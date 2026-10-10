import assert from 'node:assert/strict';
import test from 'node:test';
import { LESSONS } from '../src/core/content.ts';
import { summarizeSession, WEAK_BELOW, WEAK_TOPIC_LIMIT } from '../src/core/recap.ts';

const now = Date.parse('2026-10-09T17:00:00Z');
const question = (id, kind, topic, extra = {}) => ({ id, kind, topic, title: `Title ${id}`, difficulty: 'beginner', prompt: 'Prompt', hints: [], ...extra });
const feedback = (score, passed, extra = {}) => ({ passed, score, strengths: [], improvements: [`Improve ${score}`, 'A second line'], explanation: 'Explanation', mode: 'rubric', ...extra });
const attempt = (questionId, score, passed, extra) => ({ questionId, answer: `Answer to ${questionId}`, createdAt: '2026-10-09T16:00:00Z', feedback: feedback(score, passed, extra) });
const profile = (extra = {}) => ({ id: 'p', level: 'beginner', placementComplete: true, major: 'Computer Science', unlockMinutes: 30, completedLessonIds: [], ...extra });
const everything = { communication: { score: 70, answers: 2 }, technical: { score: 70, answers: 2 }, coding: { score: 70, answers: 2 } };
const stats = (extra = {}) => ({ unlockedUntil: null, skills: everything, ...extra });
const session = (questions, attempts, extra = {}) => ({ id: 'session', kind: 'checkpoint', status: 'completed', questions, attempts, index: questions.length, technicalCount: 1, behavioralCount: 1, startedAt: '2026-10-09T15:00:00Z', ...extra });
const lessons = [
  { id: 'b1', title: 'Tell a story', topic: 'Behavioral', level: 'beginner', minutes: 7, summary: 'Use situation, task, action and result.' },
  { id: 't1', title: 'Explain it', topic: 'Technical foundations', level: 'beginner', minutes: 8, summary: 'Make reasoning easy to follow.' },
  { id: 'b2', title: 'Take feedback', topic: 'Behavioral', level: 'intermediate', minutes: 8, summary: 'Respond with evidence.' },
  { id: 't2', title: 'Validate it', topic: 'Technical reasoning', level: 'intermediate', minutes: 10, summary: 'Test your own claim.' },
  { id: 't3', title: 'Whole system', topic: 'Mastery', level: 'expert', minutes: 14, summary: 'Trace effects across a process.' },
];
const recap = (s, context = {}) => summarizeSession(s, { profile: profile(), stats: stats(), now, lessons, ...context });

const mixed = session(
  [question('q1', 'technical', 'Arrays'), question('q2', 'behavioral', 'Behavioral'), question('q3', 'technical', 'Algorithms', { starter: 'function f() {}' })],
  [attempt('q1', 90, true, { hintsUsed: 1, evaluationScore: 80 }), attempt('q2', 55, false), attempt('q3', 70, true)],
);

test('each answered question reports its title, topic, kind, grade, evaluation score and result', () => {
  const result = recap(mixed);
  assert.deepEqual(result.questions.map(item => item.title), ['Title q1', 'Title q2', 'Title q3']);
  assert.deepEqual(result.questions.map(item => item.topic), ['Arrays', 'Behavioral', 'Algorithms']);
  assert.deepEqual(result.questions.map(item => item.kind), ['technical', 'behavioral', 'technical']);
  assert.deepEqual(result.questions.map(item => item.skill), ['technical', 'communication', 'coding']);
  assert.deepEqual(result.questions.map(item => item.score), [90, 55, 70]);
  assert.deepEqual(result.questions.map(item => item.evaluation), [80, 55, 70], 'an attempt without an evaluation score falls back to its grade');
  assert.deepEqual(result.questions.map(item => item.passed), [true, false, true]);
  assert.deepEqual(result.questions.map(item => item.hintsUsed), [1, 0, 0]);
  assert.equal(result.total, 3);
  assert.equal(result.passed, 2);
  assert.equal(result.averageScore, 72);
  assert.equal(result.averageEvaluation, 68);
  assert.equal(result.hintsTaken, 1);
});

test('questions without an answer are left out and an empty session summarizes to zeros', () => {
  const partial = recap(session([question('q1', 'technical', 'Arrays'), question('q2', 'technical', 'Systems')], [attempt('q1', 80, true)]));
  assert.deepEqual(partial.questions.map(item => item.id), ['q1']);
  const empty = recap(session([], []));
  assert.deepEqual([empty.total, empty.passed, empty.averageScore, empty.averageEvaluation, empty.hintsTaken], [0, 0, 0, 0, 0]);
  assert.deepEqual(empty.weakTopics, []);
  assert.deepEqual(empty.revisit, []);
});

test('weak topics are the failed answers, lowest first, each with its first improvement line', () => {
  const result = recap(session(
    [question('q1', 'technical', 'Arrays'), question('q2', 'behavioral', 'Behavioral'), question('q3', 'technical', 'Systems')],
    [attempt('q1', 62, false), attempt('q2', 30, false), attempt('q3', 95, true)],
  ));
  assert.deepEqual(result.weakTopics.map(item => item.topic), ['Behavioral', 'Arrays']);
  assert.deepEqual(result.weakTopics.map(item => item.improvement), ['Improve 30', 'Improve 62']);
  assert.deepEqual(result.weakTopics.map(item => item.score), [30, 62]);
  assert.ok(result.weakTopics.every(item => item.passed === false && item.missed === false));
});

test('when every answer passed the single lowest answer is named only if it is below the threshold', () => {
  const rows = scores => session(scores.map((_, index) => question(`q${index}`, 'technical', `Topic ${index}`)), scores.map((score, index) => attempt(`q${index}`, score, true)));
  const some = recap(rows([95, WEAK_BELOW - 1, 91]));
  assert.deepEqual(some.weakTopics.map(item => item.topic), ['Topic 1']);
  assert.equal(some.weakTopics[0].passed, true);
  assert.deepEqual(recap(rows([95, WEAK_BELOW, 100])).weakTopics, [], 'a session at or above the threshold has nothing to strengthen');
});

test('a topic appears once with its lowest answer, and the list is capped', () => {
  const twice = recap(session(
    [question('q1', 'technical', 'Arrays'), question('q2', 'technical', 'Arrays')],
    [attempt('q1', 50, false), attempt('q2', 20, false)],
  ));
  assert.deepEqual(twice.weakTopics.map(item => [item.topic, item.score]), [['Arrays', 20]]);
  const many = recap(session(
    Array.from({ length: 6 }, (_, index) => question(`q${index}`, 'technical', `Topic ${index}`)),
    Array.from({ length: 6 }, (_, index) => attempt(`q${index}`, 10 + index, false)),
  ));
  assert.equal(many.weakTopics.length, WEAK_TOPIC_LIMIT);
  assert.deepEqual(many.weakTopics.map(item => item.topic), ['Topic 0', 'Topic 1', 'Topic 2']);
});

test('a failed answer without improvement lines still appears, with no improvement text', () => {
  const result = recap(session([question('q1', 'technical', 'Arrays')], [attempt('q1', 20, false, { improvements: ['', '  '] })]));
  assert.equal(result.weakTopics[0].improvement, null);
});

test('replaced questions are listed to revisit with their answer and feedback, feed the weak topics and never count as passed', () => {
  const missedFeedback = feedback(35, false, { improvements: ['Name the tradeoff first.', 'Second'], explanation: 'Full explanation', strengths: ['Clear start'] });
  const missed = { questionId: 'old', title: 'Old question', topic: 'Databases', kind: 'technical', skill: 'technical', answer: 'My first try', feedback: missedFeedback, createdAt: '2026-10-09T15:30:00Z' };
  const result = recap(session(
    [question('q1', 'technical', 'Arrays'), question('q2', 'behavioral', 'Behavioral')],
    [attempt('old', 35, false), attempt('q1', 92, true), attempt('q2', 88, true)],
    { kind: 'daily', missed: [missed] },
  ));
  assert.deepEqual(result.questions.map(item => item.id), ['q1', 'q2'], 'a replaced question is not a row');
  assert.equal(result.passed, 2);
  assert.equal(result.total, 2);
  assert.equal(result.revisit.length, 1);
  assert.deepEqual(result.revisit[0], missed, 'the answer and the full feedback come through unchanged');
  assert.deepEqual(result.weakTopics.map(item => [item.topic, item.missed, item.improvement]), [['Databases', true, 'Name the tradeoff first.']]);
  assert.equal(result.averageScore, 90, 'the average covers the questions that remain, not the replaced one');
});

test('a session saved before missed questions existed summarizes without them', () => {
  const old = session([question('q1', 'technical', 'Arrays')], [attempt('gone', 10, false), attempt('q1', 80, true)], { kind: 'daily' });
  assert.equal('missed' in old, false);
  const result = recap(old);
  assert.deepEqual(result.revisit, []);
  assert.deepEqual(result.questions.map(item => item.id), ['q1']);
});

test('the lesson step picks the unfinished lesson for the weakest area at the student level', () => {
  const behavioralWeak = recap(session([question('q1', 'behavioral', 'Behavioral'), question('q2', 'technical', 'Arrays')], [attempt('q1', 40, false), attempt('q2', 90, true)]));
  const lesson = behavioralWeak.steps.find(step => step.kind === 'lesson');
  assert.equal(lesson.lessonId, 'b1');
  assert.ok(lesson.detail.includes('communication'), 'it says which area the lesson is aimed at');
  assert.ok(lesson.detail.includes('7 minute lesson'));
  const technicalWeak = recap(session([question('q1', 'behavioral', 'Behavioral'), question('q2', 'technical', 'Arrays')], [attempt('q1', 90, true), attempt('q2', 40, false)]));
  assert.equal(technicalWeak.steps[0].lessonId, 't1');
  const codingWeak = recap(session([question('q1', 'technical', 'Algorithms', { starter: 'x' })], [attempt('q1', 40, false)]));
  assert.equal(codingWeak.steps[0].lessonId, 't1', 'coding practice uses the technical lessons');
});

test('the student own level comes first, then the nearest level below, and finished or locked lessons are skipped', () => {
  const weak = session([question('q1', 'technical', 'Arrays')], [attempt('q1', 40, false)]);
  const lessonId = context => recap(weak, context).steps.find(step => step.kind === 'lesson')?.lessonId;
  assert.equal(lessonId({ profile: profile({ level: 'beginner' }) }), 't1');
  assert.equal(lessonId({ profile: profile({ level: 'intermediate' }) }), 't2');
  assert.equal(lessonId({ profile: profile({ level: 'intermediate', completedLessonIds: ['t2'] }) }), 't1', 'with the level done, the nearest unfinished lesson below');
  assert.equal(lessonId({ profile: profile({ level: 'advanced' }) }), 't2', 'no advanced lesson exists, so the nearest level below');
  assert.equal(lessonId({ profile: profile({ level: 'master' }) }), 't3');
  assert.equal(lessonId({ profile: profile({ level: 'beginner', completedLessonIds: ['t1'] }) }), 'b1', 'with no technical lesson left it falls back to any unfinished lesson');
  assert.equal(lessonId({ profile: profile({ level: 'beginner', completedLessonIds: ['t1', 'b1'] }) }), undefined, 'a locked lesson is never suggested');
  const fallback = recap(weak, { profile: profile({ level: 'beginner', completedLessonIds: ['t1'] }) }).steps[0];
  assert.ok(!fallback.detail.includes('Aimed at'), 'a lesson outside the weak area does not claim to match it');
});

test('with all answers strong the lesson still follows the lowest scoring area', () => {
  const result = recap(session([question('q1', 'behavioral', 'Behavioral'), question('q2', 'technical', 'Arrays')], [attempt('q1', 99, true), attempt('q2', 96, true)]));
  assert.deepEqual(result.weakTopics, []);
  assert.equal(result.steps[0].lessonId, 't1');
});

test('the daily step reports when the next interview opens, or that it is ready', () => {
  const finished = session([question('q1', 'technical', 'Arrays')], [attempt('q1', 90, true)], { kind: 'daily' });
  const onBreak = recap(finished, { stats: stats({ unlockedUntil: new Date(now + 28 * 60_000).toISOString() }) }).steps.find(step => step.kind === 'daily');
  assert.equal(onBreak.ready, false);
  assert.equal(onBreak.availableAt, new Date(now + 28 * 60_000).toISOString());
  assert.ok(onBreak.detail.includes('28 minutes'));
  const oneLeft = recap(finished, { stats: stats({ unlockedUntil: new Date(now + 20_000).toISOString() }) }).steps.find(step => step.kind === 'daily');
  assert.ok(oneLeft.detail.includes('1 minute,'), 'singular minute');
  const ready = recap(finished, { stats: stats() }).steps.find(step => step.kind === 'daily');
  assert.equal(ready.ready, true);
  assert.equal(ready.availableAt, null);
  const expired = recap(finished, { stats: stats({ unlockedUntil: new Date(now - 1000).toISOString() }) }).steps.find(step => step.kind === 'daily');
  assert.equal(expired.ready, true, 'a break that has ended is not shown as a wait');
  assert.equal(recap(finished, { profile: profile({ placementComplete: false }) }).steps.some(step => step.kind === 'daily'), false);
});

test('the evaluation step appears when a skill has no evidence and names exactly those skills', () => {
  const finished = session([question('q1', 'technical', 'Arrays')], [attempt('q1', 90, true)]);
  const step = ctx => recap(finished, ctx).steps.find(item => item.kind === 'evaluation');
  assert.equal(step({ stats: stats() }), undefined, 'every skill has evidence');
  const one = step({ stats: stats({ skills: { communication: { score: 80, answers: 1 }, technical: { score: 80, answers: 1 } } }) });
  assert.ok(one.detail.startsWith('No graded answers yet for coding.'));
  const two = step({ stats: stats({ skills: { technical: { score: 80, answers: 1 } } }) });
  assert.ok(two.detail.startsWith('No graded answers yet for communication and coding.'));
  const none = step({ stats: stats({ skills: undefined }) });
  assert.ok(none.detail.startsWith('No graded answers yet for communication, technical discussion and coding.'));
  const zero = step({ stats: stats({ skills: { communication: { score: 0, answers: 0 }, technical: { score: 80, answers: 1 }, coding: { score: 80, answers: 1 } } }) });
  assert.ok(zero.detail.includes('communication'), 'a standing with no answers counts as no evidence');
});

test('coding is not offered to measure on a track that never asks coding questions', () => {
  const finished = session([question('q1', 'technical', 'Systems')], [attempt('q1', 90, true)]);
  const noCoding = { communication: { score: 80, answers: 1 }, technical: { score: 80, answers: 1 } };
  const nursing = recap(finished, { profile: profile({ major: 'Nursing' }), stats: stats({ skills: noCoding }) });
  assert.equal(nursing.steps.some(item => item.kind === 'evaluation'), false);
  const software = recap(finished, { stats: stats({ skills: noCoding }) });
  assert.equal(software.steps.some(item => item.kind === 'evaluation'), true);
});

test('steps come in a fixed order and the summary never mutates its inputs', () => {
  const input = { session: structuredClone(mixed), profile: profile(), stats: stats({ skills: { technical: { score: 80, answers: 1 } } }) };
  const deep = value => { Object.freeze(value); for (const child of Object.values(value)) if (child && typeof child === 'object' && !Object.isFrozen(child)) deep(child); return value; };
  deep(input);
  const result = summarizeSession(input.session, { profile: input.profile, stats: input.stats, now, lessons });
  assert.deepEqual(result.steps.map(step => step.kind), ['lesson', 'daily', 'evaluation']);
  assert.deepEqual(result.revisit, []);
});

test('the real lesson catalog supplies a lesson for a student at any level', () => {
  const weak = session([question('q1', 'technical', 'Arrays')], [attempt('q1', 40, false)]);
  for (const level of ['beginner', 'intermediate', 'advanced', 'expert', 'master']) {
    const result = summarizeSession(weak, { profile: profile({ level }), stats: stats(), now });
    const lessonId = result.steps[0].lessonId;
    assert.ok(LESSONS.some(lesson => lesson.id === lessonId), level);
  }
});

test('copy contains no em dashes', () => {
  const result = recap(mixed, { stats: stats({ skills: {}, unlockedUntil: new Date(now + 5 * 60_000).toISOString() }) });
  const text = JSON.stringify(result.steps) + JSON.stringify(result.weakTopics);
  assert.ok(!text.includes('—'));
});
