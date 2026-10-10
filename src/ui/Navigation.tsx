import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePressFeedback } from './components';
import { useReducedMotion } from './motion';
import { elevation, useTheme, type ThemePalette } from './theme';
export type Tab = 'today' | 'practice' | 'learn' | 'progress' | 'settings';
const TABS: Tab[] = ['today', 'practice', 'learn', 'progress', 'settings'];
const PAD = 8;
const GAP = 4;
const BORDER = 1;
const ITEM_HEIGHT = 56;
/** Height of the floating pill; pages add it to their bottom padding so the last content clears the bar. */
export const TAB_BAR_HEIGHT = ITEM_HEIGHT + PAD * 2 + BORDER * 2;
/** Space between the pill and the screen edge: tucked partly into the home indicator zone on notched phones. */
export const tabBarBottom = (safeAreaBottom: number) => Math.max(safeAreaBottom - 10, 12);
function Icon({ tab, active }: { tab: Tab; active: boolean }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const color = active ? colors.accent : colors.muted;
  if (tab === 'practice') return <View style={s.icon}><View style={{ position: 'absolute', left: 1, width: 8, height: 8, borderLeftWidth: 1.8, borderBottomWidth: 1.8, borderColor: color, transform: [{ rotate: '45deg' }] }} /><View style={{ position: 'absolute', right: 1, width: 8, height: 8, borderRightWidth: 1.8, borderTopWidth: 1.8, borderColor: color, transform: [{ rotate: '45deg' }] }} /><View style={{ height: 17, width: 1.8, borderRadius: 1, backgroundColor: color, transform: [{ rotate: '18deg' }] }} /></View>;
  if (tab === 'today') return <View style={s.icon}><View style={[s.home, { borderColor: color }]} /><View style={[s.roof, { borderColor: color }]} /><View style={[s.door, { backgroundColor: color }]} /></View>;
  if (tab === 'learn') return <View style={s.icon}><View style={[s.book, { borderColor: color }]} /><View style={[s.bookLine, { backgroundColor: color }]} /><View style={[s.bookText, { backgroundColor: color }]} /></View>;
  if (tab === 'progress') return <View accessible={false} aria-hidden style={s.icon}>{[0, 1, 2].map(panel => <View key={panel} style={{ position: 'absolute', left: 1 + panel * 7, top: 3, width: 7, height: 16, borderWidth: 1.5, borderColor: color, borderRadius: 1, transform: [{ skewY: panel === 1 ? '22deg' : '-22deg' }] }} />)}<View style={{ position: 'absolute', width: 5, height: 5, borderRadius: 3, left: 15, top: 6, backgroundColor: color }} /><View style={{ position: 'absolute', width: 1.5, height: 5, left: 16.8, top: 10, backgroundColor: color }} /></View>;
  return <View style={s.icon}><View style={[s.settingsCircle, { borderColor: color }]} /><View style={[s.settingsCenter, { backgroundColor: color }]} /></View>;
}
function TabButton({ item, selected, onSelect }: { item: Tab; selected: boolean; onSelect: (tab: Tab) => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const feedback = usePressFeedback({ scale: 0.94, dim: 0.8 });
  const label = item === 'progress' ? 'Roadmap' : item === 'settings' ? 'Profile' : item[0].toUpperCase() + item.slice(1);
  return <Animated.View style={[s.slot, feedback.style]}><Pressable accessibilityRole="tab" accessibilityState={{ selected }} aria-selected={selected} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPress={() => onSelect(item)} onPressIn={feedback.onPressIn} onPressOut={feedback.onPressOut} style={[s.item, focused && s.focused]}><Icon tab={item} active={selected} /><Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[s.label, selected && { color: colors.accent }]}>{label}</Text></Pressable></Animated.View>;
}
export function Navigation({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [width, setWidth] = useState(0);
  const [keyboard, setKeyboard] = useState(false);
  const index = TABS.indexOf(tab);
  const position = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    position.stopAnimation();
    if (reducedMotion) { position.setValue(index); return; }
    const spring = Animated.spring(position, { toValue: index, stiffness: 340, damping: 26, mass: 1, useNativeDriver: true });
    spring.start();
    return () => spring.stop();
  }, [index, position, reducedMotion]);
  // iOS draws the keyboard over the bar; Android resizes the window, so the bar steps aside while typing.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const itemWidth = Math.max(0, (width - BORDER * 2 - PAD * 2 - GAP * (TABS.length - 1)) / TABS.length);
  const translateX = useMemo(() => position.interpolate({ inputRange: TABS.map((_, slot) => slot), outputRange: TABS.map((_, slot) => slot * (itemWidth + GAP)) }), [itemWidth, position]);
  if (keyboard) return null;
  return <View style={[s.wrapper, { paddingBottom: tabBarBottom(insets.bottom) }]}>
    <View accessibilityRole="tablist" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={s.nav}>
      {width > 0 && <Animated.View accessible={false} style={[s.indicator, { width: itemWidth, transform: [{ translateX }] }]} />}
      {TABS.map(item => <TabButton key={item} item={item} selected={tab === item} onSelect={onChange} />)}
    </View>
  </View>;
}
function createStyles(colors: ThemePalette) { return StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, alignItems: 'center', pointerEvents: 'box-none' },
  nav: { flexDirection: 'row', width: '100%', maxWidth: 430, backgroundColor: colors.surface, borderRadius: 28, borderWidth: BORDER, borderColor: colors.line, padding: PAD, gap: GAP, ...elevation(colors, 'raised') },
  indicator: { position: 'absolute', top: PAD, left: PAD, height: ITEM_HEIGHT, borderRadius: 20, backgroundColor: colors.pale },
  slot: { flex: 1 },
  item: { alignItems: 'center', justifyContent: 'center', minHeight: ITEM_HEIGHT, gap: 4, borderRadius: 20, borderWidth: 1.5, borderColor: 'transparent' },
  focused: { borderColor: colors.accent },
  label: { fontSize: 11, lineHeight: 13, fontWeight: '600', color: colors.muted },
  icon: { width: 24, height: 22, alignItems: 'center', justifyContent: 'center' }, home: { position: 'absolute', bottom: 0, width: 17, height: 14, borderWidth: 1.8, borderTopWidth: 0, borderRadius: 3 }, roof: { position: 'absolute', top: 1, width: 13, height: 13, borderTopWidth: 1.8, borderLeftWidth: 1.8, transform: [{ rotate: '45deg' }] }, door: { position: 'absolute', bottom: 1, width: 4, height: 7, borderRadius: 1 }, book: { width: 21, height: 18, borderWidth: 1.8, borderRadius: 4 }, bookLine: { position: 'absolute', width: 1.5, height: 17 }, bookText: { position: 'absolute', left: 5, top: 8, width: 4, height: 1.5 }, settingsCircle: { width: 21, height: 21, borderWidth: 1.8, borderRadius: 11 }, settingsCenter: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
}); }
