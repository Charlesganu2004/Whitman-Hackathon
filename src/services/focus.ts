import { Platform } from 'react-native';
import nativeFocus, { type NativeFocusStatus } from '../../modules/interview-focus';

export type FocusStatus = NativeFocusStatus;

const unsupportedReason = Platform.OS === 'ios'
  ? 'Practice-only: Expo Go and builds without the Screen Time module cannot block Instagram, TikTok, or other apps. App shielding needs the signed iPhone development build.'
  : 'Practice-only on this device. App shielding is available in the signed iPhone development build.';

export async function focusStatus(): Promise<FocusStatus> {
  if (Platform.OS === 'ios' && nativeFocus) return nativeFocus.focusStatus();
  return { supported: false, authorized: false, selectedCount: 0, blocking: false, emergencyReleased: false, reason: unsupportedReason };
}

export async function authorizeFocus(): Promise<void> {
  if (!nativeFocus || Platform.OS !== 'ios') throw new Error(unsupportedReason);
  await nativeFocus.authorizeFocus();
}

export async function chooseFocusApps(): Promise<void> {
  if (!nativeFocus || Platform.OS !== 'ios') throw new Error(unsupportedReason);
  await nativeFocus.chooseFocusApps();
}

export async function lockFocus(): Promise<void> {
  if (Platform.OS === 'ios' && nativeFocus) await nativeFocus.lockFocus();
}

export async function unlockFocus(untilIso: string): Promise<void> {
  const timestamp = Date.parse(untilIso);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) throw new Error('Unlock expiry must be a future date.');
  if (Platform.OS === 'ios' && nativeFocus) await nativeFocus.unlockFocus(timestamp / 1000);
}

export async function emergencyRelease(): Promise<void> {
  if (Platform.OS === 'ios' && nativeFocus) await nativeFocus.emergencyRelease();
}
