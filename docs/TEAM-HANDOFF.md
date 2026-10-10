# Unscroll hackathon handoff

## Charles's contribution

Charles led the product scope and built the initial Unscroll MVP: Expo/React Native/TypeScript application, SQLite-backed accounts, resume onboarding, placement, adaptive practice, review before a fresh retry, lessons and knowledge checks, company goals, daily and weekly plans, streaks, and a full progress roadmap. The UI includes an animated phone layout, light/dark/system appearance, four accent choices, five navigation tabs, and Profile with a device-local photo. The server supports low-cost Groq and optional OpenAI for voice transcription, STAR feedback, technical hints, and lesson coaching. Native iPhone focus integration and repeatable verification are included.

## Teammates: first run on Mac and iPhone

1. Pull the latest repository. Install Node.js 24 or newer, then run `npm ci --ignore-scripts` and `npm run check:environment`.
2. Start `npm run server` in one terminal and `npm start` in another.
3. Install Expo Go supporting SDK 57 on the iPhone. Use the same private Wi-Fi as the Mac, scan the QR code, and set the app's Server connection to the Mac's Wi-Fi IPv4 address on port 3001. The phone must not use `localhost`.
4. Use fictional accounts and resume data. Exercise signup, four-step survey, placement, daily practice, failed-answer review and replacement, knowledge checkpoint, lessons, roadmap, profile photo, every theme, logout/login, and interrupted interview resume. Record device, iOS version, Expo Go version, and any failure in the acceptance checklist in [TESTING.md](TESTING.md).

## Remaining verification

- **Live AI:** Create a Groq API key, add `GROQ_API_KEY` to ignored `.env`, and restart the server. Test recording/transcription, edited transcripts, STAR feedback, spoken feedback, and technical/lesson coaching. Verify microphone denial, provider rate limits, and network interruption. No live key was supplied during the Windows build. GitHub Pro does not provide the retired GitHub Models inference API.
- **Actual iPhone blocking:** Expo Go cannot shield Instagram or other apps. Use the custom development build described in [IPHONE.md](IPHONE.md), compile Swift on Mac, sign with the required Family Controls capability, then test authorization, app picker, shields, expiry, emergency release, foreground reconciliation, and relaunch. Do not present a JavaScript export or fixture check as physical-device blocking evidence.
- **Accessibility and device layout:** Test VoiceOver, Dynamic Type, Reduce Motion, keyboard behavior, small and large iPhones, and dark/light system changes. Browser phone-size checks do not replace these tests.
- **Dependency maintenance:** The final local npm audit has 15 high-severity transitive Expo/Metro entries. See [INTAKE.md](INTAKE.md); compatible fixes were not available in the checked dependency set. Recheck before public deployment.

## Next improvements after the demo

Prioritize a genuinely isolated code judge for objective tests, deeper question banks for each major, more evidence-based company preparation, notifications for chosen study times, and secure hosted API infrastructure. The current code checker accepts a limited static grammar and AI review; it does not execute student code. Keep original questions and link to NeetCode, LeetCode, and HackerRank resources without copying proprietary material.

Use GitHub Actions for repeatable checks, then attach physical-device and live-provider results to [TESTING.md](TESTING.md). Inspect any failing CI job before treating the handoff as verified.
