import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Stats } from '../core/types';
import { SKILL_IDS, skillSummary } from '../core/skills';
import { Body, Card, Label, Meter, Title } from './components';
import { useTheme, type ThemePalette } from './theme';

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Where the student stands in communication, technical discussion and coding. A skill without graded answers says so instead of showing a number. */
export function SkillStandings({ stats, title = 'Where you stand', eyebrow = 'Your three interview skills' }: { stats: Stats; title?: string; eyebrow?: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  return <Card>
    <Label>{eyebrow}</Label>
    <Title small>{title}</Title>
    {SKILL_IDS.map((id, index) => {
      const skill = skillSummary(id, stats.skills?.[id]);
      return <View key={id} style={[s.row, index > 0 && s.divider]}>
        <View style={s.heading}>
          <Text accessibilityRole="header" style={s.name}>{skill.label}</Text>
          <Text style={[s.level, skill.level === null && s.muted]}>{skill.level === null ? 'Not measured yet' : `${capitalize(skill.level)} · ${skill.score}`}</Text>
        </View>
        <Body muted>{skill.description}</Body>
        {skill.score !== null && <Meter value={skill.score} label={`${skill.label} standing`} />}
        <Text style={s.evidence}>{skill.level === null ? 'No graded answers yet' : skill.evidence}</Text>
        <Body>Next step: {skill.nextStep}</Body>
      </View>;
    })}
  </Card>;
}

function createStyles(colors: ThemePalette) {
  return StyleSheet.create({
    row: { gap: 10 },
    divider: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16 },
    heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
    name: { color: colors.ink, fontSize: 17, lineHeight: 24, fontWeight: '700' },
    level: { color: colors.accent, fontSize: 15, lineHeight: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
    muted: { color: colors.muted },
    evidence: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  });
}
