# Unscroll hackathon handoff

## Charles's contribution

Charles led the product scope and built the initial Unscroll MVP: Expo/React Native/TypeScript application, SQLite-backed accounts, resume onboarding, placement, adaptive practice, review before a fresh retry, lessons and knowledge checks, company goals, daily and weekly plans, streaks, and a full progress roadmap. The UI includes an animated phone layout, light/dark/system appearance, four accent choices, five navigation tabs, and Profile with a device-local photo. The server can grade and interview through NVIDIA, Groq or OpenAI, and uses Groq or OpenAI for voice transcription and spoken replies. NVIDIA does not transcribe voice. Native iPhone focus integration and repeatable verification are included.

The October 10 continuation adds a moving accent background, sharper native focus artwork, reactive progress rings, and foreground/Reduce Motion handling. It also fixes retained question headings, the initial lesson countdown, and local-code false passes from quoted functions, dead wrappers, and suffix mutations. The local suite passes with `npm test`. [TESTING.md](TESTING.md) has the measured count and one earlier timeout in a PDF test. Existing Figma frames were repaired for wrapped text and badge overlap. See [TESTING.md](TESTING.md) for the precise receipt and limits.

The same day's work also added NVIDIA as a grading provider, Groq voice, Jarvis (the AI interviewer, with hints that cost evaluation points and three skill standings), a draggable road map on the Roadmap tab, phone host detection with `npm run demo`, and an iPhone frame preview at `public/iphone.html`. The launch film is built in `marketing/ad` with Remotion but is not rendered into committed files yet. [PLAN.md](PLAN.md) lists what is delivered and what is still in progress.

## Teammates: first run on Mac and iPhone

1. Pull the latest repository. Install Node.js 24, because `npm run check:environment` fails on any other major version. Then run `npm ci --ignore-scripts` and `npm run check:environment`.
2. Run `npm run demo` from the repository root. It starts the API on port 3001 and Expo together, creates `.env` from `.env.example` when `.env` is missing, and prints whether AI feedback is on. To run them in two terminals instead, start `npm run server` in one and `npm start` in another.
3. Install Expo Go supporting SDK 57 on the iPhone. Use the same private Wi-Fi as the Mac and scan the QR code. The app finds the computer by itself. If it cannot reach the server, open **Server connection** in the app, enter the Mac's Wi-Fi IPv4 address with port 3001 in **Server URL**, and press **Test connection**. The phone must not use `localhost`.
4. Use fictional accounts and resume data. Exercise signup, four-step survey, placement, daily practice, failed-answer review and replacement, knowledge checkpoint, lessons, roadmap, profile photo, every theme, logout/login, interrupted interview resume, the Jarvis conversation, hints, and voice. Record device, iOS version, Expo Go version, and any failure in the acceptance checklist in [TESTING.md](TESTING.md). The manual checklist for the Jarvis conversation, hints, voice and offline state is in the same file.

For a desktop preview, run `npm run web` and open `http://localhost:8081/iphone.html`. It shows the app inside an iPhone frame. It is a browser simulation, so Screen Time shielding and the microphone behave as they do on web.

## Remaining verification

- **Live AI:** On Charles's Windows machine, NVIDIA and Groq keys are set in its local `.env`. Live grading, Jarvis's replies and Groq voice ran there on 2026-10-10 (see [TESTING.md](TESTING.md)). The keys are not in git. Every computer that runs the server needs its own `.env`: copy `.env.example` to `.env` (`npm run demo` does this when `.env` is missing), then add `NVIDIA_API_KEY` and `GROQ_API_KEY`. Never put a key in an `EXPO_PUBLIC_` variable, because that value ships inside the app. `npm run check:environment` reports which keys it sees, as true or false only. `npm run check:ai` makes one live grading call. Still to test on the Mac and iPhone: recording and transcription from the phone, edited transcripts, STAR feedback, spoken feedback, technical and lesson coaching, microphone denial, provider rate limits and network interruption. NVIDIA's free access is rate limited, and its trial terms cover evaluation and prototyping, not a public launch. NVIDIA does not transcribe voice; see [NVIDIA.md](NVIDIA.md). Groq's Orpheus voice model needs its model terms accepted once in the Groq console. Groq account setup is in [GROQ-HACKATHON.md](GROQ-HACKATHON.md).
- **Actual iPhone blocking:** Expo Go cannot shield Instagram or other apps. Use the custom development build described in [IPHONE.md](IPHONE.md), compile Swift on Mac, sign with the required Family Controls capability, then test authorization, app picker, shields, expiry, emergency release, foreground reconciliation, and relaunch. Do not present a JavaScript export or fixture check as physical-device blocking evidence.
- **Accessibility and device layout:** Test VoiceOver, Dynamic Type, Reduce Motion, keyboard behavior, small and large iPhones, and dark/light system changes. Browser phone-size checks do not replace these tests.
- **Dependency maintenance:** The final local npm audit has 15 high-severity transitive Expo/Metro entries. See [INTAKE.md](INTAKE.md); compatible fixes were not available in the checked dependency set. Recheck before public deployment.
- **Built, with automated tests; phone checks still to do:** saving the typed answer on "Save and leave", the end-of-session recap, the earned-break start guard, missed-answer feedback in the recap, and the offline banner with automatic retry. See [PLAN.md](PLAN.md).
- **Launch film:** built in `marketing/ad` with Remotion. The 1080p film, poster and three app screenshots are in `docs/media/` but not committed yet, and there is no teaser GIF. A second cut is in progress today. The 4K master stays out of git, because `marketing/ad/out/` is ignored.

## Next improvements after the demo

Prioritize a genuinely isolated code judge for objective tests, deeper question banks for each major, more evidence-based company preparation, notifications for chosen study times, and secure hosted API infrastructure. The current code checker accepts a limited static grammar and AI review; it does not execute student code. Keep original questions and link to NeetCode, LeetCode, and HackerRank resources without copying proprietary material.

Use GitHub Actions for repeatable checks, then attach physical-device and live-provider results to [TESTING.md](TESTING.md). Inspect any failing CI job before treating the handoff as verified.

## Merge note, 2026-10-10

Two lines of work met on `main` today. Ayimhi's commits (draft persistence, break guard, offline banner, session summary, answer improver) were written against the earlier question screen. Charles's commit replaced that screen with the conversation with Jarvis and built the same safeguards into it. The merge keeps one implementation of each so the app has a single behaviour:

- Drafts: one `readDraft`, `writeDraft`, `clearDraft` API in `src/services/cache.*`, keyed by session and question. Ayimhi's `tests/cache.test.mjs` runs against it and passes.
- Running app: `App.tsx` uses `InterviewChat`, `SessionRecap`, `StartControl` and `OfflineBanner` from `src/ui`.
- Kept in the tree but not wired into a screen yet: `src/ui/SessionSummary.tsx` and `src/ui/AnswerImprover.tsx`. The answer improver is the piece with no equivalent in the new flow; adding it to the feedback step of the conversation is a good next task.
- `docs/HACKATHON-REVIEW.md` and `.agents/tasks/plan.md` are Ayimhi's and are unchanged.
