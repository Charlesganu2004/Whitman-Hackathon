# iPhone testing and Screen Time

## Expo Go

Expo Go runs accounts, onboarding, resume submission, interview practice, lessons, streaks and metrics. It cannot run this repository’s native Screen Time module or block other apps. The Focus screen labels this mode as practice-only. Completing practice still records progress and the earned access window, without claiming that Instagram or TikTok was blocked. Expo explains this boundary in [custom native code](https://docs.expo.dev/workflow/customizing/).

For an Expo Go test, start the backend and Expo as described in the repository README. Set `EXPO_PUBLIC_API_URL` to this computer’s LAN address. An iPhone cannot reach this computer through `localhost`. Connect both devices to the same network and allow the backend port through the Windows firewall. Scan Expo’s QR code with the iPhone camera and open it in Expo Go.

## Native iPhone build

Actual selected-app shielding requires a custom iPhone development build, an Apple Developer team, valid signing, and Screen Time capabilities. `modules/interview-focus` is a local Expo module. Its plugin creates and embeds `InterviewFocusMonitor`, links Apple’s frameworks, adds App Group and Family Controls entitlements to both targets, and declares the extension to EAS. See [Expo local modules](https://docs.expo.dev/modules/get-started/) and [EAS app extensions](https://docs.expo.dev/build-reference/app-extensions/).

Use these identifiers when configuring the Apple Developer account:

- App: `com.charlesganu.interviewunlocked`
- Monitor extension: `com.charlesganu.interviewunlocked.focusmonitor`
- Shared App Group: `group.com.charlesganu.interviewunlocked`

Enable Family Controls for both App IDs and attach the shared App Group to both. Distribution, including distributing entitled builds to testers, needs the appropriate provisioning profiles. The Apple account holder must request Family Controls distribution access for the app and its Screen Time extension before distribution. See [Apple’s entitlement request instructions](https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement).

On a Mac with Xcode and this checkout, install the audited lockfile dependencies and build a connected physical iPhone:

```sh
npm ci
npx expo prebuild --platform ios
npx expo run:ios --device
```

If signing needs intervention, open the generated Xcode workspace, select the Apple team for both targets, and confirm both capabilities and App Group membership. Start Metro for that development build:

```sh
npx expo start --dev-client
```

For an EAS development build, authenticate with the repository owner’s Expo account, register the tester device, and use the supplied profile:

```sh
npx eas-cli device:create
npx eas-cli build --platform ios --profile development
```

EAS will require an Expo project and Apple signing setup. Supply `EXPO_PUBLIC_API_URL` for the reachable backend when building or starting Metro. Development permits local HTTP. Preview and production set `APP_ENV=production` and require an HTTPS backend.

## How shielding works

**Locked by default.** In the native build the chosen apps are shielded from the moment they are picked, not only while an interview is running. They open for the break a passed daily interview earns, and the shield returns when that break ends. The rule is one tested function, `focusAction` in `src/core/focusPolicy.ts` (`tests/focus-policy.test.mjs`), which the app applies every time fresh progress arrives and right after the app picker closes. An emergency release is the student's explicit exit and is never undone automatically. None of this can run in Expo Go.

The student grants individual Screen Time authorization and chooses individual apps in Apple’s native picker. Only opaque application tokens are stored in the App Group; names, bundle IDs and tokens are not sent to the backend. Website and category selections are discarded. Keep Interview Unlocked unselected so practice and emergency release remain reachable. Apple can invalidate all tokens after authorization is revoked, so the module clears selections after revocation and asks the student to authorize and select again. See [Apple’s selection privacy and revocation behavior](https://developer.apple.com/documentation/familycontrols/familyactivityselection).

Apple’s authorization status starts as `notDetermined` in a new process until authorization is requested. That initial value is not treated as revocation. After launching the native app again, tap Allow Screen Time to check access before changing focus settings; the persisted selection and monitor continue independently. The monitor never reads `AuthorizationCenter` from its background callback. See [Apple’s authorization status contract](https://developer.apple.com/documentation/familycontrols/authorizationcenter/authorizationstatus).

Starting focus shields the selected apps with a named `ManagedSettingsStore`. Passing practice clears that store until the earned expiry and registers a nonrepeating Device Activity interval ending at expiry. Its start is at least sixteen minutes earlier, including a past start for short rewards, because Apple requires [at least fifteen minutes](https://developer.apple.com/documentation/deviceactivity/deviceactivitycenter/monitoringerror/intervaltooshort). The monitor checks the persisted grant at its callbacks and restores shields after expiry. A daily recovery monitor and app foreground reconciliation also check expired grants. The app and extension coordinate reads and shield changes with a file lock.

Device Activity callbacks happen when the device is used; they are not a promise of a callback at an exact wall-clock instant while the phone is asleep. Apple documents [interval end callbacks](https://developer.apple.com/documentation/deviceactivity/deviceactivitymonitor/intervaldidend(for:)) and [interval start callbacks](https://developer.apple.com/documentation/deviceactivity/deviceactivitymonitor/intervaldidstart(for:)). If iOS rejects monitoring setup, the native function rejects and does not report a successful unlock.

Emergency release clears this app’s settings and cancels its monitors without requiring a correct answer. Its suppression flag persists across relaunch, expired grants, completed practice and foreground refresh. Only the student’s explicit Start focus or Resume app blocking action clears it. The student can also revoke this app’s access in iPhone Settings under Screen Time. This uses individual consent; it does not make the device impossible to unlock, prevent uninstalling the app, or lock phone calls and every application.

## Physical-device acceptance checklist

1. In Expo Go, confirm Focus says practice-only and completing practice does not claim OS blocking.
2. In the signed native build, deny authorization. Practice must remain available and no apps should be shielded.
3. Authorize, select Instagram and TikTok individually, and save. Confirm the selected count. Canceling the picker must preserve the old selection.
4. Start a daily focus session. Open both selected apps and confirm Apple’s shields. An unselected app must stay usable.
5. Fail a question. Read the feedback and answer the replacement; selected apps must stay shielded until the full required session is passed.
6. Pass the session. Confirm selected apps become usable and the access expiry appears. Close Interview Unlocked, use a selected app after expiry, and confirm shielding returns.
7. Repeat the expiry test with Interview Unlocked terminated and the phone asleep at expiry, then wake it. Check short rewards as well as the normal reward duration.
8. Use emergency release during a lock and during an access window. Relaunch the app and complete practice. Confirm selected apps stay accessible after the former expiry until you explicitly resume app blocking.
9. Revoke Screen Time authorization in Settings. Confirm shields disappear and reopening Interview Unlocked resets the selection. Reauthorize and select again.
10. Change the selection while shielded. Confirm removed apps are available and newly selected apps are shielded. Saving an empty selection must release all selected apps.
11. Restart the iPhone during a lock and during a grant. Check persistence, later relocking, and emergency release. Check a changed time zone and daylight-saving transition.

## Verification boundary

Windows can validate TypeScript, Expo config generation, autolinking and the generated Xcode target structure. It cannot compile these Apple frameworks or verify operating-system shielding on an iPhone. Native compilation, provisioning, authorization, picker behavior, background callbacks, reboot behavior and actual selected-app shielding require the Mac and physical-device checks above. Until those checks pass, treat the native implementation as unverified on-device.

Run config/autolinking checks and the plugin’s PBX project fixture check on Windows or Mac:

```sh
node modules/interview-focus/verify-expo-config.cjs
node modules/interview-focus/verify-plugin.cjs
```

After actual iOS prebuild on Mac or Linux, validate the generated project:

```sh
node modules/interview-focus/verify-native-config.cjs
```

The project fixture confirms target structure and repeatability. It does not compile Swift, run Expo’s real iOS prebuild, obtain Apple capabilities, or test OS enforcement.
