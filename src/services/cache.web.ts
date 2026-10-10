import { draftKey, DRAFT_PREFIX } from '../core/draft.ts';
import type { Snapshot } from '../core/types';
// The browser preview uses browser storage; the phone implementation uses SQLite and SecureStore.
export async function readSnapshot(): Promise<Snapshot | null> {
  const value = sessionStorage.getItem('interview-snapshot');
  return value ? JSON.parse(value) : null;
}
export async function writeSnapshot(snapshot: Snapshot) { sessionStorage.setItem('interview-snapshot', JSON.stringify(snapshot)); }
export async function readToken() { return sessionStorage.getItem('interview-token'); }
export async function writeToken(token: string) { sessionStorage.setItem('interview-token', token); }
export async function readApiUrl() { return localStorage.getItem('interview-api-url'); }
export async function writeApiUrl(url: string) { localStorage.setItem('interview-api-url', url); }
export async function readThemeMode() { return localStorage.getItem('interview-theme-mode'); }
export async function writeThemeMode(mode: string) { localStorage.setItem('interview-theme-mode', mode); }
export async function readThemeAccent() { return localStorage.getItem('interview-theme-accent'); }
export async function writeThemeAccent(accent: string) { localStorage.setItem('interview-theme-accent', accent); }
export async function readAvatar(id: string) { return localStorage.getItem('interview-profile-avatar:' + id); }
export async function writeAvatar(id: string, image: string) { localStorage.setItem('interview-profile-avatar:' + id, image); }
// Chat composer drafts live beside the token and snapshot, so they survive a reload and end with the account.
const webDraftKey = (sessionId: string, questionId: string) => 'interview-' + draftKey(sessionId, questionId);
export async function readDraft(sessionId: string, questionId: string) { return sessionStorage.getItem(webDraftKey(sessionId, questionId)); }
export async function writeDraft(sessionId: string, questionId: string, text: string) { sessionStorage.setItem(webDraftKey(sessionId, questionId), text); }
export async function clearDraft(sessionId: string, questionId: string) { sessionStorage.removeItem(webDraftKey(sessionId, questionId)); }
export async function clearAccount() {
  sessionStorage.removeItem('interview-token');
  sessionStorage.removeItem('interview-snapshot');
  for (const key of Object.keys(sessionStorage)) if (key.startsWith('interview-' + DRAFT_PREFIX)) sessionStorage.removeItem(key);
}
