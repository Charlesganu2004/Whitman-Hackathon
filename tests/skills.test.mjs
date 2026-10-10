import assert from 'node:assert/strict';
import test from 'node:test';
import { INTERVIEWER_NAME, SKILL_IDS, skillForQuestion, skillLevel, skillSummary, updateSkill } from '../src/core/skills.ts';

test('the interviewer persona is named in one place', () => {
  assert.equal(INTERVIEWER_NAME, 'Jarvis');
  assert.deepEqual([...SKILL_IDS], ['communication', 'technical', 'coding']);
});

test('behavioral questions train communication, starter code trains coding, other technical questions train discussion', () => {
  assert.equal(skillForQuestion({ kind: 'behavioral' }), 'communication');
  assert.equal(skillForQuestion({ kind: 'behavioral', starter: 'function x() {}' }), 'communication');
  assert.equal(skillForQuestion({ kind: 'technical', starter: 'function x() {}' }), 'coding');
  assert.equal(skillForQuestion({ kind: 'technical' }), 'technical');
  assert.equal(skillForQuestion({ kind: 'technical', starter: '' }), 'technical');
});

test('a skill score is a rolling mean of about the last five answers, as an integer from 0 to 100', () => {
  let standing = updateSkill(undefined, 80);
  assert.deepEqual(standing, { score: 80, answers: 1 });
  standing = updateSkill(standing, 60);
  assert.deepEqual(standing, { score: 70, answers: 2 });
  standing = updateSkill(standing, 50);
  assert.deepEqual(standing, { score: 63, answers: 3 });
  standing = updateSkill(standing, 100);
  standing = updateSkill(standing, 100);
  assert.equal(standing.answers, 5);
  assert.equal(standing.score, 78, 'five answers average exactly');
  const old = updateSkill({ score: 10, answers: 40 }, 100);
  assert.equal(old.answers, 41);
  assert.equal(old.score, Math.round((10 * 4 + 100) / 5), 'the newest answer carries one fifth of the weight once the window is full');
  let steady = { score: 0, answers: 0 };
  for (let answer = 0; answer < 30; answer++) steady = updateSkill(steady, 100);
  assert.ok(steady.score >= 95 && steady.score <= 100, 'a long run of perfect answers lands at the top of the range');
});

test('skill updates stay in range and never mutate the previous standing', () => {
  const previous = Object.freeze({ score: 50, answers: 2 });
  assert.deepEqual(updateSkill(previous, 150), { score: 67, answers: 3 });
  assert.deepEqual(updateSkill(previous, -40), { score: 33, answers: 3 });
  assert.deepEqual(updateSkill(previous, Number.NaN), { score: 33, answers: 3 });
  assert.deepEqual(updateSkill({ score: 250, answers: 1 }, 100), { score: 100, answers: 2 });
  assert.deepEqual(previous, { score: 50, answers: 2 });
});

test('skill level follows the existing ladder at its boundaries', () => {
  const cases = [[0, 'beginner'], [39, 'beginner'], [40, 'intermediate'], [59, 'intermediate'], [60, 'advanced'], [74, 'advanced'], [75, 'expert'], [89, 'expert'], [90, 'master'], [100, 'master']];
  for (const [score, level] of cases) assert.equal(skillLevel(score), level, String(score));
});

test('a skill without graded answers is not measured and never shows a number', () => {
  for (const id of SKILL_IDS) {
    for (const standing of [undefined, { score: 0, answers: 0 }, { score: 88, answers: 0 }]) {
      const summary = skillSummary(id, standing);
      assert.equal(summary.evidence, 'Not measured yet');
      assert.equal(summary.level, null);
      assert.equal(summary.score, null);
      assert.ok(summary.nextStep.length > 20);
      assert.ok(summary.description.length > 10);
    }
  }
});

test('measured skills report level, evidence count and a concrete next step', () => {
  assert.equal(skillSummary('communication', { score: 82, answers: 3 }).label, 'Communication');
  assert.equal(skillSummary('technical', { score: 82, answers: 3 }).label, 'Technical discussion');
  assert.equal(skillSummary('coding', { score: 82, answers: 3 }).label, 'Coding');
  const one = skillSummary('coding', { score: 45, answers: 1 });
  assert.equal(one.level, 'intermediate');
  assert.equal(one.score, 45);
  assert.equal(one.evidence, 'Based on 1 answer');
  assert.equal(skillSummary('technical', { score: 45, answers: 4 }).evidence, 'Based on 4 answers');
  const steps = new Set();
  for (const id of SKILL_IDS) for (const score of [10, 45, 65, 80, 95]) {
    const summary = skillSummary(id, { score, answers: 2 });
    assert.equal(summary.level, skillLevel(score));
    assert.ok(summary.nextStep.length > 20);
    assert.ok(!summary.nextStep.includes('—'), 'no em dashes in learner copy');
    steps.add(summary.nextStep);
  }
  assert.equal(steps.size, 15, 'every skill and level pair has its own next step');
});
