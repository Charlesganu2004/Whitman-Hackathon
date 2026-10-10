import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { LESSONS, QUESTION_SPECS, trackForMajor } from '../src/core/content.ts';
import { acknowledgeReview, applyAnswer, completeLesson, createState, getSnapshot, gradeWithRubric, maybePromote, questionSpec, refreshStreak, startSession, technicalCount } from '../src/core/engine.ts';

const startTime = Date.parse('2026-10-09T17:00:00Z');
function ready(level = 'beginner') {
  const state = createState('student', 'Student', 'student@example.com', 'America/Los_Angeles');
  Object.assign(state.snapshot.profile, { major: 'Computer Science', resumeText: 'Built a JavaScript research project with a student team.', placementComplete: true, level });
  return state;
}

test('major tracks and time-dependent daily counts cover requested careers', () => {
  assert.equal(trackForMajor('Computer Science'), 'software');
  assert.equal(trackForMajor('Economics'), 'business');
  assert.equal(trackForMajor('English'), 'humanities');
  assert.equal(trackForMajor('Nursing'), 'health');
  for (const level of ['beginner', 'intermediate', 'advanced']) {
    for (const minutes of [5, 15, 30, 60]) {
      const state = ready(level); state.snapshot.profile.minutes = minutes;
      const count = technicalCount(state.snapshot.profile);
      assert.ok(count >= 4 && count <= 6);
    }
  }
  assert.equal(technicalCount(ready('expert').snapshot.profile), 1);
  assert.equal(technicalCount(ready('master').snapshot.profile), 1);
  assert.ok(technicalCount({ ...ready().snapshot.profile, minutes: 30 }) > technicalCount({ ...ready().snapshot.profile, minutes: 5 }));
  assert.equal(technicalCount({ ...ready().snapshot.profile, minutes: 10 }), 4);
  assert.equal(technicalCount({ ...ready().snapshot.profile, minutes: 15 }), 5);
  assert.equal(technicalCount({ ...ready().snapshot.profile, minutes: 20 }), 5);
  assert.equal(technicalCount({ ...ready().snapshot.profile, minutes: 30 }), 6);
});

test('each track has enough original questions and distinct replacements', () => {
  assert.equal(new Set(QUESTION_SPECS.map(spec => spec.question.id)).size, QUESTION_SPECS.length);
  assert.equal(QUESTION_SPECS.length, 72);
  for (const major of ['Computer Science', 'Economics', 'English', 'Nursing']) {
    const state = ready(); state.snapshot.profile.major = major; state.snapshot.profile.minutes = 30;
    startSession(state, 'daily', 'session', startTime);
    const session = state.snapshot.activeSession;
    assert.equal(session.technicalCount, 6);
    assert.equal(session.behavioralCount, 2);
    const first = session.questions[0];
    const bad = gradeWithRubric(first, 'I do not know.');
    applyAnswer(state, 'session', first.id, 'I do not know.', bad, startTime + 60_000);
    assert.equal(session.status, 'review');
    assert.throws(() => applyAnswer(state, 'session', session.questions[1].id, 'skip', bad, startTime + 60_001), /acknowledge/);
    acknowledgeReview(state, 'session', first.id);
    assert.notEqual(session.questions[0].id.split('~')[0], first.id.split('~')[0]);
    assert.equal(session.questions[0].kind, first.kind);
    assert.equal(session.index, 0);
    assert.equal(state.snapshot.stats.unlockedUntil, null);
  }
});

test('expert daily uses one hard technical question and two behavioral questions', () => {
  for (const level of ['expert', 'master']) {
    const state = ready(level);
    startSession(state, 'daily', 'session', startTime);
    const session = state.snapshot.activeSession;
    assert.equal(session.questions.length, 3);
    assert.equal(session.questions[0].difficulty, 'expert');
    assert.equal(session.questions.filter(question => question.kind === 'behavioral').length, 2);
    for (let retry = 0; retry < 10; retry++) {
      const current = session.questions[0];
      applyAnswer(state, 'session', current.id, 'I do not know.', gradeWithRubric(current, 'I do not know.'), startTime + (retry + 1) * 30_000);
      acknowledgeReview(state, 'session', current.id);
      assert.equal(session.questions[0].difficulty, 'expert');
      assert.notEqual(session.questions[0].id.split('~')[0], current.id.split('~')[0]);
    }
  }
});

test('rubric rejects tiny answers and keyword stuffing', () => {
  for (const spec of QUESTION_SPECS) {
    assert.equal(gradeWithRubric(spec.question, 'yes').passed, false, spec.question.id);
    const stuffing = Array(30).fill(spec.question.hints.join(' ')).join(' ');
    assert.equal(gradeWithRubric(spec.question, stuffing).passed, false, spec.question.id);
  }
});

test('all worked examples meet their declared rubrics', () => {
  for (const spec of QUESTION_SPECS) {
    const feedback = gradeWithRubric(spec.question, spec.example);
    assert.equal(feedback.passed, true, `${spec.question.id}: ${feedback.improvements.join('; ')}`);
  }
});

test('behavioral rubric recognizes a shipped result without a literal outcome label', () => {
  const question = QUESTION_SPECS.find(spec => spec.question.id === 'behavior-deadline').question;
  const answer = 'During finals week, our campus registration demo and two class assignments had competing deadlines. My task was to finish the core booking flow without losing test coverage. I prioritized the SQL duplicate-booking fix by impact and deadline, wrote a short checklist, and asked teammates to own the documentation and frontend polish. I communicated the tradeoff to the organizer: postpone calendar animations and deliver reliable registration first. We reviewed progress each day, tested conflicts, and shipped the demo on time with fewer duplicate registrations. I learned to make scope decisions early and communicate what will be deferred rather than promise everything. Next time I would reserve a buffer for integration work before the deadline.';
  assert.equal(gradeWithRubric(question, answer).passed, true);
});

test('local code checks reject wrong returns, accumulation and empty/all-negative behavior', () => {
  const sum = QUESTION_SPECS.find(spec => spec.question.id === 'sw-positive-sum');
  for (const answer of [
    sum.example.replace('return total;', 'return 999;'),
    sum.example.replace('return total;', 'return values;'),
    sum.example.replace('let total = 0;', 'let total = 5;'),
    sum.example.replace('total += value;', 'total += 999;'),
    sum.example.replace('value > 0', 'value < 0'),
    sum.example.replace('return total;', 'return\n total;'),
    sum.example.replace('return total;', 'return /*\n*/ total;'),
    `async ${sum.example}`,
  ]) assert.equal(gradeWithRubric(sum.question, answer).passed, false);
  const unique = QUESTION_SPECS.find(spec => spec.question.id === 'sw-unique');
  assert.equal(gradeWithRubric(unique.question, unique.example.replace('return [...new Set(values)];', 'const seen = new Set(values); return values;')).passed, false);
  assert.equal(gradeWithRubric(unique.question, unique.example.replaceAll('values', 'Set')).passed, false);
  assert.equal(gradeWithRubric(unique.question, unique.example.replace('return [...new Set(values)];', 'return Array.from(new Set(values));').replaceAll('values', 'Array')).passed, false);
  assert.equal(gradeWithRubric(unique.question, unique.example.replace('return ', 'return\n ')).passed, false);
  const reduction = 'function sumPositive(values) { return values.reduce((total, value) => total + (value > 0 ? value : 0), 0); } Zero is excluded because it is not positive. Empty input returns the initial zero, as does all-negative input. Each number is visited once, so the time is O(n), which is linear.';
  assert.equal(gradeWithRubric(sum.question, reduction).passed, true);
  assert.equal(gradeWithRubric(sum.question, reduction.replace(') =>', ')\n=>')).passed, false);
  assert.equal(gradeWithRubric(sum.question, reduction.replace(') =>', ') /*\n*/ =>')).passed, false);
  for (const separator of ['\r', '\u2028', '\u2029']) assert.equal(gradeWithRubric(sum.question, sum.example.replace('return total;', `return${separator} total;`)).passed, false);
  const invalidCode = sum.example.replaceAll('values', 'const');
  assert.throws(() => new Script(invalidCode.slice(0, invalidCode.indexOf(' Zero is'))), /Unexpected token/);
  assert.equal(gradeWithRubric(sum.question, invalidCode).passed, false);
  for (const identifier of ['const', 'return', 'await', 'let', 'arguments', 'eval']) {
    assert.equal(gradeWithRubric(sum.question, sum.example.replaceAll('total', identifier)).passed, false);
    assert.equal(gradeWithRubric(sum.question, sum.example.replace(/\bvalue\b/g, identifier)).passed, false);
  }
});

test('local code checks require a standalone declaration outside literals and dead code', () => {
  for (const id of ['sw-positive-sum', 'sw-unique']) {
    const spec = QUESTION_SPECS.find(item => item.question.id === id);
    const boundary = spec.example.indexOf(id === 'sw-unique' ? ' A Set' : ' Zero is');
    const code = spec.example.slice(0, boundary);
    const explanation = spec.example.slice(boundary);
    const name = id === 'sw-unique' ? 'unique' : 'sumPositive';
    for (const answer of [
      `const unusedText = \`${code}\`;${explanation}`,
      `const unusedText = ${JSON.stringify(code)};${explanation}`,
      `const unusedText = '${code}';${explanation}`,
      `const unusedText = \`escaped \\\` ${code}\`;${explanation}`,
      `/* ${code} */${explanation}`,
      `// ${code}\n${explanation}`,
      `if (false) { ${code} }${explanation}`,
      `function wrapper() { ${code} }${explanation}`,
      `const unused = ${code};${explanation}`,
      `void ${code};${explanation}`,
      `throw new Error(); ${code}${explanation}`,
      `${code} throw new Error();${explanation}`,
      `${code} ${name} = () => 999;${explanation}`,
      `${code} ${name} ||= () => 999;${explanation}`,
      `${code} const Set = class { constructor() { return [999]; } };${explanation}`,
      `${code} Set.prototype.add = () => undefined;${explanation}`,
      `${code} Set.prototype.add = null;${explanation}`,
      `${code} delete Set.prototype.add;${explanation}`,
      `${code} Reflect.deleteProperty(Set.prototype, 'add');${explanation}`,
      `${code} Reflect['deleteProperty'] (Set.prototype, 'add');${explanation}`,
      `${code} Set.prototype.add++;${explanation}`,
      `${code} mutate();${explanation}`,
      `${code} mutate(new Set);${explanation}`,
      `${code} mutate(typeof Set);${explanation}`,
      `${code} mutate(value in Set);${explanation}`,
      `\`\`\`javascript\nif (false) { ${code} }\n\`\`\`${explanation}`,
      `\`\`\`javascript\n${code}\nthrow new Error();\n\`\`\`${explanation}`,
    ]) {
      const feedback = gradeWithRubric(spec.question, answer);
      assert.equal(feedback.passed, false, `${id}: ${answer}`);
      assert.ok(feedback.improvements.includes(spec.criteria[1].label), id);
    }
    for (const answer of [
      `/* function ${name}(unused) { return 999; } */\n${spec.example}`,
      `// A standalone function follows.\n${spec.example}`,
      `\`\`\`javascript\n${code}\n\`\`\`${explanation}`,
      `\`\`\`js\n${code};\n\`\`\`${explanation}`,
      `${code} A quoted counterexample is \`${code}\`.${explanation}`,
      `${code} This function returns its result without changing the input.${explanation}`,
    ]) assert.equal(gradeWithRubric(spec.question, answer).passed, true, `${id}: ${answer}`);
  }
  const unique = QUESTION_SPECS.find(spec => spec.question.id === 'sw-unique');
  for (const prefix of ['const Set = class { constructor() { return [999]; } }; ', 'let Array = {}; ']) {
    assert.equal(gradeWithRubric(unique.question, prefix + unique.example).passed, false);
  }
  assert.equal(gradeWithRubric(unique.question, unique.example.replace('A Set stores values', 'A Set (which stores distinct values) stores values')).passed, true);
  assert.equal(gradeWithRubric(unique.question, unique.example.replace('in insertion order', 'in insertion order (in original order)')).passed, true);
  const sum = QUESTION_SPECS.find(spec => spec.question.id === 'sw-positive-sum');
  for (const accumulator of ['Set', 'Array']) {
    assert.equal(gradeWithRubric(sum.question, sum.example.replaceAll('total', accumulator)).passed, true);
  }
});

test('checkpoint questions assess the current level and do not grant daily credit', () => {
  const state = ready('intermediate');
  state.snapshot.profile.targetCompanies = ['Example Company'];
  startSession(state, 'checkpoint', 'checkpoint', startTime);
  const session = state.snapshot.activeSession;
  assert.equal(session.technicalCount, 2);
  assert.equal(session.questions.filter(question => question.kind === 'technical' && question.difficulty === 'intermediate').length, 2);
  assert.equal(session.questions.filter(question => question.kind === 'behavioral').length, 2);
  assert.match(session.questions[0].prompt, /Example Company/);
  assert.match(session.questions[0].prompt, /not an exact or proprietary question/);
  let timestamp = startTime;
  while (session.status !== 'completed') {
    const question = session.questions[session.index];
    timestamp += 30_000;
    applyAnswer(state, session.id, question.id, 'I do not know.', gradeWithRubric(question, 'I do not know.'), timestamp);
    if (session.status !== 'completed') assert.equal(session.status, 'active');
  }
  assert.equal(state.snapshot.profile.level, 'intermediate');
  assert.equal(state.dailyResults.length, 0);
  assert.equal(getSnapshot(state, timestamp).stats.todaySessions, 0);
  assert.equal(state.snapshot.stats.unlockedUntil, null);
});

test('local behavioral guidance gives four STAR actions without invented achievements', () => {
  const question = QUESTION_SPECS.find(spec => spec.question.id === 'behavior-teamwork').question;
  const feedback = gradeWithRubric(question, 'I worked hard.');
  assert.deepEqual(Object.keys(feedback.star), ['situation', 'task', 'action', 'result']);
  assert.match(feedback.star.task, /personally/);
  assert.match(feedback.star.result, /observable/);
  assert.equal(feedback.passed, false);
});

test('review acknowledgement cannot be replayed to replace a passing question', () => {
  const state = ready();
  startSession(state, 'daily', 'session', startTime);
  const first = state.snapshot.activeSession.questions[0];
  applyAnswer(state, 'session', first.id, 'bad', gradeWithRubric(first, 'bad'), startTime + 45_000);
  acknowledgeReview(state, 'session', first.id);
  assert.throws(() => acknowledgeReview(state, 'session', first.id), /no feedback/);
  const replacement = state.snapshot.activeSession.questions[0];
  const answer = questionSpec(replacement).example;
  applyAnswer(state, 'session', replacement.id, answer, gradeWithRubric(replacement, answer), startTime + 90_000);
  assert.equal(state.snapshot.activeSession.index, 1);
  assert.equal(state.snapshot.stats.answers, 2);
});

test('streak counts unique local study dates and resets after a gap', () => {
  const state = ready();
  state.snapshot.stats.activity = [{ date: '2026-10-07', count: 5 }, { date: '2026-10-08', count: 2 }, { date: '2026-10-09', count: 10 }];
  refreshStreak(state, startTime);
  assert.equal(state.snapshot.stats.streak, 3);
  refreshStreak(state, startTime + 86_400_000);
  assert.equal(state.snapshot.stats.streak, 3);
  refreshStreak(state, startTime + 2 * 86_400_000);
  assert.equal(state.snapshot.stats.streak, 0);
  assert.equal(state.snapshot.stats.bestStreak, 3);
});

test('promotion requires evaluated lessons and successful sessions on two dates', () => {
  const state = ready('expert');
  const lessons = LESSONS.filter(lesson => lesson.level === 'expert');
  for (const lesson of lessons) {
    state.lessonStarted[lesson.id] = startTime;
    const wrong = completeLesson(state, lesson.id, (lesson.check.correct + 1) % lesson.check.choices.length, startTime + 20_000);
    assert.equal(wrong.feedback.passed, false);
    assert.equal(state.snapshot.profile.completedLessonIds.includes(lesson.id), false);
    completeLesson(state, lesson.id, lesson.check.correct, startTime + 21_000);
  }
  maybePromote(state);
  assert.equal(state.snapshot.profile.level, 'expert');
  state.dailyResults.push({ level: 'expert', accuracy: 100, date: '2026-10-08' }, { level: 'expert', accuracy: 100, date: '2026-10-08' });
  maybePromote(state);
  assert.equal(state.snapshot.profile.level, 'expert');
  state.dailyResults.push({ level: 'expert', accuracy: 100, date: '2026-10-09' });
  maybePromote(state);
  assert.equal(state.snapshot.profile.level, 'master');
});

test('a paused daily session keeps its assessed level after lesson promotion', () => {
  const state = ready('beginner');
  const lessons = LESSONS.filter(lesson => lesson.level === 'beginner');
  state.snapshot.profile.completedLessonIds = [lessons[0].id];
  state.dailyResults = [{ level: 'beginner', accuracy: 100, date: '2026-10-07' }, { level: 'beginner', accuracy: 100, date: '2026-10-08' }];
  startSession(state, 'daily', 'paused-session', startTime);
  const session = state.snapshot.activeSession;
  state.lessonStarted[lessons[1].id] = startTime;
  completeLesson(state, lessons[1].id, lessons[1].check.correct, startTime + 20_000);
  assert.equal(state.snapshot.profile.level, 'intermediate');
  assert.equal(session.status, 'active');
  let timestamp = startTime + 20_000;
  while (session.status !== 'completed') {
    const question = session.questions[session.index];
    const answer = questionSpec(question).example;
    timestamp += 60_000;
    applyAnswer(state, session.id, question.id, answer, gradeWithRubric(question, answer), timestamp);
  }
  assert.equal(state.dailyResults.at(-1).level, 'beginner');
  assert.equal(state.dailyResults.filter(result => result.level === 'intermediate').length, 0);
  assert.equal(state.snapshot.profile.level, 'intermediate');
});

test('roadmap counts qualifying current-level dates and completed level lessons', () => {
  const state = ready('expert');
  const lessons = LESSONS.filter(lesson => lesson.level === 'expert');
  state.snapshot.profile.completedLessonIds = ['beginner-star', lessons[0].id];
  state.dailyResults = [
    { level: 'advanced', accuracy: 100, date: '2026-10-07' },
    { level: 'expert', accuracy: 50, date: '2026-10-07' },
    { level: 'expert', accuracy: 100, date: '2026-10-08' },
    { level: 'expert', accuracy: 85, date: '2026-10-08' },
  ];
  let stats = getSnapshot(state, startTime).stats;
  assert.equal(stats.levelPracticeDays, 1);
  assert.equal(stats.levelPracticeRequired, 2);
  assert.equal(stats.levelLessonsCompleted, 1);
  assert.equal(stats.levelLessonsRequired, 2);
  assert.equal(stats.todaySessions, 0);
  state.dailyResults.push({ level: 'expert', accuracy: 100, date: '2026-10-09' });
  state.snapshot.profile.completedLessonIds.push(lessons[1].id);
  stats = getSnapshot(state, startTime).stats;
  assert.equal(stats.levelPracticeDays, 2);
  assert.equal(stats.levelLessonsCompleted, 2);
  maybePromote(state);
  assert.equal(state.snapshot.profile.level, 'master');
});
