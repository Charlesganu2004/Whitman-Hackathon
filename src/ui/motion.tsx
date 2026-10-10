import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './theme';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => Platform.OS === 'web' && typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches : false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); }).catch(() => { if (mounted) setReduced(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const media = Platform.OS === 'web' && typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const updateMedia = () => setReduced(media?.matches ?? false);
    media?.addEventListener?.('change', updateMedia);
    return () => { mounted = false; subscription.remove(); media?.removeEventListener?.('change', updateMedia); };
  }, []);
  return reduced;
}

export function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  useEffect(() => {
    entrance.stopAnimation();
    if (reducedMotion) { entrance.setValue(1); return; }
    const animation = Animated.timing(entrance, { toValue: 1, delay: Math.max(0, Math.min(delay, 300)), duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [delay, entrance, reducedMotion]);
  return <Animated.View style={[style, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>{children}</Animated.View>;
}

export function AmbientMotion() {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    breath.stopAnimation();
    breath.setValue(0);
    if (reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [breath, reducedMotion]);
  return <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}><Animated.View style={{ position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.accent, opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] }), transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] }) }] }} /><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent }} /></View>;
}
