import test from 'node:test';
import assert from 'node:assert/strict';
import { focusAction } from '../src/core/focusPolicy.ts';

const NOW = Date.parse('2026-10-10T18:00:00Z');
const later = new Date(NOW + 30 * 60_000).toISOString();
const earlier = new Date(NOW - 60_000).toISOString();
const ready = { supported: true, authorized: true, selectedCount: 3, blocking: false, emergencyReleased: false };

test('chosen apps lock by default, before any interview has started', () => {
  assert.equal(focusAction(ready, null, NOW), 'lock');
  assert.equal(focusAction(ready, undefined, NOW), 'lock');
});

test('an expired break locks the apps again and a running shield is left alone', () => {
  assert.equal(focusAction(ready, earlier, NOW), 'lock');
  assert.equal(focusAction({ ...ready, blocking: true }, earlier, NOW), 'none');
  assert.equal(focusAction({ ...ready, blocking: true }, null, NOW), 'none');
});

test('an earned break opens a shield that is still up and does nothing once it is open', () => {
  assert.equal(focusAction({ ...ready, blocking: true }, later, NOW), 'unlock');
  assert.equal(focusAction(ready, later, NOW), 'none');
});

test('an emergency release is never undone automatically', () => {
  assert.equal(focusAction({ ...ready, emergencyReleased: true }, null, NOW), 'none');
  assert.equal(focusAction({ ...ready, emergencyReleased: true }, earlier, NOW), 'none');
});

test('nothing happens without the native module, authorization or a selection', () => {
  assert.equal(focusAction({ ...ready, supported: false }, null, NOW), 'none');
  assert.equal(focusAction({ ...ready, authorized: false }, null, NOW), 'none');
  assert.equal(focusAction({ ...ready, selectedCount: 0 }, null, NOW), 'none');
});

test('a malformed expiry is treated as no break', () => {
  assert.equal(focusAction(ready, 'not a date', NOW), 'lock');
});
