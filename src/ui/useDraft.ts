import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { createDraftSaver } from '../core/draft';
import { clearDraft, readDraft, writeDraft } from '../services/cache';

/**
 * The composer text for one question, kept in storage while the student types. Typing writes after a short pause, the
 * stored text returns when the question mounts again, and leaving the screen or the app writes whatever is pending.
 * Turn `enabled` off once the answer has been graded: the composer then holds a different conversation.
 */
export function useDraft(sessionId: string, questionId: string, enabled: boolean) {
  const [draft, setDraftState] = useState('');
  const [saved, setSaved] = useState(false);
  const latest = useRef('');
  const alive = useRef(true);
  const saver = useMemo(() => createDraftSaver({
    write: text => writeDraft(sessionId, questionId, text),
    clear: () => clearDraft(sessionId, questionId),
    onSaved: () => { if (alive.current) setSaved(true); },
  }), [sessionId, questionId]);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    if (enabled) {
      readDraft(sessionId, questionId).then(text => {
        // Text typed while the stored draft was loading wins over it.
        if (cancelled || !text || latest.current !== '') return;
        latest.current = text;
        setDraftState(text);
        setSaved(true);
      }, () => undefined);
    }
    const leave = () => saver.flush();
    const app = AppState.addEventListener('change', state => { if (state !== 'active') leave(); });
    if (Platform.OS === 'web') globalThis.addEventListener?.('pagehide', leave);
    return () => {
      cancelled = true;
      alive.current = false;
      app.remove();
      if (Platform.OS === 'web') globalThis.removeEventListener?.('pagehide', leave);
      leave();
    };
  }, [saver, enabled, sessionId, questionId]);

  /** `persist: false` changes what the student sees without touching storage, for text that has just been sent for grading. */
  const setDraft = useCallback((next: string | ((current: string) => string), persist = true) => {
    const text = typeof next === 'function' ? next(latest.current) : next;
    latest.current = text;
    setDraftState(text);
    if (!persist) return;
    setSaved(false);
    if (enabled) saver.change(text);
  }, [saver, enabled]);

  /** The answer was graded: forget the stored draft. */
  const discard = useCallback(() => { saver.discard(); setSaved(false); }, [saver]);

  return { draft, setDraft, saved: saved && enabled && draft.trim() !== '', discard };
}
