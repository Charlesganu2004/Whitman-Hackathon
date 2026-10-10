import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BREAK_MEANWHILE, BREAK_OPENS, BREAK_TITLE, breakHeadline, type StartDecision } from '../core/break';
import { OFFLINE_REASON } from '../core/connection';
import { Button, Meter } from './components';
import { useTheme, type ThemePalette } from './theme';

interface Props {
  decision: StartDecision;
  /** The label of the start button when a new interview may begin. */
  startLabel: string;
  busy: boolean;
  offline: boolean;
  onStart: () => void;
  onCheckpoint: () => void;
  onLearn: () => void;
}

/**
 * The start control on the dark hero cards. While an earned break runs it cannot start a daily interview: it shows the
 * minutes left and offers the two things a break allows, an evaluation with Jarvis and the lessons.
 */
export function StartControl({ decision, startLabel, busy, offline, onStart, onCheckpoint, onLearn }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  if (decision.action !== 'break') {
    return <View style={s.stack}>
      <Button title={startLabel} busy={busy} disabled={offline} onPress={onStart} />
      {offline && <Text style={s.reason}>{OFFLINE_REASON}</Text>}
    </View>;
  }
  return <View style={s.stack}>
    <View style={s.panel}>
      <View style={s.top}>
        <Text style={s.eyebrow}>{BREAK_TITLE.toUpperCase()}</Text>
        <Text accessibilityRole="header" style={s.minutes}>{breakHeadline(decision.minutesLeft)}</Text>
      </View>
      <Meter value={decision.progress * 100} onHero />
      <Text style={s.copy}>{BREAK_OPENS}</Text>
    </View>
    <Button title={`Break on · ${breakHeadline(decision.minutesLeft)}`} disabled onPress={onStart} />
    <Text style={s.copy}>{BREAK_MEANWHILE}</Text>
    <Button title="Test my knowledge with Jarvis" secondary busy={busy} disabled={offline || !decision.canEvaluate} onPress={onCheckpoint} />
    <Button title="Explore lessons" secondary onPress={onLearn} />
    {offline && <Text style={s.reason}>{OFFLINE_REASON}</Text>}
  </View>;
}

function createStyles(colors: ThemePalette) {
  return StyleSheet.create({
    stack: { gap: 12 },
    panel: { borderWidth: 1, borderColor: colors.heroLine, borderRadius: 20, padding: 16, gap: 12 },
    top: { gap: 4 },
    eyebrow: { color: colors.heroMuted, fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2 },
    minutes: { color: colors.onHero, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
    copy: { color: colors.heroMuted, fontSize: 14, lineHeight: 21 },
    reason: { color: colors.heroMuted, fontSize: 13, lineHeight: 19 },
  });
}
