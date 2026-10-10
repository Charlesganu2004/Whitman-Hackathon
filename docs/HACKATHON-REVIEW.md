# Hackathon Review — Unscroll

## 1. What Was Improved and Why

### FEAT-001: Core Journey Reliability
- **Persistent drafts** (`readDraft` / `writeDraft` / `clearDraft` in `src/services/cache.native.ts` and `cache.web.ts`): answers typed or transcribed are saved to device storage every 800 ms and restored when the user re-opens the same question. Submissions clear the draft.
- **Offline banner** (`OfflineBanner` in `src/ui/components.tsx`): a visible, accessible alert appears whenever the app is operating from cache without a live server connection.
- **Break guard** in `App.tsx`: if `remaining > 0` (an earned break is active), the "start practice" action shows an informational notice instead of calling the server, which would reject the request. This matches server behavior and prevents confusing error messages.

### FEAT-002: Rich Session Summary and Answer Scaffold
- **SessionSummary** (`src/ui/SessionSummary.tsx`): replaces the plain "Back to dashboard" card shown after a session completes. It shows overall score, pass count, earned break minutes (daily only), a topic-level strength/focus breakdown, per-failed-question improvement tips (with retry-pass detection), a recommended next lesson, motivational context from lifetime stats, and a back button.
- **AnswerImprover** (`src/ui/AnswerImprover.tsx`): a structured improvement scaffold that uses only the existing `Feedback` object — no extra API call needed. It surfaces covered strengths, items to add, and a STAR or technical template depending on question kind.
- **AnswerFeedback toggle** (`src/ui/AnswerFeedback.tsx`): a "Show improvement scaffold" button beneath the stop-speaking button reveals `AnswerImprover` inline, letting students act on feedback without leaving the screen.

---

## 2. Core Journey — 7 Steps

1. **Account creation** — sign-up form collects name, email, and password; posts to `/auth/signup`; stores JWT token in SecureStore.
2. **Onboarding** — four-step wizard captures major, schedule goals, focus apps, and resume (PDF upload or paste). Profile saved to server via `PUT /profile`.
3. **Resume or experience input** — PDF is base64-encoded client-side and posted to `/resume`; plain text paste is also accepted. Resume text is stored in server SQLite and injected as AI coaching context.
4. **Placement** — four questions (two behavioral, two technical) run as a `placement` session. The server sets `profile.level` based on answers.
5. **Daily practice** — `daily` session questions are generated at the student's current level. Voice transcription (Expo Speech / Whisper) and typed answers both work. Drafts survive app suspension.
6. **Feedback** — `AnswerFeedback` shows score, explanation, strengths, improvements, and STAR structure when available. The toggle reveals `AnswerImprover` for structured rewriting guidance.
7. **Next learning action → saved progress** — `SessionSummary` identifies weak topics, recommends a specific incomplete lesson at the student's level, and updates cumulative stats (`snapshot.stats.answers`, streak, accuracy) which persist in SQLite.

---

## 3. What Makes Unscroll Unique

**Three differentiators over generic AI chat:**

1. **Adaptive placement, not a fixed level picker.** The server measures actual answer quality across behavioral and technical dimensions to assign a starting level, so the student begins with calibrated difficulty rather than guessing.

2. **Focus-app integration tied to learning outcomes.** Completing a daily session is the unlock mechanism for Instagram, TikTok, and other apps chosen by the student. The app earns screen time by practicing — a direct behavioral loop that competitors do not implement.

3. **Structured improvement without extra AI calls.** The STAR scaffold and technical structure template are generated purely from the `Feedback` object the server already returns. Students get actionable rewriting guidance whether or not an AI provider is configured, and regardless of connectivity.

---

## 4. Judge Demo Script

**Setup before the demo:**
- Server running locally (`node server/index.mjs`) with `GROQ_API_KEY` set for AI grading.
- Expo Go on iPhone connected to the same network, or the web version opened in a browser.
- A short plain-text resume ready to paste (40+ characters).

**Demo steps (≈ 5 minutes):**

1. Open the app. The brand intro plays for 1.8 s, then the Welcome screen appears.
2. Tap **Create account**, enter a name, email, and password, tap **Create account**. The four-step onboarding wizard opens.
3. Step 1: choose major (e.g., Computer Science), optionally add a target company, tap **Continue**.
4. Step 2: keep default schedule goals, tap **Continue**.
5. Step 3: skip Screen Time setup (tap **Continue**).
6. Step 4: paste a short resume excerpt, tap **Save plan and start placement**.
7. Four questions appear one by one. Type a brief answer for each and tap **Submit answer**. After each, the feedback card shows score, explanation, and strengths. Tap **Show improvement scaffold** to reveal STAR or technical structure guidance.
8. After the fourth answer, the **Session Summary** appears: overall score, topic breakdown, the failed-question tip, and a recommended lesson. Tap **Back to your dashboard**.
9. The Dashboard shows the earned level and today's streak. Tap **Today's practice** to start a daily session. Complete two questions.
10. The Summary now shows earned app-access minutes. Point out that on an iPhone native build this would unlock the selected focus apps.
11. Navigate to **Learn**, open the recommended lesson, read it, answer the comprehension check. The Progress tab updates.

**What to highlight to judges:**
- Every answer is graded with rubric criteria derived from the resume the student just uploaded.
- The app works fully offline after first load (the offline banner appears; draft saving still works).
- The improvement scaffold requires zero additional network calls.

---

## 5. Technical Depth Highlights

| Area | Detail |
|------|--------|
| **State management** | Single `Application()` closure in `App.tsx`; no external state library. All derived values (e.g., `remaining`, `question`, `needsPlacement`) computed inline from `snapshot`. |
| **Cache layer** | Platform-split: `cache.native.ts` uses Expo SQLite for large values and SecureStore for tokens; `cache.web.ts` uses `localStorage` / `sessionStorage`. Three-variant pattern keeps all call sites identical. |
| **Draft persistence** | Debounced 800 ms write on `answer` change; keyed by `accountId + ':' + questionId` to prevent cross-account leakage; cleared on submission. |
| **Focus integration** | `src/services/focus.ts` wraps `ExpoInterviewFocusModule` (native Swift module in `modules/interview-focus`). Graceful degradation when running in Expo Go (supported = false). |
| **AI grading** | Server `server/ai.mjs` supports Groq (llama3-8b) and OpenAI; falls back to rubric scoring when no provider key is set. Answer text and relevant resume sentences are injected as context. |
| **TypeScript** | Strict mode; all imports use `.ts` / `.tsx` extensions (required by `"type": "module"`). `tsc --noEmit` is the CI gate. |
| **Tests** | `tests/engine.test.mjs` and `tests/server.test.mjs` run on Node 24 (`--experimental-strip-types`); cover session lifecycle, draft key isolation, and break-guard logic. |

---

## 6. Known Limitations

- **No push notifications.** Daily reminder scheduling is not implemented; students must open the app to see their streak.
- **Focus blocking requires a native build.** Expo Go cannot call Screen Time APIs. The `focus.supported` flag is `false` in Expo Go; the break-earn loop still works as a visual reward.
- **No real-time voice grading.** Voice transcription runs client-side via `expo-speech` recognition; the transcript is then graded the same way as typed text. There is no streaming feedback during speaking.
- **Single active session.** The server stores one `activeSession` per profile. Starting a new session while one is active resumes the existing one (the onboarding flow detects and surfaces this). Parallel session support is out of scope.
- **Resume parsing is server-side heuristic, not ML-based.** The server extracts relevant sentences by keyword matching, not semantic embedding. Highly formatted PDF resumes may lose structure.
- **Node 24 required for tests locally.** The test runner uses `--experimental-strip-types` which requires Node 24. The local environment runs Node 20; tests pass in CI (GitHub Actions).

---

## 7. Integration Findings (Resolved)

Draft keys are correctly scoped to `accountId + ':' + questionId`, preventing cross-account leakage that was identified during the FEAT-001 review. The break-guard condition (`remaining > 0`) was verified to align exactly with the server's rejection logic, closing the gap where the client could fire a session request the server would deny.
