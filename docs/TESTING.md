# Test the hackathon MVP

The Expo Go path tests accounts, onboarding, resume intake, placement, interview practice, lessons and progress. Expo Go cannot shield Instagram, TikTok or other apps. Test actual iPhone shielding separately with the custom development build in [IPHONE.md](IPHONE.md).

## Automated checks

Use Node 24 on Windows or macOS. From the repository root, install the locked dependencies without lifecycle scripts, validate syntax first, then run the checks:

```sh
npm ci --ignore-scripts
node --check scripts/check-environment.mjs
node --env-file-if-exists=.env scripts/check-environment.mjs
npm run typecheck
npm test
npx --no-install expo install --check
npx --no-install expo export --platform web --output-dir dist-web
npx --no-install expo export --platform ios --output-dir dist-ios
node modules/interview-focus/verify-expo-config.cjs
node modules/interview-focus/verify-plugin.cjs
```

The environment check prints Node and SQLite versions, available IPv4 addresses, the API origin and a boolean indicating whether an AI key is configured. It sends no network or AI requests and does not print credentials, resume data or account data. API credentials, provider availability and phone connectivity still require their own tests.

`npm test` uses isolated test databases and deterministic provider substitutes. It does not prove that a live AI account can generate, grade or transcribe answers. JavaScript exports prove that bundles can be generated; they do not prove iPhone installation or Swift compilation.

The [verification workflow](../.github/workflows/verify.yml) runs those checks on Ubuntu with Node 24. Its macOS job runs the real iOS prebuild and validates the generated Xcode host and monitor targets:

```sh
npx --no-install expo prebuild --platform ios --no-install
node modules/interview-focus/verify-native-config.cjs
```

The macOS job does not install CocoaPods, compile Swift, sign an app or exercise Screen Time. The actions are pinned to immutable commits verified against the official [checkout v7.0.1 release](https://github.com/actions/checkout/releases/tag/v7.0.1) and [setup-node v7.1.0 release](https://github.com/actions/setup-node/releases/tag/v7.1.0).

## Run on a Mac and iPhone with Expo Go

1. Pull the repository, use Node 24 and run `npm ci --ignore-scripts`.
2. Copy `.env.example` to `.env`. Set `EXPO_PUBLIC_API_URL` to the Mac's reachable Wi-Fi IPv4 address with port `3001`, or set the same address using **Server connection** in the app. Run the environment check above to find candidates. A phone cannot reach the Mac through `localhost`.
3. For live AI and voice transcription, set `OPENAI_API_KEY` only in the Mac's `.env`. Do not use an `EXPO_PUBLIC_` variable for a provider key. Without a key, typed interview practice uses rubric feedback and voice transcription is unavailable.
4. Run `npm run server` in one terminal. Keep the Mac and iPhone on the same trusted Wi-Fi, permit the Node server through the firewall, and open `http://MAC_WIFI_IP:3001/health` in iPhone Safari. Use the actual address found in step 2. Confirm the health response loads.
5. Run `npm start` in a second terminal. Open the QR code with the iPhone Camera and Expo Go. Use an Expo Go version that supports the project's Expo SDK. If Expo Go reports an SDK mismatch, resolve that mismatch before recording a device pass.
6. Test **Server connection** before signing up. Keep the server running throughout the test; SQLite data is stored on the machine running the server.

Use synthetic resumes and a dedicated test account. Do not put keys, tokens, passwords or resume text in test screenshots, bug reports or committed files. With live AI enabled, submitted answers, resume context and recordings are processed by the configured provider.

## Expo Go acceptance cases

Record the commit, macOS version, Node version, iPhone model/iOS version, Expo Go version and whether AI was configured for each run. Record failures with a reproduction and sanitized error message.

- Create an account, log out, log back in and reject an incorrect password. Confirm persisted progress returns and one account cannot see another account's progress.
- Complete onboarding with major, internship or full-time goal, practice days per week, session length and earned access length. Upload a synthetic TXT and a text PDF resume in separate runs; also test pasted resume text. Confirm invalid or oversized uploads show a useful error.
- Complete placement with exactly two technical and two behavioral questions. Confirm the resulting starting level and dashboard are saved after reopening the app. Technical responses are reviewed as text; submitted code is not executed.
- Start a daily interview. Confirm beginner through advanced sessions contain four to six technical questions and two behavioral questions according to the study target; expert/master sessions contain one hard technical question and two behavioral questions. Use accounts placed at the required level rather than changing database rows during the device run.
- Submit an incorrect daily answer. Confirm no earned access is granted, feedback explains what was missing, review must be acknowledged, and a different question appears. Pass the replacement and remaining questions; confirm the configured earned access window appears. In Expo Go this is a practice result: other apps remain accessible throughout.
- Save and leave an interview, reopen the app and resume the current question. Confirm an answer cannot be submitted twice by repeated taps or that session progress cannot skip a required review.
- With a valid server AI key, record both behavioral answers, allow microphone access, edit the returned transcript and submit. Confirm live feedback is shown. Deny microphone access in a separate run and confirm a useful error plus typed-answer access. Confirm the app describes rubric mode when AI is not configured.
- Open a lesson, read it and try an incorrect knowledge check. Confirm it does not count as complete. Pass the check after the reading interval; confirm completion persists and reopening the completed lesson does not add duplicate progress.
- Complete practice or a lesson and inspect the flame streak, activity, accuracy, technical/behavioral scores and study minutes. Repeat activity on the same day and confirm the streak does not gain another day. Check the account's local date boundary with server tests; do not claim a multi-day physical-device streak from one same-day run.
- Change practice preferences. Confirm new settings affect the next interview and preserve an already started interview.
- Stop the server or disconnect Wi-Fi after a cached sign-in. Reopen the app, confirm the offline message and disabled submissions, reconnect, then confirm progress refreshes. Test a missing or unreachable server address at sign-in and verify the connection error is visible.
- Test small-screen layout, keyboard overlap, scrolling, text scaling and VoiceOver labels on authentication, question submission, lessons and settings.

## Separate native focus acceptance

Follow the physical-device checklist in [IPHONE.md](IPHONE.md). Test Apple authorization, picker selection, daily-session shielding, review and replacement, successful unlock, expiry while the app is closed, reopening, reboot behavior and emergency release. Verify Instagram and TikTok on the actual iPhone. Record Apple signing and entitlement prerequisites separately from app behavior.

Do not count an Expo Go run, JavaScript export, project fixture or prebuild result as evidence that operating-system app shielding works.

## Recorded results

- Local automated integration checks: Pending final integration run and receipt.
- GitHub Ubuntu verification job: Pending first workflow run after push.
- GitHub macOS generated-project job: Pending first workflow run after push.
- Mac/iPhone Expo Go end-to-end cases: Pending physical-device run.
- Live AI generation, grading and voice transcription: Pending configured-provider run.
- Native Swift compilation, signing and physical-device shielding: Pending Mac and entitled iPhone development-build run.
