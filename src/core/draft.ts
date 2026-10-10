/**
 * Composer drafts. The text a student is typing is kept per session and question, written after a short pause in typing,
 * restored when the question mounts again, and dropped once the answer is graded or the session completes.
 */
export const DRAFT_DELAY_MS = 400;
export const DRAFT_PREFIX = 'draft:';
export const draftKey = (sessionId: string, questionId: string) => `${DRAFT_PREFIX}${sessionId}:${questionId}`;

export interface DraftSaverOptions {
  /** Stores a non-empty draft. */
  write: (text: string) => Promise<void>;
  /** Removes the stored draft. An empty or blank draft is cleared instead of stored. */
  clear: () => Promise<void>;
  /** Called after a non-empty draft reached storage. */
  onSaved?: () => void;
  delay?: number;
  /** Timer functions, replaceable so the pause can be tested without waiting. */
  schedule?: (run: () => void, milliseconds: number) => unknown;
  cancelSchedule?: (handle: unknown) => void;
}

export interface DraftSaver {
  /** Records the latest text and restarts the pause. */
  change: (text: string) => void;
  /** Writes a pending change now, for leaving the screen or the app before the pause ends. */
  flush: () => void;
  /** Forgets a pending change and removes the stored draft, once the answer has been graded. */
  discard: () => void;
}

export function createDraftSaver(options: DraftSaverOptions): DraftSaver {
  const schedule = options.schedule ?? ((run, milliseconds) => setTimeout(run, milliseconds));
  const cancelSchedule = options.cancelSchedule ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const delay = options.delay ?? DRAFT_DELAY_MS;
  let pending: string | null = null;
  let timer: unknown = null;
  const stop = () => { if (timer !== null) { cancelSchedule(timer); timer = null; } };
  // Storage can fail (a full or blocked store). The draft is a convenience, so a failure must never reach the student.
  const settle = (work: Promise<void>, saved: boolean) => { work.then(() => { if (saved) options.onSaved?.(); }, () => undefined); };
  function commit() {
    stop();
    if (pending === null) return;
    const text = pending;
    pending = null;
    try { settle(text.trim() ? options.write(text) : options.clear(), text.trim() !== ''); } catch { /* storage threw synchronously */ }
  }
  return {
    change(text) { pending = text; stop(); timer = schedule(commit, delay); },
    flush: commit,
    discard() {
      stop();
      pending = null;
      try { settle(options.clear(), false); } catch { /* storage threw synchronously */ }
    },
  };
}
