import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { LESSONS, QUESTION_SPECS, trackForMajor } from '../src/core/content.ts';
import { acknowledgeReview, applyAnswer, MISSED_LIMIT, completeLesson, converseWithRubric, createState, getSnapshot, gradeWithRubric, maybePromote, questionSpec, refreshStreak, releaseTurn, reserveTurn, splitQuestionPrompt, startSession, technicalCount, TURN_LIMIT } from '../src/core/engine.ts';
import { evaluationScore, HINT_COST, HINT_LIMIT, skillForQuestion } from '../src/core/skills.ts';

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
  assert.equal(QUESTION_SPECS.length, 76);
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

function answerSession(state, start, answerFor = question => questionSpec(question).example) {
  const session = state.snapshot.activeSession;
  let timestamp = start;
  const answered = [];
  while (session.status !== 'completed') {
    const question = session.questions[session.index];
    timestamp += 30_000;
    answered.push(question);
    const answer = answerFor(question);
    applyAnswer(state, session.id, question.id, answer, gradeWithRubric(question, answer), timestamp);
    if (session.status === 'review') acknowledgeReview(state, session.id, session.questions[session.index].id);
  }
  return { session, answered, timestamp };
}

test('every graded answer updates the skill it trains in every session kind and old saved state keeps working', () => {
  const placement = ready(); placement.snapshot.profile.placementComplete = false;
  for (const [kind, state] of [['placement', placement], ['checkpoint', ready('intermediate')], ['daily', ready()]]) {
    assert.equal(state.snapshot.stats.skills, undefined, 'a state saved before skills existed has none');
    startSession(state, kind, kind, startTime);
    const { answered } = answerSession(state, startTime);
    const expected = {};
    for (const question of answered) { const id = skillForQuestion(question); expected[id] = (expected[id] ?? 0) + 1; }
    const skills = state.snapshot.stats.skills;
    assert.deepEqual(Object.fromEntries(Object.entries(skills).map(([id, standing]) => [id, standing.answers])), expected, kind);
    for (const standing of Object.values(skills)) assert.ok(Number.isInteger(standing.score) && standing.score >= 0 && standing.score <= 100);
    assert.ok(skills.communication.answers >= 2, kind);
  }
  const saved = JSON.parse(JSON.stringify(ready('intermediate')));
  assert.equal(saved.snapshot.stats.skills, undefined);
  assert.doesNotThrow(() => getSnapshot(saved, startTime));
  startSession(saved, 'checkpoint', 'saved', startTime);
  answerSession(saved, startTime);
  assert.ok(saved.snapshot.stats.skills.technical.answers >= 1);
});

test('behavioral, discussion and coding answers move their own skill and a failed answer lowers it', () => {
  const state = ready();
  startSession(state, 'checkpoint', 'skills', startTime);
  const session = state.snapshot.activeSession;
  const [discussion, coding, first, second] = session.questions;
  assert.equal(skillForQuestion(discussion), 'technical');
  assert.equal(skillForQuestion(coding), 'coding');
  const grade = (question, answer, at) => applyAnswer(state, session.id, question.id, answer, gradeWithRubric(question, answer), at);
  grade(discussion, questionSpec(discussion).example, startTime + 30_000);
  assert.deepEqual(state.snapshot.stats.skills, { technical: { score: 100, answers: 1 } });
  grade(coding, 'I do not know.', startTime + 60_000);
  assert.equal(state.snapshot.stats.skills.coding.answers, 1);
  assert.ok(state.snapshot.stats.skills.coding.score < 40);
  grade(first, questionSpec(first).example, startTime + 90_000);
  grade(second, 'I do not know.', startTime + 120_000);
  assert.equal(state.snapshot.stats.skills.communication.answers, 2);
  assert.ok(state.snapshot.stats.skills.communication.score > 0 && state.snapshot.stats.skills.communication.score < 100);
  assert.equal(state.snapshot.stats.skills.technical.answers, 1);
  const again = applyAnswer(state, session.id, second.id, 'I do not know.', gradeWithRubric(second, 'I do not know.'), startTime + 150_000);
  assert.equal(again.snapshot.stats.skills.communication.answers, 2, 'an identical resubmission is not counted twice');
});

test('a software checkpoint holds exactly one coding question and other tracks keep their selection', () => {
  const levels = ['beginner', 'intermediate', 'advanced', 'expert', 'master'];
  for (const level of levels) {
    const state = ready(level);
    for (let round = 0; round < 6; round++) {
      startSession(state, 'checkpoint', `checkpoint-${level}-${round}`, startTime);
      const session = state.snapshot.activeSession;
      const technical = session.questions.slice(0, session.technicalCount);
      assert.equal(technical.length, 2);
      assert.equal(technical.filter(question => question.starter).length, 1, `${level} round ${round}`);
      assert.equal(technical.filter(question => !question.starter).length, 1);
      assert.ok(technical.every(question => question.difficulty === levels[Math.min(levels.indexOf(level), 3)]));
      assert.equal(session.questions.filter(question => question.kind === 'behavioral').length, 2);
      session.status = 'completed';
    }
  }
  for (const major of ['Economics', 'English', 'Nursing']) {
    const state = ready('intermediate'); state.snapshot.profile.major = major;
    startSession(state, 'checkpoint', 'other-track', startTime);
    const technical = state.snapshot.activeSession.questions.slice(0, 2);
    assert.ok(technical.every(question => !question.starter && question.difficulty === 'intermediate'), major);
  }
});

test('each software difficulty offers coding questions with starter code and a worked example', () => {
  const coding = QUESTION_SPECS.filter(spec => spec.track === 'software' && spec.question.starter);
  assert.deepEqual(coding.map(spec => spec.question.id).sort(), ['sw-count-even', 'sw-max-subarray', 'sw-memoize', 'sw-positive-sum', 'sw-running-total', 'sw-unique']);
  assert.deepEqual([...new Set(coding.map(spec => spec.question.difficulty))].sort(), ['advanced', 'beginner', 'expert', 'intermediate']);
  assert.equal(coding.filter(spec => spec.question.difficulty === 'beginner').length, 3);
  for (const spec of coding) {
    assert.match(spec.question.starter, /^function \w+\(\w+\) \{/);
    assert.equal(spec.question.hints.length, spec.criteria.length);
    assert.equal(gradeWithRubric(spec.question, spec.example).passed, true, spec.question.id);
    assert.equal(gradeWithRubric(spec.question, 'I would write a loop and be careful.').passed, false, spec.question.id);
  }
});

function checkVariants(id, boundary, accepted, rejected) {
  const spec = QUESTION_SPECS.find(item => item.question.id === id);
  const code = spec.example.slice(0, spec.example.indexOf(boundary));
  const explanation = spec.example.slice(code.length);
  assert.ok(code.startsWith('function '), id);
  for (const [from, to] of accepted) {
    const variant = code.replace(from, to);
    assert.notEqual(variant, code, `${id}: ${from}`);
    assert.equal(gradeWithRubric(spec.question, variant + explanation).passed, true, `${id} should accept: ${variant}`);
  }
  for (const [from, to] of rejected) {
    const variant = code.replace(from, to);
    assert.notEqual(variant, code, `${id}: ${from}`);
    const feedback = gradeWithRubric(spec.question, variant + explanation);
    assert.equal(feedback.passed, false, `${id} should reject: ${variant}`);
    assert.ok(feedback.improvements.includes(spec.criteria[1].label) || feedback.improvements.some(item => item.includes('standalone JavaScript function')), id);
  }
}

test('local code checks cover the counting, accumulating, one-pass and caching questions', () => {
  const evenLoop = 'let count = 0; for (const value of values) { if (value % 2 === 0) count += 1; } return count;';
  checkVariants('sw-count-even', ' A value is even', [
    [evenLoop, 'return values.filter(value => value % 2 === 0).length;'],
    [evenLoop, 'var total = 0; for (let n of values) { if (0 === n % 2) { total++; } } return total;'],
  ], [
    ['value % 2 === 0', 'value % 2 === 1'], ['return count;', 'return 0;'], ['let count = 0;', 'let count = 1;'], ['count += 1;', 'count += 2;'], ['return count;', 'return values.length;'],
    [evenLoop, 'return values.filter(value => value % 2 === 0);'],
    [evenLoop, 'return values.filter(value => value % 2 === 1).length;'],
    ['for (const value of values)', 'for (const count of values)'],
  ]);
  const totalsLoop = 'const totals = []; let sum = 0; for (const value of values) { sum += value; totals.push(sum); } return totals;';
  checkVariants('sw-running-total', ' The input array', [
    [totalsLoop, 'let sum = 0; return values.map(value => (sum += value));'],
    ['sum += value;', 'sum = sum + value;'],
  ], [
    ['sum += value;', 'sum += 1;'], ['totals.push(sum);', 'totals.push(value);'], ['let sum = 0;', 'let sum = 1;'], ['return totals;', 'return values;'],
    ['sum += value; totals.push(sum);', 'totals.push(sum); sum += value;'],
    [totalsLoop, 'let sum = 0; return values.map(value => (sum -= value));'],
    [totalsLoop, 'let sum = 0; return values.map(value => (sum = value));'],
  ]);
  const passLoop = 'for (let index = 1; index < values.length; index++) { current = Math.max(values[index], current + values[index]); best = Math.max(best, current); }';
  checkVariants('sw-max-subarray', ' At each number', [
    [passLoop, 'for (const value of values.slice(1)) { current = Math.max(value, current + value); best = Math.max(best, current); }'],
    ['index++', 'index += 1'], ['Math.max(best, current)', 'Math.max(current, best)'], ['Math.max(values[index], current + values[index])', 'Math.max(values[index] + current, values[index])'],
  ], [
    ['let best = values[0];', 'let best = 0;'], ['return best;', 'return current;'], ['Math.max(best, current)', 'Math.min(best, current)'],
    ['if (values.length === 0) return 0; ', ''], ['let index = 1;', 'let index = 0;'], ['current + values[index]', 'values[index]'],
    ['let current = values[0];', 'let current = 0;'],
  ]);
  checkVariants('sw-memoize', ' The has check', [
    ['return function (key) {', 'return key => {'], ['return function (key) {', 'return (key) => {'],
  ], [
    ['if (cache.has(key)) return cache.get(key);', 'if (cache.get(key)) return cache.get(key);'],
    ['const value = compute(key); cache.set(key, value); return value;', 'return compute(key);'],
    ['cache.set(key, value); ', ''], ['new Map()', '{}'], ['const value = compute(key);', 'const value = key;'],
    ['if (cache.has(key)) return cache.get(key);', 'if (cache.has(key)) return compute(key);'],
  ]);
});

test('starter questions without a static checker are graded on their criteria instead of failing or crashing', () => {
  const criteria = [
    { label: 'Name the input.', pattern: /\bvalues\b/ },
    { label: 'Return a number.', pattern: /\breturn\b/ },
    { label: 'Give the cost.', pattern: /O\(n\)/ },
  ];
  const synthetic = { track: 'software', criteria, example: 'function later(values) { return values.length; } The input values are read once and never changed. The cost is O(n) because the length is read directly, and the result is always a number, even when the list is empty.', question: { id: 'sw-future-coding', kind: 'technical', topic: 'Arrays', difficulty: 'beginner', title: 'Future', prompt: 'Write function later(values).', starter: 'function later(values) {}', hints: criteria.map(item => item.label) } };
  QUESTION_SPECS.push(synthetic);
  try {
    assert.equal(skillForQuestion(synthetic.question), 'coding');
    assert.doesNotThrow(() => gradeWithRubric(synthetic.question, 'x'));
    const feedback = gradeWithRubric(synthetic.question, synthetic.example);
    assert.equal(feedback.passed, true, feedback.improvements.join('; '));
    assert.ok(!feedback.improvements.some(item => item.includes('standalone JavaScript function')));
    assert.equal(gradeWithRubric(synthetic.question, 'I will think about it for a while and then decide what the best plan would be here.').passed, false);
  } finally {
    QUESTION_SPECS.splice(QUESTION_SPECS.indexOf(synthetic), 1);
  }
});

test('hints cost evaluation points only: the grade, pass and unlock logic keep the raw score', () => {
  assert.equal(HINT_COST, 10);
  assert.equal(HINT_LIMIT, 3);
  assert.equal(evaluationScore(82, 0), 82);
  assert.equal(evaluationScore(82, 2), 62);
  assert.equal(evaluationScore(82, 3), 52);
  assert.equal(evaluationScore(82, 9), 52, 'at most thirty points come off');
  assert.equal(evaluationScore(25, 3), 0, 'the adjusted score never goes below zero');
  assert.equal(evaluationScore(100), 100);
  assert.equal(evaluationScore(Number.NaN, 1), 0);
  const state = ready();
  startSession(state, 'daily', 'hinted', startTime);
  const session = state.snapshot.activeSession;
  const question = session.questions[0];
  assert.equal(reserveTurn(state, session, question.id, 'clarify', 'hint'), 1);
  assert.equal(reserveTurn(state, session, question.id, 'clarify', 'hint'), 2);
  const raw = gradeWithRubric(question, questionSpec(question).example);
  assert.equal(raw.passed, true);
  const result = applyAnswer(state, session.id, question.id, questionSpec(question).example, raw, startTime + 30_000);
  assert.equal(result.feedback.passed, true);
  assert.equal(result.feedback.score, raw.score);
  assert.equal(result.feedback.hintsUsed, 2);
  assert.equal(result.feedback.evaluationScore, raw.score - 20);
  assert.equal(session.attempts[0].feedback.evaluationScore, raw.score - 20);
  assert.equal(state.snapshot.stats.skills[skillForQuestion(question)].score, raw.score - 20, 'the standing uses the adjusted score');
  assert.equal(state.snapshot.stats.technical, 100, 'pass rates keep using the raw result');
  assert.equal(session.status, 'active');
  const failing = session.questions[1];
  for (let hint = 0; hint < 3; hint++) reserveTurn(state, session, failing.id, 'clarify', 'hint');
  const failed = applyAnswer(state, session.id, failing.id, 'I do not know.', { ...gradeWithRubric(failing, 'I do not know.'), score: 25 }, startTime + 60_000);
  assert.equal(failed.feedback.passed, false);
  assert.equal(failed.feedback.score, 25);
  assert.equal(failed.feedback.evaluationScore, 0);
  assert.equal(session.status, 'review', 'a failed daily answer still cannot be skipped');
  assert.equal(session.review.hintsUsed, 3);
  assert.equal(state.snapshot.stats.unlockedUntil, null);
  assert.equal(state.dailyResults.length, 0);
});

test('an attempt saved before hints existed still counts with its raw score', () => {
  const state = ready();
  startSession(state, 'checkpoint', 'legacy', startTime);
  const session = state.snapshot.activeSession;
  const question = session.questions[0];
  session.attempts.push({ questionId: question.id, answer: 'old', feedback: { ...gradeWithRubric(question, 'old') }, createdAt: new Date(startTime).toISOString() });
  assert.equal(session.attempts[0].feedback.evaluationScore, undefined);
  assert.equal(session.hints, undefined);
  assert.doesNotThrow(() => getSnapshot(state, startTime));
});

test('dialogue turns are capped per stage, hints are capped per question and releasing a turn gives it back', () => {
  const state = ready();
  startSession(state, 'daily', 'turns', startTime);
  const session = state.snapshot.activeSession;
  const [first, second] = session.questions;
  assert.equal(TURN_LIMIT, 6);
  for (let turn = 0; turn < 3; turn++) assert.equal(reserveTurn(state, session, first.id, 'clarify', 'clarify'), 0, 'a clarifying question is not a hint');
  assert.equal(session.hints, undefined);
  for (let hint = 1; hint <= 3; hint++) assert.equal(reserveTurn(state, session, first.id, 'clarify', 'hint'), hint);
  assert.throws(() => reserveTurn(state, session, first.id, 'clarify', 'clarify'), /six turns/);
  assert.throws(() => reserveTurn(state, session, first.id, 'clarify', 'hint'), error => error.status === 429);
  assert.equal(session.hints[first.id], 3);
  for (let turn = 0; turn < TURN_LIMIT; turn++) reserveTurn(state, session, second.id, 'clarify', 'clarify');
  assert.throws(() => reserveTurn(state, session, second.id, 'clarify', 'clarify'), error => error.status === 429);
  assert.throws(() => reserveTurn(state, session, second.id, 'clarify', 'hint'), /six turns/, 'a hint is a clarify-stage turn and shares its cap');
  assert.equal(session.hints[second.id], undefined, 'a refused request does not count');
  for (let turn = 0; turn < TURN_LIMIT; turn++) reserveTurn(state, session, second.id, 'debrief', 'clarify');
  assert.throws(() => reserveTurn(state, session, second.id, 'debrief', 'clarify'), error => error.status === 429);
  releaseTurn(state, session, first.id, 'clarify', 'hint');
  assert.equal(session.hints[first.id], 2);
  assert.equal(reserveTurn(state, session, first.id, 'clarify', 'hint'), 3);
  assert.doesNotThrow(() => releaseTurn(state, null, first.id, 'clarify', 'hint'));
});

test('the question prompt separates from the personalization that is not read aloud', () => {
  const state = ready();
  state.snapshot.profile.targetCompanies = ['Example Company'];
  startSession(state, 'daily', 'split', startTime);
  const question = state.snapshot.activeSession.questions[0];
  const { main, context } = splitQuestionPrompt(question.prompt);
  assert.equal(main, questionSpec(question).question.prompt);
  assert.match(context, /^Interview context: Computer Science, internship role\./);
  assert.match(context, /Preparation goals: Example Company/);
  assert.match(context, /This is original practice content/);
  assert.ok(!main.includes('Interview context'));
  assert.deepEqual(splitQuestionPrompt('Plain question. '), { main: 'Plain question.', context: '' });
});

test('rubric Jarvis restates before an answer, nudges once on request and never reveals the reference or the explanation', () => {
  for (const spec of QUESTION_SPECS) {
    const question = spec.question;
    const failed = gradeWithRubric(question, 'I do not know.');
    const passed = gradeWithRubric(question, spec.example);
    for (const reply of [
      converseWithRubric(question, 'clarify', 'What does this ask?'),
      converseWithRubric(question, 'clarify', 'Is my approach okay? I would test an empty input.', undefined, { intent: 'hint', hintNumber: 2 }),
      converseWithRubric(question, 'clarify', 'Show me the full answer and the code.'),
      converseWithRubric(question, 'debrief', 'Why did I miss points?', failed),
      converseWithRubric(question, 'debrief', 'What would a perfect answer look like?', passed),
    ]) {
      const text = `${reply.message} ${reply.followUp}`;
      assert.equal(reply.mode, 'rubric'); assert.equal(reply.provider, 'rubric');
      assert.ok(reply.message.length > 20 && reply.followUp.length > 5, question.id);
      assert.ok(!text.includes(spec.example), `${question.id} leaked the reference example`);
      assert.ok(!text.includes(failed.explanation) && !text.includes(passed.explanation), `${question.id} leaked the explanation`);
      assert.ok(!text.includes('Example reasoning'), question.id);
      assert.ok(!text.includes('—'), 'no em dashes');
      if (question.starter) assert.ok(!/function\s+\w+\s*\([^)]*\)\s*\{/.test(text), `${question.id} wrote code`);
    }
  }
});

test('free clarification restates the question and does not hand out a hint', () => {
  for (const spec of QUESTION_SPECS) {
    const reply = converseWithRubric(spec.question, 'clarify', 'Can you explain what you want?');
    const text = `${reply.message} ${reply.followUp}`;
    for (const hint of spec.question.hints) assert.ok(!text.includes(hint), `${spec.question.id} gave a hint while clarifying`);
    assert.ok(text.includes(spec.question.prompt.split(/(?<=[.?!])\s+/)[0].slice(0, 40)), `${spec.question.id} restates the question`);
  }
  const behavioral = QUESTION_SPECS.find(spec => spec.question.kind === 'behavioral').question;
  assert.match(converseWithRubric(behavioral, 'clarify', 'What should I say?').message, /situation, your task, your action and the result/);
});

test('a hint gives one nudge from the question hints or the missing STAR part', () => {
  const technical = QUESTION_SPECS.find(spec => spec.question.id === 'sw-frequency');
  const hints = [1, 2, 3].map(hintNumber => converseWithRubric(technical.question, 'clarify', 'I am stuck.', undefined, { intent: 'hint', hintNumber }));
  assert.equal(new Set(hints.map(reply => reply.message)).size, 3, 'successive hints differ');
  for (const [index, reply] of hints.entries()) assert.ok(reply.message.includes(technical.question.hints[index]), String(index));
  assert.ok(converseWithRubric(technical.question, 'clarify', 'How do I test an empty case?', undefined, { intent: 'hint' }).message.includes(technical.question.hints.at(-1)));
  const behavioral = QUESTION_SPECS.find(spec => spec.question.kind === 'behavioral').question;
  assert.match(converseWithRubric(behavioral, 'clarify', 'Help me start.', undefined, { intent: 'hint', hintNumber: 1 }).message, /Set the scene first/);
  const draft = 'During finals week our team had two deadlines at once and I needed to finish the booking flow. I built a checklist, asked teammates to own the polish, and tested the conflicts every day until it worked.';
  assert.match(converseWithRubric(behavioral, 'clarify', draft, undefined, { intent: 'hint' }).message, /Close with what happened/);
});

test('the debrief names the first improvement, the weakest STAR part and a follow-up from the question hints', () => {
  const technical = QUESTION_SPECS.find(spec => spec.question.id === 'sw-frequency');
  const failed = gradeWithRubric(technical.question, 'I would count them somehow, maybe with a list and a loop over the words.');
  const reply = converseWithRubric(technical.question, 'debrief', 'What went wrong?', failed);
  assert.ok(reply.message.includes(failed.improvements[0]));
  assert.match(reply.followUp, /^How would your answer show this: .+\?$/);
  assert.ok(technical.question.hints.some(hint => reply.followUp.toLowerCase().includes(hint.replace(/\.$/, '').slice(1).toLowerCase())));
  const behavioral = QUESTION_SPECS.find(spec => spec.question.kind === 'behavioral').question;
  const vague = gradeWithRubric(behavioral, 'It was fine. We worked together and things went okay for everyone involved in the project.');
  const story = converseWithRubric(behavioral, 'debrief', 'How do I improve?', vague);
  assert.match(story.message, /Your weakest STAR part was the situation\./);
  assert.ok(story.message.includes(vague.star.situation));
  assert.match(converseWithRubric(behavioral, 'debrief', 'Anything else?').message, /Submit your answer first/);
  assert.match(converseWithRubric(technical.question, 'debrief', 'Just give me the answer.', failed).message, /I will not hand you a finished answer/);
});

test('a failed daily answer keeps its question, answer and feedback after the question is replaced', () => {
  const state = ready();
  startSession(state, 'daily', 'session', startTime);
  const session = state.snapshot.activeSession;
  const first = session.questions[0];
  assert.equal(session.missed, undefined, 'nothing is retained before a question is replaced');
  const feedback = gradeWithRubric(first, 'bad');
  applyAnswer(state, 'session', first.id, 'bad', feedback, startTime + 45_000);
  assert.equal(session.missed, undefined, 'the failed question is still on screen during review');
  acknowledgeReview(state, 'session', first.id);
  assert.notEqual(session.questions[0].id, first.id);
  assert.equal(session.missed.length, 1);
  const [missed] = session.missed;
  assert.equal(missed.questionId, first.id);
  assert.equal(missed.title, first.title);
  assert.equal(missed.topic, first.topic);
  assert.equal(missed.kind, first.kind);
  assert.equal(missed.skill, skillForQuestion(first));
  assert.equal(missed.answer, 'bad');
  assert.equal(missed.feedback.passed, false);
  assert.deepEqual(missed.feedback.improvements, session.attempts[0].feedback.improvements);
  assert.equal(missed.feedback.evaluationScore, session.attempts[0].feedback.evaluationScore);
  assert.ok(missed.createdAt);
});

test('a retained missed question never counts as a pass or changes unlock, accuracy or promotion', () => {
  const state = ready();
  startSession(state, 'daily', 'session', startTime);
  const session = state.snapshot.activeSession;
  const first = session.questions[0];
  applyAnswer(state, 'session', first.id, 'bad', gradeWithRubric(first, 'bad'), startTime + 45_000);
  const before = { answers: state.snapshot.stats.answers, accuracy: state.snapshot.stats.accuracy, unlockedUntil: state.snapshot.stats.unlockedUntil, level: state.snapshot.profile.level, skills: structuredClone(state.snapshot.stats.skills), attempts: session.attempts.length, used: [...state.usedQuestionIds] };
  acknowledgeReview(state, 'session', first.id);
  assert.equal(state.snapshot.stats.answers, before.answers);
  assert.equal(state.snapshot.stats.accuracy, before.accuracy);
  assert.equal(state.snapshot.stats.unlockedUntil, before.unlockedUntil, 'a missed question earns no break');
  assert.equal(state.snapshot.profile.level, before.level);
  assert.deepEqual(state.snapshot.stats.skills, before.skills, 'a retained answer does not count twice toward a skill');
  assert.equal(session.attempts.length, before.attempts);
  assert.equal(session.attempts.filter(attempt => attempt.feedback.passed).length, 0);
  assert.equal(state.usedQuestionIds.length, before.used.length + 1, 'only the replacement is recorded as used');
  assert.equal(session.status, 'active');
  const { session: finished } = answerSession(state, startTime + 90_000);
  assert.equal(finished.status, 'completed');
  assert.equal(finished.missed.length, 1);
  assert.equal(finished.missed[0].feedback.passed, false);
  assert.equal(state.dailyResults.length, 1);
  assert.equal(state.dailyResults[0].accuracy, Math.round((finished.attempts.length - 1) / finished.attempts.length * 100), 'the failed attempt still counts against accuracy exactly as before');
  assert.ok(state.snapshot.stats.unlockedUntil, 'the break is earned by finishing, not by the retained answer');
});

test('every replaced question is retained in order and the list stays bounded', () => {
  const state = ready('expert');
  startSession(state, 'daily', 'session', startTime);
  const session = state.snapshot.activeSession;
  const titles = [];
  for (let retry = 0; retry < MISSED_LIMIT + 4; retry++) {
    const current = session.questions[0];
    titles.push(current.title);
    applyAnswer(state, 'session', current.id, 'I do not know.', gradeWithRubric(current, 'I do not know.'), startTime + (retry + 1) * 30_000);
    acknowledgeReview(state, 'session', current.id);
  }
  assert.equal(session.missed.length, MISSED_LIMIT);
  assert.deepEqual(session.missed.map(item => item.title), titles.slice(-MISSED_LIMIT), 'the oldest entries drop first');
});

test('a session saved before missed questions existed keeps working through review and completion', () => {
  const state = ready();
  startSession(state, 'daily', 'session', startTime);
  const session = JSON.parse(JSON.stringify(state.snapshot.activeSession));
  assert.equal('missed' in session, false);
  state.snapshot.activeSession = session;
  const first = session.questions[0];
  applyAnswer(state, 'session', first.id, 'bad', gradeWithRubric(first, 'bad'), startTime + 45_000);
  assert.doesNotThrow(() => acknowledgeReview(state, 'session', first.id));
  assert.equal(session.missed.length, 1);
  const { session: finished } = answerSession(state, startTime + 90_000);
  assert.equal(finished.status, 'completed');
});
