import { requireOptionalNativeModule } from 'expo-modules-core';

export interface NativeFocusStatus {
  supported: boolean;
  authorized: boolean;
  selectedCount: number;
  blocking: boolean;
  emergencyReleased: boolean;
  reason: string;
}

export interface InterviewFocusNativeModule {
  focusStatus(): Promise<NativeFocusStatus>;
  authorizeFocus(): Promise<void>;
  chooseFocusApps(): Promise<void>;
  lockFocus(): Promise<void>;
  unlockFocus(untilTimestamp: number): Promise<void>;
  emergencyRelease(): Promise<void>;
}

export default requireOptionalNativeModule<InterviewFocusNativeModule>('InterviewFocus');
