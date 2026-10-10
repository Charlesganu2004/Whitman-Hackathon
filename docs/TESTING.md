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

`npm run check:environment` runs the same environment script as the third line above. The environment check fails unless Node is version 24. It prints the Node and SQLite versions, the available IPv4 addresses, the configured API origin when one is set, a phone address candidate for each IPv4 address, and whether the `GROQ_API_KEY`, `NVIDIA_API_KEY` and `OPENAI_API_KEY` values are set. It reports true or false for each key and never prints a value. It also reports which grading and speech providers would be used. It sends no network or AI requests and does not print credentials, resume data or account data. Provider availability and phone connectivity still need their own tests.

`npm test` runs every `tests/*.test.mjs` file with isolated test databases and deterministic provider substitutes. It does not prove that a live AI account can generate, grade or transcribe answers. `npm run check:ai` is the one command in this list that calls a live provider. When a provider key is set, it sends one grading request with fictional data. When no key is set, it prints that rubric mode is active and sends nothing. JavaScript exports prove that bundles can be generated; they do not prove iPhone installation or Swift compilation.

The [verification workflow](../.github/workflows/verify.yml) runs those checks on Ubuntu with Node 24. Its macOS job runs the real iOS prebuild and validates the generated Xcode host and monitor targets:

```sh
npx --no-install expo prebuild --platform ios --no-install
node modules/interview-focus/verify-native-config.cjs
```

The macOS job does not install CocoaPods, compile Swift, sign an app or exercise Screen Time. The actions are pinned to immutable commits verified against the official [checkout v7.0.1 release](https://github.com/actions/checkout/releases/tag/v7.0.1) and [setup-node v7.1.0 release](https://github.com/actions/setup-node/releases/tag/v7.1.0).

## Run on a Mac and iPhone with Expo Go

1. Pull the repository, use Node 24 and run `npm ci --ignore-scripts`.
2. Run `npm run demo` from the repository root. It creates `.env` from `.env.example` when `.env` is missing, starts the API on port 3001 (or reuses one already answering there), starts Expo in Expo Go mode, and prints whether AI feedback and voice are on. The phone finds the computer by itself. Set `EXPO_PUBLIC_API_URL` in `.env` only to force another address. A phone cannot reach the Mac through `localhost`. Run `npm run check:environment` to list the candidate addresses.
3. Provider keys go in the Mac's `.env` only: `GROQ_API_KEY` for Groq grading and voice, `NVIDIA_API_KEY` for NVIDIA grading, and `OPENAI_API_KEY` if you use OpenAI. Speech transcription needs Groq or OpenAI, because NVIDIA does not transcribe. Do not use an `EXPO_PUBLIC_` variable for a provider key, because that value ships inside the app. Without any key, typed interview practice uses rubric feedback and voice transcription is unavailable.
4. If you run the API separately, use `npm run server` in one terminal and `npm start` in another. Keep the Mac and iPhone on the same trusted Wi-Fi, permit the Node server through the firewall, and open `http://MAC_WIFI_IP:3001/health` in iPhone Safari. Use the address that `npm run check:environment` listed. Confirm the health response loads. It reports the grading and speech providers in use.
5. Open the QR code with the iPhone Camera and Expo Go. Use an Expo Go version that supports the project's Expo SDK. If Expo Go reports an SDK mismatch, resolve that mismatch before recording a device pass.
6. Test **Server connection** before signing up. In the app, that button opens a **Server URL** field with a **Test connection** button. Keep the server running throughout the test; SQLite data is stored on the machine running the server.

Use synthetic resumes and a dedicated test account. Do not put keys, tokens, passwords or resume text in test screenshots, bug reports or committed files. With live AI enabled, submitted answers, resume context and recordings are processed by the configured provider.

## Expo Go acceptance cases

Record the commit, macOS version, Node version, iPhone model/iOS version, Expo Go version and whether AI was configured for each run. Record failures with a reproduction and sanitized error message.

- Create an account, log out, log back in and reject an incorrect password. Confirm persisted progress returns and one account cannot see another account's progress.
- Complete onboarding with major, internship or full-time goal, practice days per week, session length and earned access length. Upload a synthetic TXT and a text PDF resume in separate runs; also test pasted resume text. Confirm invalid or oversized uploads show a useful error.
- Complete placement with exactly two technical and two behavioral questions. Confirm the resulting starting level and dashboard are saved after reopening the app. Technical responses are reviewed as text; submitted code is not executed.
- Start a daily interview. Confirm beginner through advanced sessions contain four to six technical questions and two behavioral questions according to the study target; expert/master sessions contain one hard technical question and two behavioral questions. Use accounts placed at the required level rather than changing database rows during the device run.
- Submit an incorrect daily answer. Confirm no earned access is granted, feedback explains what was missing, review must be acknowledged, and a different question appears. Pass the replacement and remaining questions; confirm the configured earned access window appears. In Expo Go this is a practice result: other apps remain accessible throughout.
- Save and leave an interview, reopen the app and resume the current question. Confirm an answer cannot be submitted twice by repeated taps or that session progress cannot skip a required review. (In progress: not verified on 2026-10-10.)
- With a valid server AI key, record both behavioral answers, allow microphone access, edit the returned transcript and submit. Confirm live feedback is shown. Deny microphone access in a separate run and confirm a useful error plus typed-answer access. Confirm the app describes rubric mode when AI is not configured.
- Open a lesson, read it and try an incorrect knowledge check. Confirm it does not count as complete. Pass the check after the reading interval; confirm completion persists and reopening the completed lesson does not add duplicate progress.
- Complete practice or a lesson and inspect the flame streak, activity, accuracy, technical/behavioral scores and study minutes. Repeat activity on the same day and confirm the streak does not gain another day. Check the account's local date boundary with server tests; do not claim a multi-day physical-device streak from one same-day run.
- Change practice preferences. Confirm new settings affect the next interview and preserve an already started interview.
- Stop the server or disconnect Wi-Fi after a cached sign-in. Reopen the app, confirm the offline message and disabled submissions, reconnect, then confirm progress refreshes. Test a missing or unreachable server address at sign-in and verify the connection error is visible. (In progress: the designed offline state with automatic retry is not verified yet.)
- Test small-screen layout, keyboard overlap, scrolling, text scaling and VoiceOver labels on authentication, question submission, lessons and settings.

## Separate native focus acceptance

Follow the physical-device checklist in [IPHONE.md](IPHONE.md). Test Apple authorization, picker selection, daily-session shielding, review and replacement, successful unlock, expiry while the app is closed, reopening, reboot behavior and emergency release. Verify Instagram and TikTok on the actual iPhone. Record Apple signing and entitlement prerequisites separately from app behavior.

Do not count an Expo Go run, JavaScript export, project fixture or prebuild result as evidence that operating-system app shielding works.

## Recorded results

- Earlier local automated integration checks, October 10, 2026, superseded by the [2026-10-10 results](#2026-10-10-results) below: `npm run typecheck` exited 0 and `npm test` reported no failures. Coverage includes authentication/persistence, resume boundaries, failed-answer replacement, daily reward rules, promotion evidence, provider failures, and local-code grading regressions for quoted/dead code and suffix mutations.
- Final web and iOS JavaScript exports exited 0. Expo config checks passed for development and production; the local pod/Swift module autolink check passed; the Xcode plugin fixture remained parseable and idempotent across two passes. These checks do not compile Swift or exercise an iPhone.
- Browser check at 390 × 844: signup, four-step survey, pasted resume, four-answer expert placement, failed daily answer, feedback acknowledgement and a different replacement question, three-answer daily completion with a 30-minute earned break, roadmap evidence, company goals, two-session target, and dark/pink appearance. A reload resumed the saved placement. Old question headings no longer remain after transitions. Width checks at 320 and 430 pixels matched `document.documentElement.scrollWidth` with no horizontal overflow.
- GitHub baseline verification: [run 38027167712](https://github.com/Charlesganu2004/Whitman-Hackathon/actions/runs/38027167712), commit `74692e2086aacb279d15013d08d4b997e5db11ca`, passed both Ubuntu verification and macOS generated-project checks. Each new push reruns this workflow; inspect its own result before claiming that revision passed CI.
- Figma copy repairs: existing screen headings, wrapped copy, and streak badges were repaired and visually checked in the browser. The post-write API structural audit was unavailable because of the Figma Starter MCP limit; prototype scrolling is not verified. See [the four-screen proof](https://www.figma.com/design/XRrxuZzGV3ej805HeUkqqB/?node-id=9-183).
- Mac/iPhone Expo Go end-to-end cases: Pending physical-device run.
- Browser lesson acceptance: the initial study countdown shows 15 seconds; selecting an answer keeps completion disabled until ready. The correct knowledge answer then saved the lesson, displayed "Completed," and updated the dashboard to 1 of 8 lessons.
- Live AI on Charles's Windows machine with NVIDIA and Groq keys: see the 2026-10-10 results below. Pending: the configured-provider run on the Mac and iPhone.
- Native Swift compilation, signing and physical-device shielding: Pending Mac and entitled iPhone development-build run.

## 2026-10-10 results

These checks were run on 2026-10-10 on a Windows 11 development machine. The list below is the verified list as recorded that day. The live calls were not run again for this document.

- Create account and Log in work end to end in the web build at 375x812; a new account goes straight into onboarding and an existing one lands on the dashboard.
- On a phone in Expo Go the app now finds the development computer by itself (src/services/api.ts reads the Expo host), instead of the old default of http://localhost:3001. "npm run demo" (scripts/dev.mjs) starts the API and Expo together, creates .env from .env.example when it is missing, and prints whether AI feedback is on.
- Grading and the interviewer run on NVIDIA's free hosted API with model nvidia/nemotron-3-super-120b-a12b: live replies validated in 1.6 to 2.6 seconds. Four other candidate models were slower (5.4 s, 18 s) or timed out at 35 s.
- Voice runs on Groq's free tier: whisper-large-v3-turbo transcribed a test sentence word for word in about 0.5 s, and canopylabs/orpheus-v1-english returned speech in 0.5 to 1.0 s. Orpheus accepts 200 characters per request and has a small daily quota, so long text is sent in pieces, audio is cached per question, and the phone's built-in voice is the automatic fallback. Orpheus needs its model terms accepted once in the Groq console.
- The AI interviewer is named Jarvis. Live at iPhone size: Jarvis greeted, asked the question with word-by-word motion, a hint came back in about 3 s as one nudge with no solution, and a graded answer came back in 2.6 s: score 90, one hint used, counted as 80 toward the Technical discussion standing, standing shown as Expert, 80 out of 100, based on 1 answer.
- Three skills are tracked: Communication, Technical discussion, Coding. A hint costs 10 evaluation points on that answer (at most 3 hints); pass, fail and unlock still use the raw grade.
- The Roadmap tab is a draggable road map (a real road drawn from Views, sideways native scroll, minimap, compass). The background moves with parallax. Scroll bars are hidden everywhere.
- http://localhost:8081/iphone.html (public/iphone.html) shows the app inside an iPhone frame for desktop previews.
- Tests: 119 passing and typecheck clean at the time of writing.

In progress, not verified. These are open and must not be read as done:

- Saving the typed answer on "Save and leave".
- An end-of-session recap with weak topics and next steps.
- A guard for starting practice during an earned break.
- Keeping missed-answer feedback for the recap.
- A designed offline state with automatic retry.

### Commands to reproduce

```sh
npm test
npm run typecheck
npm run check:ai
npm run check:environment
```

- `npm test`: runs every `tests/*.test.mjs` file. No live AI.
- `npm run typecheck`: runs `tsc --noEmit`.
- `npm run check:ai`: one live grading call with fictional data when a provider key is set. Rubric mode sends nothing. The key is never printed.
- `npm run check:environment`: prints Node, SQLite, the candidate addresses for a phone and which keys are set, as true or false. No provider request is sent.

Measured during the documentation pass on 2026-10-10:

- `npm run typecheck` exited 0.
- `npm test`: one run passed all 155 tests with no failures. The count rises as tests are added, so run the command for the current number. One earlier run, made while test files were being edited, failed one test in `tests/resume.test.mjs`: "PDF extraction timed out" where the test expected a rejection mentioning "at most 10 pages". The next run passed. The cause has not been investigated.
- `npm run check:environment` printed PASS on Node v24.15.0 with SQLite 3.51.3.
- `npm run check:ai` and `npm run demo` were not run in the documentation pass. One calls a live provider and the other starts servers.

### Manual checklist

Run these in Expo Go or the web build against a server that has a live key. Expo Go results are practice results. They do not test iPhone shielding.

Jarvis conversation

- [ ] Start an interview. Jarvis greets you and asks one question, and the words appear in order.
- [ ] Send a typed answer. Jarvis returns a graded reply with a score.
- [ ] Check the skill standing for the question's skill. It shows a level, a score out of 100 and the number of answers it is based on.

Hints

- [ ] Ask for a hint. Jarvis gives one nudge with no solution, and the hint does not submit the answer.
- [ ] Ask for hints until the limit. The fourth request is refused with "You have used all three hints for this question. Ask Jarvis to clarify, or submit your answer."
- [ ] Submit an answer after one hint. The grade is unchanged, pass or fail and unlock use the raw grade, and the standing counts 10 points lower per hint used. A grade of 90 with one hint counts as 80.

Voice

- [ ] With `GROQ_API_KEY` set on the server, Jarvis speaks with the Groq voice.
- [ ] With no Groq key on the server, Jarvis speaks with the phone's built-in voice.
- [ ] Record an answer, edit the returned transcript and submit it.
- [ ] Deny microphone access. A useful error appears and typed answers still work.
- [ ] Replay a question and note whether the second playback starts without a new request. Audio is cached per question.

Offline state (in progress)

- [ ] Stop the server while signed in. Record exactly what the screen shows. Expected: an offline message and disabled submissions.
- [ ] Restart the server and record whether the app reconnects and refreshes progress without a manual step.
- [ ] Do not mark the offline state as passed until the designed offline state and automatic retry are in place and verified.

### Limits that apply to these results

- Expo Go is practice mode. Shielding other apps needs the signed native build with Apple Screen Time, which has not been tested on a device.
- Student code is reviewed, never executed.
- NVIDIA's free access is rate limited. Its trial terms cover evaluation and prototyping, not a public launch.
- Provider keys live only in the server's `.env`, which git ignores.
