import assert from 'node:assert/strict';
import test from 'node:test';
import { BREAK_MEANWHILE, BREAK_OPENS, breakHeadline, breakMinutesLeft, breakNotice, startDecision } from '../src/core/break.ts';

const now = Date.parse('2026-10-09T17:00:00Z');
const after = milliseconds => new Date(now + milliseconds).toISOString();
const snapshot = ({ unlockedUntil = null, placementComplete = true, status, unlockMinutes = 30 } = {}) => ({
  profile: { placementComplete, unlockMinutes },
  stats: { unlockedUntil },
  activeSession: status ? { id: 'session', status } : null,
});

test('minutes left round up, so the last seconds of a break still read as one minute', () => {
  assert.equal(breakMinutesLeft(after(30 * 60_000), now), 30);
  assert.equal(breakMinutesLeft(after(29 * 60_000 + 1), now), 30);
  assert.equal(breakMinutesLeft(after(60_000), now), 1);
  assert.equal(breakMinutesLeft(after(1_000), now), 1);
  assert.equal(breakMinutesLeft(after(0), now), 0, 'a break ends exactly when its time arrives');
  assert.equal(breakMinutesLeft(after(-5 * 60_000), now), 0);
  assert.equal(breakMinutesLeft(null, now), 0);
  assert.equal(breakMinutesLeft(undefined, now), 0);
  assert.equal(breakMinutesLeft('not a date', now), 0);
});

test('an earned break blocks a new daily interview and reports what is left', () => {
  const decision = startDecision(snapshot({ unlockedUntil: after(12 * 60_000 + 30_000) }), now);
  assert.equal(decision.action, 'break');
  assert.equal(decision.blocked, true);
  assert.equal(decision.minutesLeft, 13);
  assert.equal(decision.endsAt, after(12 * 60_000 + 30_000));
  assert.equal(decision.canEvaluate, true, 'an evaluation with Jarvis is allowed during a break');
});

test('the decision follows the clock: a break that has ended allows the daily interview again', () => {
  const state = snapshot({ unlockedUntil: after(2 * 60_000) });
  assert.equal(startDecision(state, now).action, 'break');
  assert.equal(startDecision(state, now + 61_000).minutesLeft, 1);
  assert.equal(startDecision(state, now + 2 * 60_000 - 1).action, 'break');
  const done = startDecision(state, now + 2 * 60_000);
  assert.equal(done.action, 'daily');
  assert.equal(done.blocked, false);
  assert.equal(done.minutesLeft, 0);
  assert.equal(done.endsAt, null);
});

test('without a break the next action is placement, a daily interview or resuming a saved one', () => {
  assert.equal(startDecision(snapshot(), now).action, 'daily');
  assert.equal(startDecision(snapshot({ placementComplete: false }), now).action, 'placement');
  assert.equal(startDecision(snapshot({ status: 'active' }), now).action, 'resume');
  assert.equal(startDecision(snapshot({ status: 'review' }), now).action, 'resume');
  assert.equal(startDecision(snapshot({ status: 'completed' }), now).action, 'daily', 'a completed session is not resumable');
});

test('a saved interview can always be resumed, even if a break is still running', () => {
  const decision = startDecision(snapshot({ unlockedUntil: after(10 * 60_000), status: 'active' }), now);
  assert.equal(decision.action, 'resume');
  assert.equal(decision.blocked, false);
  assert.equal(decision.canEvaluate, false, 'an evaluation waits for the saved interview to finish');
});

test('placement comes before everything, and an evaluation needs a completed placement', () => {
  const decision = startDecision(snapshot({ placementComplete: false, unlockedUntil: after(10 * 60_000) }), now);
  assert.equal(decision.action, 'placement');
  assert.equal(decision.canEvaluate, false);
  assert.equal(startDecision(snapshot(), now).canEvaluate, true);
});

test('break progress runs from zero to one over the earned minutes and stays in range', () => {
  const at = (left, minutes) => startDecision(snapshot({ unlockedUntil: after(left), unlockMinutes: minutes }), now).progress;
  assert.equal(at(30 * 60_000, 30), 0);
  assert.equal(at(15 * 60_000, 30), 0.5);
  assert.equal(at(60 * 60_000, 30), 0, 'a longer break than the current setting never goes negative');
  assert.equal(startDecision(snapshot(), now).progress, 0);
  const odd = startDecision(snapshot({ unlockedUntil: after(60_000), unlockMinutes: 0 }), now);
  assert.ok(odd.progress >= 0 && odd.progress <= 1);
});

test('the start control and the 409 notice share one wording', () => {
  assert.equal(breakHeadline(1), '1 minute left');
  assert.equal(breakHeadline(28), '28 minutes left');
  const notice = breakNotice(28);
  assert.ok(notice.includes('28 minutes left'));
  assert.ok(notice.includes(BREAK_OPENS) && notice.includes(BREAK_MEANWHILE));
  assert.ok(breakNotice(1).includes('1 minute left'));
  const unknown = breakNotice(0);
  assert.ok(unknown.includes('still active') && unknown.includes(BREAK_OPENS), 'it still reads well when the time left is not known');
  assert.ok(!notice.includes('Practice again'), 'the raw server message is never shown');
  assert.ok(![notice, unknown, BREAK_OPENS, BREAK_MEANWHILE].some(text => text.includes('—')), 'no em dashes');
});
