import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useMotionEnabled } from './motion';
import { useTheme } from './theme';

export function AudioWave({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const motionEnabled = useMotionEnabled();
  const values = useRef(Array.from({ length: 7 }, () => new Animated.Value(0.35))).current;
  useEffect(() => {
    values.forEach(value => value.stopAnimation());
    if (!active || !motionEnabled) { values.forEach((value, index) => value.setValue(active ? 0.45 + (3 - Math.abs(3 - index)) * 0.1 : 0.25)); return; }
    const animations = values.map((value, index) => Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 0.65 + (index % 3) * 0.17, duration: 250 + index * 50, useNativeDriver: true, isInteraction: false }),
      Animated.timing(value, { toValue: 0.25, duration: 380 + index * 35, useNativeDriver: true, isInteraction: false }),
    ])));
    animations.forEach(animation => animation.start());
    return () => animations.forEach(animation => animation.stop());
  }, [active, motionEnabled, values]);
  return <View accessible={false} aria-hidden style={{ height: 40, flexDirection: 'row', alignItems: 'center', gap: 5 }}>{values.map((value, index) => <Animated.View key={index} style={{ width: 5, height: 32, borderRadius: 3, backgroundColor: colors.accent, transform: [{ scaleY: value }] }} />)}</View>;
}
