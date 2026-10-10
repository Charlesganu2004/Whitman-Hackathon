import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from '../server/app.mjs';
import { LESSONS } from '../src/core/content.ts';
import { gradeWithRubric, questionSpec } from '../src/core/engine.ts';

async function fixture(t, extra = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'interview-focus-'));
  const databasePath = join(directory, 'test.sqlite');
  let timestamp = Date.parse('2026-10-09T17:00:00Z');
  const server = createServer({ databasePath, now: () => timestamp, apiKey: '', groqApiKey: '', provider: 'rubric', speechProvider: 'rubric', rateLimit: false, logErrors: false, ...extra });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let token;
  const request = async (path, method = 'GET', body, overrideToken) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...((overrideToken ?? token) ? { Authorization: `Bearer ${overrideToken ?? token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  };
  const signup = async (email = 'student@example.com') => {
    const response = await request('/auth/signup', 'POST', { name: 'Test Student', email, password: 'correct horse battery', timeZone: 'America/Los_Angeles' });
    assert.equal(response.status, 201); token = response.body.token; return response.body.snapshot;
  };
  const configure = async (major = 'Computer Science', minutes = 30) => {
    const profile = await request('/profile', 'PUT', { major, target: 'internship', minutes, daysPerWeek: 4, unlockMinutes: 20, focusApps: ['Instagram', 'TikTok'] });
    assert.equal(profile.status, 200);
    const resume = await request('/resume', 'POST', { name: 'resume.txt', text: 'I built a JavaScript research project and volunteered with a community team. I tested an API and led project presentations.' });
    assert.equal(resume.status, 200); return resume.body;
  };
  const passAnswer = async snapshot => {
    const session = snapshot.activeSession;
    const question = session.questions[session.index];
    const answer = questionSpec(question).example;
    timestamp += 60_000;
    const result = await request(`/sessions/${session.id}/answer`, 'POST', { questionId: question.id, answer });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.feedback.passed, true, JSON.stringify(result.body.feedback));
    return result.body.snapshot;
  };
  const placement = async (pass = false) => {
    let result = await request('/sessions', 'POST', { kind: 'placement' }); assert.equal(result.status, 201);
    let snapshot = result.body;
    while (snapshot.activeSession.status !== 'completed') {
      if (pass) snapshot = await passAnswer(snapshot);
      else {
        const session = snapshot.activeSession;
        timestamp += 30_000;
        result = await request(`/sessions/${session.id}/answer`, 'POST', { questionId: session.questions[session.index].id, answer: 'I am unsure and need to study this topic.' });
        assert.equal(result.status, 200); snapshot = result.body.snapshot;
      }
    }
    return snapshot;
  };
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  return { request, signup, configure, placement, passAnswer, databasePath, advance: milliseconds => timestamp += milliseconds, currentToken: () => token, base };
}

test('HTTP auth uses salted hashes, normalized email, private tokens and durable SQLite', async t => {
  const app = await fixture(t);
  const snapshot = await app.signup('Student@Example.com');
  assert.equal(snapshot.profile.email, 'student@example.com');
  assert.equal((await app.request('/me')).body.profile.id, snapshot.profile.id);
  const reader = new DatabaseSync(app.databasePath);
  const user = reader.prepare('SELECT salt, password_hash FROM users').get();
  assert.equal(user.salt.length, 32); assert.equal(user.password_hash.length, 128);
  assert.notEqual(user.password_hash, 'correct horse battery');
  const token = reader.prepare('SELECT hash FROM tokens').get();
  assert.notEqual(token.hash, app.currentToken()); reader.close();
  const duplicate = await app.request('/auth/signup', 'POST', { name: 'Another', email: 'STUDENT@example.com', password: 'another password' });
  assert.equal(duplicate.status, 409);
  const wrong = await app.request('/auth/login', 'POST', { email: 'student@example.com', password: 'wrong password' });
  assert.equal(wrong.status, 401);
  const login = await app.request('/auth/login', 'POST', { email: 'STUDENT@example.com', password: 'correct horse battery' });
  assert.equal(login.status, 200); assert.equal(login.body.snapshot.profile.id, snapshot.profile.id);
  const logout = await app.request('/auth/logout', 'POST', {}); assert.equal(logout.status, 200);
  assert.equal((await app.request('/me')).status, 401);
});

test('profile validation and placement prerequisites reject forged progress', async t => {
  const app = await fixture(t); await app.signup();
  assert.equal((await app.request('/sessions', 'POST', { kind: 'daily' })).status, 400);
  assert.equal((await app.request('/profile', 'PUT', { minutes: -1 })).status, 400);
  assert.equal((await app.request('/profile', 'PUT', { daysPerWeek: 8 })).status, 400);
  assert.equal((await app.request('/profile', 'PUT', { level: 'master' })).status, 400);
  assert.equal((await app.request('/profile', 'PUT', { focusApps: ['Instagram', 'instagram'] })).status, 400);
  assert.equal((await app.request('/profile', 'PUT', { focusApps: Array.from({ length: 12 }, (_, index) => `App ${index + 1}`) })).status, 200);
  assert.equal((await app.request('/profile', 'PUT', { focusApps: Array.from({ length: 13 }, (_, index) => `App ${index + 1}`) })).status, 400);
  assert.equal((await app.request('/resume', 'POST', { name: 'bad.txt', text: 'tiny' })).status, 400);
  await app.configure('Economics');
  assert.equal((await app.request('/sessions', 'POST', { kind: 'daily' })).status, 409);
  const snapshot = await app.placement();
  assert.equal(snapshot.profile.placementComplete, true);
  assert.equal(snapshot.profile.level, 'beginner');
  assert.equal(snapshot.stats.unlockedUntil, null);
  assert.equal(snapshot.activeSession.questions.filter(question => question.kind === 'technical').length, 2);
  assert.equal(snapshot.activeSession.questions.filter(question => question.kind === 'behavioral').length, 2);
  assert.ok(snapshot.activeSession.questions[0].id.startsWith('business-'));
  assert.equal((await app.request('/sessions', 'POST', { kind: 'placement' })).status, 409);
});

test('failed daily answer blocks, teaches and requires a different same-kind answer before unlock', async t => {
  const app = await fixture(t); await app.signup(); await app.configure(); await app.placement();
  let result = await app.request('/sessions', 'POST', { kind: 'daily' }); assert.equal(result.status, 201);
  let snapshot = result.body; const sessionId = snapshot.activeSession.id;
  assert.equal(snapshot.activeSession.technicalCount, 6);
  const first = snapshot.activeSession.questions[0];
  app.advance(45_000);
  result = await app.request(`/sessions/${sessionId}/answer`, 'POST', { questionId: first.id, answer: 'I do not know.' });
  assert.equal(result.status, 200); assert.equal(result.body.feedback.passed, false);
  assert.ok(result.body.feedback.improvements.length > 0); assert.ok(result.body.feedback.explanation.includes('Example reasoning'));
  snapshot = result.body.snapshot;
  assert.equal(snapshot.activeSession.status, 'review'); assert.equal(snapshot.stats.unlockedUntil, null);
  assert.equal((await app.request('/sessions', 'POST', { kind: 'daily' })).status, 409);
  const skipped = await app.request(`/sessions/${sessionId}/answer`, 'POST', { questionId: snapshot.activeSession.questions[1].id, answer: 'Skip the review.' });
  assert.equal(skipped.status, 409);
  result = await app.request(`/sessions/${sessionId}/review`, 'POST', { questionId: first.id }); assert.equal(result.status, 200);
  snapshot = result.body;
  const replacement = snapshot.activeSession.questions[0];
  assert.notEqual(replacement.id.split('~')[0], first.id.split('~')[0]); assert.equal(replacement.kind, first.kind);
  assert.equal((await app.request(`/sessions/${sessionId}/review`, 'POST', { questionId: first.id })).status, 409);
  const duplicate = await app.request(`/sessions/${sessionId}/answer`, 'POST', { questionId: first.id, answer: 'I do not know.' });
  assert.equal(duplicate.status, 200); assert.equal(duplicate.body.snapshot.activeSession.index, 0);
  const answer = questionSpec(replacement).example;
  app.advance(60_000);
  const concurrent = await Promise.all([1, 2].map(() => app.request(`/sessions/${sessionId}/answer`, 'POST', { questionId: replacement.id, answer })));
  concurrent.forEach(value => assert.equal(value.status, 200));
  snapshot = (await app.request('/me')).body;
  assert.equal(snapshot.activeSession.index, 1);
  assert.equal(snapshot.activeSession.attempts.filter(attempt => attempt.questionId === replacement.id).length, 1);
  assert.equal(snapshot.stats.unlockedUntil, null);
  while (snapshot.activeSession.status !== 'completed') snapshot = await app.passAnswer(snapshot);
  assert.equal(snapshot.activeSession.attempts.length, 9);
  assert.equal(Date.parse(snapshot.stats.unlockedUntil) - Date.parse(snapshot.activeSession.attempts.at(-1).createdAt), 20 * 60_000);
  assert.equal(snapshot.stats.streak, 1);
  assert.equal(snapshot.stats.activity.length, 1);
  assert.ok(snapshot.stats.studiedMinutes >= 10);
  const stored = (await app.request('/me')).body; assert.equal(stored.stats.unlockedUntil, snapshot.stats.unlockedUntil);
  assert.equal((await app.request('/sessions', 'POST', { kind: 'daily' })).status, 409);
  app.advance(21 * 60_000);
  result = await app.request('/sessions', 'POST', { kind: 'daily' }); assert.equal(result.status, 201);
  assert.equal(result.body.stats.unlockedUntil, null);
});

test('strong placement creates expert plan and lessons cannot promote by clicks', async t => {
  const app = await fixture(t); await app.signup(); await app.configure();
  let snapshot = await app.placement(true);
  assert.equal(snapshot.profile.level, 'expert');
  const lesson = LESSONS.find(item => item.level === 'expert');
  assert.equal((await app.request(`/lessons/${lesson.id}/complete`, 'POST', { answer: lesson.check.correct })).status, 409);
  assert.equal((await app.request(`/lessons/${lesson.id}/start`, 'POST', {})).status, 200);
  const wrong = await app.request(`/lessons/${lesson.id}/complete`, 'POST', { answer: (lesson.check.correct + 1) % 4 });
  assert.equal(wrong.status, 200); assert.equal(wrong.body.feedback.passed, false);
  assert.equal(wrong.body.snapshot.profile.completedLessonIds.length, 0);
  app.advance(20_000);
  const correct = await app.request(`/lessons/${lesson.id}/complete`, 'POST', { answer: lesson.check.correct });
  assert.equal(correct.status, 200); assert.equal(correct.body.snapshot.profile.level, 'expert');
  assert.ok(correct.body.snapshot.profile.completedLessonIds.includes(lesson.id));
  snapshot = (await app.request('/sessions', 'POST', { kind: 'daily' })).body;
  assert.equal(snapshot.activeSession.questions.length, 3);
  assert.equal(snapshot.activeSession.questions[0].difficulty, 'expert');
});

test('study streak survives fresh login, grows across days, expires after a gap', async t => {
  const app = await fixture(t); await app.signup(); await app.configure(); await app.placement();
  let snapshot = (await app.request('/me')).body; assert.equal(snapshot.stats.streak, 1);
  app.advance(86_400_000);
  snapshot = (await app.request('/sessions', 'POST', { kind: 'daily' })).body;
  snapshot = await app.passAnswer(snapshot);
  assert.equal(snapshot.stats.streak, 2); assert.equal(snapshot.stats.activity.length, 2);
  const login = await app.request('/auth/login', 'POST', { email: 'student@example.com', password: 'correct horse battery' });
  assert.equal(login.body.snapshot.stats.streak, 2);
  app.advance(2 * 86_400_000);
  snapshot = (await app.request('/me')).body;
  assert.equal(snapshot.stats.streak, 0); assert.equal(snapshot.stats.bestStreak, 2);
});

test('speech unavailable mode and upload boundaries are explicit', async t => {
  const app = await fixture(t); await app.signup(); await app.configure();
  const health = await app.request('/health'); assert.equal(health.body.gradingMode, 'rubric'); assert.equal(health.body.speechAvailable, false);
  assert.equal((await app.request('/resume', 'POST', { name: 'resume.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', base64: Buffer.from('unsupported resume format').toString('base64') })).status, 400);
  assert.equal((await app.request('/resume', 'POST', { name: 'resume.pdf', mimeType: 'application/pdf', base64: Buffer.from('not a PDF').toString('base64') })).status, 400);
  const txt = Buffer.from('Student resume. Built community research projects with leadership, Python, JavaScript and financial analysis.').toString('base64');
  assert.equal((await app.request('/resume', 'POST', { name: 'resume.txt', mimeType: 'text/plain', base64: txt })).status, 200);
  let snapshot = (await app.request('/sessions', 'POST', { kind: 'placement' })).body;
  snapshot = await app.passAnswer(snapshot); snapshot = await app.passAnswer(snapshot);
  const speech = await app.request('/ai/transcribe', 'POST', { mimeType: 'audio/mp4', base64: Buffer.from('fake audio').toString('base64') });
  assert.equal(speech.status, 503); assert.match(speech.body.error, /OPENAI_API_KEY/);
});

test('rate limit bounds repeated login attempts', async t => {
  const app = await fixture(t, { rateLimit: true });
  for (let i = 0; i < 15; i++) {
    const result = await app.request('/auth/login', 'POST', { email: 'missing@example.com', password: 'wrong password' }); assert.equal(result.status, 401);
  }
  assert.equal((await app.request('/auth/login', 'POST', { email: 'missing@example.com', password: 'wrong password' })).status, 429);
});

test('daily session goals persist, count only completed practice and reset by local date', async t => {
  const app = await fixture(t);
  const initial = await app.signup();
  assert.equal(initial.profile.sessionsPerDay, 1);
  assert.equal(initial.stats.todaySessions, 0);
  await app.configure();
  assert.equal((await app.request('/profile', 'PUT', { sessionsPerDay: 0 })).status, 400);
  assert.equal((await app.request('/profile', 'PUT', { sessionsPerDay: 5 })).status, 400);
  assert.equal((await app.request('/profile', 'PUT', { sessionsPerDay: 1.5 })).status, 400);
  const saved = await app.request('/profile', 'PUT', { sessionsPerDay: 2 });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.profile.sessionsPerDay, 2);
  const placement = await app.placement(true);
  assert.equal(placement.stats.sessions, 1);
  assert.equal(placement.stats.todaySessions, 0);
  assert.equal(placement.stats.levelPracticeDays, 0);
  for (let completed = 1; completed <= 3; completed++) {
    if (completed > 1) app.advance(21 * 60_000);
    const started = await app.request('/sessions', 'POST', { kind: 'daily' });
    assert.equal(started.status, 201);
    let snapshot = await app.passAnswer(started.body);
    assert.equal(snapshot.stats.todaySessions, completed - 1);
    while (snapshot.activeSession.status !== 'completed') snapshot = await app.passAnswer(snapshot);
    assert.equal(snapshot.stats.todaySessions, completed);
    assert.equal(snapshot.stats.levelPracticeDays, 1);
    assert.equal(snapshot.stats.levelPracticeRequired, 2);
    assert.equal(snapshot.stats.levelLessonsCompleted, 0);
    assert.equal(snapshot.stats.levelLessonsRequired, 2);
    const last = snapshot.activeSession.attempts.at(-1);
    const duplicate = await app.request(`/sessions/${snapshot.activeSession.id}/answer`, 'POST', { questionId: last.questionId, answer: last.answer });
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.snapshot.stats.todaySessions, completed);
  }
  const login = await app.request('/auth/login', 'POST', { email: 'student@example.com', password: 'correct horse battery' });
  assert.equal(login.body.snapshot.profile.sessionsPerDay, 2);
  assert.equal(login.body.snapshot.stats.todaySessions, 3);
  app.advance(86_400_000);
  const nextDay = (await app.request('/me')).body;
  assert.equal(nextDay.stats.todaySessions, 0);
  assert.equal(nextDay.profile.sessionsPerDay, 2);
  assert.equal(nextDay.stats.levelPracticeDays, 1);
  let snapshot = (await app.request('/sessions', 'POST', { kind: 'daily' })).body;
  while (snapshot.activeSession.status !== 'completed') snapshot = await app.passAnswer(snapshot);
  assert.equal(snapshot.stats.todaySessions, 1);
  assert.equal(snapshot.stats.levelPracticeDays, 2);
});

test('legacy SQLite states acquire default goal and reconstruct completed daily dates', async t => {
  const app = await fixture(t);
  const initial = await app.signup();
  const database = new DatabaseSync(app.databasePath);
  const row = database.prepare('SELECT state FROM users WHERE id = ?').get(initial.profile.id);
  const state = JSON.parse(row.state);
  delete state.snapshot.profile.sessionsPerDay;
  delete state.snapshot.profile.targetCompanies;
  delete state.dailySessionCounts;
  for (const key of ['todaySessions', 'levelPracticeDays', 'levelPracticeRequired', 'levelLessonsCompleted', 'levelLessonsRequired']) delete state.snapshot.stats[key];
  state.dailyResults = [{ level: 'beginner', accuracy: 100, date: '2026-10-09' }, { level: 'beginner', accuracy: 50, date: '2026-10-09' }];
  database.prepare('UPDATE users SET state = ?, version = version + 1 WHERE id = ?').run(JSON.stringify(state), initial.profile.id);
  database.close();
  const snapshot = (await app.request('/me')).body;
  assert.equal(snapshot.profile.sessionsPerDay, 1);
  assert.deepEqual(snapshot.profile.targetCompanies, []);
  assert.equal(snapshot.stats.todaySessions, 2);
  assert.equal(snapshot.stats.levelPracticeDays, 1);
  assert.equal(snapshot.stats.levelLessonsRequired, 2);
  const stored = new DatabaseSync(app.databasePath);
  const persisted = JSON.parse(stored.prepare('SELECT state FROM users WHERE id = ?').get(initial.profile.id).state);
  assert.equal(persisted.snapshot.profile.sessionsPerDay, 1);
  assert.equal(persisted.dailySessionCounts['2026-10-09'], 2);
  stored.close();
});

test('technical coaching cannot pass, unlock or skip review and rejects stale questions', async t => {
  const app = await fixture(t); await app.signup(); await app.configure(); await app.placement();
  let snapshot = (await app.request('/sessions', 'POST', { kind: 'daily' })).body;
  const session = snapshot.activeSession;
  const question = session.questions[0];
  assert.equal((await app.request(`/sessions/${session.id}/coach`, 'POST', { questionId: 'stale-question', message: 'Give a hint.' })).status, 409);
  const coached = await app.request(`/sessions/${session.id}/coach`, 'POST', { questionId: question.id, message: 'How do I test a boundary case?' });
  assert.equal(coached.status, 200); assert.equal(coached.body.mode, 'rubric'); assert.equal(coached.body.provider, 'rubric');
  assert.ok(coached.body.hints.length > 0); assert.equal(coached.body.feedback, undefined);
  snapshot = (await app.request('/me')).body;
  assert.equal(snapshot.activeSession.index, 0); assert.equal(snapshot.activeSession.attempts.length, 0); assert.equal(snapshot.stats.unlockedUntil, null);
  const failed = await app.request(`/sessions/${session.id}/answer`, 'POST', { questionId: question.id, answer: 'I do not know.' });
  assert.equal(failed.body.snapshot.activeSession.status, 'review');
  assert.equal((await app.request(`/sessions/${session.id}/coach`, 'POST', { questionId: question.id, message: 'Explain the missing principle.' })).status, 200);
  snapshot = (await app.request('/me')).body;
  assert.equal(snapshot.activeSession.status, 'review'); assert.equal(snapshot.activeSession.attempts.length, 1); assert.equal(snapshot.stats.unlockedUntil, null);
  snapshot = (await app.request(`/sessions/${session.id}/review`, 'POST', { questionId: question.id })).body;
  assert.equal((await app.request(`/sessions/${session.id}/coach`, 'POST', { questionId: question.id, message: 'Use the old question.' })).status, 409);
  const replacement = snapshot.activeSession.questions[0];
  for (let count = 0; count < 5; count++) assert.equal((await app.request(`/sessions/${session.id}/coach`, 'POST', { questionId: replacement.id, message: 'Give one hint.' })).status, 200);
  assert.equal((await app.request(`/sessions/${session.id}/coach`, 'POST', { questionId: replacement.id, message: 'One more hint.' })).status, 429);
  snapshot = (await app.request('/me')).body;
  assert.equal(snapshot.activeSession.index, 0); assert.equal(snapshot.stats.unlockedUntil, null);
  assert.equal((await app.request(`/sessions/${session.id}/coach`, 'POST', { questionId: replacement.id, message: 'x'.repeat(2001) })).status, 400);
});

test('provider health reports independent speech and failed grading records no attempt', async t => {
  const app = await fixture(t, { provider: 'groq', speechProvider: 'groq', groqApiKey: 'test-key', fetchImpl: async () => new Response('{}', { status: 429 }) });
  const health = (await app.request('/health')).body;
  assert.equal(health.gradingProvider, 'groq'); assert.equal(health.speechProvider, 'groq'); assert.equal(health.speechAvailable, true);
  await app.signup(); await app.configure();
  const snapshot = (await app.request('/sessions', 'POST', { kind: 'placement' })).body;
  const session = snapshot.activeSession;
  const response = await app.request(`/sessions/${session.id}/answer`, 'POST', { questionId: session.questions[0].id, answer: questionSpec(session.questions[0]).example });
  assert.equal(response.status, 429);
  const unchanged = (await app.request('/me')).body;
  assert.equal(unchanged.activeSession.attempts.length, 0); assert.equal(unchanged.activeSession.index, 0); assert.equal(unchanged.stats.unlockedUntil, null);
});

test('lesson coaching enforces level access and cannot complete or unlock a lesson', async t => {
  const app = await fixture(t); await app.signup(); await app.configure();
  const lesson = LESSONS.find(item => item.level === 'beginner');
  assert.equal((await app.request(`/lessons/${lesson.id}/coach`, 'POST', { message: 'Explain this lesson.' })).status, 409);
  await app.placement();
  const advanced = LESSONS.find(item => item.level === 'advanced');
  assert.equal((await app.request(`/lessons/${advanced.id}/coach`, 'POST', { message: 'Explain this lesson.' })).status, 409);
  for (let count = 0; count < 5; count++) {
    const result = await app.request(`/lessons/${lesson.id}/coach`, 'POST', { message: 'Which principle should I practice?' });
    assert.equal(result.status, 200); assert.equal(result.body.mode, 'rubric');
    assert.equal(result.body.correct, undefined); assert.equal(result.body.choices, undefined);
  }
  assert.equal((await app.request(`/lessons/${lesson.id}/coach`, 'POST', { message: 'Choose the answer for me.' })).status, 429);
  const snapshot = (await app.request('/me')).body;
  assert.equal(snapshot.profile.completedLessonIds.length, 0); assert.equal(snapshot.stats.unlockedUntil, null);
  app.advance(86_400_000);
  assert.equal((await app.request(`/lessons/${lesson.id}/coach`, 'POST', { message: 'Practice a new example.' })).status, 200);
});

test('target companies validate, persist and personalize original practice prompts', async t => {
  const app = await fixture(t); const initial = await app.signup();
  assert.deepEqual(initial.profile.targetCompanies, []);
  await app.configure();
  for (const targetCompanies of [['Example', ' example '], Array(6).fill('Company'), ['x'.repeat(61)], [''], ['Bad\u0000Company']]) {
    assert.equal((await app.request('/profile', 'PUT', { targetCompanies })).status, 400);
  }
  const saved = await app.request('/profile', 'PUT', { targetCompanies: [' Example Company ', 'Another Company'] });
  assert.equal(saved.status, 200); assert.deepEqual(saved.body.profile.targetCompanies, ['Example Company', 'Another Company']);
  const login = await app.request('/auth/login', 'POST', { email: 'student@example.com', password: 'correct horse battery' });
  assert.deepEqual(login.body.snapshot.profile.targetCompanies, ['Example Company', 'Another Company']);
  const placement = (await app.request('/sessions', 'POST', { kind: 'placement' })).body;
  assert.match(placement.activeSession.questions[0].prompt, /Example Company, Another Company/);
  assert.match(placement.activeSession.questions[0].prompt, /not an exact or proprietary question/);
});

test('knowledge checkpoints advance failed answers without unlock or promotion credit', async t => {
  const app = await fixture(t); await app.signup(); await app.configure();
  assert.equal((await app.request('/sessions', 'POST', { kind: 'checkpoint' })).status, 409);
  const placed = await app.placement();
  const level = placed.profile.level;
  let snapshot = (await app.request('/sessions', 'POST', { kind: 'checkpoint' })).body;
  assert.equal(snapshot.activeSession.questions.length, 4);
  assert.equal(snapshot.activeSession.questions.filter(question => question.kind === 'technical' && question.difficulty === level).length, 2);
  const sessionId = snapshot.activeSession.id;
  const first = snapshot.activeSession.questions[0];
  const failed = await app.request(`/sessions/${sessionId}/answer`, 'POST', { questionId: first.id, answer: 'I need to learn this topic.' });
  assert.equal(failed.status, 200); assert.equal(failed.body.feedback.passed, false);
  snapshot = failed.body.snapshot;
  assert.equal(snapshot.activeSession.status, 'active'); assert.equal(snapshot.activeSession.index, 1);
  while (snapshot.activeSession.status !== 'completed') snapshot = await app.passAnswer(snapshot);
  assert.equal(snapshot.stats.sessions, 2); assert.equal(snapshot.stats.todaySessions, 0); assert.equal(snapshot.stats.levelPracticeDays, 0);
  assert.equal(snapshot.stats.unlockedUntil, null); assert.equal(snapshot.profile.level, level); assert.deepEqual(snapshot.profile.completedLessonIds, []);
  snapshot = (await app.request('/sessions', 'POST', { kind: 'daily' })).body;
  while (snapshot.activeSession.status !== 'completed') snapshot = await app.passAnswer(snapshot);
  const earnedUntil = snapshot.stats.unlockedUntil;
  const dailyCount = snapshot.stats.todaySessions;
  snapshot = (await app.request('/sessions', 'POST', { kind: 'checkpoint' })).body;
  while (snapshot.activeSession.status !== 'completed') snapshot = await app.passAnswer(snapshot);
  assert.equal(snapshot.stats.unlockedUntil, earnedUntil);
  assert.equal(snapshot.stats.todaySessions, dailyCount);
  assert.equal(snapshot.stats.levelPracticeDays, 1);
  assert.equal(snapshot.profile.level, level);
});

test('provider failures release coaching turns so both coaching paths recover', async t => {
  let healthy = false;
  const app = await fixture(t, { provider: 'groq', groqApiKey: 'test', grade: gradeWithRubric, fetchImpl: async () => healthy
    ? new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ message: 'Explain one small example and check its boundary.', hints: ['State the goal before choosing a method.'] }) } }] }), { status: 200 })
    : new Response('{}', { status: 503 }) });
  await app.signup(); await app.configure(); await app.placement();
  const snapshot = (await app.request('/sessions', 'POST', { kind: 'daily' })).body;
  const session = snapshot.activeSession;
  for (let attempt = 0; attempt < 5; attempt++) assert.equal((await app.request(`/sessions/${session.id}/coach`, 'POST', { questionId: session.questions[0].id, message: 'Explain a boundary case.' })).status, 503);
  healthy = true;
  assert.equal((await app.request(`/sessions/${session.id}/coach`, 'POST', { questionId: session.questions[0].id, message: 'Try the hint again.' })).status, 200);
  healthy = false;
  const lesson = LESSONS.find(item => item.level === 'beginner');
  for (let attempt = 0; attempt < 5; attempt++) assert.equal((await app.request(`/lessons/${lesson.id}/coach`, 'POST', { message: 'Explain the principle.' })).status, 503);
  healthy = true;
  assert.equal((await app.request(`/lessons/${lesson.id}/coach`, 'POST', { message: 'Try the explanation again.' })).status, 200);
  const unchanged = (await app.request('/me')).body;
  assert.equal(unchanged.activeSession.attempts.length, 0);
  assert.equal(unchanged.profile.completedLessonIds.length, 0);
  assert.equal(unchanged.stats.unlockedUntil, null);
});
