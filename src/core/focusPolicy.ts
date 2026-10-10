export type FocusAction = 'lock' | 'unlock' | 'none';

export interface FocusState {
  supported: boolean;
  authorized: boolean;
  selectedCount: number;
  blocking: boolean;
  emergencyReleased: boolean;
}

/**
 * What the shield should do right now. The chosen apps are locked by default and open only during an earned break,
 * so they are shielded from the moment they are picked, not just while an interview is running.
 * An emergency release is the student's explicit exit and is never undone automatically.
 */
export function focusAction(state: FocusState, unlockedUntil: string | null | undefined, now: number): FocusAction {
  if (!state.supported || !state.authorized || state.selectedCount === 0) return 'none';
  const expiry = unlockedUntil ? Date.parse(unlockedUntil) : Number.NaN;
  if (Number.isFinite(expiry) && expiry > now) return state.blocking ? 'unlock' : 'none';
  return state.blocking || state.emergencyReleased ? 'none' : 'lock';
}
