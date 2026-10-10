# Unscroll

**Practice for what’s next.** Unscroll helps students replace distracting social media habits with short, constructive interview practice. Students prepare for internships and full-time jobs through technical challenges, behavioral stories, lessons, and a visible roadmap toward stronger interview skills.

This is a working hackathon MVP built with Expo, React Native, TypeScript, and SQLite. **Expo Go runs the practice experience but cannot block other iPhone applications.** Actual shielding uses the included custom iOS module and requires a signed development build with Apple's Family Controls capability. See [iPhone setup](docs/IPHONE.md).

## What's left to do

See the full **[coding TODO list](docs/TODO.md)** for everything remaining. Quick summary:

| Category | What needs doing | Blocker |
|----------|------------------|---------|
| Live AI testing | Groq key, transcription, STAR feedback, coaching | API key |
| Expo Go on iPhone | Full acceptance run on real device | Mac + iPhone |
| Native shielding | Swift compile, Family Controls, actual app blocking | Mac + iPhone |
| Accessibility | VoiceOver, Dynamic Type, Reduce Motion | Physical device |
| CI / dependencies | First GitHub Actions run, npm audit recheck | Push / npm |
| Post-demo | Code judge, question banks, notifications, hosted API | After demo |
| Pre-deployment | HTTPS, privacy/terms, audit resolution | Before public |

The detailed checklist with sub-items is in [**docs/TODO.md**](docs/TODO.md).

## Student experience

1. Watch the animated Unscroll entrance, then choose **Create account** or **Log in**.
2. Set a major, internship or full-time goal, up to five target companies, practice days per week, sessions per day, session duration, earned app-access duration, and focus apps. Twenty suggested majors map to four MVP interview tracks; a custom major can also be entered.
3. Upload a PDF or text resume, or paste resume text.
4. Complete placement: two technical questions and two behavioral questions. Placement assigns beginner through expert. Returning students review their plan, then resume saved progress.
5. Practice at your level. Experts receive one hard technical question and two behavioral questions. Other levels receive four to six technical questions and two behavioral questions, adjusted to the study duration.
6. On a failed daily answer, review feedback and answer a different question of the same kind. Complete every required question to earn app-access credit.
7. Take lessons, ask for coaching, and complete knowledge checks. Promotion requires two evaluated lessons at the current level and successful practice on two different dates with at least 75% session accuracy.
8. Follow your roadmap: placement, companies, current level, daily and weekly goals, lessons, technical and behavioral scores, streaks, study minutes, and requirements for the next level. Use **Test my knowledge** for a four-question checkpoint at your current level; it gives feedback without changing your level or granting app access.

Behavioral practice supports spoken prompts, microphone recording, transcription, editable transcripts, and spoken feedback. AI feedback explains **Situation, Task, Action, and Result (STAR)** using evidence from the student's answer. Technical practice supports code and reasoning, coaching hints, and feedback before a fresh quiz question. Lesson coaching explains concepts without completing the knowledge check. Coaching never grants an unlock.

No key is required for typed rubric practice and question hints. These are labeled separately from AI coaching. Code receives static or AI review; the MVP does not execute student code in a code judge. This is interview preparation, not a guarantee of code correctness or job readiness.

Focus goals include Instagram, TikTok, Facebook, X/Twitter, Snapchat, YouTube, Reddit, Threads, Pinterest, Discord, Twitch, and LinkedIn. In a native build, Apple's picker selects the actual applications to shield. Emergency focus release remains available.

## Run on Windows or Mac

Use **Node.js 24 or newer** and npm. The server uses Node's built-in SQLite; no separate database installation is needed.

```sh
git clone https://github.com/Charlesganu2004/Whitman-Hackathon.git
cd Whitman-Hackathon
npm ci --ignore-scripts
npm run check:environment
```

Start the API in one terminal:

```sh
npm run server
```

Start Expo in a second terminal:

```sh
npm start
```

Install Expo Go on the iPhone, connect phone and computer to the same Wi-Fi, and scan Expo's QR code with the iPhone Camera. The project uses **Expo SDK 57**; the installed Expo Go must support it. A Mac is not required for the Expo Go practice experience.

On the login screen, open **Server connection**, enter the computer's Wi-Fi IPv4 address, such as `http://192.168.1.25:3001`, and tap **Test connection**. On a phone, `localhost` refers to the phone itself. Find the computer's address with `ipconfig` on Windows or `ipconfig getifaddr en0` on Mac. Permit Node on the private development network. Public Wi-Fi may isolate devices; a private hotspot can help. A Metro tunnel exposes the bundle, not the separate API.

For a browser preview, run `npm run web`. The browser defaults to the computer's API at port 3001. The layout is designed for a 390 by 844 iPhone viewport and keeps content within 430 points on desktop.

To configure the bundled API address, copy `.env.example` to `.env`, set `EXPO_PUBLIC_API_URL`, and restart Expo. Use `cp .env.example .env` on Mac or `Copy-Item .env.example .env` in PowerShell.

## Low-cost AI voice and coaching

Groq supports transcription and structured feedback with one server key. Add these values to `.env`, then restart the API:

```dotenv
AI_PROVIDER=groq
AI_SPEECH_PROVIDER=groq
GROQ_API_KEY=your_server_key
GROQ_MODEL=openai/gpt-oss-20b
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
```

Review [Groq free-plan limits](https://console.groq.com/docs/rate-limits), [speech pricing](https://console.groq.com/docs/speech-to-text), and [structured outputs](https://console.groq.com/docs/structured-outputs). Free quotas are bounded and can change. GitHub Models [retired on July 30, 2026](https://docs.github.com/en/github-models), so it is not an available provider.

For this hackathon, start with the free plan. See [Groq setup, quotas, and cost examples](docs/GROQ-HACKATHON.md). A teammate must configure the key and complete live voice tests; paid billing is not required to run typed rubric practice. See [team handoff](docs/TEAM-HANDOFF.md) for Charles's contribution and remaining Mac/iPhone testing.

For OpenAI, select `AI_PROVIDER=openai` and `AI_SPEECH_PROVIDER=openai`, set `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-4.1-mini`, and `OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe`. Speech and grading providers can be selected independently. Leave keys empty for rubric practice.

**Never put API keys in `EXPO_PUBLIC_` variables or commit `.env`.** Keys stay on the Node server. AI mode sends answers and relevant resume text to the configured provider; recordings are sent for transcription. Usage charges may apply. The interviewer uses the device speech engine to read prompts and feedback aloud. This MVP uses recorded answer turns, not a continuous live audio connection.

## Appearance and roadmap

Profile contains settings for **Light, Dark, or System** mode and **Pink, Red, Blue, or Green** accents. Appearance persists on the device. The interface uses original lock-orbit artwork, gentle ambient motion, spring press feedback, animated skill meters, and reduced-motion support. Navigation includes Today, Practice, Learn, Roadmap, and Profile. The top-right avatar opens Profile; optional photos stay on the device and are scoped to the signed-in account.

Target companies are preparation context for AI coaching, not a claim that the app knows an employer's exact interview questions. The Learn tab links to [NeetCode](https://neetcode.io/roadmap), [LeetCode study plans](https://leetcode.com/studyplan/), and [HackerRank](https://www.hackerrank.com/dashboard). Unscroll's question bank and worked examples are original.

Roadmap distinguishes goals from evidence: completed daily interviews count toward the daily goal; actual study dates count toward the weekly goal; current-level lessons and qualifying practice dates determine promotion. Extra practice remains available after reaching a goal.

## SQLite and account data

The server stores accounts, salted password hashes, session tokens, profiles, resume text, interviews, lessons, and study history in `server/data/interview.sqlite`. SQLite and environment files are ignored by Git. Native cache uses Expo SQLite and tokens use SecureStore. Browser preview uses browser storage.

Use fictional data for the hackathon. Local HTTP setup is intended for a private development network. Public deployment needs HTTPS and a deployment-specific account, privacy, and operational review.

## Verification

```sh
npm run typecheck
npm test
npx expo install --check
npm run export:web
npm run export:ios
node modules/interview-focus/verify-plugin.cjs
node modules/interview-focus/verify-expo-config.cjs
```

See [test instructions and receipts](docs/TESTING.md) for automated coverage and manual acceptance cases. GitHub Actions checks Ubuntu and generated iOS configuration on macOS. An iOS JavaScript export does not prove Swift compilation, signing, entitlement approval, microphone behavior, or app shielding. Physical Mac/iPhone and live-provider tests remain required.

## Design and source review

The original interface draws layout inspiration from the requested iOS galleries. See [design notes](docs/DESIGN.md). The [REA repository](https://github.com/morluto/rea) informed structure, network, and screenshot inspection methodology; its code was not installed or executed. Installed [Master Repo skills](https://github.com/Charlesganu2004/Master-Repo-Use) guided architecture, design, review, and verification. The [local-index benchmark](https://charlesganu2004.github.io/Global-Ai-Setup-Benchmark/) informed local retrieval. No remote installer was run.

See [intake records](docs/INTAKE.md) for reviewed commits, PDF extraction boundaries, and remaining dependency advisories. The app contains `src/core` interview policy, `src/ui` screens, `src/services` adapters, `server` API/SQLite/AI, and `modules/interview-focus` with its Expo plugin for the custom iOS build.
