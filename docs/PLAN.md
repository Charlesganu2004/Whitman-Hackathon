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
- `server`: authoritative accounts, assessment/session progress, AI requests, resume extraction and SQLite persistence. API keys never enter the mobile bundle.
- `src/services`: API client, native SQLite cache, session-token storage, focus adapter.
- `src/ui` and `App.tsx`: accessible mobile interface and navigation state.
- `modules/interview-focus`: optional custom iOS native implementation. No effect in Expo Go.

## Visual direction

An original dashboard for college students, with light/dark/system appearance and one selectable pink, red, blue, or green accent. Native focus artwork and subtle moving backgrounds accompany measured progress. Use a 12/20/28-point corner scale, system typography, and monospace code. All controls have visible labels and usable touch targets. Motion honors Reduce Motion and stops while backgrounded. Empty, error, busy, denial, and offline states stay visible.

## Verification status

Application and local checks are implemented. The current verification receipt and external prerequisites are tracked in `TESTING.md` and `TODO.md`. Physical-device behavior, native Swift compilation/signing, and live AI still require the Mac/iPhone and provider handoff.
# Current integration finish list

Profile replaces the Settings label on the bottom bar. A circular photo or initials avatar at the top right opens Profile. The Profile view presents identity, goals, progress, then appearance, study, focus, resume, connection, and account settings. Optional profile photos stay on the current device.

Additional requested scope: twenty major choices, target-company goals used as AI context, a four-question knowledge checkpoint that never unlocks apps, and a five-tab Today/Practice/Learn/Roadmap/Profile navigation. Appearance supports four accents in every mode, with subtle continuous motion respecting Reduce Motion. Lesson coaching, original technical questions, and linked NeetCode/LeetCode/HackerRank resources support learning. Figma iPhone frames and VS Code tasks support the design and development handoff.

The app is named Unscroll. Pink with charcoal replaces the initial forest palette. Light, dark, and system appearance persist on the device. The phone preview uses a 390 by 844 viewport and a 430-point maximum content width.

- Complete: SQLite accounts, resume extraction, placement, daily practice, review before retry, lessons, streaks, and promotion metrics.
- Integrating: welcome animation, separate account/login entry, four-step plan review, expanded focus app choices, and roadmap across all goals.
- Integrating: Groq/OpenAI provider choice, spoken STAR feedback, and bounded technical coaching. Coaching cannot submit an answer or unlock apps.
- Verify: typecheck, all automated checks, web and iOS JavaScript export, Expo Go dependency alignment, and browser acceptance flow.
- Publish: commit with Charles's identity and push to the requested repository after reviewing the stored commit.
- External verification still required: live provider key; Mac/iPhone Expo Go run; actual Swift compilation, signing, Family Controls entitlement, and physical-device shielding.
