import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useTheme } from './theme';

export function Avatar({ name, image, onPress, large = false }: { name: string; image?: string; onPress?: () => void; large?: boolean }) {
  const { colors } = useTheme();
  const size = large ? 88 : 42;
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U';
  const content = <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}>{image ? <Image source={{ uri: image }} style={{ width: size, height: size }} accessibilityLabel={`${name} profile photo`} /> : <Text style={{ color: colors.accent, fontSize: large ? 30 : 15, fontWeight: '700' }}>{initials}</Text>}</View>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, padding: 3 })}>{content}</Pressable> : content;
}
