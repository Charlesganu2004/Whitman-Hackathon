import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraftSaver, DRAFT_DELAY_MS, draftKey, DRAFT_PREFIX } from '../src/core/draft.ts';

// A hand-driven clock so the pause can be tested without waiting for it.
function clock() {
  let now = 0, next = 1;
  const timers = new Map();
  return {
    schedule: (run, milliseconds) => { const id = next++; timers.set(id, { run, at: now + milliseconds }); return id; },
    cancelSchedule: id => { timers.delete(id); },
    advance(milliseconds) {
      now += milliseconds;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.run(); }
    },
    pending: () => timers.size,
  };
}
function harness(extra = {}) {
  const time = clock();
  const log = [];
  const saver = createDraftSaver({
    write: async text => { log.push(['write', text]); },
    clear: async () => { log.push(['clear']); },
    onSaved: () => log.push(['saved']),
    schedule: time.schedule, cancelSchedule: time.cancelSchedule, ...extra,
  });
  return { time, log, saver };
}
const settled = () => new Promise(resolve => setImmediate(resolve));

test('a draft is keyed by session and question, so two questions never share one', () => {
  assert.equal(draftKey('s1', 'q1'), 'draft:s1:q1');
  assert.notEqual(draftKey('s1', 'q1'), draftKey('s1', 'q2'));
  assert.notEqual(draftKey('s1', 'q1'), draftKey('s2', 'q1'));
  assert.ok(draftKey('s1', 'q1').startsWith(DRAFT_PREFIX));
});

test('typing is written once, after the pause, with the latest text', async () => {
  const { time, log, saver } = harness();
  saver.change('I would start');
  time.advance(DRAFT_DELAY_MS - 1);
  saver.change('I would start by naming');
  time.advance(DRAFT_DELAY_MS - 1);
  assert.deepEqual(log, [], 'the pause restarts on every keystroke');
  time.advance(1);
  await settled();
  assert.deepEqual(log, [['write', 'I would start by naming'], ['saved']]);
  assert.equal(time.pending(), 0);
});

test('leaving the screen writes a pending draft at once and does not write twice', async () => {
  const { time, log, saver } = harness();
  saver.change('half an answer');
  saver.flush();
  await settled();
  assert.deepEqual(log, [['write', 'half an answer'], ['saved']]);
  time.advance(DRAFT_DELAY_MS * 3);
  saver.flush();
  await settled();
  assert.equal(log.filter(entry => entry[0] === 'write').length, 1);
});

test('a blank draft clears storage instead of saving whitespace', async () => {
  const { time, log, saver } = harness();
  saver.change('   \n ');
  time.advance(DRAFT_DELAY_MS);
  await settled();
  assert.deepEqual(log, [['clear']], 'nothing is reported as saved');
});

test('discarding after a graded answer removes the stored draft and cancels a pending write', async () => {
  const { time, log, saver } = harness();
  saver.change('graded text');
  saver.discard();
  time.advance(DRAFT_DELAY_MS * 2);
  await settled();
  assert.deepEqual(log, [['clear']]);
});

test('a storage failure is swallowed and is not reported as saved', async () => {
  const { time, log, saver } = harness({ write: async () => { throw new Error('storage is full'); } });
  saver.change('text');
  time.advance(DRAFT_DELAY_MS);
  await settled();
  assert.deepEqual(log, []);
  const synchronous = harness({ write: () => { throw new Error('blocked'); }, clear: () => { throw new Error('blocked'); } });
  synchronous.saver.change('text');
  assert.doesNotThrow(() => { synchronous.time.advance(DRAFT_DELAY_MS); synchronous.saver.discard(); });
});

test('the real timer is used when none is injected', async () => {
  const log = [];
  const saver = createDraftSaver({ write: async text => { log.push(text); }, clear: async () => undefined, delay: 5 });
  saver.change('typed');
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.deepEqual(log, ['typed']);
});
