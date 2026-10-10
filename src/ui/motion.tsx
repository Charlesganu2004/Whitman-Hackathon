import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './theme';

let nativeReducedMotion: boolean | undefined;

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => Platform.OS === 'web' && typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches : nativeReducedMotion ?? true);
  useEffect(() => {
    let mounted = true;
    const media = Platform.OS === 'web' && typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const updateMedia = () => setReduced(media?.matches ?? false);
    const updateNative = (value: boolean) => { nativeReducedMotion = value; if (mounted) setReduced(value); };
    if (media) updateMedia();
    else AccessibilityInfo.isReduceMotionEnabled().then(updateNative).catch(() => updateNative(true));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', updateNative);
    media?.addEventListener?.('change', updateMedia);
    return () => { mounted = false; subscription.remove(); media?.removeEventListener?.('change', updateMedia); };
  }, []);
  return reduced;
}

export function useMotionEnabled() {
  const reduced = useReducedMotion();
  const [foreground, setForeground] = useState(() => AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [visible, setVisible] = useState(() => Platform.OS !== 'web' || typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    const updateVisibility = () => setVisible(document.visibilityState !== 'hidden');
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);
  return !reduced && foreground && visible;
}

export function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const motionEnabled = useMotionEnabled();
  const entrance = useRef(new Animated.Value(motionEnabled ? 0 : 1)).current;
  const revealed = useRef(!motionEnabled);
  useEffect(() => {
    entrance.stopAnimation();
    if (!motionEnabled || revealed.current) { revealed.current = true; entrance.setValue(1); return; }
    entrance.setValue(0);
    revealed.current = true;
    const animation = Animated.timing(entrance, { toValue: 1, delay: Math.max(0, Math.min(delay, 300)), duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [delay, entrance, motionEnabled]);
  return <Animated.View style={[style, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>{children}</Animated.View>;
}

export function AmbientBackground() {
  const { colors, isDark } = useTheme();
  const motionEnabled = useMotionEnabled();
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    drift.stopAnimation();
    if (!motionEnabled) { drift.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 18000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(drift, { toValue: 0, duration: 18000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [drift, motionEnabled]);
  return <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
    <Animated.View style={{ position: 'absolute', width: 430, height: 430, borderRadius: 215, right: -225, top: 15, transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -28] }) }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) }, { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
      {[1, 0.82, 0.64, 0.46].map((ratio, index) => <View key={ratio} style={{ position: 'absolute', width: 430 * ratio, height: 430 * ratio, borderRadius: 215 * ratio, top: 215 * (1 - ratio), left: 215 * (1 - ratio), backgroundColor: colors.accent, opacity: (isDark ? 0.012 : 0.014) + index * 0.005 }} />)}
    </Animated.View>
    <Animated.View style={{ position: 'absolute', width: 340, height: 340, borderRadius: 170, left: -215, bottom: 80, transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 35] }) }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) }] }}>
      {[1, 0.74, 0.48].map((ratio, index) => <View key={ratio} style={{ position: 'absolute', width: 340 * ratio, height: 340 * ratio, borderRadius: 170 * ratio, top: 170 * (1 - ratio), left: 170 * (1 - ratio), backgroundColor: colors.accentBright, opacity: 0.025 + index * 0.009 }} />)}
    </Animated.View>
    <Animated.View style={{ position: 'absolute', width: 320, height: 320, borderRadius: 160, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accent, opacity: isDark ? 0.1 : 0.08, right: -185, bottom: -90, transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) }] }} />
  </View>;
}

export function AmbientMotion() {
  const { colors } = useTheme();
  const motionEnabled = useMotionEnabled();
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    breath.stopAnimation();
    breath.setValue(0);
    if (!motionEnabled) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(breath, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [breath, motionEnabled]);
  return <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}><Animated.View style={{ position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.accent, opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] }), transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] }) }] }} /><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent }} /></View>;
}
