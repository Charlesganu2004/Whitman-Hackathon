import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { INTERVIEWER_NAME } from '../core/skills';
import { REVEAL_WORD_LIMIT, revealStagger, splitWords } from '../core/interview';
import { useMotionEnabled } from './motion';
import { useTheme, type ThemePalette } from './theme';

const FADE_WORDS = 5;

function useChatStyles() {
  const { colors } = useTheme();
  return { colors, s: useMemo(() => createStyles(colors), [colors]) };
}

/** A bubble enters with a spring: it rises about 14pt, grows from 0.96 and fades in, from the left for Jarvis and the right for the student. */
export function Enter({ children, from, instant = false }: { children: React.ReactNode; from: 'left' | 'right'; instant?: boolean }) {
  const motion = useMotionEnabled();
  const play = useRef(motion && !instant).current;
  const progress = useRef(new Animated.Value(play ? 0 : 1)).current;
  useEffect(() => {
    if (!play) return;
    const spring = Animated.spring(progress, { toValue: 1, speed: 14, bounciness: 7, useNativeDriver: true });
    spring.start();
    return () => spring.stop();
  }, [play, progress]);
  const side = from === 'left' ? -10 : 10;
  return <Animated.View style={{ opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }), transformOrigin: from === 'left' ? 'left bottom' : 'right bottom', transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }, { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [side, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>{children}</Animated.View>;
}

export function Monogram() {
  const { s } = useChatStyles();
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.mark}><Text style={s.markText}>{INTERVIEWER_NAME.charAt(0)}</Text></View>;
}

/** One Jarvis message: the small monogram sits beside the first bubble of a run, and a replay control speaks the message again. */
export function JarvisBubble({ children, mark = true, instant = false, onReplay }: { children: React.ReactNode; mark?: boolean; instant?: boolean; onReplay?: () => void }) {
  const { s } = useChatStyles();
  return <Enter from="left" instant={instant}><View style={s.jarvisRow}>
    {mark ? <Monogram /> : <View style={s.markSpace} />}
    <View style={s.jarvisBubble} accessibilityLabel={undefined}>
      {children}
      {onReplay && <Pressable accessibilityRole="button" accessibilityLabel={`Replay ${INTERVIEWER_NAME}'s voice`} onPress={onReplay} hitSlop={6} style={s.replay}><Text style={s.replayText}>Replay voice</Text></Pressable>}
    </View>
  </View></Enter>;
}

export function StudentBubble({ text, code = false, instant = false }: { text: string; code?: boolean; instant?: boolean }) {
  const { s } = useChatStyles();
  return <Enter from="right" instant={instant}><View style={s.studentRow}><View style={s.studentBubble}><Text selectable style={[s.text, code && s.codeText]}>{text}</Text></View></View></Enter>;
}

function Dot({ delay, active }: { delay: number; active: boolean }) {
  const { s } = useChatStyles();
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    phase.setValue(0);
    if (!active) return;
    const loop = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(phase, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }), Animated.timing(phase, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }), Animated.delay(Math.max(0, 480 - delay))]));
    loop.start();
    return () => loop.stop();
  }, [active, delay, phase]);
  return <Animated.View style={[s.dot, { opacity: active ? phase.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) : 0.7, transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]} />;
}

/** The three dots shown while Jarvis is replying, grading or preparing his voice. */
export function Typing({ label }: { label: string }) {
  const { s } = useChatStyles();
  const motion = useMotionEnabled();
  return <Enter from="left"><View style={s.jarvisRow}><Monogram /><View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={[s.jarvisBubble, s.typing]}>{[0, 140, 280].map(delay => <Dot key={delay} delay={delay} active={motion} />)}</View></View></Enter>;
}

/**
 * Reveals a message word by word with staggered opacity and a 4pt rise. Tapping the message finishes the reveal at once. The words
 * stay as separate items so the layout never shifts when the reveal ends; a long message appears as one block instead.
 */
export function Words({ text, speaking = false, instant = false, start = true, style, onDone }: { text: string; speaking?: boolean; instant?: boolean; start?: boolean; style?: StyleProp<TextStyle>; onDone?: () => void }) {
  const { s } = useChatStyles();
  const motion = useMotionEnabled();
  const words = useMemo(() => splitWords(text), [text]);
  const animate = useRef(motion && !instant && words.length > 0 && words.length <= REVEAL_WORD_LIMIT).current;
  const total = words.length + FADE_WORDS;
  const progress = useRef(new Animated.Value(animate ? 0 : total)).current;
  const [finished, setFinished] = useState(!animate);
  const done = useRef(onDone);
  done.current = onDone;
  const reported = useRef(false);
  const finish = () => { if (!reported.current) { reported.current = true; setFinished(true); done.current?.(); } };
  useEffect(() => {
    if (!animate) { finish(); return; }
    if (!start) return;
    const timing = Animated.timing(progress, { toValue: total, duration: total * revealStagger(words.length, speaking), easing: Easing.linear, useNativeDriver: true });
    timing.start(({ finished: completed }) => { if (completed) finish(); });
    return () => timing.stop();
  }, [animate, start]);
  const styles = useMemo(() => words.map((_word, index) => ({
    opacity: progress.interpolate({ inputRange: [index, index + FADE_WORDS], outputRange: [0, 1], extrapolate: 'clamp' as const }),
    transform: [{ translateY: progress.interpolate({ inputRange: [index, index + FADE_WORDS], outputRange: [4, 0], extrapolate: 'clamp' as const }) }],
  })), [words, progress]);
  if (!animate) return <Text style={[s.text, style]}>{text}</Text>;
  const space = Math.round(((StyleSheet.flatten([s.text, style]) as TextStyle).fontSize ?? 16) * 0.27);
  return <Pressable accessible accessibilityLabel={text} disabled={finished} onPress={() => { progress.stopAnimation(); progress.setValue(total); finish(); }} style={s.words}>
    {words.map((word, index) => <Animated.Text key={index} accessibilityElementsHidden importantForAccessibility="no" style={[s.text, style, styles[index], { marginRight: space }]}>{word}</Animated.Text>)}
  </Pressable>;
}

/** The score counts up from zero. It is the one place a JavaScript timer drives text, and it never blocks an action. */
export function CountUp({ value, instant = false, style }: { value: number; instant?: boolean; style?: StyleProp<TextStyle> }) {
  const motion = useMotionEnabled();
  const play = useRef(motion && !instant).current;
  const [shown, setShown] = useState(play ? 0 : value);
  useEffect(() => {
    if (!play) { setShown(value); return; }
    const begin = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = Math.min(1, (Date.now() - begin) / 800);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) timer = setTimeout(tick, 32);
    };
    tick();
    return () => clearTimeout(timer);
  }, [play, value]);
  return <Text accessibilityLabel={`Score ${value} out of 100`} style={[{ fontVariant: ['tabular-nums'] }, style]}>{shown}</Text>;
}

/** Lines tick in one after another: a short fade and rise, each a little after the one before. */
export function TickIn({ index, instant = false, children }: { index: number; instant?: boolean; children: React.ReactNode }) {
  const motion = useMotionEnabled();
  const play = useRef(motion && !instant).current;
  const progress = useRef(new Animated.Value(play ? 0 : 1)).current;
  useEffect(() => {
    if (!play) return;
    const timing = Animated.timing(progress, { toValue: 1, delay: 120 + index * 150, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    timing.start();
    return () => timing.stop();
  }, [index, play, progress]);
  return <Animated.View style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>{children}</Animated.View>;
}

function createStyles(colors: ThemePalette) {
  return StyleSheet.create({
    text: { color: colors.ink, fontSize: 16, lineHeight: 24 },
    codeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 14, lineHeight: 21 },
    jarvisRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '100%' },
    mark: { width: 28, height: 28, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    markText: { color: colors.onAccent, fontSize: 13, lineHeight: 18, fontWeight: '700' },
    markSpace: { width: 28 },
    jarvisBubble: { flexShrink: 1, flexGrow: 0, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
    studentRow: { flexDirection: 'row', justifyContent: 'flex-end' },
    studentBubble: { backgroundColor: colors.pale, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, maxWidth: '88%' },
    typing: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingVertical: 12 },
    dot: { width: 8, height: 8, borderRadius: 12, backgroundColor: colors.muted },
    words: { flexDirection: 'row', flexWrap: 'wrap' },
    replay: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignSelf: 'flex-start' },
    replayText: { color: colors.accent, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  });
}
