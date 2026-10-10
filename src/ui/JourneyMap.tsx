import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type GestureResponderEvent, type LayoutChangeEvent, type ScrollView, type ViewStyle } from 'react-native';
import { LEVELS } from '../core/engine';
import { LESSONS } from '../core/content';
import {
  createRoadmapLayout, createRoadmapStages, MAX_FONT_SCALE, pathWindow, ROAD_WIDTH, roadmapViewportHeight, roadSegments,
  scrubberOffset, scrubberWindow, type PathWindow, type RoadSegment, type RoadmapLayout, type RoadmapStage, type RoadmapState, type RoadmapStop,
} from '../core/roadmap';
import type { Snapshot } from '../core/types';
import { Body } from './components';
import { useMotionEnabled } from './motion';
import { useTheme, type ThemePalette } from './theme';

const STAGE_COPY = [
  { title: 'Build your foundation', description: 'Explain your reasoning and tell a concrete story.' },
  { title: 'Find your rhythm', description: 'Validate your answers and turn feedback into action.' },
  { title: 'Make better decisions', description: 'Explain tradeoffs and handle disagreement constructively.' },
  { title: 'See the whole system', description: 'Reason across a system and help someone else improve.' },
  { title: 'Keep your edge', description: 'Continue practicing and revisit lessons to keep your interview skills sharp.' },
];
const STATE_LABELS: Record<RoadmapState, string> = {
  reached: 'Level reached', current: 'You are here', locked: 'Future level', placement: 'Placement first',
};
const CARD_STATE: Record<RoadmapState, string> = {
  reached: 'REACHED', current: 'YOU ARE HERE', locked: 'LOCKED', placement: 'PLACEMENT',
};
const name = (level: string) => level[0].toUpperCase() + level.slice(1);
const pad = (value: number) => String(value).padStart(2, '0');

// Parallax: the far dot grid drifts at 22% of the road's speed, the contour rings at 50%.
const FAR_PARALLAX = 0.22;
const MID_PARALLAX = 0.5;
const DOT_PITCH = 24;
const CONTOURS = [
  { x: 0.14, y: 0.78, radii: [62, 100, 142] },
  { x: 0.5, y: 0.22, radii: [70, 112, 158] },
  { x: 0.86, y: 0.7, radii: [58, 96, 138] },
];
const SCRUB_HEIGHT = 44;
const SCRUB_INSET = 14;

// Decorative layers are hidden from screen readers; the stops and the buttons carry the content.
const decorative = { accessible: false, importantForAccessibility: 'no-hide-descendants', 'aria-hidden': true } as const;

function rgb(hex: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  return match ? [0, 2, 4].map(at => parseInt(match[1].slice(at, at + 2), 16)) : null;
}
// Opaque blend of two palette colours. Road passes overlap, so translucent fills would band at every joint.
function mix(from: string, to: string, amount: number) {
  const a = rgb(from);
  const b = rgb(to);
  if (!a || !b) return from;
  return `#${a.map((channel, i) => Math.round(channel + (b[i] - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
}
function withAlpha(hex: string, alpha: number) {
  return rgb(hex) ? `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : hex;
}
// Same shadow props as components.tsx on iPhone; web gets boxShadow so react-native-web does not warn about shadow*.
function lift(color: string, opacity: number, radius: number, offsetY: number): ViewStyle {
  if (Platform.OS === 'web') return { boxShadow: `0px ${offsetY}px ${radius}px ${withAlpha(color, opacity)}` };
  return { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: offsetY }, elevation: Math.max(1, Math.round(radius / 3)) };
}

function roadPalette(colors: ThemePalette) {
  return {
    aheadCasing: mix(colors.muted, colors.background, 0.55),
    aheadSurface: colors.surface,
    aheadMark: mix(colors.muted, colors.surface, 0.6),
    litCasing: mix(colors.accent, colors.forest, 0.38),
    litSurface: colors.accent,
    litMark: colors.onAccent,
  };
}
type RoadPalette = ReturnType<typeof roadPalette>;

function segmentStyle(segment: RoadSegment, thickness: number, length: number, color: string): ViewStyle {
  return {
    position: 'absolute', left: segment.x - length / 2, top: segment.y - thickness / 2, width: length, height: thickness,
    borderRadius: thickness / 2, backgroundColor: color, transform: [{ rotate: `${segment.angle}rad` }],
  };
}

// The road is three passes of short rounded rectangles laid along the centreline. Each pill is one chord plus a round cap
// at both ends, so every sample is the centre of a circle and bends stay seamless at any pixel density.
// Within a pass the part ahead is drawn first and the lit part after it, so the lit road ends in a clean round cap.
const RoadLayer = memo(function RoadLayer({ segments, litCount, palette, children }: { segments: RoadSegment[]; litCount: number; palette: RoadPalette; children?: React.ReactNode }) {
  const views = useMemo(() => {
    const ahead = segments.map((segment, index) => ({ segment, index })).filter(({ index }) => index >= litCount);
    const lit = segments.map((segment, index) => ({ segment, index })).filter(({ index }) => index < litCount);
    const surface = ROAD_WIDTH - 6;
    const pass = (key: string, thickness: number, color: (isLit: boolean) => string, grow: (segment: RoadSegment) => number, every = 1) => [
      ...ahead.filter(({ index }) => index % every === 0).map(({ segment, index }) => <View key={`${key}-a${index}`} style={segmentStyle(segment, thickness, grow(segment), color(false))} />),
      ...lit.filter(({ index }) => index % every === 0).map(({ segment, index }) => <View key={`${key}-l${index}`} style={segmentStyle(segment, thickness, grow(segment), color(true))} />),
    ];
    return [
      ...pass('casing', ROAD_WIDTH, isLit => (isLit ? palette.litCasing : palette.aheadCasing), segment => segment.length + ROAD_WIDTH),
      ...pass('surface', surface, isLit => (isLit ? palette.litSurface : palette.aheadSurface), segment => segment.length + surface),
      ...pass('mark', 3, isLit => (isLit ? palette.litMark : palette.aheadMark), segment => segment.length * 0.55 + 3, 2),
    ];
  }, [segments, litCount, palette]);
  return <View {...decorative} shouldRasterizeIOS style={styles0.fill}>{views}{children}</View>;
});
const styles0 = StyleSheet.create({ fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, pointerEvents: 'none' } });

// Start flag at Beginner and a chequered summit flag at Master, standing beside the first and last marker.
const Landmarks = memo(function Landmarks({ first, last, summitReached, s }: { first: RoadmapStop; last: RoadmapStop; summitReached: boolean; s: ReturnType<typeof createStyles> }) {
  const startX = first.point.x - 58;
  const startBase = first.point.y + 26;
  const summitX = last.point.x + 56;
  const summitBase = last.point.y + 26;
  const squares = [0, 1, 2, 3, 4, 5];
  return <>
    <View style={[s.flagBase, { left: startX - 8, top: startBase - 3 }]} />
    <View style={[s.flagPole, { left: startX - 1.5, top: startBase - 42, height: 42 }]} />
    <View style={[s.flagPennant, s.startPennant, { left: startX + 1.5, top: startBase - 42 }]} />
    <View style={[s.flagBase, { left: summitX - 8, top: summitBase - 3 }]} />
    <View style={[s.flagPole, { left: summitX - 1.5, top: summitBase - 46, height: 46 }]} />
    <View style={[s.chequer, { left: summitX + 1.5, top: summitBase - 46 }]}>
      {squares.map(square => <View key={square} style={[s.chequerSquare, (square + Math.floor(square / 3)) % 2 === 0 ? s.chequerDark : s.chequerLight, !summitReached && s.chequerMuted]} />)}
    </View>
  </>;
});

const FarDots = memo(function FarDots({ scrollX, width, height, color }: { scrollX: Animated.Value; width: number; height: number; color: string }) {
  const shift = useMemo(() => Animated.multiply(Animated.modulo(Animated.multiply(scrollX, FAR_PARALLAX), DOT_PITCH), -1), [scrollX]);
  const dots = useMemo(() => {
    const columns = Math.ceil(width / DOT_PITCH) + 1;
    const rows = Math.ceil(height / DOT_PITCH);
    return Array.from({ length: columns * rows }, (_, i) => (
      <View key={i} style={{ position: 'absolute', left: (i % columns) * DOT_PITCH + DOT_PITCH / 2 - 1, top: Math.floor(i / columns) * DOT_PITCH + DOT_PITCH / 2 - 1, width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
    ));
  }, [width, height, color]);
  return <Animated.View {...decorative} shouldRasterizeIOS style={{ position: 'absolute', left: 0, top: 0, width: width + DOT_PITCH, height, pointerEvents: 'none', transform: [{ translateX: shift }] }}>{dots}</Animated.View>;
});

const Contours = memo(function Contours({ scrollX, maxScroll, width, height, color }: { scrollX: Animated.Value; maxScroll: number; width: number; height: number; color: string }) {
  const layerWidth = width + maxScroll * MID_PARALLAX;
  const shift = useMemo(() => scrollX.interpolate({ inputRange: [0, Math.max(1, maxScroll)], outputRange: [0, -Math.max(1, maxScroll) * MID_PARALLAX], extrapolate: 'clamp' }), [scrollX, maxScroll]);
  const rings = useMemo(() => CONTOURS.flatMap((hill, h) => hill.radii.map(radius => (
    <View key={`${h}-${radius}`} style={{ position: 'absolute', left: hill.x * layerWidth - radius * 1.2, top: hill.y * height - radius * 0.75, width: radius * 2.4, height: radius * 1.5, borderRadius: radius * 1.2, borderWidth: 1, borderColor: color }} />
  ))), [layerWidth, height, color]);
  return <Animated.View {...decorative} shouldRasterizeIOS style={{ position: 'absolute', left: 0, top: 0, width: layerWidth, height, pointerEvents: 'none', transform: [{ translateX: shift }] }}>{rings}</Animated.View>;
});

// Loops only while `active`. The traveller glides from the current stop to the next, then rests briefly before it starts again.
const Traveller = memo(function Traveller({ path, active, style }: { path: PathWindow; active: boolean; style: ViewStyle }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    if (!active) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.delay(900),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, progress]);
  const motion = useMemo(() => ({
    opacity: progress.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0] }),
    transform: [
      { translateX: progress.interpolate({ inputRange: path.input, outputRange: path.x }) },
      { translateY: progress.interpolate({ inputRange: path.input, outputRange: path.y }) },
    ],
  }), [path, progress]);
  if (!active) return null;
  return <Animated.View {...decorative} style={[style, motion]} />;
});

// A soft highlight that runs along the lit part of the road from the start to the current stop.
const Glint = memo(function Glint({ path, active, style }: { path: PathWindow; active: boolean; style: ViewStyle }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    if (!active) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false }),
      Animated.delay(1800),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, progress]);
  const motion = useMemo(() => ({
    opacity: progress.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.85, 0.85, 0] }),
    transform: [
      { translateX: progress.interpolate({ inputRange: path.input, outputRange: path.x }) },
      { translateY: progress.interpolate({ inputRange: path.input, outputRange: path.y }) },
      { rotate: progress.interpolate({ inputRange: path.input, outputRange: path.angle.map(angle => `${angle}deg`) }) },
    ],
  }), [path, progress]);
  if (!active) return null;
  return <Animated.View {...decorative} style={[style, motion]} />;
});

interface StopProps {
  stop: RoadmapStop;
  stage: RoadmapStage;
  label: string;
  selected: boolean;
  motionEnabled: boolean;
  onSelect: (index: number) => void;
  s: ReturnType<typeof createStyles>;
}

const StopView = memo(function StopView({ stop, stage, label, selected, motionEnabled, onSelect, s }: StopProps) {
  const entrance = useRef(new Animated.Value(motionEnabled ? 0 : 1)).current;
  const entered = useRef(!motionEnabled);
  const halo = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);
  const live = stage.state === 'current' || stage.state === 'placement';
  const upper = stop.band === 'upper';

  // Markers spring in once, with a short stagger from the first stop to the last.
  useEffect(() => {
    entrance.stopAnimation();
    if (!motionEnabled || entered.current) { entered.current = true; entrance.setValue(1); return; }
    entered.current = true;
    entrance.setValue(0);
    const animation = Animated.spring(entrance, { toValue: 1, delay: 140 + stop.index * 90, speed: 11, bounciness: 9, useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [entrance, motionEnabled, stop.index]);

  useEffect(() => {
    halo.setValue(0);
    if (!live || !motionEnabled) return;
    const loop = Animated.loop(Animated.timing(halo, { toValue: 1, duration: 2200, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false }));
    loop.start();
    return () => loop.stop();
  }, [halo, live, motionEnabled]);

  const markerMotion = useMemo(() => ({
    opacity: entrance.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
    transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
  }), [entrance]);
  const cardMotion = useMemo(() => ({
    opacity: entrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [upper ? -12 : 12, 0] }) }],
  }), [entrance, upper]);
  // At rest the halo is a faint ring just outside the marker, so reduced motion still marks where you are.
  const haloMotion = useMemo(() => ({
    opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.26, 0] }),
    transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1.16, 1.6] }) }],
  }), [halo]);

  const markerLeft = stop.marker.left - stop.hit.left;
  const markerTop = stop.marker.top - stop.hit.top;
  const number = pad(stop.index + 1);
  const reachedFill = stage.state === 'reached' || stage.state === 'current';
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={label}
    onPress={() => onSelect(stop.index)}
    onFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)}
    style={({ pressed }) => [s.stop, { left: stop.hit.left, top: stop.hit.top, width: stop.hit.width, height: stop.hit.height }, pressed && s.stopPressed]}
  >
    {live && <Animated.View {...decorative} style={[s.halo, { left: markerLeft, top: markerTop }, haloMotion]} />}
    {selected && <View {...decorative} style={[s.ring, { left: markerLeft - 6, top: markerTop - 6 }]} />}
    {focused && <View {...decorative} style={[s.focusRing, { left: markerLeft - 9, top: markerTop - 9 }]} />}
    <Animated.View style={[s.marker, reachedFill && s.markerFilled, stage.state === 'placement' && s.markerPlacement, { left: markerLeft, top: markerTop }, markerMotion]}>
      {stage.state === 'locked'
        ? <View {...decorative} style={s.lock}><View style={s.shackle} /><View style={s.lockBody}><View style={s.keyhole} /></View></View>
        : stage.state === 'reached'
          ? <View {...decorative} style={s.check} />
          : <Text style={[s.markerNumber, stage.state === 'current' && { color: s.markerNumberOn.color }]} maxFontSizeMultiplier={1.2}>{number}</Text>}
    </Animated.View>
    <Animated.View style={[s.stageLabel, selected && s.stageLabelSelected, { left: stop.label.left - stop.hit.left, top: stop.label.top - stop.hit.top, width: stop.label.width, height: stop.label.height }, cardMotion]}>
      <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[s.stageEyebrow, live && s.stageEyebrowLive]}>{number} · {CARD_STATE[stage.state]}</Text>
      <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[s.stageName, stage.state === 'current' && s.stageNameLive]}>{name(stage.level)}</Text>
      <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={s.stageCaption}>{stage.totalLessons ? `${stage.completedLessons}/${stage.totalLessons} lessons complete` : 'Ongoing practice'}</Text>
    </Animated.View>
  </Pressable>;
});

const Compass = memo(function Compass({ scrollX, maxScroll, s }: { scrollX: Animated.Value; maxScroll: number; s: ReturnType<typeof createStyles> }) {
  const sway = useMemo(() => scrollX.interpolate({ inputRange: [0, Math.max(1, maxScroll)], outputRange: ['-14deg', '14deg'], extrapolate: 'clamp' }), [scrollX, maxScroll]);
  return <View {...decorative} style={s.compass}>
    <Text maxFontSizeMultiplier={1} style={s.compassN}>N</Text>
    <Animated.View style={[s.needle, { transform: [{ rotate: sway }] }]}><View style={s.needleNorth} /><View style={s.needleSouth} /></Animated.View>
  </View>;
});

interface ScrubberProps {
  layout: RoadmapLayout;
  viewportWidth: number;
  scrollX: Animated.Value;
  stages: RoadmapStage[];
  litCount: number;
  selected: number;
  colors: ThemePalette;
  s: ReturnType<typeof createStyles>;
  onJump: (offset: number) => void;
  onStep: (direction: 1 | -1) => void;
}

// Whole-road overview under the map. The window shows what the viewport covers; tapping the track moves it there.
const Scrubber = memo(function Scrubber({ layout, viewportWidth, scrollX, stages, litCount, selected, colors, s, onJump, onStep }: ScrubberProps) {
  const track = Math.max(0, viewportWidth - SCRUB_INSET * 2);
  const inner = Math.max(0, track - 2);
  const window = scrubberWindow(layout.canvas.width, viewportWidth, inner);
  const shift = useMemo(() => scrollX.interpolate({ inputRange: [0, Math.max(1, layout.maxScroll)], outputRange: [0, window.travel], extrapolate: 'clamp' }), [scrollX, layout.maxScroll, window.travel]);
  const scaleX = inner / layout.canvas.width;
  const scaleY = (SCRUB_HEIGHT - 2 - 16) / layout.canvas.height;
  const dots = useMemo(() => layout.samples.map((sample, index) => ({ sample, index })).filter(({ index }) => index % 3 === 0), [layout]);
  const road = mix(colors.muted, colors.subtle, 0.45);
  const onPress = (event: GestureResponderEvent) => {
    const native = event.nativeEvent as unknown as { locationX?: number; offsetX?: number };
    const x = native.locationX ?? native.offsetX;
    if (typeof x === 'number' && Number.isFinite(x)) onJump(scrubberOffset(x - 1, inner, layout.canvas.width, viewportWidth));
  };
  return <View style={s.scrubWrap}>
    <Pressable
      accessibilityRole={Platform.OS === 'web' ? 'button' : 'adjustable'}
      accessibilityLabel="Roadmap position. Tap to move the map."
      accessibilityValue={{ text: `Viewing stage ${selected + 1} of ${stages.length}` }}
      accessibilityActions={[{ name: 'increment', label: 'Next stage' }, { name: 'decrement', label: 'Previous stage' }]}
      onAccessibilityAction={event => onStep(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      onPress={onPress}
      style={[s.scrub, { width: track }]}
    >
      {dots.map(({ sample, index }) => (
        <View key={index} style={[s.scrubDot, { left: sample.x * scaleX - 1.5, top: 8 + sample.y * scaleY - 1.5, backgroundColor: index <= litCount ? colors.accent : road }]} />
      ))}
      {layout.stops.map(stop => {
        const stage = stages[stop.index];
        const filled = stage.state === 'reached' || stage.state === 'current';
        return <View key={stop.index} style={[s.scrubStop, filled && s.scrubStopFilled, selected === stop.index && s.scrubStopSelected, { left: stop.point.x * scaleX - 5, top: 8 + stop.point.y * scaleY - 5 }]} />;
      })}
      <Animated.View style={[s.scrubWindow, { width: window.width, transform: [{ translateX: shift }] }]} />
    </Pressable>
  </View>;
});

export function JourneyMap({ snapshot }: { snapshot: Snapshot }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const motionEnabled = useMotionEnabled();
  const { fontScale } = useWindowDimensions();
  const stages = useMemo(() => createRoadmapStages(snapshot, LESSONS, LEVELS), [snapshot]);
  const currentIndex = Math.max(0, LEVELS.indexOf(snapshot.profile.level));
  const placed = snapshot.profile.placementComplete;
  const travelled = placed ? currentIndex : 0;
  const [selected, setSelected] = useState(currentIndex);
  const [viewportWidth, setViewportWidth] = useState(0);
  const measured = viewportWidth > 0;
  const height = roadmapViewportHeight(fontScale);
  const layout = useMemo(() => createRoadmapLayout(stages.length, { width: viewportWidth, height }, fontScale), [stages.length, viewportWidth, height, fontScale]);
  const segments = useMemo(() => roadSegments(layout), [layout]);
  const palette = useMemo(() => roadPalette(colors), [colors]);
  const litCount = layout.stopSamples[travelled];
  const travellerPath = useMemo(() => (placed && currentIndex < stages.length - 1 ? pathWindow(layout, layout.stopSamples[currentIndex], layout.stopSamples[currentIndex + 1], 28) : null), [layout, placed, currentIndex, stages.length]);
  const glintPath = useMemo(() => (travelled > 0 ? pathWindow(layout, 0, layout.stopSamples[travelled], 48) : null), [layout, travelled]);

  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true }), [scrollX]);
  const scrollTo = useCallback((x: number, animated: boolean) => scrollRef.current?.scrollTo({ x, y: 0, animated }), []);

  const selectStage = useCallback((index: number) => {
    const target = Math.max(0, Math.min(layout.stops.length - 1, index));
    setSelected(target);
    scrollTo(layout.stops[target].offset, motionEnabled);
  }, [layout, motionEnabled, scrollTo]);
  const stepStage = useCallback((direction: 1 | -1) => selectStage(selected + direction), [selectStage, selected]);

  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    setViewportWidth(current => (current === width ? current : width));
  }, []);

  // One-time glide from the start of the road to the current stop once the viewport is measured. Without motion it just starts there.
  useEffect(() => {
    if (!measured) return;
    const target = layout.stops[currentIndex].offset;
    if (target <= 0) return;
    if (!motionEnabled) { scrollTo(target, false); return; }
    const timer = setTimeout(() => scrollTo(target, true), 450);
    return () => clearTimeout(timer);
    // Deliberately keyed on `measured` alone: later layout or motion changes must not replay the glide.
  }, [measured]);

  // A promotion moves the current stop; follow it.
  const lastIndex = useRef(currentIndex);
  useEffect(() => {
    if (lastIndex.current === currentIndex) return;
    lastIndex.current = currentIndex;
    setSelected(currentIndex);
    scrollTo(layout.stops[currentIndex].offset, motionEnabled);
  }, [currentIndex, layout, motionEnabled, scrollTo]);

  // Web only: a mouse cannot drag a scroll view, so mostly-horizontal mouse drags are turned into scrollTo.
  // Touch and trackpad already scroll natively and are never claimed, and the responder is given up on request.
  const dragStart = useRef(0);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (event, gesture) => (event.nativeEvent as unknown as { type?: string }).type === 'mousemove'
      && Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6,
    onPanResponderGrant: () => {
      const node = (scrollRef.current as unknown as { getScrollableNode?: () => { scrollLeft?: number } | null } | null)?.getScrollableNode?.();
      dragStart.current = node?.scrollLeft ?? 0;
    },
    onPanResponderMove: (_, gesture) => scrollTo(Math.max(0, Math.min(layout.maxScroll, dragStart.current - gesture.dx)), false),
    onPanResponderTerminationRequest: () => true,
    onShouldBlockNativeResponder: () => false,
  }), [layout.maxScroll, scrollTo]);

  const selectedStage = stages[selected];
  const next = selected < stages.length - 1;
  const practiceDays = snapshot.stats.levelPracticeDays ?? 0;
  const practiceRequired = snapshot.stats.levelPracticeRequired ?? 2;
  const here = stages[currentIndex];
  const hereLabel = `${STATE_LABELS[here.state]} · ${currentIndex + 1} of ${stages.length}`;
  const lastStage = stages[stages.length - 1];
  const stageLabel = (stage: RoadmapStage) => `${name(stage.level)}. ${STATE_LABELS[stage.state]}. ${stage.completedLessons} of ${stage.totalLessons} lessons completed. Show stage details.`;

  return <View style={s.card}>
    <View style={s.header}><View style={s.heading}><Text style={s.eyebrow}>YOUR INTERVIEW PATH</Text><Text style={s.title}>A little further, every day.</Text></View><View accessible accessibilityLabel={`${stages.length} interview levels`} style={s.levelCount}><Text style={s.count}>{stages.length}</Text><Text style={s.countLabel}>LEVELS</Text></View></View>
    <View style={s.tools}>
      <Pressable accessibilityRole="button" accessibilityLabel="Center map on my current level" onPress={() => selectStage(currentIndex)} style={({ pressed }) => [s.location, pressed && s.pressed]}><View accessible={false} style={s.locator}><View style={s.locatorDot} /></View><Text style={s.locationText}>My location</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Reset map to the beginning of the roadmap" onPress={() => selectStage(0)} style={({ pressed }) => [s.reset, pressed && s.pressed]}><Text style={s.resetText}>Back to start</Text></Pressable>
    </View>
    <View style={[s.viewport, { height }, Platform.OS === 'web' && s.viewportWeb]} onLayout={onViewportLayout} {...(Platform.OS === 'web' ? panResponder.panHandlers : null)}>
      {measured && <>
        <FarDots scrollX={scrollX} width={viewportWidth} height={height} color={withAlpha(colors.muted, 0.32)} />
        <Contours scrollX={scrollX} maxScroll={layout.maxScroll} width={viewportWidth} height={height} color={colors.line} />
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          role="region"
          accessibilityLabel="Interview roadmap map. Scrolls sideways. Use the stage buttons to move between levels."
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          directionalLockEnabled
          nestedScrollEnabled
          alwaysBounceVertical={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          style={s.scroll}
          contentContainerStyle={{ width: layout.canvas.width, height: layout.canvas.height }}
        >
          <RoadLayer segments={segments} litCount={litCount} palette={palette}>
            <Landmarks first={layout.stops[0]} last={layout.stops[layout.stops.length - 1]} summitReached={lastStage.state === 'reached' || lastStage.state === 'current'} s={s} />
          </RoadLayer>
          {glintPath && <Glint path={glintPath} active={motionEnabled} style={s.glint} />}
          {travellerPath && <Traveller path={travellerPath} active={motionEnabled} style={s.traveller} />}
          {layout.stops.map(stop => <StopView key={stages[stop.index].level} stop={stop} stage={stages[stop.index]} label={stageLabel(stages[stop.index])} selected={selected === stop.index} motionEnabled={motionEnabled} onSelect={selectStage} s={s} />)}
        </Animated.ScrollView>
        <View accessible accessibilityLabel={hereLabel} style={s.readout}><View style={s.readoutDot} /><Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={s.readoutText}>{hereLabel}</Text></View>
        <Compass scrollX={scrollX} maxScroll={layout.maxScroll} s={s} />
      </>}
    </View>
    {measured && <Scrubber layout={layout} viewportWidth={viewportWidth} scrollX={scrollX} stages={stages} litCount={litCount > 0 ? layout.stopSamples[travelled] : -1} selected={selected} colors={colors} s={s} onJump={offset => scrollTo(offset, motionEnabled)} onStep={stepStage} />}
    <View style={s.explore}><Text style={s.hint}>{Platform.OS === 'web' ? 'Drag sideways to explore' : 'Swipe sideways to explore'} · Tap a stop</Text><Text style={s.position}>Viewing {selected + 1} of {stages.length}</Text></View>
    <View style={s.details}>
      <Text style={s.detailState}>{STATE_LABELS[selectedStage.state].toUpperCase()}</Text><Text style={s.detailTitle}>{name(selectedStage.level)}: {STAGE_COPY[selected].title}</Text><Body muted>{STAGE_COPY[selected].description}</Body>
      {selectedStage.totalLessons > 0 && <View style={s.lessonProgress}><Text style={s.detailMetric}>{selectedStage.completedLessons}/{selectedStage.totalLessons}</Text><Text style={s.detailMetricLabel}>knowledge checks completed</Text></View>}
      {selectedStage.state === 'placement' && <Body muted>Complete placement to set your starting level.</Body>}
      {selectedStage.state === 'reached' && <Body muted>You have reached this level. Lesson completion is tracked separately.</Body>}
      {selectedStage.state === 'locked' && <Body muted>{placed ? `Available when you reach ${selectedStage.level}.` : 'Complete placement to find which levels are available to you.'}</Body>}
      {selectedStage.state === 'current' && next && <Body muted>{practiceDays}/{practiceRequired} qualifying practice days at this level. Finish its lessons and pass practice on {practiceRequired} different days to advance.</Body>}
      <View style={s.navigator}><Pressable accessibilityRole="button" accessibilityLabel="Show previous roadmap stage" disabled={selected === 0} onPress={() => selectStage(selected - 1)} style={({ pressed }) => [s.navigate, selected === 0 && s.disabled, pressed && s.pressed]}><Text style={s.navigateText}>Previous</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Show next roadmap stage" disabled={!next} onPress={() => selectStage(selected + 1)} style={({ pressed }) => [s.navigate, !next && s.disabled, pressed && s.pressed]}><Text style={s.navigateText}>Next stage</Text></Pressable></View>
    </View>
  </View>;
}

function createStyles(colors: ThemePalette) {
  return StyleSheet.create({
    card: { backgroundColor: colors.surface, borderRadius: 28, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
    header: { padding: 22, paddingBottom: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18 },
    heading: { flex: 1, minWidth: 170, gap: 8 },
    eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
    title: { color: colors.ink, fontSize: 24, lineHeight: 31, fontWeight: '700', letterSpacing: -0.7 },
    levelCount: { minWidth: 48, alignItems: 'center', gap: 2 },
    count: { color: colors.accent, fontSize: 34, fontWeight: '700', lineHeight: 40 },
    countLabel: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 1 },
    tools: { paddingHorizontal: 22, paddingBottom: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' },
    location: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.pale },
    locationText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
    locator: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    locatorDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
    reset: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 11 },
    resetText: { color: colors.muted, fontSize: 13, fontWeight: '600' },

    viewport: { overflow: 'hidden', backgroundColor: colors.background, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
    viewportWeb: { cursor: 'grab', userSelect: 'none' } as unknown as ViewStyle,
    scroll: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

    stop: { position: 'absolute' },
    stopPressed: { opacity: 0.85 },
    halo: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, pointerEvents: 'none' },
    ring: { position: 'absolute', width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: colors.accent, pointerEvents: 'none' },
    focusRing: { position: 'absolute', width: 74, height: 74, borderRadius: 37, borderWidth: 2, borderColor: colors.ink, pointerEvents: 'none' },
    marker: { position: 'absolute', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line, ...lift(colors.ink, 0.14, 10, 4) },
    markerFilled: { backgroundColor: colors.accent, borderColor: colors.accent },
    markerPlacement: { borderColor: colors.accent, borderWidth: 3 },
    markerNumber: { color: colors.accent, fontSize: 16, lineHeight: 22, fontWeight: '700' },
    markerNumberOn: { color: colors.onAccent },
    check: { width: 20, height: 11, borderLeftWidth: 3.5, borderBottomWidth: 3.5, borderBottomLeftRadius: 2, borderColor: colors.onAccent, marginTop: -5, transform: [{ rotate: '-45deg' }] },
    lock: { width: 22, height: 26, alignItems: 'center' },
    shackle: { width: 14, height: 14, borderWidth: 2.5, borderBottomWidth: 0, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderColor: colors.muted },
    lockBody: { position: 'absolute', bottom: 0, width: 22, height: 15, borderRadius: 4, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    keyhole: { width: 4, height: 6, borderRadius: 2, backgroundColor: colors.surface },
    stageLabel: { position: 'absolute', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, gap: 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, ...lift(colors.ink, 0.08, 8, 3) },
    stageLabelSelected: { borderColor: colors.accent },
    stageEyebrow: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.4 },
    stageEyebrowLive: { color: colors.accent },
    stageName: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.3 },
    stageNameLive: { color: colors.accent },
    stageCaption: { color: colors.muted, fontSize: 11, lineHeight: 16 },

    traveller: { position: 'absolute', left: -9, top: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.surface, ...lift(colors.ink, 0.2, 6, 2) },
    glint: { position: 'absolute', left: -22, top: -4, width: 44, height: 8, borderRadius: 4, backgroundColor: colors.accentBright },
    flagBase: { position: 'absolute', width: 16, height: 6, borderRadius: 3, backgroundColor: colors.line },
    flagPole: { position: 'absolute', width: 3, borderRadius: 2, backgroundColor: colors.ink },
    flagPennant: { position: 'absolute', width: 0, height: 0, borderTopWidth: 9, borderBottomWidth: 9, borderLeftWidth: 20, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
    startPennant: { borderLeftColor: colors.accent },
    chequer: { position: 'absolute', width: 27, height: 18, flexDirection: 'row', flexWrap: 'wrap', borderRadius: 2, overflow: 'hidden', borderWidth: 1, borderColor: colors.ink },
    chequerSquare: { width: 9, height: 8 },
    chequerDark: { backgroundColor: colors.ink },
    chequerLight: { backgroundColor: colors.surface },
    chequerMuted: { opacity: 0.55 },

    readout: { position: 'absolute', left: 12, top: 12, maxWidth: '70%', minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, pointerEvents: 'none' },
    readoutDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
    readoutText: { flexShrink: 1, color: colors.ink, fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.3 },
    compass: { position: 'absolute', right: 12, top: 12, width: 48, height: 48, borderRadius: 24, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, pointerEvents: 'none', ...lift(colors.ink, 0.1, 8, 3) },
    compassN: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 13, fontWeight: '700' },
    needle: { position: 'absolute', left: 19, top: 17, width: 8, height: 26 },
    needleNorth: { width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 13, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: colors.accent },
    needleSouth: { width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 13, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.muted },

    scrubWrap: { paddingHorizontal: SCRUB_INSET, paddingTop: 12 },
    scrub: { height: SCRUB_HEIGHT, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.line },
    scrubDot: { position: 'absolute', width: 3, height: 3, borderRadius: 2 },
    scrubStop: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.muted },
    scrubStopFilled: { backgroundColor: colors.accent, borderColor: colors.accent },
    scrubStopSelected: { borderColor: colors.ink },
    scrubWindow: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 12, borderWidth: 2, borderColor: colors.accent, backgroundColor: withAlpha(colors.accent, 0.14), pointerEvents: 'none' },

    explore: { paddingVertical: 12, paddingHorizontal: 22, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
    hint: { color: colors.muted, fontSize: 11, lineHeight: 17 },
    position: { color: colors.accent, fontSize: 11, lineHeight: 17, fontWeight: '700' },
    details: { marginHorizontal: 14, marginBottom: 14, padding: 18, gap: 12, backgroundColor: colors.pale, borderRadius: 20 },
    detailState: { color: colors.accent, fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 1 },
    detailTitle: { color: colors.ink, fontSize: 20, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
    lessonProgress: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 9 },
    detailMetric: { color: colors.accent, fontSize: 25, lineHeight: 32, fontWeight: '700' },
    detailMetricLabel: { color: colors.muted, fontSize: 12, lineHeight: 19, flexShrink: 1 },
    navigator: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
    navigate: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
    navigateText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
    disabled: { opacity: 0.38 },
    pressed: { opacity: 0.7 },
  });
}
