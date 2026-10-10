# Unscroll team checklist

Status as of October 10, 2026. A box is checked only when the code or a live check confirms it. Unchecked means not done, or not yet verified on a device. Commands run from the repository root unless a line says otherwise.

## Done

### App

- [x] Expo SDK 57 app on React Native 0.86 and react-native-web 0.21, written in TypeScript (`package.json`)
- [x] Create account and log in work end to end in the web build at 375x812: a new account goes to onboarding, an existing account lands on the dashboard
- [x] A phone in Expo Go finds the development computer by itself: `src/services/api.ts` reads the Expo host, and `EXPO_PUBLIC_API_URL` stays an optional override
- [x] Five tabs: Today, Practice, Learn, Roadmap (the `progress` tab) and Profile (the `settings` tab) (`src/ui/Navigation.tsx`)
- [x] Light, dark and system themes, with four accents: pink, red, blue and green (`src/ui/theme.tsx`)
- [x] Scroll bars hidden across the app; on web this comes from `src/ui/scrollbars.ts`
- [x] Profile photo saved on the device and shown in the app (`readAvatar` and `writeAvatar` in `src/services/cache.web.ts` and `src/services/cache.native.ts`)
- [x] Resume intake from a PDF or TXT file, or from pasted text. PDFs are capped at 4 MB and 10 pages, and extracted text at 100,000 bytes (`server/resume.mjs`, `server/pdf-worker.mjs`, unpdf 1.8.1)
- [x] Placement interview: 2 technical and 2 behavioral questions, then a starting level (`startSession` in `src/core/engine.ts`)
- [x] Daily interview size: 1 technical question at expert or master level; otherwise 4 to 6 technical questions depending on level and study minutes; plus 2 behavioral questions (`technicalCount` in `src/core/engine.ts`)
- [x] Failed daily answer: feedback first, then a different question of the same difficulty replaces it (`acknowledgeReview` in `src/core/engine.ts`). Code path only, not yet run on a phone
- [x] Eight lessons, each with a knowledge check (`LESSONS` in `src/core/content.ts`); lesson routes `/lessons/:id/start`, `/complete` and `/coach` (`server/app.mjs`)
- [x] Knowledge checkpoint, "Test my knowledge", on the Practice tab (`src/ui/PracticeHub.tsx`)
- [x] Level promotion from daily results (`maybePromote` in `src/core/engine.ts`)
- [x] Streak, study minutes, accuracy, and technical and behavioral scores kept in the stats (`src/core/engine.ts`)
- [x] Focus app list with 12 apps (`src/ui/FocusApps.tsx`). Expo Go is practice mode only; real shielding needs the signed iOS build
- [x] Screen Time module source: Swift Family Controls code in `modules/interview-focus/ios/`, and the Expo config plugin `plugins/withInterviewFocus.cjs`, wired from `app.config.ts`. Not compiled and not tested on a device yet

### AI and voice

- [x] Grading and the interviewer run on NVIDIA's hosted API with `nvidia/nemotron-3-super-120b-a12b` (default `NVIDIA_MODEL`). Live replies took 1.6 to 2.6 seconds. Four other candidate models were slower or timed out in the same check (lead's check, October 10, 2026)
- [x] Three grading providers, NVIDIA, Groq and OpenAI, chosen from the keys present or from `AI_PROVIDER` (`server/ai.mjs`). With no key, rubric practice runs
- [x] Recorded voice answers are transcribed by Groq `whisper-large-v3-turbo` (a test sentence came back word for word in about 0.5 seconds) or by OpenAI `gpt-4o-mini-transcribe` (`POST /ai/transcribe`). NVIDIA cannot transcribe voice
- [x] Jarvis speaks with Groq `canopylabs/orpheus-v1-english`, voice `troy`, in 0.5 to 1.0 seconds. Text is cut into pieces of at most 190 characters, under Orpheus's 200 character limit (`SPEECH_CHUNK` in `server/ai.mjs`). The phone's own voice is used when no Groq key is set or on any error. Spoken audio is cached on the device by its text (`clipName` in `src/services/voice.ts`)
- [x] Keys stay on the server. `.env` is git-ignored (`.gitignore`), and `.env.example` says keys must never use the `EXPO_PUBLIC_` prefix

### Interview with Jarvis

- [x] Jarvis is the named AI interviewer in the chat screen (`src/ui/InterviewChat.tsx`)
- [x] Jarvis greets the student and asks each question with a word-by-word reveal (`revealStagger` in `src/core/interview.ts`). Checked live at iPhone size (lead, October 10, 2026)
- [x] Hint: one nudge without the solution, back in about 3 seconds. At most 3 hints per question (`HINT_LIMIT` in `src/core/skills.ts`)
- [x] A hint costs 10 evaluation points on that answer (`HINT_COST` in `src/core/skills.ts`). Pass, fail and unlock still use the raw grade (`src/core/engine.ts`)
- [x] Three skill standings: Communication, Technical discussion and Coding (`src/core/skills.ts`, `src/ui/SkillStandings.tsx`)
- [x] Live run: a graded answer came back in 2.6 seconds with a score of 90 and one hint. It counted as 80 toward Technical discussion, which showed Expert, 80 out of 100, based on 1 answer (lead, October 10, 2026)

### Design and motion

- [x] Animated intro (`src/ui/BrandIntro.tsx`)
- [x] Moving accent background with parallax (`src/ui/components.tsx`, `src/ui/BrandIntro.tsx`, `src/ui/chatParts.tsx`)
- [x] Draggable road map on the Roadmap tab, with sideways native scroll, a minimap and a compass (`src/ui/JourneyMap.tsx`)
- [x] iPhone frame preview: `public/iphone.html` shows the app inside an iPhone frame at `http://localhost:8081/iphone.html` while Expo's web server runs (`npm run web`)

### Server and data

- [x] API server on Node 24 using `node:sqlite` (`server/index.mjs`, `server/app.mjs`; start with `npm run server`)
- [x] Routes in `server/app.mjs`: `/health`, `/auth/signup`, `/auth/login`, `/auth/logout`, `/me`, `/profile`, `/resume`, `/sessions` with `/answer`, `/review`, `/coach` and `/turn`, `/lessons/:id/start`, `/complete` and `/coach`, `/ai/speak`, `/ai/transcribe`
- [x] Passwords are stored as salted scrypt hashes, and session tokens are hashed with SHA-256 (`hashToken` in `server/app.mjs`)
- [x] `npm run demo` (`scripts/dev.mjs`) creates `.env` from `.env.example` when it is missing, starts the API (or reuses one already answering on `PORT`), then starts Expo in Go mode. It prints whether AI feedback is on and the Wi-Fi address that phones use
- [x] `npm run check:environment` (`scripts/check-environment.mjs`) prints PASS or FAIL for Node 24 and SQLite

### Tooling and tests

- [x] `npm run typecheck` (`tsc --noEmit`) passes
- [x] `npm test` passes with 119 or more tests in the 11 files under `tests/`. The suite makes no live AI calls
- [x] `npm run check:ai` (`scripts/check-ai.mjs`): one live grading call with fictional data. Rubric mode sends nothing, and the key is never printed
- [x] Local integration receipt dated October 10, 2026, in `docs/TESTING.md` (its test count is out of date; see In progress today)
- [x] GitHub Actions workflow `.github/workflows/verify.yml`. The Ubuntu job runs the environment check, typecheck, tests, `expo install --check`, web and iOS export, and plugin checks. The macOS job runs `expo prebuild` and the native config check; it does not compile Swift
- [x] GitHub Actions baseline run 38027167712 is recorded in `docs/TESTING.md`
- [x] Dependency audit, October 10, 2026: 15 high-severity npm audit entries remain, all transitive in Expo and Metro packages, with no compatible patched release (lead's check)

### Launch film

- [x] Film built in code with Remotion 4.0.534 in `marketing/ad`. Scripts: `npm run studio`, `npm run still`, `npm run render`, `npm run render:hd`
- [x] Eight scenes at 1920x1080 and 60 fps, 39.6 seconds long, written to the shooting script in `marketing/ad/SCRIPT.md`
- [x] Original synthesized soundtrack `marketing/ad/public/soundtrack.wav`, made by `npm run audio` (`marketing/ad/scripts/make-audio.mjs`)

### Docs

- [x] Docs in place: `README.md`, `docs/DESIGN.md`, `docs/GROQ-HACKATHON.md`, `docs/INTAKE.md`, `docs/IPHONE.md`, `docs/NVIDIA.md`, `docs/PLAN.md`, `docs/TEAM-HANDOFF.md`, `docs/TESTING.md` and `marketing/ad/SCRIPT.md`. Some lines are stale; see In progress today
- [x] `docs/NVIDIA.md` covers the NVIDIA key, the model, the rate limit and the trial terms
- [x] `docs/TESTING.md` holds the Expo Go acceptance cases and the native focus acceptance checklist

## In progress today

- [ ] Commit and push the working tree so the Mac team can pull it. The working tree has many modified and untracked files that are not committed, so a pull on the Mac would not get them
- [ ] Draft saving: the composer keeps the typed answer as a draft (`src/core/draft.ts`, used through `src/ui/useDraft.ts` in `src/ui/InterviewChat.tsx`). Not verified: that "Save and leave interview" keeps the typed answer
- [ ] End-of-session recap: `summarizeSession` in `src/core/recap.ts` builds weak topics and next steps, and has tests (`tests/recap.test.mjs`). No screen calls it yet, so the app shows no recap
- [ ] Break guard: the engine already refuses a new daily interview during an earned break (`startSession` in `src/core/engine.ts`, HTTP 409). The screen logic in `src/core/break.ts` (`startDecision`, `breakMinutesLeft`) has tests, but no screen imports it yet
- [ ] Missed-answer feedback kept for the recap: `acknowledgeReview` in `src/core/engine.ts` keeps the replaced question's title, topic and feedback for the end of the session (`MISSED_LIMIT` is 20). The recap does not show them yet
- [ ] Offline state with automatic retry: `App.tsx` tracks `offline`, and `src/ui/StartControl.tsx` uses the reason text from `src/core/connection.ts`. Retry timing exists in `src/core/connection.ts` (3, 6 and 12 seconds, then every 20 seconds). No offline banner was found in the screen code, and the automatic retry is not verified on a device
- [ ] Voice answer transcript editing: not verified. `src/ui/VoiceAnswer.tsx` has no text input, so the edit path has not been confirmed
- [ ] Spoken feedback and STAR feedback: STAR wording appears in `src/ui/AnswerFeedback.tsx`, but neither spoken feedback nor STAR feedback has been checked live on a phone
- [ ] Launch film files: after rendering, add `docs/media/unscroll-ad.mp4` (1080p, committed), `docs/media/unscroll-ad-poster.jpg`, `docs/media/unscroll-ad-teaser.gif`, `docs/media/screen-today.jpg`, `docs/media/screen-jarvis.jpg`, `docs/media/screen-evaluation.jpg` and `docs/media/screen-roadmap.jpg`. `docs/media/` does not exist yet. The 4K master stays out of git (`marketing/ad/out/` is git-ignored)
- [ ] Film timing: scene start times in `marketing/ad/src/Film.tsx` do not match the table in `marketing/ad/SCRIPT.md` for scenes 2 to 4 and 6 to 8. `SCRIPT.md` is the spec, so align the code to it
- [ ] Refresh stale doc lines (text only):
  - [ ] `README.md` line 69 says to set `EXPO_PUBLIC_API_URL`; the app now finds the computer itself
  - [ ] `README.md` line 73 says Groq is the only key for transcription and feedback; NVIDIA and OpenAI also grade
  - [ ] `README.md` line 85 presents the Groq free plan as the start; NVIDIA is now a provider
  - [ ] `docs/TEAM-HANDOFF.md` line 13 says to type the Mac's Wi-Fi IPv4 address; the app finds it now
  - [ ] `docs/TEAM-HANDOFF.md` line 18 names a Groq key as the only live AI path
  - [ ] `docs/PLAN.md` line 37 names Groq and OpenAI as the provider choice and leaves out NVIDIA
  - [ ] `docs/IPHONE.md` line 7 says to set `EXPO_PUBLIC_API_URL`
  - [ ] `docs/GROQ-HACKATHON.md` line 3 says to start with a free Groq account
  - [ ] `docs/TESTING.md` line 71 keeps a receipt with 42 tests; add a new dated receipt with the current `npm test` count and leave the old one as a record

## Mac team: before the demo

- [ ] Pull `main` after the push above (`git pull`)
- [ ] Run `npm install`, then `npm run check:environment`; expect PASS on Node 24
- [ ] Create `.env`: copy `.env.example` to `.env`, or run `npm run demo` once, which creates it. Paste the NVIDIA and Groq keys you were sent privately after `NVIDIA_API_KEY=` and `GROQ_API_KEY=`. Keep keys out of chat, commits, docs and screenshots
  - [ ] Accept the Orpheus model terms once in the Groq console. Until then Jarvis falls back to the phone's voice
- [ ] Run `npm run check:ai`: one live grading call with fictional data. It prints the provider, the model, the latency and whether the reply validated
- [ ] Run `npm run demo`: it starts the API and Expo, and the terminal says whether AI feedback is on and prints the address phones use
- [ ] Scan the QR code with the iPhone in Expo Go, with the iPhone on the same Wi-Fi as the Mac
- [ ] Create an account; a new account goes straight to onboarding
  - [ ] Upload a TXT or PDF resume (PDF up to 4 MB and 10 pages), or paste the text
  - [ ] Log out, try a wrong password once, then log back in
- [ ] Finish placement: 2 technical and 2 behavioral questions, then a starting level
- [ ] Do one daily interview with Jarvis
  - [ ] Use one hint. It costs 10 evaluation points on that answer
  - [ ] Answer once by voice. Voice needs a Groq or OpenAI key, because NVIDIA cannot transcribe
  - [ ] Give one weak answer to see the feedback and the replacement question
  - [ ] Check the earned access window; in Expo Go it is practice only
- [ ] Check the evaluation: the score, the hint and the skill standing
  - [ ] Lesson flow: read, check, wrong answer, re-read, pass (see `docs/TESTING.md`)
  - [ ] Knowledge checkpoint, "Test my knowledge"
- [ ] Drag the road map on the Roadmap tab
- [ ] Try light and dark, then check the profile photo and one accent change
- [ ] Pull the plug on the server once. Run the API as `npm run server` in its own terminal, since stopping the API inside `npm run demo` also stops Expo. With the app open, stop that API, watch what the app shows, then run `npm run server` again
- [ ] Play the film: `cd marketing/ad`, run `npm run studio`, and open the `UnscrollAd` composition

## Needs a physical iPhone and the native build

Shielding is not tested on any device yet. Expo Go cannot shield other apps; that needs the signed iOS build.

- [ ] On the Mac, run `npx expo prebuild --platform ios`
- [ ] Compile the Swift in `modules/interview-focus/ios/` and the extension in `modules/interview-focus/extension/` in Xcode
- [ ] Sign the build with the Family Controls capability
- [ ] Test Apple authorization, the app picker and the shields
- [ ] Test expiry while the app is closed, reopening the app, and a reboot
- [ ] Test emergency release
- [ ] Verify that Instagram and TikTok are actually blocked
- [ ] Accessibility on device: VoiceOver labels and navigation
- [ ] Accessibility on device: Dynamic Type
- [ ] Accessibility on device: Reduce Motion
- [ ] Accessibility on device: dark and light system changes
- [ ] Accessibility on device: small and large iPhone layouts, and keyboard overlap

## After the demo

- [ ] Isolated code judge: run student code against test cases. Today student code gets static checks and AI review only, and it is never executed
- [ ] Deeper question banks for each major and track
- [ ] Evidence-based company preparation. Target-company goals are AI context only today (`docs/PLAN.md`)
- [ ] Study-time notifications (local push)
- [ ] Secure hosted API: HTTPS, and a deployment-specific account and privacy review
- [ ] Figma: the API structural audit and prototype scrolling are not verified. The copy repairs and the browser visual check are recorded in `docs/TESTING.md`

## Before any public release

- [ ] Resolve or accept the 15 high-severity npm audit entries in transitive Expo and Metro packages. No compatible patched release exists yet. Update compatible packages when they are released
- [ ] Complete physical-device shielding verification (see the native build section)
- [ ] Complete the accessibility audit
- [ ] Complete live AI provider testing: microphone denial with typed fallback, provider rate-limit handling, a network drop during an AI call, editable transcripts, spoken feedback and STAR feedback rendering, and lesson coaching
- [ ] NVIDIA trial terms: free access is rate limited, and the API Trial Terms cover evaluation and testing, not a public launch. Before any public use, settle NVIDIA terms that cover a launch (see `docs/NVIDIA.md`)
- [ ] Key sharing: keys live only in the `.env` file on each computer that runs the server. Git ignores that file, so each computer needs its own `.env`. Keys were shared privately; rotate any key that has appeared in chat, a commit, a document or a screenshot
- [ ] Hosted HTTPS deployment
- [ ] Privacy policy and terms of service
- [ ] Production account management review
