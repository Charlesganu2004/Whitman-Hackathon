# Interview lock build plan

The goal is an Expo application for students that exchanges interview practice for focus-app access, with onboarding, resume intake, placement, lessons, streaks, and progress stored in SQLite.

1. Vet the requested REA reference without executing untrusted repository code.
2. Build a shared question engine and a local Node server with SQLite, password authentication, resume extraction, and optional server-side AI transcription and grading.
3. Build the Expo interface and native SQLite cache. Complete two behavioral and two technical placement questions before assigning a level. Daily practice includes one hard technical question for experts or four to six technical questions for other levels, plus two behavioral questions. Incorrect answers require reviewing feedback and passing a different question.
4. Add an iOS Screen Time module for development builds. Expo Go displays an explicit practice-only mode because its native binary cannot use custom Family Controls code.
5. Verify static types, engine/server tests, iOS/web bundle exports, and the actual browser onboarding and practice flow. Inspect the final diff and push with Charles's Git identity.
6. Document Mac/iPhone testing. Physical iPhone behavior and Apple entitlements require device access and signing credentials and cannot be asserted from a Windows build.

## Boundaries

- `src/core`: shared types, question bank, grading policy, lesson content, scheduling and streak rules. No UI or database dependencies.
- `server`: authoritative accounts, assessment/session progress, AI requests, resume extraction and SQLite persistence. API keys never enter the mobile bundle. Provider selection and requests live in `server/ai.mjs`.
- `src/services`: API client, native SQLite cache, session-token storage, focus adapter, voice playback and recording.
- `src/ui` and `App.tsx`: accessible mobile interface and navigation state.
- `modules/interview-focus`: optional custom iOS native implementation. No effect in Expo Go.

## Visual direction

An original dashboard for college students, with light/dark/system appearance and one selectable pink, red, blue, or green accent. Native focus artwork and subtle moving backgrounds accompany measured progress. Use a 12/20/28-point corner scale, system typography, and monospace code. All controls have visible labels and usable touch targets. Motion honors Reduce Motion and stops while backgrounded. Empty, error, busy, denial, and offline states stay visible.

## Verification status

Application and local checks are implemented. The current verification receipt and external prerequisites are tracked in `TESTING.md` and `TODO.md`. Physical-device behavior and native Swift compilation and signing still require the Mac and iPhone handoff. Live AI ran on the Windows development machine on 2026-10-10 with NVIDIA and Groq keys. The Mac and iPhone runs have not happened yet.

# Current integration finish list

Profile replaces the Settings label on the bottom bar. A circular photo or initials avatar at the top right opens Profile. The Profile view presents identity, goals, progress, then appearance, study, focus, resume, connection, and account settings. Optional profile photos stay on the current device.

Additional requested scope: twenty major choices, target-company goals used as AI context, a four-question knowledge checkpoint that never unlocks apps, and a five-tab Today/Practice/Learn/Roadmap/Profile navigation. Appearance supports four accents in every mode, with subtle continuous motion respecting Reduce Motion. Lesson coaching, original technical questions, and linked NeetCode/LeetCode/HackerRank resources support learning. Figma iPhone frames and VS Code tasks support the design and development handoff.

The app is named Unscroll. Pink with charcoal replaces the initial forest palette. Light, dark, and system appearance persist on the device. The phone preview uses a 390 by 844 viewport and a 430-point maximum content width.

- Complete: SQLite accounts, resume extraction, placement, daily practice, review before retry, lessons, streaks, and promotion metrics.
- Complete on 2026-10-10, checked on a Windows 11 development machine. Details and limits are in `TESTING.md`, under "2026-10-10 results".
  - Account creation and login in the web build at 375 by 812. A new account goes straight into onboarding, and an existing account lands on the dashboard.
  - NVIDIA as a grading and interviewer provider, with `nvidia/nemotron-3-super-120b-a12b` as the default `NVIDIA_MODEL`. Live replies were validated in 1.6 to 2.6 seconds. Four other candidate models were slower (5.4 s and 18 s) or timed out at 35 s. See `docs/NVIDIA.md`.
  - Groq voice on the free tier. `whisper-large-v3-turbo` transcribed a test sentence word for word in about 0.5 s. `canopylabs/orpheus-v1-english` returned speech in 0.5 to 1.0 s. Orpheus accepts 200 characters per request and has a small daily quota, so long text is sent in pieces and audio is cached per question. The phone's built-in voice is the automatic fallback.
  - Jarvis, the AI interviewer, in a conversation with hints. Live at iPhone size, Jarvis greeted, asked the question with word-by-word motion, and gave a hint in about 3 s as one nudge with no solution. A graded answer came back in 2.6 s with a score of 90 and one hint used. That answer counted as 80 toward the Technical discussion standing, which showed Expert, 80 out of 100, based on 1 answer.
  - Costed hints. A hint costs 10 evaluation points on that answer, up to three hints per question. Pass, fail and unlock still use the raw grade.
  - Three skill standings: Communication, Technical discussion, and Coding. Each standing is a rolling average of up to the last five answers in that skill.
  - A draggable road map on the Roadmap tab. A road is drawn from Views, with sideways native scrolling, a minimap and a compass.
  - A moving background with parallax. Scroll bars are hidden everywhere.
  - Phone host detection. The app reads the Expo host in `src/services/api.ts` and no longer defaults to `http://localhost:3001` on a phone.
  - `npm run demo` (`scripts/dev.mjs`). It starts the API and Expo together, creates `.env` from `.env.example` when `.env` is missing, and prints whether AI feedback and voice are on.
  - An iPhone frame preview at `public/iphone.html`, for desktop previews while the Expo web server runs.
  - The launch film is built in code with Remotion in `marketing/ad`. It has eight scenes, an original synthesized soundtrack, 60 fps, a 1920 by 1080 authored composition, and a 4K render setting. Final renders, the poster, the teaser and the app screenshots are not committed yet.
- Open, in progress. These are not verified and are not done.
  - Saving the typed answer on "Save and leave".
  - An end-of-session recap with weak topics and next steps.
  - A guard that stops starting practice during an earned break.
  - Keeping missed-answer feedback for the recap.
  - A designed offline state with automatic retry.
- Open, carried over from earlier integration. These were not re-verified on 2026-10-10.
  - Welcome animation, four-step plan review (the four-step survey was part of the earlier browser check in `TESTING.md`), expanded focus app choices, and roadmap across all goals.
  - Spoken STAR feedback. It is in the server, but the 2026-10-10 live checks did not cover it.
- Verify: typecheck, all automated checks, web and iOS JavaScript export, Expo Go dependency alignment, and browser acceptance flow.
- Publish: commit with Charles's identity and push to the requested repository after reviewing the stored commit.
- External verification still required: live AI on the Mac and iPhone, not only on the Windows machine; Mac/iPhone Expo Go run; actual Swift compilation, signing, Family Controls entitlement, and physical-device shielding.

## Known limits

- Expo Go is practice mode. It cannot shield Instagram, TikTok or other apps.
- Shielding other apps needs the signed native iPhone development build with Apple Screen Time. That path has not been tested on a device.
- Student code is reviewed, never executed.
- NVIDIA's free access is rate limited. Its trial terms cover evaluation and prototyping, not a public launch.
- Provider keys live only in the server's `.env`, which git ignores. Each computer that runs the server needs its own `.env`.
- The final local npm audit reports 15 high-severity entries in transitive Expo and Metro packages. No compatible patch is available yet.
