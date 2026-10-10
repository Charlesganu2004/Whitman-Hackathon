import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemePalette } from './theme';
import { useMotionEnabled } from './motion';
function useVisualStyles() { const { colors } = useTheme(); return { colors, visualStyles: useMemo(() => makeVisualStyles(colors), [colors]) }; }

export function FocusOrbit({ unlocked = false, compact = false, progress = 0 }: { unlocked?: boolean; compact?: boolean; progress?: number }) {
  const { colors, visualStyles } = useVisualStyles();
  const movement = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const opening = useRef(new Animated.Value(unlocked ? 1 : 0)).current;
  const motionEnabled = useMotionEnabled();
  const size = compact ? 130 : 220;
  const completed = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  useEffect(() => {
    movement.stopAnimation();
    orbit.stopAnimation();
    movement.setValue(0);
    orbit.setValue(0);
    if (!motionEnabled) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(movement, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(movement, { toValue: 0, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    const rotation = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 32000, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    animation.start();
    rotation.start();
    return () => { animation.stop(); rotation.stop(); };
  }, [movement, orbit, motionEnabled]);
  useEffect(() => {
    opening.stopAnimation();
    if (!motionEnabled) { opening.setValue(unlocked ? 1 : 0); return; }
    const animation = Animated.timing(opening, { toValue: unlocked ? 1 : 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [motionEnabled, opening, unlocked]);
  return <View accessible accessibilityRole="image" accessibilityLabel={unlocked ? 'Open focus lock illustration' : 'Closed focus lock illustration'} style={[visualStyles.orbit, { width: size, height: size }]}>
    <View style={[visualStyles.orbitGlow, { width: size * 0.65, height: size * 0.65, borderRadius: size * 0.325 }]} />
    {[1, 0.76, 0.52].map((ratio, index) => <View key={ratio} style={[visualStyles.orbitRing, { width: size * ratio, height: size * ratio, borderColor: index === 1 ? colors.accentBright : colors.heroMuted, opacity: index === 2 ? 0.32 : 0.2 }]} />)}
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
      {Array.from({ length: 16 }, (_, index) => {
        const angle = index * Math.PI / 8 - Math.PI / 2;
        return <View key={index} style={{ position: 'absolute', width: compact ? 2 : 3, height: compact ? 5 : 7, borderRadius: 2, backgroundColor: colors.accentBright, opacity: index < Math.round(completed * 16) ? 0.95 : index % 4 === 0 ? 0.5 : 0.18, left: size / 2 + Math.cos(angle) * size * 0.43 - 1.5, top: size / 2 + Math.sin(angle) * size * 0.43 - 3.5, transform: [{ rotate: `${index * 22.5}deg` }] }} />;
      })}
      <View style={[visualStyles.orbitDot, { top: size * 0.11, left: size * 0.17 }]} /><View style={[visualStyles.orbitDot, { bottom: size * 0.12, right: size * 0.18, width: 5, height: 5 }]} />
    </Animated.View>
    <View style={[visualStyles.orbitLine, { width: size * 0.8, transform: [{ rotate: '-32deg' }] }]} />
    <Animated.View style={[visualStyles.orbitCore, { width: size * 0.44, height: size * 0.44, borderRadius: size * 0.22, transform: [{ scale: movement.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }] }]}>
      <View style={visualStyles.coreHighlight} /><View style={[visualStyles.lockGlyph, compact && { transform: [{ scale: 0.64 }] }]}><Animated.View style={[visualStyles.lockShackle, { transform: [{ translateX: opening.interpolate({ inputRange: [0, 1], outputRange: [0, 7] }) }, { translateY: opening.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }, { rotate: opening.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '24deg'] }) }] }]} /><View style={visualStyles.lockBody}><View style={visualStyles.lockHighlight} /><View style={visualStyles.keyhole} /><View style={visualStyles.keyStem} /></View></View>
    </Animated.View>
    <Animated.View style={[visualStyles.socialNode, compact && visualStyles.smallNode, { top: size * 0.1, right: size * 0.02, transform: [{ translateY: movement.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }, { rotate: '8deg' }] }]}><View style={[visualStyles.instagramIcon, compact && { transform: [{ scale: 0.75 }], margin: -3 }]}><View style={visualStyles.instagramLens} /><View style={visualStyles.instagramDot} /></View>{!compact && <Text style={visualStyles.socialLabel}>Instagram</Text>}</Animated.View>
    <Animated.View style={[visualStyles.socialNode, compact && visualStyles.smallNode, { bottom: size * 0.09, left: -3, transform: [{ translateY: movement.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }, { rotate: '-8deg' }] }]}><View style={[visualStyles.musicIcon, compact && { transform: [{ scale: 0.75 }], margin: -3 }]}><View style={visualStyles.musicStem} /><View style={visualStyles.musicNote} /><View style={visualStyles.musicBar} /></View>{!compact && <Text style={visualStyles.socialLabel}>TikTok</Text>}</Animated.View>
  </View>;
}

export function StreakBadge({ days }: { days: number }) {
  const { visualStyles } = useVisualStyles();
  const count = Math.max(0, Math.floor(Number.isFinite(days) ? days : 0));
  return <View accessible accessibilityLabel={`${count} day study streak`} style={visualStyles.streakBadge}>
    <View importantForAccessibility="no-hide-descendants" aria-hidden style={visualStyles.flameContainer}><View style={visualStyles.flameHalo} /><View style={visualStyles.flame} /><View style={visualStyles.flameInner} /></View>
    <View><Text style={visualStyles.streakCount}>{count} <Text style={visualStyles.streakUnit}>{count === 1 ? 'day' : 'days'}</Text></Text><Text style={visualStyles.streakLabel}>STUDY STREAK</Text></View>
  </View>;
}

export function SkillRing({ value, label, size = 100 }: { value: number; label?: string; size?: number }) {
  const { colors, visualStyles } = useVisualStyles();
  const percent = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const displayed = useRef(new Animated.Value(percent)).current;
  const motionEnabled = useMotionEnabled();
  useEffect(() => {
    displayed.stopAnimation();
    if (!motionEnabled) { displayed.setValue(percent); return; }
    const animation = Animated.timing(displayed, { toValue: percent, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [displayed, motionEnabled, percent]);
  const diameter = Math.max(72, Number.isFinite(size) ? size : 100);
  const tickWidth = diameter >= 120 ? 5 : 4;
  const tickHeight = diameter >= 120 ? 10 : 8;
  const radius = diameter / 2 - tickHeight / 2 - 2;
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label ?? 'Skill progress'} accessibilityValue={{ min: 0, max: 100, now: Math.round(percent), text: `${Math.round(percent)} percent` }} style={{ width: diameter, height: diameter, alignItems: 'center', justifyContent: 'center' }}>
    {Array.from({ length: 40 }, (_, index) => {
      const angle = index * Math.PI / 20 - Math.PI / 2;
      return <View key={index} style={{ position: 'absolute', width: tickWidth, height: tickHeight, borderRadius: 2, backgroundColor: colors.ringTrack, overflow: 'hidden', left: diameter / 2 + Math.cos(angle) * radius - tickWidth / 2, top: diameter / 2 + Math.sin(angle) * radius - tickHeight / 2, transform: [{ rotate: `${index * 9}deg` }] }}><Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.accent, opacity: displayed.interpolate({ inputRange: [index * 2.5, (index + 1) * 2.5], outputRange: [0, 1], extrapolate: 'clamp' }) }]} /></View>;
    })}
    <Text style={[visualStyles.ringNumber, { fontSize: Math.min(36, Math.round(diameter * 0.25)), lineHeight: Math.round(diameter * 0.3) }]}>{Math.round(percent)}<Text style={visualStyles.ringPercent}>%</Text></Text>
    {label && <Text numberOfLines={2} style={[visualStyles.ringLabel, { maxWidth: diameter * 0.66, fontSize: diameter >= 120 ? 11 : 9 }]}>{label}</Text>}
  </View>;
}

function makeVisualStyles(colors: ThemePalette) { return StyleSheet.create({
  orbit: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  orbitGlow: { position: 'absolute', backgroundColor: colors.accent, opacity: 0.13 },
  orbitRing: { position: 'absolute', borderWidth: 1, borderRadius: 999 },
  orbitLine: { position: 'absolute', height: 1, backgroundColor: colors.heroLine, opacity: 0.5 },
  orbitCore: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentBright, borderWidth: 3, borderColor: colors.accent, shadowColor: colors.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 18, elevation: 5 },
  coreHighlight: { position: 'absolute', left: '14%', right: '14%', top: 3, height: '36%', borderTopLeftRadius: 50, borderTopRightRadius: 50, backgroundColor: colors.onHero, opacity: 0.16 },
  lockGlyph: { width: 48, height: 52 },
  lockShackle: { width: 28, height: 25, borderWidth: 4, borderColor: colors.forest, borderTopLeftRadius: 18, borderTopRightRadius: 18, position: 'absolute', top: 2, left: 10 },
  lockBody: { position: 'absolute', bottom: 0, left: 6, width: 36, height: 31, borderRadius: 9, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  lockHighlight: { position: 'absolute', left: 4, right: 4, top: 3, height: 1, backgroundColor: colors.accentBright, opacity: 0.4 },
  keyhole: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accentBright },
  keyStem: { width: 3, height: 7, backgroundColor: colors.accentBright, marginTop: -1 },
  socialNode: { position: 'absolute', backgroundColor: colors.onHero, borderWidth: 1, borderColor: colors.accentBright, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 9, alignItems: 'center', gap: 5, shadowColor: colors.accent, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 9, elevation: 3 },
  smallNode: { paddingHorizontal: 7, paddingVertical: 7, borderRadius: 12, gap: 3 },
  socialLabel: { fontSize: 11, fontWeight: '700', color: colors.forest },
  instagramIcon: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  instagramLens: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: colors.forest },
  instagramDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.forest, position: 'absolute', right: 3, top: 3 },
  musicIcon: { width: 24, height: 24 },
  musicStem: { position: 'absolute', width: 4, height: 20, top: 0, right: 5, backgroundColor: colors.forest, borderRadius: 2 },
  musicNote: { position: 'absolute', width: 12, height: 9, bottom: 0, right: 5, backgroundColor: colors.forest, borderRadius: 6, transform: [{ rotate: '-20deg' }] },
  musicBar: { position: 'absolute', width: 12, height: 6, top: 2, right: -2, backgroundColor: colors.forest, borderBottomRightRadius: 8, transform: [{ rotate: '20deg' }] },
  orbitDot: { position: 'absolute', width: 9, height: 9, borderRadius: 6, backgroundColor: colors.accentBright },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.pale, borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10 },
  flameContainer: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  flameHalo: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, opacity: 0.1 },
  flame: { width: 24, height: 28, borderTopLeftRadius: 2, borderTopRightRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, transform: [{ rotate: '45deg' }], backgroundColor: colors.accent },
  flameInner: { position: 'absolute', width: 10, height: 14, bottom: 4, borderTopLeftRadius: 1, borderTopRightRadius: 8, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, transform: [{ rotate: '45deg' }], backgroundColor: colors.pale },
  streakCount: { color: colors.ink, fontSize: 22, fontWeight: '700', lineHeight: 27, fontVariant: ['tabular-nums'] },
  streakUnit: { fontSize: 13, fontWeight: '600' },
  streakLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, lineHeight: 15 },
  ringNumber: { color: colors.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  ringPercent: { fontSize: 12, fontWeight: '600' },
  ringLabel: { color: colors.muted, fontWeight: '600', textAlign: 'center', lineHeight: 13, marginTop: 2 },
}); }
