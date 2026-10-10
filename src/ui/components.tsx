import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useReducedMotion } from './motion';
import { lightColors, useTheme, type ThemePalette } from './theme';

export const colors = lightColors;
function useComponentStyles() { const { colors } = useTheme(); return { colors, styles: useMemo(() => makeStyles(colors), [colors]) }; }
export function Label({ children }: { children: React.ReactNode }) { const { styles } = useComponentStyles(); return <Text style={styles.label}>{children}</Text>; }
export function Title({ children, small = false }: { children: React.ReactNode; small?: boolean }) { const { styles } = useComponentStyles(); return <Text accessibilityRole="header" style={[styles.title, small && { fontSize: 26, lineHeight: 32, letterSpacing: -0.7 }]}>{children}</Text>; }
export function Body({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) { const { colors, styles } = useComponentStyles(); return <Text style={[styles.body, muted && { color: colors.muted }]}>{children}</Text>; }
export function Card({ children, green = false, tone = 'default' }: { children: React.ReactNode; green?: boolean; tone?: 'default' | 'sage' | 'dark' }) { const { styles } = useComponentStyles(); return <View style={[styles.card, (green || tone === 'sage') && styles.sageCard, tone === 'dark' && styles.darkCard]}>{children}</View>; }
export function Button({ title, onPress, secondary = false, disabled = false, busy = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; busy?: boolean }) {
  const { colors, styles } = useComponentStyles();
  const scale = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const unavailable = disabled || busy;
  const press = (down: boolean) => {
    scale.stopAnimation();
    if (reducedMotion) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue: down ? 0.975 : 1, speed: 32, bounciness: down ? 0 : 5, useNativeDriver: true }).start();
  };
  useEffect(() => { if (unavailable || reducedMotion) { scale.stopAnimation(); scale.setValue(1); } }, [unavailable, reducedMotion, scale]);
  useEffect(() => () => scale.stopAnimation(), [scale]);
  return <Animated.View style={{ transform: [{ scale }] }}><Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: unavailable, busy }} aria-disabled={unavailable} aria-busy={busy} disabled={unavailable} onPress={onPress} onPressIn={() => press(true)} onPressOut={() => press(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={({ pressed }) => [styles.button, secondary && styles.secondary, unavailable && { opacity: 0.5 }, pressed && { opacity: 0.82 }, focused && styles.controlFocus]}>
    {busy ? <ActivityIndicator color={secondary ? colors.accent : colors.onAccent} /> : <Text style={[styles.buttonText, secondary && { color: colors.ink }]}>{title}</Text>}
  </Pressable></Animated.View>;
}
export function Field({ label, onFocus, onBlur, ...props }: TextInputProps & { label: string }) {
  const { colors, styles } = useComponentStyles();
  const [focused, setFocused] = useState(false);
  return <View style={styles.field}><Label>{label}</Label><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...props} onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }} style={[styles.input, props.multiline && { minHeight: 138, textAlignVertical: 'top' }, props.style, focused && styles.inputFocus]} /></View>;
}
export function Chips<T extends string | number>({ options, value, onChange }: { options: { label: string; value: T }[]; value: T; onChange: (value: T) => void }) {
  const { colors, styles } = useComponentStyles();
  const [focused, setFocused] = useState<T | null>(null);
  return <View style={styles.chips}>{options.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: value === option.value }} aria-pressed={value === option.value} accessibilityLabel={option.label} onPress={() => onChange(option.value)} onFocus={() => setFocused(option.value)} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.chip, value === option.value && { backgroundColor: colors.accent, borderColor: colors.accent }, pressed && { opacity: 0.82 }, focused === option.value && styles.controlFocus]}><Text style={[styles.chipText, value === option.value && { color: colors.onAccent }]}>{option.label}</Text></Pressable>)}</View>;
}
export function Meter({ value, label }: { value: number; label?: string }) {
  const { styles } = useComponentStyles();
  const percent = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const progress = useRef(new Animated.Value(percent)).current;
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    progress.stopAnimation();
    if (reducedMotion) { progress.setValue(percent); return; }
    const animation = Animated.timing(progress, { toValue: percent, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [percent, progress, reducedMotion]);
  return <View style={{ gap: 8 }}>{label && <Body muted>{label}</Body>}<View accessibilityRole="progressbar" accessibilityLabel={label ?? 'Progress'} accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }} style={styles.meter}><Animated.View style={[styles.fill, { width: progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) }]} /></View></View>;
}
export function Message({ text }: { text: string }) { const { colors, styles } = useComponentStyles(); return <View accessibilityRole="alert" accessibilityLiveRegion="polite" aria-live="polite" style={styles.message}><Text style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}>{text}</Text></View>; }
export function makeStyles(colors: ThemePalette) { return StyleSheet.create({
  label: { color: colors.muted, fontSize: 11, lineHeight: 17, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 38, lineHeight: 43, fontWeight: '700', letterSpacing: -1.5 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 24, borderRadius: 24, gap: 16, shadowColor: colors.forest, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.035, shadowRadius: 16, elevation: 2 },
  sageCard: { backgroundColor: colors.pale, borderColor: colors.line, shadowOpacity: 0 },
  darkCard: { backgroundColor: colors.forest, borderColor: colors.forest, shadowOpacity: 0.12 },
  button: { minHeight: 56, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.accent, borderWidth: 2, borderColor: 'transparent', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.pale, borderColor: colors.line },
  buttonText: { color: colors.onAccent, fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },
  controlFocus: { borderColor: colors.ink, shadowColor: colors.accent, shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  field: { gap: 8 },
  input: { backgroundColor: colors.subtle, borderColor: colors.line, borderWidth: 2, borderRadius: 16, padding: 15, minHeight: 56, color: colors.ink, fontSize: 16, lineHeight: 24 },
  inputFocus: { backgroundColor: colors.surface, borderColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 2, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.subtle },
  chipText: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  meter: { height: 10, backgroundColor: colors.ringTrack, borderRadius: 8, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: colors.accent, borderRadius: 8 },
  message: { borderWidth: 1, borderColor: colors.dangerLine, backgroundColor: colors.dangerSurface, padding: 16, borderRadius: 16 },
}); }
export const styles = makeStyles(colors);
