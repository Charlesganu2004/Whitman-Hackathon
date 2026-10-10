/**
 * Reaching the Unscroll server. When it cannot be reached the app keeps the saved snapshot readable, tells the student
 * which address it tried and what usually fixes it, and checks again quietly until the server answers.
 */
export const RETRY_DELAYS_MS: readonly number[] = [3_000, 6_000, 12_000];
export const RETRY_STEADY_MS = 20_000;
/** How long the "Back online" notice stays after the server answers. */
export const ONLINE_NOTICE_MS = 3_500;

/** The wait before check number `attempt`, counting from zero after the connection was lost: 3 s, 6 s, 12 s, then every 20 s. */
export function retryDelayMs(attempt: number): number {
  const index = Number.isNaN(attempt) ? 0 : Math.max(0, Math.floor(attempt));
  return RETRY_DELAYS_MS[index] ?? RETRY_STEADY_MS;
}

export type ConnectionPlatform = 'web' | 'phone';
export interface OfflineGuidance {
  title: string;
  /** Names the address the app is trying. */
  tried: string;
  /** The likely fix on this platform. */
  fix: string;
  /** What still works, and what waits. */
  saved: string;
}

export const OFFLINE_TITLE = 'Cannot reach the Unscroll server';
export const ONLINE_TITLE = 'Back online';
/** Shown next to every control that is switched off while the server cannot be reached. */
export const OFFLINE_REASON = 'Needs the Unscroll server. It reconnects on its own, or choose Try again.';

export function offlineGuidance(platform: ConnectionPlatform, address: string, hasSnapshot: boolean): OfflineGuidance {
  return {
    title: OFFLINE_TITLE,
    tried: `Trying ${address}`,
    fix: platform === 'phone'
      ? 'Check that your phone is on the same Wi-Fi as your computer, and that "npm run demo" is running there.'
      : 'Start the server on this computer with "npm run server", then try again.',
    saved: hasSnapshot
      ? 'Your saved progress stays readable. Interviews, lessons and saving wait until it reconnects.'
      : 'Logging in and signing up wait until it reconnects.',
  };
}
