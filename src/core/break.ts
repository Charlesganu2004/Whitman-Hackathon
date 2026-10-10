import type { Snapshot } from './types.ts';

/**
 * The earned break after a daily interview. The server refuses a new daily interview while it lasts, so the screens
 * decide from the snapshot and the clock what the start control may do, instead of letting the student hit an error.
 */
export type StartAction = 'resume' | 'placement' | 'daily' | 'break';

export interface StartDecision {
  action: StartAction;
  /** Whole minutes of earned break left, rounded up. Zero when no break is active. */
  minutesLeft: number;
  /** When the break ends, only while it is active. */
  endsAt: string | null;
  /** How much of the earned break has passed, from 0 to 1. Zero when no break is active. */
  progress: number;
  /** True when a new daily interview cannot start. */
  blocked: boolean;
  /** True when an evaluation with Jarvis may start. A break never stops it, but a saved or unplaced interview does. */
  canEvaluate: boolean;
}

export const BREAK_TITLE = 'Earned break';
export const BREAK_OPENS = 'A new daily interview opens when it ends.';
export const BREAK_MEANWHILE = 'Until then you can take an evaluation with Jarvis or a lesson.';

/** Whole minutes left before `unlockedUntil`, rounded up so the last partial minute still reads as 1. */
export function breakMinutesLeft(unlockedUntil: string | null | undefined, now: number): number {
  const ends = unlockedUntil ? Date.parse(unlockedUntil) : NaN;
  return Number.isFinite(ends) ? Math.max(0, Math.ceil((ends - now) / 60_000)) : 0;
}

export const minutesLabel = (minutes: number) => `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
export const breakHeadline = (minutesLeft: number) => `${minutesLabel(minutesLeft)} left`;

/** The one wording for the break, used by the start control and by the notice shown if the server still answers 409. */
export function breakNotice(minutesLeft: number): string {
  const lead = minutesLeft > 0 ? `${BREAK_TITLE}: ${breakHeadline(minutesLeft)}.` : 'Your earned break is still active.';
  return `${lead} ${BREAK_OPENS} ${BREAK_MEANWHILE}`;
}

export function startDecision(snapshot: Pick<Snapshot, 'profile' | 'stats' | 'activeSession'>, now: number): StartDecision {
  const { profile, stats, activeSession } = snapshot;
  const saved = !!activeSession && ['active', 'review'].includes(activeSession.status);
  const minutesLeft = breakMinutesLeft(stats.unlockedUntil, now);
  const active = minutesLeft > 0;
  const total = Math.max(1, (profile.unlockMinutes || 0) * 60_000);
  const remaining = active ? Math.max(0, Date.parse(stats.unlockedUntil as string) - now) : 0;
  const base = {
    minutesLeft, endsAt: active ? stats.unlockedUntil : null,
    progress: active ? Math.max(0, Math.min(1, 1 - remaining / total)) : 0,
    canEvaluate: profile.placementComplete && !saved,
  };
  // A saved interview is always resumable and placement comes first, as the server decides them.
  if (saved) return { ...base, action: 'resume', blocked: false };
  if (!profile.placementComplete) return { ...base, action: 'placement', blocked: false };
  if (active) return { ...base, action: 'break', blocked: true };
  return { ...base, action: 'daily', blocked: false };
}
