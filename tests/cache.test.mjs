import test from 'node:test';
import assert from 'node:assert/strict';

// Install a Map-backed localStorage stub on globalThis before the module's
// top-level code runs, matching the pattern used by cache.web.ts.
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
};

const { readDraft, writeDraft, clearDraft } = await import('../src/services/cache.web.ts');

test('draft isolation: write for one account does not leak to another', async () => {
  await writeDraft('account-a', 'q-1', 'my answer text');
  const ownRead = await readDraft('account-a', 'q-1');
  assert.equal(ownRead, 'my answer text');
  const otherRead = await readDraft('account-b', 'q-1');
  assert.equal(otherRead, null);
});

test('clearDraft removes the target key while leaving other keys intact', async () => {
  await writeDraft('account-a', 'q-1', 'text1');
  await writeDraft('account-a', 'q-2', 'text2');
  await clearDraft('account-a', 'q-1');
  const q1 = await readDraft('account-a', 'q-1');
  assert.equal(q1, null);
  const q2 = await readDraft('account-a', 'q-2');
  assert.equal(q2, 'text2');
});
