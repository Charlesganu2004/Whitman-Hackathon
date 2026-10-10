import assert from 'node:assert/strict';
import test from 'node:test';
import { OFFLINE_REASON, offlineGuidance, ONLINE_NOTICE_MS, retryDelayMs, RETRY_STEADY_MS } from '../src/core/connection.ts';

test('retries wait 3 s, 6 s and 12 s, then every 20 s', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 50].map(retryDelayMs), [3000, 6000, 12000, 20000, 20000, 20000, 20000]);
  assert.equal(RETRY_STEADY_MS, 20000);
});

test('the schedule never goes backwards, so a long outage does not hammer the server', () => {
  let previous = 0;
  for (let attempt = 0; attempt < 40; attempt++) {
    const delay = retryDelayMs(attempt);
    assert.ok(delay >= previous, `attempt ${attempt}`);
    previous = delay;
  }
});

test('an odd attempt number falls back to a sensible wait', () => {
  assert.equal(retryDelayMs(-4), 3000);
  assert.equal(retryDelayMs(Number.NaN), 3000);
  assert.equal(retryDelayMs(Number.POSITIVE_INFINITY), 20000);
  assert.equal(retryDelayMs(1.9), 6000, 'a fraction counts as the attempt it started');
});

test('the guidance names the address, gives the fix for the platform and says what still works', () => {
  const phone = offlineGuidance('phone', 'http://192.168.1.20:3001', true);
  assert.equal(phone.title, 'Cannot reach the Unscroll server');
  assert.equal(phone.tried, 'Trying http://192.168.1.20:3001');
  assert.ok(phone.fix.includes('same Wi-Fi') && phone.fix.includes('npm run demo'));
  assert.ok(!phone.fix.includes('npm run server'));
  const web = offlineGuidance('web', 'http://localhost:3001', true);
  assert.equal(web.tried, 'Trying http://localhost:3001');
  assert.ok(web.fix.includes('Start the server') && web.fix.includes('npm run server'));
  assert.ok(!web.fix.includes('Wi-Fi'));
  assert.ok(phone.saved.includes('saved progress stays readable'));
});

test('without a saved snapshot the guidance does not promise readable progress', () => {
  const guidance = offlineGuidance('web', 'http://localhost:3001', false);
  assert.ok(!guidance.saved.includes('saved progress'));
  assert.ok(guidance.saved.includes('Logging in'));
});

test('connection copy has no em dashes and the disabled reason points at the retry', () => {
  const text = [OFFLINE_REASON, ...['web', 'phone'].flatMap(platform => Object.values(offlineGuidance(platform, 'http://x:1', true)))].join(' ');
  assert.ok(!text.includes('—'));
  assert.ok(OFFLINE_REASON.includes('Try again'));
  assert.ok(ONLINE_NOTICE_MS > 0 && ONLINE_NOTICE_MS < 10_000, 'the notice is short');
});
