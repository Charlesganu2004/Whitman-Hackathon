const fs = require('node:fs/promises');
const path = require('node:path');
const { withAndroidManifest, withEntitlementsPlist, withInfoPlist, withXcodeProject } = require('expo/config-plugins');

const targetName = 'InterviewFocusMonitor';
const unquote = value => typeof value === 'string' ? value.replace(/^"|"$/g, '') : value;
const reference = (value, comment) => ({ value, comment });
const xml = value => String(value).replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character]));
const plist = content => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>${content}</dict></plist>\n`;

function addObject(project, sectionName, object, comment) {
  const objects = project.hash.project.objects;
  objects[sectionName] ||= {};
  const id = project.generateUuid();
  objects[sectionName][id] = object;
  objects[sectionName][`${id}_comment`] = comment;
  return id;
}

function findObject(project, sectionName, predicate) {
  return Object.entries(project.hash.project.objects[sectionName] || {})
    .find(([key, value]) => !key.endsWith('_comment') && typeof value === 'object' && predicate(value));
}

function addExtension(project, bundleIdentifier, appVersion, buildNumber) {
  const objects = project.hash.project.objects;
  const host = findObject(project, 'PBXNativeTarget', target => unquote(target.productType) === 'com.apple.product-type.application');
  const root = findObject(project, 'PBXProject', () => true);
  if (!host || !root) throw new Error('InterviewFocus requires an iOS application target and PBXProject.');
  const [hostId, hostTarget] = host;
  const [projectId, projectObject] = root;
  const existing = findObject(project, 'PBXNativeTarget', target => unquote(target.name) === targetName);
  if (existing) {
    const list = objects.XCConfigurationList[existing[1].buildConfigurationList];
    for (const item of list.buildConfigurations) {
      const settings = objects.XCBuildConfiguration[item.value].buildSettings;
      settings.PRODUCT_BUNDLE_IDENTIFIER = bundleIdentifier;
      settings.MARKETING_VERSION = appVersion;
      settings.CURRENT_PROJECT_VERSION = buildNumber;
    }
    return;
  }

  const sourceNames = ['FocusStorage.swift', 'InterviewActivityMonitor.swift'];
  const children = [];
  const sourceBuildFiles = sourceNames.map(name => {
    const fileId = addObject(project, 'PBXFileReference', {
      isa: 'PBXFileReference', lastKnownFileType: 'sourcecode.swift', path: name, sourceTree: '"<group>"',
    }, name);
    children.push(reference(fileId, name));
    return reference(addObject(project, 'PBXBuildFile', { isa: 'PBXBuildFile', fileRef: fileId, fileRef_comment: name }, `${name} in Sources`), `${name} in Sources`);
  });
  for (const name of ['Info.plist', `${targetName}.entitlements`]) {
    children.push(reference(addObject(project, 'PBXFileReference', {
      isa: 'PBXFileReference', lastKnownFileType: 'text.plist.xml', path: name, sourceTree: '"<group>"',
    }, name), name));
  }
  const groupId = addObject(project, 'PBXGroup', {
    isa: 'PBXGroup', children, name: targetName, path: targetName, sourceTree: '"<group>"',
  }, targetName);
  const mainGroup = objects.PBXGroup[projectObject.mainGroup];
  if (!mainGroup) throw new Error('InterviewFocus could not locate the main Xcode group.');
  mainGroup.children.push(reference(groupId, targetName));

  const frameworkBuildFiles = ['FamilyControls', 'ManagedSettings', 'DeviceActivity'].map(name => {
    const frameworkName = `${name}.framework`;
    const fileId = addObject(project, 'PBXFileReference', {
      isa: 'PBXFileReference', lastKnownFileType: 'wrapper.framework', name: frameworkName,
      path: `System/Library/Frameworks/${frameworkName}`, sourceTree: 'SDKROOT',
    }, frameworkName);
    return reference(addObject(project, 'PBXBuildFile', {
      isa: 'PBXBuildFile', fileRef: fileId, fileRef_comment: frameworkName,
    }, `${frameworkName} in Frameworks`), `${frameworkName} in Frameworks`);
  });
  const sourcesId = addObject(project, 'PBXSourcesBuildPhase', {
    isa: 'PBXSourcesBuildPhase', buildActionMask: 2147483647, files: sourceBuildFiles, runOnlyForDeploymentPostprocessing: 0,
  }, 'Sources');
  const frameworksId = addObject(project, 'PBXFrameworksBuildPhase', {
    isa: 'PBXFrameworksBuildPhase', buildActionMask: 2147483647, files: frameworkBuildFiles, runOnlyForDeploymentPostprocessing: 0,
  }, 'Frameworks');
  const resourcesId = addObject(project, 'PBXResourcesBuildPhase', {
    isa: 'PBXResourcesBuildPhase', buildActionMask: 2147483647, files: [], runOnlyForDeploymentPostprocessing: 0,
  }, 'Resources');

  const hostList = objects.XCConfigurationList[hostTarget.buildConfigurationList];
  const configurations = hostList.buildConfigurations.map(item => {
    const hostConfiguration = objects.XCBuildConfiguration[item.value];
    const inherited = hostConfiguration.buildSettings;
    const buildSettings = {
      APPLICATION_EXTENSION_API_ONLY: 'YES', CLANG_ENABLE_MODULES: 'YES',
      CODE_SIGN_ENTITLEMENTS: `${targetName}/${targetName}.entitlements`, CODE_SIGN_STYLE: 'Automatic',
      CURRENT_PROJECT_VERSION: buildNumber, GENERATE_INFOPLIST_FILE: 'NO',
      INFOPLIST_FILE: `${targetName}/Info.plist`,
      IPHONEOS_DEPLOYMENT_TARGET: String(Math.max(16, Number(unquote(inherited.IPHONEOS_DEPLOYMENT_TARGET)) || 16)),
      LD_RUNPATH_SEARCH_PATHS: ['"$(inherited)"', '"@executable_path/Frameworks"', '"@executable_path/../../Frameworks"'],
      MARKETING_VERSION: appVersion, PRODUCT_BUNDLE_IDENTIFIER: bundleIdentifier, PRODUCT_NAME: '"$(TARGET_NAME)"',
      SDKROOT: 'iphoneos', SKIP_INSTALL: 'YES', SUPPORTS_MACCATALYST: 'NO',
      SUPPORTED_PLATFORMS: '"iphoneos iphonesimulator"', SWIFT_VERSION: '5.0', TARGETED_DEVICE_FAMILY: '"1,2"',
    };
    if (inherited.DEVELOPMENT_TEAM) buildSettings.DEVELOPMENT_TEAM = inherited.DEVELOPMENT_TEAM;
    const name = unquote(hostConfiguration.name);
    return reference(addObject(project, 'XCBuildConfiguration', { isa: 'XCBuildConfiguration', buildSettings, name }, name), name);
  });
  const configurationListId = addObject(project, 'XCConfigurationList', {
    isa: 'XCConfigurationList', buildConfigurations: configurations, defaultConfigurationIsVisible: 0, defaultConfigurationName: 'Release',
  }, `Build configuration list for PBXNativeTarget "${targetName}"`);
  const productName = `${targetName}.appex`;
  const productId = addObject(project, 'PBXFileReference', {
    isa: 'PBXFileReference', explicitFileType: '"wrapper.app-extension"', includeInIndex: 0, path: productName, sourceTree: 'BUILT_PRODUCTS_DIR',
  }, productName);
  const products = objects.PBXGroup[projectObject.productRefGroup];
  if (!products) throw new Error('InterviewFocus could not locate the Xcode Products group.');
  products.children.push(reference(productId, productName));
  const targetId = addObject(project, 'PBXNativeTarget', {
    isa: 'PBXNativeTarget', buildConfigurationList: configurationListId,
    buildConfigurationList_comment: `Build configuration list for PBXNativeTarget "${targetName}"`,
    buildPhases: [reference(sourcesId, 'Sources'), reference(frameworksId, 'Frameworks'), reference(resourcesId, 'Resources')],
    buildRules: [], dependencies: [], name: targetName, productName: targetName,
    productReference: productId, productReference_comment: productName, productType: '"com.apple.product-type.app-extension"',
  }, targetName);
  projectObject.targets.push(reference(targetId, targetName));
  const proxyId = addObject(project, 'PBXContainerItemProxy', {
    isa: 'PBXContainerItemProxy', containerPortal: projectId, containerPortal_comment: 'Project object',
    proxyType: 1, remoteGlobalIDString: targetId, remoteInfo: targetName,
  }, 'PBXContainerItemProxy');
  const dependencyId = addObject(project, 'PBXTargetDependency', {
    isa: 'PBXTargetDependency', target: targetId, target_comment: targetName, targetProxy: proxyId, targetProxy_comment: 'PBXContainerItemProxy',
  }, 'PBXTargetDependency');
  hostTarget.dependencies.push(reference(dependencyId, 'PBXTargetDependency'));
  const embedFileId = addObject(project, 'PBXBuildFile', {
    isa: 'PBXBuildFile', fileRef: productId, fileRef_comment: productName, settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
  }, `${productName} in Embed App Extensions`);
  const embedId = addObject(project, 'PBXCopyFilesBuildPhase', {
    isa: 'PBXCopyFilesBuildPhase', buildActionMask: 2147483647, dstPath: '""', dstSubfolderSpec: 13,
    files: [reference(embedFileId, `${productName} in Embed App Extensions`)], name: '"Embed App Extensions"', runOnlyForDeploymentPostprocessing: 0,
  }, 'Embed App Extensions');
  hostTarget.buildPhases.push(reference(embedId, 'Embed App Extensions'));
}

module.exports = function withInterviewFocus(config, options = {}) {
  const bundleIdentifier = config.ios?.bundleIdentifier;
  if (!bundleIdentifier) throw new Error('Set ios.bundleIdentifier before applying InterviewFocus.');
  const appGroup = options.appGroup || `group.${bundleIdentifier}`;
  const extensionIdentifier = `${bundleIdentifier}.focusmonitor`;
  const entitlements = { 'com.apple.developer.family-controls': true, 'com.apple.security.application-groups': [appGroup] };

  config = withEntitlementsPlist(config, result => {
    result.modResults['com.apple.developer.family-controls'] = true;
    result.modResults['com.apple.security.application-groups'] = [...new Set([...(result.modResults['com.apple.security.application-groups'] || []), appGroup])];
    return result;
  });
  config = withInfoPlist(config, result => {
    result.modResults.InterviewFocusAppGroup = appGroup;
    return result;
  });
  config = withAndroidManifest(config, result => {
    const application = result.modResults.manifest.application?.[0];
    if (application) application.$['android:usesCleartextTraffic'] = options.allowLocalHttp ? 'true' : 'false';
    return result;
  });

  config.extra ||= {};
  config.extra.eas ||= {};
  config.extra.eas.build ||= {};
  config.extra.eas.build.experimental ||= {};
  config.extra.eas.build.experimental.ios ||= {};
  const extensions = config.extra.eas.build.experimental.ios.appExtensions || [];
  config.extra.eas.build.experimental.ios.appExtensions = [
    ...extensions.filter(extension => extension.targetName !== targetName),
    { targetName, bundleIdentifier: extensionIdentifier, entitlements },
  ];

  return withXcodeProject(config, async result => {
    const directory = path.join(result.modRequest.platformProjectRoot, targetName);
    const moduleDirectory = path.join(result.modRequest.projectRoot, 'modules', 'interview-focus');
    await fs.mkdir(directory, { recursive: true });
    await fs.copyFile(path.join(moduleDirectory, 'ios', 'FocusStorage.swift'), path.join(directory, 'FocusStorage.swift'));
    await fs.copyFile(path.join(moduleDirectory, 'extension', 'InterviewActivityMonitor.swift'), path.join(directory, 'InterviewActivityMonitor.swift'));
    await fs.writeFile(path.join(directory, 'Info.plist'), plist(`
      <key>CFBundleDisplayName</key><string>Interview Focus</string>
      <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
      <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
      <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
      <key>CFBundlePackageType</key><string>XPC!</string>
      <key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
      <key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
      <key>InterviewFocusAppGroup</key><string>${xml(appGroup)}</string>
      <key>NSExtension</key><dict>
        <key>NSExtensionPointIdentifier</key><string>com.apple.deviceactivity.monitor-extension</string>
        <key>NSExtensionPrincipalClass</key><string>$(PRODUCT_MODULE_NAME).InterviewActivityMonitor</string>
      </dict>`));
    await fs.writeFile(path.join(directory, `${targetName}.entitlements`), plist(`
      <key>com.apple.developer.family-controls</key><true/>
      <key>com.apple.security.application-groups</key><array><string>${xml(appGroup)}</string></array>`));
    addExtension(result.modResults, extensionIdentifier, config.version || '1.0.0', config.ios?.buildNumber || '1');
    return result;
  });
};
