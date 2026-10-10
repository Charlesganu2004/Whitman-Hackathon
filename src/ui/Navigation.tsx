import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemePalette } from './theme';
export type Tab = 'today' | 'practice' | 'learn' | 'progress' | 'settings';
function Icon({ tab, active }: { tab: Tab; active: boolean }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const color = active ? colors.accent : colors.muted;
  if (tab === 'practice') return <View style={s.icon}><View style={{ position: 'absolute', left: 1, width: 8, height: 8, borderLeftWidth: 1.8, borderBottomWidth: 1.8, borderColor: color, transform: [{ rotate: '45deg' }] }} /><View style={{ position: 'absolute', right: 1, width: 8, height: 8, borderRightWidth: 1.8, borderTopWidth: 1.8, borderColor: color, transform: [{ rotate: '45deg' }] }} /><View style={{ height: 17, width: 1.8, borderRadius: 1, backgroundColor: color, transform: [{ rotate: '18deg' }] }} /></View>;
  if (tab === 'today') return <View style={s.icon}><View style={[s.home, { borderColor: color }]} /><View style={[s.roof, { borderColor: color }]} /><View style={[s.door, { backgroundColor: color }]} /></View>;
  if (tab === 'learn') return <View style={s.icon}><View style={[s.book, { borderColor: color }]} /><View style={[s.bookLine, { backgroundColor: color }]} /><View style={[s.bookText, { backgroundColor: color }]} /></View>;
  if (tab === 'progress') return <View style={[s.icon, s.bars]}>{[8, 14, 20].map(height => <View key={height} style={{ height, width: 4, borderRadius: 2, backgroundColor: color }} />)}</View>;
  return <View style={s.icon}><View style={[s.settingsCircle, { borderColor: color }]} /><View style={[s.settingsCenter, { backgroundColor: color }]} /></View>;
}
export function Navigation({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [focused, setFocused] = useState<Tab | null>(null);
  return <View style={s.wrapper}><View accessibilityRole="tablist" style={s.nav}>{(['today', 'practice', 'learn', 'progress', 'settings'] as Tab[]).map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} aria-selected={tab === item} onFocus={() => setFocused(item)} onBlur={() => setFocused(null)} onPress={() => onChange(item)} style={({ pressed }) => [s.item, tab === item && s.selected, focused === item && s.focused, pressed && { opacity: 0.7 }]}><Icon tab={item} active={tab === item} /><Text style={[s.label, tab === item && { color: colors.accent, fontWeight: '700' }]}>{item === 'progress' ? 'Roadmap' : item === 'settings' ? 'Profile' : item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</View></View>;
}
function createStyles(colors: ThemePalette) { return StyleSheet.create({
  wrapper: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: colors.background }, nav: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 24, padding: 7, gap: 4, shadowColor: colors.hero, shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 5 }, elevation: 6 }, item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 58, gap: 6, borderRadius: 18, borderWidth: 1.5, borderColor: 'transparent' }, selected: { backgroundColor: colors.pale }, focused: { borderColor: colors.accent }, label: { fontSize: 10, color: colors.muted }, icon: { width: 24, height: 22, alignItems: 'center', justifyContent: 'center' }, home: { position: 'absolute', bottom: 0, width: 17, height: 14, borderWidth: 1.8, borderTopWidth: 0, borderRadius: 3 }, roof: { position: 'absolute', top: 1, width: 13, height: 13, borderTopWidth: 1.8, borderLeftWidth: 1.8, transform: [{ rotate: '45deg' }] }, door: { position: 'absolute', bottom: 1, width: 4, height: 7, borderRadius: 1 }, book: { width: 21, height: 18, borderWidth: 1.8, borderRadius: 4 }, bookLine: { position: 'absolute', width: 1.5, height: 17 }, bookText: { position: 'absolute', left: 5, top: 8, width: 4, height: 1.5 }, bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 }, settingsCircle: { width: 21, height: 21, borderWidth: 1.8, borderRadius: 11 }, settingsCenter: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
}); }
