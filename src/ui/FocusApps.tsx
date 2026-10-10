import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Label } from './components';
import { useTheme } from './theme';

export const SOCIAL_APPS = ['Instagram', 'TikTok', 'Facebook', 'X / Twitter', 'Snapchat', 'YouTube', 'Reddit', 'Threads', 'Pinterest', 'Discord', 'Twitch', 'LinkedIn'];

export function FocusApps({ selected, onChange }: { selected: string[]; onChange: (apps: string[]) => void }) {
  const { colors } = useTheme();
  return <View style={{ gap: 14 }}>
    <Label>Choose your distractions</Label>
    <Body muted>Select the apps you want to make room from. You can change this plan anytime.</Body>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {SOCIAL_APPS.map(app => {
        const checked = selected.includes(app);
        return <Pressable key={app} accessibilityRole="checkbox" accessibilityLabel={app} accessibilityState={{ checked }} aria-checked={checked}
          onPress={() => onChange(checked ? selected.filter(item => item !== app) : [...selected, app])}
          style={({ pressed }) => ({ width: '47%', flexGrow: 1, minHeight: 54, padding: 14, borderWidth: 1, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: checked ? colors.pale : colors.surface, borderColor: checked ? colors.accent : colors.line, opacity: pressed ? 0.75 : 1 })}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>{checked ? '✓' : '+'}</Text>
          <Text style={{ color: colors.ink, fontSize: 14, flexShrink: 1 }}>{app}</Text>
        </Pressable>;
      })}
    </View>
    <Body muted>Expo Go saves these focus goals. In the custom iPhone build, Apple’s Screen Time picker selects the apps that are actually shielded.</Body>
  </View>;
}
