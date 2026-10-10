import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { AmbientBackground, useMotionState, useReducedMotion, useRevealSettled } from './motion';
import { elevation, flat, focusRing, lightColors, useTheme, type ThemePalette } from './theme';

export const colors = lightColors;
function useComponentStyles() { const { colors } = useTheme(); return { colors, styles: useMemo(() => makeStyles(colors), [colors]) }; }

/** Shared pressed state: a 120ms scale and dim on the native driver. Reduced Motion keeps the dim and drops the scale. */
export function usePressFeedback({ scale = 0.97, dim = 0.86, disabled = false }: { scale?: number; dim?: number; disabled?: boolean } = {}) {
  const reduced = useReducedMotion();
  const press = useRef(new Animated.Value(0)).current;
  const to = (target: number) => {
    press.stopAnimation();
    if (disabled || reduced) { press.setValue(disabled ? 0 : target); return; }
    Animated.timing(press, { toValue: target, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false }).start();
  };
  useEffect(() => { if (disabled) { press.stopAnimation(); press.setValue(0); } }, [disabled, press]);
  useEffect(() => () => press.stopAnimation(), [press]);
  return {
    onPressIn: () => to(1),
    onPressOut: () => to(0),
    style: { opacity: press.interpolate({ inputRange: [0, 1], outputRange: [1, dim] }), transform: [{ scale: reduced ? 1 : press.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }) }] },
  };
}

export function Label({ children }: { children: React.ReactNode }) { const { styles } = useComponentStyles(); return <Text style={styles.label}>{children}</Text>; }
export function Title({ children, small = false }: { children: React.ReactNode; small?: boolean }) { const { styles } = useComponentStyles(); return <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.title, small && { fontSize: 26, lineHeight: 32, letterSpacing: -0.7 }]}>{children}</Text>; }
export function Body({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) { const { colors, styles } = useComponentStyles(); return <Text style={[styles.body, muted && { color: colors.muted }]}>{children}</Text>; }
export function Card({ children, green = false, tone = 'default' }: { children: React.ReactNode; green?: boolean; tone?: 'default' | 'sage' | 'dark' }) { const { styles } = useComponentStyles(); return <View style={[styles.card, (green || tone === 'sage') && styles.sageCard, tone === 'dark' && styles.darkCard]}>{children}</View>; }
/** The always-dark hero surface: a glowing shell around a clipped card that carries the moving background. */
export function HeroCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { styles } = useComponentStyles();
  return <View style={styles.heroShell}><View style={[styles.hero, style]}><AmbientBackground hero />{children}</View></View>;
}
export function SurfaceAction({ children, label, onPress, disabled = false, style }: { children: React.ReactNode; label: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const feedback = usePressFeedback({ scale: 0.985, disabled });
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return <Animated.View style={feedback.style}><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} onPressIn={feedback.onPressIn} onPressOut={feedback.onPressOut} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} style={[style, { minHeight: 44 }, hovered && !disabled && { opacity: 0.94 }]}>{children}{focused && <View style={[StyleSheet.absoluteFill, { borderWidth: 2, borderColor: colors.accent, borderRadius: 20, pointerEvents: 'none' }]} />}</Pressable></Animated.View>;
}
export function Button({ title, onPress, secondary = false, disabled = false, busy = false, onHero = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; busy?: boolean; onHero?: boolean }) {
  const { colors, styles } = useComponentStyles();
  const [focused, setFocused] = useState(false);
  const unavailable = disabled || busy;
  const feedback = usePressFeedback({ disabled: unavailable });
  const labelColor = secondary ? colors.ink : onHero ? colors.hero : colors.onAccent;
  return <Animated.View style={feedback.style}><Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: unavailable, busy }} aria-disabled={unavailable} aria-busy={busy} disabled={unavailable} onPress={onPress} onPressIn={feedback.onPressIn} onPressOut={feedback.onPressOut} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[styles.button, secondary ? styles.secondary : onHero ? styles.onHeroButton : null, !secondary && !unavailable && (onHero ? styles.onHeroGlow : styles.primaryGlow), unavailable && { opacity: 0.5 }, focused && (onHero ? { borderColor: colors.onHero } : styles.controlFocus)]}>
    {busy ? <ActivityIndicator color={secondary ? colors.accent : labelColor} /> : <Text style={[styles.buttonText, { color: labelColor }]}>{title}</Text>}
  </Pressable></Animated.View>;
}
export function Field({ label, onFocus, onBlur, ...props }: TextInputProps & { label: string }) {
  const { colors, styles } = useComponentStyles();
  const [focused, setFocused] = useState(false);
  return <View style={styles.field}><Label>{label}</Label><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...props} onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }} style={[styles.input, props.multiline && styles.multiline, props.style, focused && styles.inputFocus]} /></View>;
}
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors, styles } = useComponentStyles();
  const [focused, setFocused] = useState(false);
  const feedback = usePressFeedback({ scale: 0.96 });
  return <Animated.View style={feedback.style}><Pressable accessibilityRole="button" accessibilityState={{ selected }} aria-pressed={selected} accessibilityLabel={label} onPress={onPress} onPressIn={feedback.onPressIn} onPressOut={feedback.onPressOut} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[styles.chip, selected && { backgroundColor: colors.accent, borderColor: colors.accent }, focused && styles.controlFocus]}><Text style={[styles.chipText, selected && { color: colors.onAccent }]}>{label}</Text></Pressable></Animated.View>;
}
export function Chips<T extends string | number>({ options, value, onChange }: { options: { label: string; value: T }[]; value: T; onChange: (value: T) => void }) {
  const { styles } = useComponentStyles();
  return <View style={styles.chips}>{options.map(option => <Chip key={option.value} label={option.label} selected={value === option.value} onPress={() => onChange(option.value)} />)}</View>;
}
/** Sweeps from empty to its value once when it first appears, then follows changes; a revisited screen shows the value at once. */
export function Meter({ value, label, onHero = false }: { value: number; label?: string; onHero?: boolean }) {
  const { colors, styles } = useComponentStyles();
  const percent = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const settled = useRevealSettled();
  const progress = useRef(new Animated.Value(settled ? percent : 0)).current;
  const swept = useRef(settled);
  const { known, reduced } = useMotionState();
  useEffect(() => {
    progress.stopAnimation();
    if (!known) return;
    if (reduced) { swept.current = true; progress.setValue(percent); return; }
    const first = !swept.current;
    swept.current = true;
    const animation = Animated.timing(progress, { toValue: percent, duration: first ? 720 : 280, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [known, percent, progress, reduced]);
  return <View style={{ gap: 8 }}>{label && <Body muted>{label}</Body>}<View accessibilityRole="progressbar" accessibilityLabel={label ?? 'Progress'} accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }} style={[styles.meter, onHero && { backgroundColor: colors.heroLine }]}><Animated.View style={[styles.fill, onHero && { backgroundColor: colors.accentBright }, { width: progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) }]} /></View></View>;
}
export function Message({ text, tone = 'error' }: { text: string; tone?: 'error' | 'notice' }) {
  const { colors, styles } = useComponentStyles();
  const notice = tone === 'notice';
  return <View accessibilityRole="alert" accessibilityLiveRegion="polite" aria-live="polite" style={[styles.message, notice && styles.notice]}><Text numberOfLines={4} style={{ color: notice ? colors.ink : colors.danger, fontSize: 15, lineHeight: 22 }}>{text}</Text></View>;
}
/** Leading back control for the header, replacing a full-width button at the top of the page. */
export function BackButton({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  const { colors } = useTheme();
  const feedback = usePressFeedback();
  return <Animated.View style={feedback.style}><Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={8} onPress={onPress} onPressIn={feedback.onPressIn} onPressOut={feedback.onPressOut} style={{ minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={{ color: colors.accent, fontSize: 28, lineHeight: 28, marginTop: -3 }} maxFontSizeMultiplier={1.3}>‹</Text><Text style={{ color: colors.accent, fontSize: 17, fontWeight: '600' }} maxFontSizeMultiplier={1.3}>{label}</Text></Pressable></Animated.View>;
}
export function makeStyles(colors: ThemePalette) { return StyleSheet.create({
  label: { color: colors.muted, fontSize: 11, lineHeight: 17, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 38, lineHeight: 43, fontWeight: '700', letterSpacing: -1.5 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: 24, borderRadius: 20, gap: 16, ...elevation(colors, 'rest') },
  sageCard: { backgroundColor: colors.pale, borderColor: colors.line, ...flat },
  darkCard: { backgroundColor: colors.forest, borderColor: colors.forest, ...elevation(colors, 'raised') },
  heroShell: { borderRadius: 28, ...elevation(colors, 'glow') },
  hero: { backgroundColor: colors.hero, borderRadius: 28, borderWidth: 1, borderColor: colors.heroLine, padding: 24, gap: 18, overflow: 'hidden' },
  button: { minHeight: 56, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.accent, borderWidth: 1, borderColor: 'transparent', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryGlow: elevation(colors, 'glow'),
  onHeroButton: { backgroundColor: colors.accentBright },
  onHeroGlow: elevation(colors, 'glow', colors.accentBright),
  secondary: { backgroundColor: colors.pale, borderColor: colors.line },
  buttonText: { color: colors.onAccent, fontSize: 16, lineHeight: 23, fontWeight: '700', letterSpacing: 0.1, textAlign: 'center' },
  controlFocus: { borderColor: colors.ink, ...focusRing(colors) },
  field: { gap: 8 },
  input: { backgroundColor: colors.subtle, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 16, minHeight: 56, color: colors.ink, fontSize: 16, lineHeight: 24 },
  multiline: { minHeight: 138, ...Platform.select<TextStyle>({ web: { verticalAlign: 'top' }, default: { textAlignVertical: 'top' } }) },
  inputFocus: { backgroundColor: colors.surface, borderColor: colors.accent, ...focusRing(colors) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.subtle },
  chipText: { color: colors.ink, fontWeight: '600', fontSize: 15 },
  meter: { height: 10, backgroundColor: colors.ringTrack, borderRadius: 8, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: colors.accent, borderRadius: 8 },
  message: { borderWidth: 1, borderLeftWidth: 3, borderColor: colors.dangerLine, borderLeftColor: colors.danger, backgroundColor: colors.dangerSurface, padding: 16, borderRadius: 12 },
  notice: { borderColor: colors.line, borderLeftColor: colors.accent, backgroundColor: colors.pale },
}); }
export const styles = makeStyles(colors);
