const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const configPlugins = path.dirname(require.resolve('expo/config-plugins', { paths: [root] }));
const xcode = require(require.resolve('xcode', { paths: [configPlugins] }));
const importedPlist = require(require.resolve('@expo/plist', { paths: [configPlugins] }));
const plist = importedPlist.default || importedPlist;
const withInterviewFocus = require(path.join(root, 'plugins/withInterviewFocus.cjs'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'interview-focus-plugin-'));

async function main() {
  const ios = path.join(temporary, 'ios');
  const projectDirectory = path.join(ios, 'InterviewUnlocked.xcodeproj');
  const hostDirectory = path.join(ios, 'InterviewUnlocked');
  fs.mkdirSync(projectDirectory, { recursive: true });
  fs.mkdirSync(hostDirectory, { recursive: true });
  const entitlementPath = 'InterviewUnlocked/InterviewUnlocked.entitlements';
  fs.writeFileSync(path.join(ios, entitlementPath), plist.build({
    'com.apple.developer.family-controls': true,
    'com.apple.security.application-groups': ['group.com.charlesganu.interviewunlocked'],
  }));

  const names = ['project', 'mainGroup', 'products', 'host', 'hostProduct', 'configurations', 'debug', 'release', 'sources', 'frameworks', 'resources'];
  const ids = Object.fromEntries(names.map((name, index) => [name, `A${(index + 1).toString(16).padStart(23, '0').toUpperCase()}`]));
  const ref = (value, comment) => ({ value, comment });
  const settings = {
    CODE_SIGN_ENTITLEMENTS: entitlementPath, IPHONEOS_DEPLOYMENT_TARGET: '17.0',
    DEVELOPMENT_TEAM: 'TESTTEAM00', PRODUCT_BUNDLE_IDENTIFIER: 'com.charlesganu.interviewunlocked',
  };
  const projectFile = path.join(projectDirectory, 'project.pbxproj');
  let project = xcode.project(projectFile);
  project.hash = {
    project: {
      archiveVersion: 1, classes: {}, objectVersion: 56, rootObject: ids.project,
      objects: {
        PBXProject: { [ids.project]: {
          isa: 'PBXProject', buildConfigurationList: ids.configurations, mainGroup: ids.mainGroup,
          productRefGroup: ids.products, compatibilityVersion: '"Xcode 14.0"',
          developmentRegion: 'en', knownRegions: ['en', 'Base'], targets: [ref(ids.host, 'InterviewUnlocked')],
        } },
        PBXGroup: {
          [ids.mainGroup]: { isa: 'PBXGroup', children: [ref(ids.products, 'Products')], sourceTree: '"<group>"' },
          [ids.products]: { isa: 'PBXGroup', children: [ref(ids.hostProduct, 'InterviewUnlocked.app')], name: 'Products', sourceTree: '"<group>"' },
        },
        PBXFileReference: { [ids.hostProduct]: {
          isa: 'PBXFileReference', explicitFileType: 'wrapper.application', includeInIndex: 0,
          path: 'InterviewUnlocked.app', sourceTree: 'BUILT_PRODUCTS_DIR',
        } },
        PBXNativeTarget: { [ids.host]: {
          isa: 'PBXNativeTarget', buildConfigurationList: ids.configurations,
          buildPhases: [ref(ids.sources, 'Sources'), ref(ids.frameworks, 'Frameworks'), ref(ids.resources, 'Resources')],
          buildRules: [], dependencies: [], name: 'InterviewUnlocked', productName: 'InterviewUnlocked',
          productReference: ids.hostProduct, productType: '"com.apple.product-type.application"',
        } },
        XCConfigurationList: { [ids.configurations]: {
          isa: 'XCConfigurationList', buildConfigurations: [ref(ids.debug, 'Debug'), ref(ids.release, 'Release')],
          defaultConfigurationIsVisible: 0, defaultConfigurationName: 'Release',
        } },
        XCBuildConfiguration: {
          [ids.debug]: { isa: 'XCBuildConfiguration', name: 'Debug', buildSettings: { ...settings } },
          [ids.release]: { isa: 'XCBuildConfiguration', name: 'Release', buildSettings: { ...settings } },
        },
        PBXSourcesBuildPhase: { [ids.sources]: { isa: 'PBXSourcesBuildPhase', buildActionMask: 2147483647, files: [], runOnlyForDeploymentPostprocessing: 0 } },
        PBXFrameworksBuildPhase: { [ids.frameworks]: { isa: 'PBXFrameworksBuildPhase', buildActionMask: 2147483647, files: [], runOnlyForDeploymentPostprocessing: 0 } },
        PBXResourcesBuildPhase: { [ids.resources]: { isa: 'PBXResourcesBuildPhase', buildActionMask: 2147483647, files: [], runOnlyForDeploymentPostprocessing: 0 } },
      },
    },
  };
  fs.writeFileSync(projectFile, project.writeSync());
  project = xcode.project(projectFile).parseSync();

  const config = withInterviewFocus({
    name: 'Interview Unlocked', slug: 'interview-unlocked', version: '1.0.0',
    ios: { bundleIdentifier: 'com.charlesganu.interviewunlocked' },
  }, { appGroup: 'group.com.charlesganu.interviewunlocked', allowLocalHttp: true });
  for (let pass = 0; pass < 2; pass++) {
    await config.mods.ios.xcodeproj({
      ...config, modResults: project,
      modRequest: { projectRoot: root, platformProjectRoot: ios, platform: 'ios', modName: 'xcodeproj', introspect: false },
    });
    fs.writeFileSync(projectFile, project.writeSync());
    project = xcode.project(projectFile).parseSync();
    const check = spawnSync(process.execPath, [path.join(__dirname, 'verify-native-config.cjs'), ios], { encoding: 'utf8', cwd: root });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  }
  console.log('PASS: Xcode plugin creates a parseable monitor target and remains idempotent after two passes on a project fixture.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  const absolute = path.resolve(temporary);
  assert.equal(path.dirname(absolute), path.resolve(os.tmpdir()));
  assert.ok(path.basename(absolute).startsWith('interview-focus-plugin-'));
  fs.rmSync(absolute, { recursive: true, force: true });
});
