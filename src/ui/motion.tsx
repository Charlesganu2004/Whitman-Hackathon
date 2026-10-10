import React, { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { alpha, useTheme } from './theme';

let nativeReducedMotion: boolean | undefined;
const reduceMotionQuery = () => Platform.OS === 'web' && typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(prefers-reduced-motion: reduce)') : null;

/** True or false once the system preference is known; undefined while the native query is still in flight. */
function useReducedPreference() {
  const [reduced, setReduced] = useState<boolean | undefined>(() => reduceMotionQuery()?.matches ?? nativeReducedMotion);
  useEffect(() => {
    let mounted = true;
    const media = reduceMotionQuery();
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

export function useReducedMotion() {
  return useReducedPreference() ?? true;
}

/** `known` is false only during the first native query; `reduced` is the safe answer (true) until then; `enabled` also needs the app in the foreground and the tab visible. */
export function useMotionState() {
  const reduced = useReducedPreference();
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
  return { known: reduced !== undefined, reduced: reduced ?? true, enabled: reduced === false && foreground && visible };
}

export function useMotionEnabled() {
  return useMotionState().enabled;
}

/** One native-driven 0 to 1 loop. It stops when motion is off or the component unmounts and parks at `rest`. */
export function useLoop(period: number, enabled: boolean, rest = 0) {
  const value = useRef(new Animated.Value(rest)).current;
  useEffect(() => {
    value.stopAnimation();
    value.setValue(rest);
    if (!enabled) return;
    value.setValue(0);
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration: period, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    loop.start();
    return () => loop.stop();
  }, [enabled, period, rest, value]);
  return value;
}

/** Maps a looping 0 to 1 value through a periodic function sampled into a piecewise curve the native driver can run. */
export function periodic(value: Animated.Value, curve: (cycle: number) => number, phase = 0, steps = 24) {
  const inputRange = Array.from({ length: steps + 1 }, (_, index) => index / steps);
  return value.interpolate({ inputRange, outputRange: inputRange.map(position => curve((position + phase) % 1)) });
}

const RevealSettled = createContext(false);
const playedScopes = new Set<string>();
/** Marks a screen as seen after its first paint so entrances and meter sweeps do not replay when the student returns to it. */
export function RevealScope({ id, children }: { id: string; children: React.ReactNode }) {
  const settled = playedScopes.has(id);
  useEffect(() => { playedScopes.add(id); }, [id]);
  return <RevealSettled.Provider value={settled}>{children}</RevealSettled.Provider>;
}
export function useRevealSettled() {
  return useContext(RevealSettled);
}

export function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const { known, enabled } = useMotionState();
  const quick = useRef(useRevealSettled()).current;
  const entrance = useRef(new Animated.Value(known && !enabled ? 1 : 0)).current;
  const finished = useRef(false);
  useEffect(() => {
    if (finished.current) { entrance.setValue(1); return; }
    if (!known) {
      const timer = setTimeout(() => { finished.current = true; entrance.setValue(1); }, 200);
      return () => clearTimeout(timer);
    }
    finished.current = true;
    if (!enabled) { entrance.setValue(1); return; }
    entrance.setValue(0);
    const animation = Animated.timing(entrance, quick
      ? { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }
      : { toValue: 1, delay: Math.max(0, Math.min(delay, 160)), duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [delay, enabled, entrance, known, quick]);
  const rise = quick ? [] : [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }];
  return <Animated.View style={[style, { opacity: entrance, transform: rise }]}>{children}</Animated.View>;
}

interface Ink { hairline: string; arc: string; fill: string; dot: string }
interface RingSpec { size: number; place: ViewStyle; spin: number; drift: number; driftX: number; driftY: number; reverse?: boolean; phase: number; dots: { angle: number; ratio: number; size: number }[] }
interface OrbSpec { size: number; place: ViewStyle; period: number; ax: number; ay: number; phase: number }
interface MoteSpec { place: ViewStyle; size: number; period: number; travel: number; sway: number; phase: number }

// Three depth layers. Periods run 14 to 40 seconds and are mostly coprime, so the combined pattern does not visibly repeat.
const PAGE_RINGS: RingSpec[] = [
  { size: 500, place: { right: -250, top: '-2%' }, spin: 40000, drift: 27000, driftX: 30, driftY: 26, phase: 0, dots: [{ angle: -60, ratio: 1, size: 7 }, { angle: 35, ratio: 0.74, size: 5 }, { angle: 160, ratio: 1, size: 6 }] },
  { size: 420, place: { left: -230, bottom: '3%' }, spin: 34000, drift: 31000, driftX: 34, driftY: 28, reverse: true, phase: 0.3, dots: [{ angle: 20, ratio: 1, size: 6 }, { angle: 200, ratio: 0.74, size: 5 }] },
];
const PAGE_ORBS: OrbSpec[] = [
  { size: 150, place: { left: '56%', top: '24%' }, period: 17000, ax: 28, ay: 30, phase: 0 },
  { size: 96, place: { left: '-4%', top: '40%' }, period: 21000, ax: 26, ay: 32, phase: 0.4 },
  { size: 210, place: { left: '34%', top: '60%' }, period: 26000, ax: 30, ay: 26, phase: 0.7 },
  { size: 64, place: { left: '76%', top: '80%' }, period: 14000, ax: 22, ay: 28, phase: 0.2 },
];
const PAGE_MOTES: MoteSpec[] = [
  { place: { left: '12%', top: '24%' }, size: 5, period: 15000, travel: 70, sway: 6, phase: 0.05 },
  { place: { left: '31%', top: '55%' }, size: 7, period: 22000, travel: 60, sway: 8, phase: 0.27 },
  { place: { left: '48%', top: '16%' }, size: 4, period: 18000, travel: 66, sway: 5, phase: 0.52 },
  { place: { left: '66%', top: '40%' }, size: 6, period: 27000, travel: 70, sway: 9, phase: 0.74 },
  { place: { left: '84%', top: '66%' }, size: 5, period: 16000, travel: 56, sway: 6, phase: 0.15 },
  { place: { left: '22%', top: '80%' }, size: 6, period: 33000, travel: 70, sway: 10, phase: 0.61 },
  { place: { left: '91%', top: '20%' }, size: 4, period: 24000, travel: 62, sway: 6, phase: 0.9 },
  { place: { left: '58%', top: '88%' }, size: 7, period: 19000, travel: 68, sway: 7, phase: 0.38 },
  { place: { left: '6%', top: '47%' }, size: 4, period: 29000, travel: 64, sway: 5, phase: 0.83 },
];
// The card version of the same scene, sized for a dark hero card or the launch screen.
const HERO_RINGS: RingSpec[] = [
  { size: 300, place: { right: -140, top: -60 }, spin: 40000, drift: 27000, driftX: 16, driftY: 14, phase: 0, dots: [{ angle: -60, ratio: 1, size: 6 }, { angle: 150, ratio: 0.74, size: 5 }] },
];
const HERO_ORBS: OrbSpec[] = [
  { size: 84, place: { left: '6%', top: '54%' }, period: 17000, ax: 14, ay: 16, phase: 0.1 },
  { size: 52, place: { left: '72%', top: '70%' }, period: 14000, ax: 12, ay: 14, phase: 0.55 },
];
const HERO_MOTES: MoteSpec[] = [
  { place: { left: '14%', top: '30%' }, size: 4, period: 16000, travel: 44, sway: 4, phase: 0.1 },
  { place: { left: '46%', top: '78%' }, size: 5, period: 22000, travel: 48, sway: 5, phase: 0.45 },
  { place: { left: '70%', top: '24%' }, size: 4, period: 19000, travel: 40, sway: 4, phase: 0.7 },
  { place: { left: '90%', top: '58%' }, size: 5, period: 26000, travel: 46, sway: 5, phase: 0.92 },
];

const circle = (size: number, ratio: number): ViewStyle => ({ position: 'absolute', width: size * ratio, height: size * ratio, borderRadius: (size * ratio) / 2, top: (size * (1 - ratio)) / 2, left: (size * (1 - ratio)) / 2 });

const RingGroup = memo(function RingGroup({ spec, ink, enabled }: { spec: RingSpec; ink: Ink; enabled: boolean }) {
  const spin = useLoop(spec.spin, enabled);
  const drift = useLoop(spec.drift, enabled);
  const motion = useMemo(() => ({
    rotate: spin.interpolate({ inputRange: [0, 1], outputRange: spec.reverse ? ['0deg', '-360deg'] : ['0deg', '360deg'] }),
    x: periodic(drift, cycle => spec.driftX * Math.sin(2 * Math.PI * cycle), spec.phase),
    y: periodic(drift, cycle => spec.driftY * Math.sin(2 * Math.PI * cycle + 1.6), spec.phase),
  }), [drift, spec, spin]);
  const { size } = spec;
  return <Animated.View style={[{ position: 'absolute', width: size, height: size }, spec.place, { transform: [{ translateX: motion.x }, { translateY: motion.y }, { rotate: motion.rotate }] }]}>
    <View style={[circle(size, 1), { borderWidth: 1, borderColor: ink.hairline }]} />
    <View style={[circle(size, 0.74), { borderWidth: 1.5, borderTopColor: ink.arc, borderRightColor: ink.arc, borderBottomColor: ink.hairline, borderLeftColor: ink.hairline }]} />
    <View style={[circle(size, 0.46), { borderWidth: 1, borderColor: ink.hairline, backgroundColor: ink.fill }]} />
    {spec.dots.map((dot, index) => {
      const angle = (dot.angle * Math.PI) / 180;
      return <View key={index} style={{ position: 'absolute', width: dot.size, height: dot.size, borderRadius: dot.size / 2, backgroundColor: ink.dot, left: size / 2 + Math.cos(angle) * dot.ratio * (size / 2) - dot.size / 2, top: size / 2 + Math.sin(angle) * dot.ratio * (size / 2) - dot.size / 2 }} />;
    })}
  </Animated.View>;
});

const Orb = memo(function Orb({ spec, ink, enabled }: { spec: OrbSpec; ink: Ink; enabled: boolean }) {
  const loop = useLoop(spec.period, enabled);
  const motion = useMemo(() => ({
    x: periodic(loop, cycle => spec.ax * Math.sin(2 * Math.PI * cycle), spec.phase),
    y: periodic(loop, cycle => spec.ay * Math.sin(4 * Math.PI * cycle + 0.8), spec.phase),
    scale: periodic(loop, cycle => 1 + 0.05 * Math.sin(2 * Math.PI * cycle + 2), spec.phase),
  }), [loop, spec]);
  return <Animated.View style={[{ position: 'absolute', width: spec.size, height: spec.size, borderRadius: spec.size / 2, borderWidth: 1, borderColor: ink.hairline, backgroundColor: ink.fill }, spec.place, { transform: [{ translateX: motion.x }, { translateY: motion.y }, { scale: motion.scale }] }]} />;
});

const Mote = memo(function Mote({ spec, ink, enabled }: { spec: MoteSpec; ink: Ink; enabled: boolean }) {
  const loop = useLoop(spec.period, enabled, (0.5 - spec.phase + 1) % 1);
  const motion = useMemo(() => ({
    rise: periodic(loop, cycle => spec.travel * (0.5 - cycle), spec.phase),
    sway: periodic(loop, cycle => spec.sway * Math.sin(4 * Math.PI * cycle), spec.phase),
    opacity: periodic(loop, cycle => Math.sin(Math.PI * cycle) ** 2, spec.phase),
  }), [loop, spec]);
  return <Animated.View style={[{ position: 'absolute', width: spec.size, height: spec.size, borderRadius: spec.size / 2, backgroundColor: ink.dot }, spec.place, { opacity: motion.opacity, transform: [{ translateX: motion.sway }, { translateY: motion.rise }] }]} />;
});

/** Distance the page scroll may carry a layer; the layer is this much taller than the screen so it never runs out of shapes. */
const PARALLAX_REACH = 900;
function Layer({ rate, scrollY, parallax, children }: { rate: number; scrollY?: Animated.Value; parallax: boolean; children: React.ReactNode }) {
  const follow = parallax && scrollY ? scrollY : null;
  const translateY = useMemo(() => follow?.interpolate({ inputRange: [0, 500, 1500], outputRange: [0, rate * 500, rate * PARALLAX_REACH], extrapolate: 'clamp' }), [follow, rate]);
  const extra = follow ? Math.round(Math.abs(rate) * PARALLAX_REACH) : 0;
  return <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: -extra }, translateY ? { transform: [{ translateY }] } : null]}>{children}</Animated.View>;
}

/**
 * Theme-coloured scene behind the page or inside a hero card: large rotating arcs at the back, slow orbs in the middle and
 * rising motes in front. Everything moves with transform and opacity on the native driver, so there is no per-frame JavaScript,
 * and with `scrollY` the layers also shift against the page scroll for depth. With motion off the shapes sit still.
 */
export function AmbientBackground({ hero = false, scrollY }: { hero?: boolean; scrollY?: Animated.Value }) {
  const { colors, isDark } = useTheme();
  const { reduced, enabled } = useMotionState();
  const tone = hero ? colors.accentBright : colors.accent;
  const strength = hero ? 1.15 : isDark ? 1.1 : 1;
  const ink = useMemo<Ink>(() => ({ hairline: alpha(tone, 0.2 * strength), arc: alpha(tone, 0.5 * strength), fill: alpha(tone, 0.07 * strength), dot: alpha(tone, 0.5 * strength) }), [strength, tone]);
  const parallax = !hero && !reduced;
  const rings = hero ? HERO_RINGS : PAGE_RINGS;
  const orbs = hero ? HERO_ORBS : PAGE_ORBS;
  const motes = hero ? HERO_MOTES : PAGE_MOTES;
  return <View accessible={false} aria-hidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { overflow: 'hidden', pointerEvents: 'none' }]}>
    <Layer rate={-0.06} scrollY={scrollY} parallax={parallax}>{rings.map((spec, index) => <RingGroup key={index} spec={spec} ink={ink} enabled={enabled} />)}</Layer>
    <Layer rate={-0.12} scrollY={scrollY} parallax={parallax}>{orbs.map((spec, index) => <Orb key={index} spec={spec} ink={ink} enabled={enabled} />)}</Layer>
    <Layer rate={-0.2} scrollY={scrollY} parallax={parallax}>{motes.map((spec, index) => <Mote key={index} spec={spec} ink={ink} enabled={enabled} />)}</Layer>
  </View>;
}
