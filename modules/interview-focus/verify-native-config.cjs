const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const configPlugins = path.dirname(require.resolve('expo/config-plugins', { paths: [root] }));
const xcode = require(require.resolve('xcode', { paths: [configPlugins] }));
const importedPlist = require(require.resolve('@expo/plist', { paths: [configPlugins] }));
const plist = importedPlist.default || importedPlist;
const ios = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'ios');
const projectDirectories = fs.readdirSync(ios).filter(name => name.endsWith('.xcodeproj'));
assert.equal(projectDirectories.length, 1, 'Expected exactly one generated Xcode project.');
const projectFile = path.join(ios, projectDirectories[0], 'project.pbxproj');
const project = xcode.project(projectFile).parseSync();
const objects = project.hash.project.objects;
const entries = section => Object.entries(objects[section] || {}).filter(([key]) => !key.endsWith('_comment'));
const unquote = value => typeof value === 'string' ? value.replace(/^"|"$/g, '') : value;
const targets = entries('PBXNativeTarget');
const hosts = targets.filter(([, target]) => unquote(target.productType) === 'com.apple.product-type.application');
const monitors = targets.filter(([, target]) => unquote(target.name) === 'InterviewFocusMonitor');
assert.equal(hosts.length, 1, 'Expected one host application target.');
assert.equal(monitors.length, 1, 'Monitor target must exist exactly once.');
const [monitorId, monitor] = monitors[0];
const [, host] = hosts[0];
assert.equal(unquote(monitor.productType), 'com.apple.product-type.app-extension');

const monitorConfigurations = objects.XCConfigurationList[monitor.buildConfigurationList].buildConfigurations;
assert.ok(monitorConfigurations.length >= 2, 'Expected debug and release configurations.');
for (const item of monitorConfigurations) {
  const settings = objects.XCBuildConfiguration[item.value].buildSettings;
  assert.equal(unquote(settings.PRODUCT_BUNDLE_IDENTIFIER), 'com.charlesganu.interviewunlocked.focusmonitor');
  assert.equal(unquote(settings.CODE_SIGN_ENTITLEMENTS), 'InterviewFocusMonitor/InterviewFocusMonitor.entitlements');
  assert.equal(unquote(settings.APPLICATION_EXTENSION_API_ONLY), 'YES');
  assert.ok(Number(unquote(settings.IPHONEOS_DEPLOYMENT_TARGET)) >= 16);
}

const phases = monitor.buildPhases.map(item => ({ id: item.value, phase: Object.values(objects).find(section => section[item.value])?.[item.value] }));
const sources = phases.find(item => item.phase?.isa === 'PBXSourcesBuildPhase');
assert.ok(sources, 'Monitor requires a sources build phase.');
const sourceNames = sources.phase.files.map(item => unquote(objects.PBXFileReference[objects.PBXBuildFile[item.value].fileRef].path)).sort();
assert.deepEqual(sourceNames, ['FocusStorage.swift', 'InterviewActivityMonitor.swift']);
const frameworks = phases.find(item => item.phase?.isa === 'PBXFrameworksBuildPhase');
assert.ok(frameworks, 'Monitor requires a frameworks build phase.');
const frameworkNames = frameworks.phase.files.map(item => unquote(objects.PBXFileReference[objects.PBXBuildFile[item.value].fileRef].name)).sort();
assert.deepEqual(frameworkNames, ['DeviceActivity.framework', 'FamilyControls.framework', 'ManagedSettings.framework']);
assert.ok(host.dependencies.some(item => objects.PBXTargetDependency[item.value]?.target === monitorId), 'Host must depend on monitor.');
const embedPhases = host.buildPhases.map(item => objects.PBXCopyFilesBuildPhase?.[item.value]).filter(Boolean);
const embeddings = embedPhases.flatMap(phase => phase.files.filter(item => objects.PBXBuildFile[item.value].fileRef === monitor.productReference));
assert.equal(embeddings.length, 1, 'Monitor must be embedded exactly once.');

const monitorDirectory = path.join(ios, 'InterviewFocusMonitor');
const info = plist.parse(fs.readFileSync(path.join(monitorDirectory, 'Info.plist'), 'utf8'));
const entitlements = plist.parse(fs.readFileSync(path.join(monitorDirectory, 'InterviewFocusMonitor.entitlements'), 'utf8'));
assert.equal(info.InterviewFocusAppGroup, 'group.com.charlesganu.interviewunlocked');
assert.equal(info.NSExtension.NSExtensionPointIdentifier, 'com.apple.deviceactivity.monitor-extension');
assert.equal(info.NSExtension.NSExtensionPrincipalClass, '$(PRODUCT_MODULE_NAME).InterviewActivityMonitor');
assert.equal(entitlements['com.apple.developer.family-controls'], true);
assert.deepEqual(entitlements['com.apple.security.application-groups'], ['group.com.charlesganu.interviewunlocked']);

const hostConfigurations = objects.XCConfigurationList[host.buildConfigurationList].buildConfigurations;
for (const item of hostConfigurations) {
  const settings = objects.XCBuildConfiguration[item.value].buildSettings;
  const entitlementFile = unquote(settings.CODE_SIGN_ENTITLEMENTS);
  assert.ok(entitlementFile, 'Host requires an entitlements file.');
  const hostEntitlements = plist.parse(fs.readFileSync(path.join(ios, entitlementFile), 'utf8'));
  assert.equal(hostEntitlements['com.apple.developer.family-controls'], true);
  assert.ok(hostEntitlements['com.apple.security.application-groups'].includes('group.com.charlesganu.interviewunlocked'));
}
const podspec = fs.readFileSync(path.join(__dirname, 'ios/InterviewFocus.podspec'), 'utf8');
assert.ok(podspec.includes("s.dependency 'ExpoModulesCore'"), 'Local module must link ExpoModulesCore.');
console.log('PASS: host capabilities, monitor target, sources, frameworks, embedding, signing settings and App Group match.');
