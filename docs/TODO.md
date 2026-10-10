# Unscroll coding TODO

## Done

- [x] Expo SDK 57 + React Native + TypeScript application shell
- [x] SQLite accounts, salted password auth, session tokens
- [x] Resume intake: PDF upload, text paste, bounded extraction (unpdf)
- [x] Placement: 2 technical + 2 behavioral questions → beginner–expert
- [x] Adaptive daily practice: 1 hard tech (expert) or 4–6 tech (other) + 2 behavioral
- [x] Review-before-retry: feedback, then different question of same kind
- [x] Lessons with knowledge checks, coaching, promotion requirements
- [x] Streaks, study minutes, accuracy, technical/behavioral scores
- [x] Full progress roadmap with goals vs. evidence
- [x] UI: animated intro, 5-tab nav, light/dark/system, 4 accents, profile photo
- [x] Voice: mic recording, Groq/OpenAI transcription, editable transcripts, spoken STAR feedback
- [x] Technical coaching: hints, feedback, no unlock grants
- [x] 12 focus apps: Instagram, TikTok, Facebook, X, Snapchat, YouTube, Reddit, Threads, Pinterest, Discord, Twitch, LinkedIn
- [x] Custom iOS module: Swift Family Controls, Expo config plugin, verification scripts
- [x] Server: Node + SQLite, Groq + OpenAI providers, server-side keys only
- [x] Tests: engine, server, resume, AI (42 automated tests passing; October 10 receipt in TESTING.md)
- [x] CI: GitHub Actions (Ubuntu verify + macOS iOS prebuild)
- [x] Verification: typecheck, web/iOS JS export, Expo config/plugin checks
- [x] Docs: README, DESIGN, GROQ-HACKATHON, INTAKE, IPHONE, PLAN, TEAM-HANDOFF, TESTING
- [x] Commit and push to GitHub with full chat context

## To do — verification (needs physical device / live key)

- [ ] Live AI testing: add `GROQ_API_KEY` to local `.env`, restart server, test:
  - [ ] Recording and transcription
  - [ ] Edited transcripts
  - [ ] STAR feedback rendering
  - [ ] Spoken feedback
  - [ ] Technical hints and lesson coaching
  - [ ] Microphone denial error + typed fallback
  - [ ] Provider rate-limit handling
  - [ ] Network interruption during AI call
- [ ] Mac + iPhone Expo Go acceptance run (see `docs/TESTING.md` checklist):
  - [ ] Signup, login, logout, wrong-password rejection
  - [ ] Onboarding survey, resume upload (TXT + PDF + paste)
  - [ ] Placement → level assignment
  - [ ] Daily practice: question counts per level
  - [ ] Failed answer → feedback → replacement question
  - [ ] Earned access window appears (Expo Go: practice-only)
  - [ ] Interrupted interview resume
  - [ ] Lesson flow: read → check → wrong → re-read → pass
  - [ ] Knowledge checkpoint (Test my knowledge)
  - [ ] Streaks, scores, study minutes
  - [ ] Profile photo, themes, accents
  - [ ] Offline behavior: kill server, reconnect
  - [ ] Server connection error on sign-in
  - [ ] Small/large iPhone layout, keyboard overlap
- [ ] Physical iPhone native build shielding:
  - [ ] Mac: `expo prebuild --platform ios`
  - [ ] Compile Swift in Xcode
  - [ ] Sign with Family Controls capability
  - [ ] Test authorization, app picker, shields
  - [ ] Test expiry while app closed, reopening, reboot
  - [ ] Test emergency release
  - [ ] Verify Instagram + TikTok actually blocked
- [ ] Accessibility on device:
  - [ ] VoiceOver labels and navigation
  - [ ] Dynamic Type
  - [ ] Reduce Motion
  - [ ] Dark/light system changes
- [x] GitHub Actions baseline verified (run 38027167712; every new push reruns checks):
  - [x] Ubuntu verify job green
  - [x] macOS generated-project job green (configuration generation, not Swift compilation)
- [x] Dependency recheck, October 10, 2026:
  - [x] `npm audit` — 15 high-severity transitive Expo/Metro entries remain; no compatible patched release
  - [ ] Update compatible patched packages when released

## To do — post-demo improvements

- [ ] Isolated code judge: execute student code with test cases (currently static + AI review only)
- [ ] Deeper question banks per major/track
- [ ] Evidence-based company preparation (currently goals are AI context only)
- [ ] Study-time notifications (local push)
- [ ] Secure hosted API: HTTPS, deployment-specific account/privacy review
- [x] Figma text/clipping repairs and browser visual check (API structural audit and prototype scrolling remain unverified)
- [x] Final local integration run receipt in `docs/TESTING.md`

## To do — before public deployment

- [ ] Resolve or accept 15 high-severity npm audit entries
- [ ] Complete physical-device shielding verification
- [ ] Complete accessibility audit
- [ ] Complete live AI provider testing
- [ ] Hosted HTTPS deployment
- [ ] Privacy policy and terms of service
- [ ] Production account management review
