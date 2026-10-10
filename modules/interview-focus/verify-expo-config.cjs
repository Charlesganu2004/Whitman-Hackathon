const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
function run(script, arguments_, environment = {}) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...arguments_], {
    cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, env: { ...process.env, ...environment },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
  return JSON.parse(result.stdout);
}

for (const appEnvironment of ['development', 'production']) {
  const config = run('node_modules/expo/bin/cli', ['config', '--type', 'introspect', '--json'], { APP_ENV: appEnvironment });
  assert.equal(config.ios.bundleIdentifier, 'com.charlesganu.interviewunlocked');
  assert.equal(config.android.package, 'com.charlesganu.interviewunlocked');
  const extensions = config.extra.eas.build.experimental.ios.appExtensions;
  const monitors = extensions.filter(extension => extension.targetName === 'InterviewFocusMonitor');
  assert.equal(monitors.length, 1);
  assert.equal(monitors[0].bundleIdentifier, 'com.charlesganu.interviewunlocked.focusmonitor');
  assert.equal(monitors[0].entitlements['com.apple.developer.family-controls'], true);
  assert.deepEqual(monitors[0].entitlements['com.apple.security.application-groups'], ['group.com.charlesganu.interviewunlocked']);
  const ios = config._internal.modResults.ios;
  assert.equal(ios.entitlements['com.apple.developer.family-controls'], true);
  assert.ok(ios.entitlements['com.apple.security.application-groups'].includes('group.com.charlesganu.interviewunlocked'));
  assert.equal(ios.infoPlist.InterviewFocusAppGroup, 'group.com.charlesganu.interviewunlocked');
  assert.ok(ios.infoPlist.NSMicrophoneUsageDescription);
  assert.equal(ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads, appEnvironment === 'development');
  const application = config._internal.modResults.android.manifest.manifest.application[0];
  assert.equal(application.$['android:usesCleartextTraffic'], appEnvironment === 'development' ? 'true' : 'false');
  console.log(`PASS: ${appEnvironment} config, microphone permission, host entitlements, EAS extension and network policy.`);
}

const autolinking = run('node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js', ['resolve', '--platform', 'apple', '--json']);
const modules = autolinking.modules.filter(module => module.packageName === 'interview-focus');
assert.equal(modules.length, 1, 'Local native module must resolve exactly once.');
assert.ok(modules[0].modules.some(module => module.class === 'InterviewFocusModule'), 'Swift module class must be registered.');
assert.ok(modules[0].pods.some(pod => pod.podName === 'InterviewFocus'), 'Native podspec must be resolved.');
console.log('PASS: local InterviewFocus pod and Swift module autolink exactly once.');
