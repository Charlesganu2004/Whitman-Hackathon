# Implementation Plan — Unscroll Hackathon Improvements

## Codebase findings that inform this plan

- **Runtime**: Node v20.19.4 on this machine; project targets Node 24. `--experimental-strip-types` is _not_ available on v20. Tests therefore cannot be run with `npm test` locally. Test commands in each item are written for Node 24 (the CI environment) with a note to verify in CI. The implementer must note this discrepancy but must not upgrade Node or dependencies.
- **Cache layer**: Three files. `cache.ts` is a plain re-export of `cache.native.ts`. `cache.native.ts` uses Expo SQLite (`get`/`set` helpers with a `cache` table keyed by string) and SecureStore for the token. `cache.web.ts` uses `localStorage` / `sessionStorage`. Adding draft functions to all three must follow the existing key-namespacing convention: `'profile-avatar:' + id` → drafts will use `'answer-draft:' + accountId + ':' + questionId`.
- **App.tsx structure**: One large `Application` component (~260 lines). `answer` state (`useState('')`), `setAnswer`, `question`, `profile`, `session` are all in scope. `submitAnswer()` already calls `setAnswer('')`. The `practice` boolean gates the question view. No existing draft mechanism.
- **Session completed view**: Inline JSX inside the `if (practice)` block—a `<Card green>` with level/score/body. Replaced by `<SessionSummary>` in item 2.
- **Dashboard**: Receives `remaining` as a prop but does NOT disable the start button when `remaining > 0`. It only changes the hero FocusOrbit animation. The break guard must be applied in App.tsx's `onStart` callback; the Dashboard button title/disabled state can stay as-is (the guard in `act()` is sufficient without prop surgery).
- **PracticeHub**: Receives `onStart` but no `remaining` prop; it does not check `remaining`. Same approach—guard in App.tsx's `onStart`.
- **AnswerFeedback**: Receives a `Feedback` object. Uses `Body`, `Button`, `Card`, `Label`, `Title` from `components.tsx`. No toggle state exists yet.
- **components.tsx**: Exports `Label`, `Title`, `Body`, `Card`, `Button`, `Field`, `Chips`, `Meter`, `Message`. All components use `useTheme()` internally. The `OfflineBanner` must be added here as a new named export, not a new file.
- **LESSONS array**: Exported from `src/core/content.ts` with `id`, `title`, `topic`, `level` fields. Used in `App.tsx` for the `recommended` prop.
- **Tests**: New cache unit test file must be `tests/cache.test.mjs`, imported as `.mjs`, using `node:test` + `node:assert/strict` like existing tests. Because the cache files use Expo/browser APIs not available in Node, the tests must mock/stub the storage layer directly (test the key-naming logic, not the real storage). Pattern: import the web variant (`cache.web.ts`) in an isolated storage context by temporarily overriding `localStorage` with a Map-backed stub.
- **Import paths**: The project uses `"type": "module"` and imports `.ts` files directly (e.g., `import { LESSONS } from '../src/core/content.ts'`). All new files must use `.ts` extensions in import paths.
- **TypeScript**: `tsc` must find no new errors. The existing types (`Feedback`, `PracticeSession`, `Profile`, `Snapshot`, `Lesson`) cover everything needed. No new types need to be declared outside the component files.
- **Node 20 test workaround**: Tests that import `.ts` files rely on `--experimental-strip-types` (Node 22.6+). On this machine's Node 20, the test runner will fail. All `Verify` commands below are written for CI (Node 24). The implementer should push and check CI rather than running `npm test` locally.

---

## Implementation Plan

- [ ] 1. Add draft cache functions to all three cache files.

      **What**: Add `readDraft(accountId, questionId)`, `writeDraft(accountId, questionId, text)`, and `clearDraft(accountId, questionId)` to `cache.native.ts`, `cache.web.ts`, and `cache.ts`. Use the key `'answer-draft:' + accountId + ':' + questionId`. In `cache.native.ts`, reuse the existing `get`/`set` helpers (they already read/write any string key to the SQLite `cache` table). In `cache.web.ts`, use `localStorage` (not `sessionStorage`) so drafts survive tab close, matching the `readApiUrl`/`readThemeMode` pattern. `cache.ts` must re-export all three new names (it currently does `export * from './cache.native'` so no change is needed there unless the pattern changes).

      **Files**:
      - `src/services/cache.native.ts` — add 3 functions after `clearAccount`
      - `src/services/cache.web.ts` — add 3 functions after `clearAccount`
      - `src/services/cache.ts` — verify the existing `export *` re-exports the new names (no change needed if using `export *`; confirm)

      **Verify**: Run `node --experimental-strip-types --test tests/cache.test.mjs` on Node 24 in CI. Expect `tests 2, pass 2, fail 0`.

- [ ] 2. Create the cache unit test file.

      **What**: Create `tests/cache.test.mjs` with exactly 2 tests that verify draft key isolation using the `cache.web.ts` implementation. Because Node does not have `localStorage`, mock it with a plain `Map`-backed stub injected via `globalThis.localStorage` before importing. Test 1: write a draft for `(account-a, question-1)`, read it back, confirm it matches, then read `(account-b, question-1)` and confirm it returns `null` (key isolation by account). Test 2: write two drafts `(account-a, question-1)` and `(account-a, question-2)`, call `clearDraft(account-a, question-1)`, confirm `question-1` returns `null` and `question-2` still returns its value (clear does not clobber other keys).

      Use dynamic `import()` after installing the stub so that `localStorage` is available at module evaluation time, or import the module and call functions after setting `globalThis.localStorage`. Follow the style of existing tests: `import test from 'node:test'; import assert from 'node:assert/strict';`.

      **Files**:
      - `tests/cache.test.mjs` — new file

      **Verify**: `node --experimental-strip-types --test tests/cache.test.mjs` on Node 24 → `tests 2, pass 2, fail 0`.

- [ ] 3. Add draft auto-save and restore to App.tsx.

      **What**: Wire draft persistence into the answer-entry flow. Requires 3 changes inside `Application()` in `App.tsx`:

      a. **Add imports**: Import `readDraft`, `writeDraft`, `clearDraft` from `'./src/services/cache'`.

      b. **Debounce write on answer change**: Add a `draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)` ref. Add a `useEffect` that watches `[answer, question?.id, profile?.id]`: when `profile?.id` and `question?.id` are both defined AND `practice` is `true`, clear any pending timer and set a new 800 ms timeout that calls `writeDraft(profile.id, question.id, answer)`. Return a cleanup that clears the timer. Do NOT run the draft write when `practice` is false (avoids writing stale drafts on the dashboard).

      c. **Restore draft on question open**: In the `useEffect` that watches `[question?.id]` (or add one if not present), when `practice` is true and `feedback` is null and `profile?.id` and `question?.id` are defined, call `readDraft(profile.id, question.id).then(draft => { if (draft && !answer) setAnswer(draft); })`. This pre-populates the answer field when a student reopens a saved session. Use a `mounted` guard to avoid state updates after unmount, following the `readAvatar` effect pattern already in the file.

      d. **Clear draft on submit**: In `submitAnswer()`, after `await accept(data.snapshot)` and `setAnswer('')`, call `await clearDraft(profile!.id, question!.id)`. The `question` and `profile` are in scope in `submitAnswer` because they're derived from `snapshot` state.

      **Files**:
      - `App.tsx` — 4 targeted changes: import line, useRef declaration, new useEffect for debounce write, clearDraft call in submitAnswer, new useEffect for restore on question open

      **Verify**: Full typecheck passes. Manually: start a session, type a partial answer, tap "Save and leave", reopen → answer pre-populated.

- [ ] 4. Create SessionSummary.tsx.

      **What**: Create `src/ui/SessionSummary.tsx`. This component replaces the inline completed-session Card in App.tsx with a richer post-session screen.

      **Props interface**:
      ```typescript
      interface Props {
        session: PracticeSession;
        snapshot: Snapshot;
        profile: Profile;
        focus: { supported: boolean; authorized: boolean; selectedCount: number; blocking: boolean; emergencyReleased: boolean; reason: string };
        remaining: number;
        onNext: () => void;
        lessons: Lesson[];
      }
      ```

      **Layout** (all using `View`, `Body`, `Card`, `Label`, `Title`, `Button` from `components.tsx` + `useTheme`):

      1. A `<Card green>` header with:
         - `<Label>` showing session kind label ("Placement complete" / "Checkpoint complete" / "Practice complete")
         - `<Title>` showing level for placement, score% for checkpoint, or "Prepared looks good on you." for daily
         - Overall accuracy score: `Math.round(session.attempts.reduce((s,a) => s + a.feedback.score, 0) / Math.max(1, session.attempts.length))` shown as `{score}%`
         - Passed count: `session.attempts.filter(a => a.feedback.passed).length` out of `session.attempts.length`

      2. If `session.kind === 'daily'` and `remaining > 0`, show a prominent `<Card>` with `<Title small>{remaining} minutes of app access earned</Title>` and a body explaining that selected apps are unlocked.

      3. Strong areas vs. focus-next breakdown:
         - Group attempts by `question.topic` (map `questionId` → topic using `session.questions`). For each topic, count passed vs. failed. Render "Strong: [topics with all passed]" and "Focus next: [topics with any failed]" as `<Body>` items with checkmark/arrow prefixes.

      4. Per-failed-question improvement tip:
         - For each `attempt` where `!attempt.feedback.passed`, find the question from `session.questions` (match on `attempt.questionId`). Show a `<Card>` with `<Label>{question.topic}</Label>` and the first `attempt.feedback.improvements[0]` as a one-sentence tip. If there was a retry (`session.attempts` has a second attempt for the same base question ID — check `attempt.questionId.includes('~')`), also show "✓ Retried and passed" if the retry attempt passed.

      5. "What to do next" section:
         - Find the most relevant lesson from the `lessons` prop: the first lesson whose `level` matches `profile.level` and whose `topic` matches any failed topic. Fall back to any incomplete lesson at the current level. Show it as a `<Card>` with a `<Button title="Start this lesson" onPress={onNext} />`.

      6. Motivational progress note:
         - `<Body muted>` with something like: `"${profile.name.split(' ')[0]}, you've answered ${profile.completedLessonIds.length > 0 ? `${profile.completedLessonIds.length} lessons and` : ''} ${snapshot.stats.answers} questions. Keep building."` (no invented claims, uses actual stats).

      7. Back button: `<Button title="Back to your dashboard" onPress={onNext} />`.

      **Files**:
      - `src/ui/SessionSummary.tsx` — new file

      **Verify**: Typecheck passes. No new imports beyond existing component/type files.

- [ ] 5. Wire SessionSummary into App.tsx.

      **What**: Replace the inline completed-session JSX in App.tsx with `<SessionSummary>`. The existing inline view is this block inside `if (practice)`:

      ```tsx
      if (session?.status === 'completed') return <View style={s.stack}>...</View>;
      ```

      Replace it with:
      ```tsx
      if (session?.status === 'completed') return (
        <SessionSummary
          session={session}
          snapshot={snapshot}
          profile={profile!}
          focus={focus}
          remaining={remaining}
          onNext={() => { setPractice(false); setTab('today'); }}
          lessons={LESSONS}
        />
      );
      ```

      Add the import: `import { SessionSummary } from './src/ui/SessionSummary';`.

      **Files**:
      - `App.tsx` — import + replace the completed-session block

      **Verify**: Typecheck passes. The `<View>` inline block is fully removed; no orphan JSX.

- [ ] 6. Add the daily-practice break guard in App.tsx.

      **What**: In App.tsx, the two `onStart` props (for Dashboard at `tab === 'today'` and for PracticeHub at `tab === 'practice'`) share the same inline arrow function logic: if there's an active session, resume it; otherwise call `startSession(kind)`. Add a break guard _before_ the `startSession` call:

      ```typescript
      if (remaining > 0) {
        setNotice(`You earned ${remaining} minutes of app access. Come back after your break to practice again.`);
        return;
      }
      ```

      This guard goes inside the `act()` callback, after the active-session resume check, so it only fires when trying to start a _new_ daily session. It must be added to **both** the Dashboard `onStart` handler and the PracticeHub `onStart` handler (they are written separately in App.tsx as distinct inline lambdas).

      For the Dashboard button disabled/title state: Dashboard already receives `remaining` as a prop and uses it for the `FocusOrbit` animation, but the start button always reads `disabled={offline}`. To make the button reflect the break state without prop surgery, the guard in `act()` is sufficient — the button will show "busy" briefly then the notice appears. However, per the spec, also update the `onStart` prop JSX for Dashboard to pass a derived `disabled` prop that includes the break: change `disabled={offline}` in Dashboard's `<Button>` to also account for `remaining > 0 && !active`. Since Dashboard is a separate component and we cannot change its internal button without modifying it, the implementer should add a `breakEarned` prop to Dashboard's Props interface and pass it through to the start button's `disabled` state, OR simply ensure the App.tsx guard (notice + early return) is sufficient and document that the button is not visually disabled. **Decision: use only the App.tsx guard (no prop surgery on Dashboard).** The notice message adequately communicates the break to the student; the visual button state is a polish concern.

      **Files**:
      - `App.tsx` — two guard insertions in the two `onStart` inline lambdas

      **Verify**: Typecheck passes. When `remaining > 0` and no active session, tapping start shows the notice and does not call the server.

- [ ] 7. Create AnswerImprover.tsx and wire it into AnswerFeedback.tsx.

      **What**:

      **Part A** — Create `src/ui/AnswerImprover.tsx`:

      Props: `{ feedback: Feedback; kind: QuestionKind }` (import `QuestionKind` from `'../core/types.ts'`).

      Layout (use `View`, `Body`, `Card`, `Label`, `Title` from `'./components.tsx'`, `useTheme` from `'./theme.tsx'`):

      1. `<Card>` header: `<Label>Improvement scaffold</Label>` + `<Title small>How to make this answer stronger.</Title>`

      2. If `feedback.strengths.length > 0`: `<Body>What you covered:</Body>` then each strength as `<Body>✓ {s}</Body>`.

      3. If `feedback.improvements.length > 0`: `<Body>What to add:</Body>` then each improvement as `<Body>→ {imp}</Body>`.

      4. If `kind === 'behavioral'`:
         - If `feedback.star` exists: render the STAR template with the actual guidance text filled in:
           ```
           <Label>Your STAR structure</Label>
           <Body>Situation: {feedback.star.situation}</Body>
           <Body>Task: {feedback.star.task}</Body>
           <Body>Action: {feedback.star.action}</Body>
           <Body>Result: {feedback.star.result}</Body>
           ```
         - Otherwise: show the generic STAR template:
           ```
           <Body>Structure: "In [situation], my task was [task]. I [action]. The result was [result]."</Body>
           ```

      5. If `kind === 'technical'` and `feedback.improvements.length > 0`:
         ```
         <Label>Technical structure</Label>
         <Body>Problem → Approach → Complexity → Edge Cases</Body>
         ```
         Then list `feedback.improvements` again if they weren't shown above (they already are—skip duplicate). Just show the structure header if improvements already listed.

      **Part B** — Wire into `AnswerFeedback.tsx`:

      - Add `import { useState } from 'react'` (it's already imported from React but confirm it's destructured — the existing file uses `useEffect`; add `useState` to the destructured imports).
      - Add `import { AnswerImprover } from './AnswerImprover.tsx'`.
      - Add a `kind` prop to `AnswerFeedback`: `{ feedback: Feedback; kind: QuestionKind }`. Import `QuestionKind` from `'../core/types.ts'`.
      - Add `const [showScaffold, setShowScaffold] = useState(false)` inside the component.
      - Add a `<Button title={showScaffold ? 'Hide improvement scaffold' : 'Show improvement scaffold'} secondary onPress={() => setShowScaffold(v => !v)} />` after the existing "Stop speaking" button.
      - Render `{showScaffold && <AnswerImprover feedback={feedback} kind={kind} />}` below that button.

      **Part C** — Update the `<AnswerFeedback>` call sites in App.tsx:

      The only call site is in App.tsx: `<AnswerFeedback feedback={feedback} />`. Change to `<AnswerFeedback feedback={feedback} kind={question?.kind ?? 'behavioral'} />`. The `question` variable is in scope.

      **Files**:
      - `src/ui/AnswerImprover.tsx` — new file
      - `src/ui/AnswerFeedback.tsx` — add `kind` prop, toggle state, toggle button, conditional render
      - `App.tsx` — add `kind` prop to the `<AnswerFeedback>` call

      **Verify**: Typecheck passes. Tapping "Show improvement scaffold" on a feedback card reveals the structured rewrite guide; tapping again hides it.

- [ ] 8. Add OfflineBanner to components.tsx and wire it in App.tsx.

      **What**:

      **Part A** — Add `OfflineBanner` to `src/ui/components.tsx` as a new named export after `Message`:

      ```typescript
      export function OfflineBanner() {
        const { colors, styles } = useComponentStyles();
        return (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            aria-live="polite"
            style={[styles.message, { borderColor: colors.accent, backgroundColor: colors.pale }]}
          >
            <Text style={{ color: colors.ink, fontSize: 15, lineHeight: 22 }}>
              Working offline — your saved progress is available. Connect to submit answers.
            </Text>
          </View>
        );
      }
      ```

      Uses existing `styles.message` shape (border + padding + borderRadius) but with `pale`/`accent` tones instead of danger tones to distinguish it visually from errors.

      **Part B** — Wire into App.tsx:

      - Add `OfflineBanner` to the import from `'./src/ui/components'`.
      - In the scroll content JSX (the `<View style={s.content}>` block), replace or supplement the existing offline error. Currently when `offline === true` the generic `setError('Offline view. Reconnect…')` message is shown via the `{error !== '' && <Message text={error} />}` line. The plan: show `{offline && <OfflineBanner />}` immediately _before_ `{error !== '' && <Message text={error} />}`. This means both can appear simultaneously (OfflineBanner for the offline state + any additional error message). Also remove the inline `setError('Offline view…')` call from the `initializeApi` catch block and from the AppState listener, since OfflineBanner now handles the offline communication. Keep `setOffline(true)` so the banner still renders.

      **Files**:
      - `src/ui/components.tsx` — add `OfflineBanner` export
      - `App.tsx` — add import, render `<OfflineBanner />` when `offline === true`, remove the inline offline `setError` string (keep `setOffline(true)`)

      **Verify**: Typecheck passes. Setting `offline` to `true` (e.g., by killing the server and relaunching) shows the styled banner at the top of the scroll content instead of a generic red error message.

- [ ] 9. Create docs/HACKATHON-REVIEW.md.

      **What**: Create `docs/HACKATHON-REVIEW.md` with the following sections. All claims must be grounded in the actual codebase (no invented features):

      **Sections**:

      1. **What was improved and why** — list all 7 improvements with one-line rationale each. Reference the files changed.

      2. **Core journey end-to-end (7 steps)** — written as a judge-walkthrough narrative:
         - Step 1: Account creation → server stores salted bcrypt-equivalent hash, issues JWT, returns `Snapshot`
         - Step 2: 4-step onboarding → major, schedule, focus apps, resume upload/paste
         - Step 3: Placement interview → 2 technical + 2 behavioral, rubric engine assigns level (beginner–expert)
         - Step 4: Daily adaptive practice → level-appropriate questions, STAR feedback on behavioral, rubric/AI on technical, draft auto-saved every 800 ms
         - Step 5: Post-session summary → accuracy %, strong vs. focus-next breakdown by topic, per-question improvement tip, recommended lesson
         - Step 6: Lesson → read → knowledge check (15 s gate) → coach hints → complete → progress saved
         - Step 7: Earned break → `unlockedUntil` timestamp set, native iOS app shields removed, break guard prevents re-entry during window

      3. **What makes Unscroll unique** — contrast with flashcards/generic LLM: rubric engine with pattern-matching criteria (no hallucinated scores), STAR feedback template from actual question spec, adaptive difficulty (placement → promotion gates), iOS Screen Time native module, focus-as-reward behavioral design, resume-contextual questions.

      4. **Judge demo script** — exact steps with expected outcomes:
         - Create account with "CS" major, internship goal, 20-min sessions, 30-min reward
         - Upload the included synthetic resume or paste 50+ words
         - Observe placement → level displayed on dashboard
         - Start daily interview: note question count for level (4–6 tech + 2 behavioral at beginner/intermediate)
         - Submit a weak behavioral answer → feedback shows score, strengths, STAR guidance, improvement scaffold toggle
         - Type a partial answer, tap "Save and leave", reopen app → answer pre-populated from draft
         - Complete session → SessionSummary shows score, strong areas, next-lesson recommendation
         - Check focus card → shows earned minutes

      5. **Technical depth highlights**:
         - Rubric engine: pattern-matching with anti-stuffing (word count gate, RegExp criteria), local code execution sandboxing for JS questions (Node vm.Script), distinct replacement questions to prevent re-using failed spec
         - STAR feedback: behavioral questions have per-question STAR guidance objects in the spec, surfaced in `AnswerFeedback` and `AnswerImprover`
         - Adaptive selection: `technicalCount()` scales with minutes goal; expert/master gets 1 hard question; replacement pool ensures no exact repeat
         - Draft persistence: `localStorage` (web) / SQLite (native), keyed by `accountId + questionId`, debounced 800 ms to avoid excessive writes
         - Three-file cache pattern: `cache.ts` re-exports native; `cache.web.ts` used by Expo web; Expo resolves the platform variant automatically via `metro.config` source extension resolution

      6. **Known limitations**:
         - Tests require Node 24 (`--experimental-strip-types`); local machine has Node 20 — run tests via CI
         - `npm audit` shows 15 high-severity transitive entries in Expo/Metro; no compatible patched releases available at time of submission
         - Actual iPhone app shielding requires native dev build (not Expo Go) — see `docs/IPHONE.md`
         - Live AI (Groq/OpenAI) requires server-side API key; rubric mode works without one
         - SessionSummary topic grouping uses `session.questions` array; question topic is available for all questions including replacement questions (they inherit the original topic from the spec)

      **Files**:
      - `docs/HACKATHON-REVIEW.md` — new file

      **Verify**: File exists at the correct path. All section headers present. No claims about features that are not implemented in the codebase.

---

## Ordering rationale

Items 1–2 must come first because App.tsx (item 3) imports the new cache functions. Item 3 depends on items 1–2. Items 4–5 are sequenced together (create component, then wire) to avoid a broken import state. Items 6, 7, 8 are independent of each other and of items 4–5 (they each touch App.tsx separately but do not depend on each other's output). Item 9 (docs) is last and depends on nothing.

Dependency order: 1 → 2 → 3, then 4 → 5, then 6 (independent), 7 (independent), 8 (independent), 9 (last).

## Test command (Node 24 / CI only)

```sh
node --experimental-strip-types --test tests/cache.test.mjs
node --experimental-strip-types --test tests/engine.test.mjs
node --experimental-strip-types --test tests/*.test.mjs
```

Expected: all existing 42 tests pass, plus 2 new cache tests = 44 total.

## TypeScript check

```sh
./node_modules/.bin/tsc --noEmit
```

(Installed as a dev dependency; use `./node_modules/.bin/tsc` rather than bare `tsc` since `tsc` is not on PATH in this environment.)

Expected: exit 0, no new type errors.
