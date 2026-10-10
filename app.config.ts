import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Unscroll',
  slug: 'unscroll',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'unscroll',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#161316',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.charlesganu.interviewunlocked',
    infoPlist: {
      NSLocalNetworkUsageDescription: 'Connect to your local Unscroll server for interview practice.',
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
        NSAllowsArbitraryLoads: process.env.APP_ENV !== 'production',
      },
    },
  },
  android: {
    package: 'com.charlesganu.interviewunlocked',
    permissions: ['RECORD_AUDIO'],
  },
  web: { bundler: 'metro' },
  plugins: [
    ['expo-audio', {
      microphonePermission: 'Record your spoken interview answers so your AI interviewer can give feedback.',
      enableBackgroundRecording: false,
      enableBackgroundPlayback: false,
    }],
    'expo-document-picker',
    'expo-secure-store',
    ['./plugins/withInterviewFocus.cjs', {
      appGroup: 'group.com.charlesganu.interviewunlocked',
      allowLocalHttp: process.env.APP_ENV !== 'production',
    }],
  ],
});
