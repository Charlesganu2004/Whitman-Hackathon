import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Snapshot } from '../core/types';
import { startDecision } from '../core/break';
import { OFFLINE_REASON } from '../core/connection';
import { technicalCount } from '../core/engine';
import { Body, Button, Card, Label, Meter, Title } from './components';
import { AmbientBackground, Reveal } from './motion';
import { SkillStandings } from './SkillStandings';
import { StartControl } from './StartControl';
import { useTheme, type ThemePalette } from './theme';

export function PracticeHub({ snapshot, now, busy, offline, ai, onStart, onCheckpoint, onLearn }: { snapshot: Snapshot; now: number; busy: boolean; offline: boolean; ai: boolean; onStart: () => void; onCheckpoint: () => void; onLearn: () => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { profile, stats, activeSession } = snapshot;
  const active = activeSession && ['active', 'review'].includes(activeSession.status);
  const placement = !profile.placementComplete;
  const technical = active ? activeSession.technicalCount : placement ? 2 : technicalCount(profile);
  const decision = useMemo(() => startDecision(snapshot, now), [snapshot, now]);
  return <View style={{ gap: 24 }}>
    <Reveal style={{ gap: 8 }}><Label>A conversation with Jarvis</Label><Title>{'Talk it through\nwith Jarvis.'}</Title><Body muted>{ai ? 'Your AI interviewer asks, listens and gives feedback on your answer and your STAR method, while your communication, technical and coding skills are evaluated.' : 'Your interviewer asks, listens and gives feedback on your answer and your STAR method, while your communication, technical and coding skills are evaluated.'}</Body></Reveal>
    <Reveal delay={80}><View style={s.hero}><AmbientBackground hero /><View style={s.heroHeading}><Text style={s.heroLabel}>{placement ? 'Placement interview' : 'Adaptive interview'}</Text><View style={s.level}><Text style={s.levelText}>{profile.level}</Text></View></View><Text accessibilityRole="header" style={s.heroTitle}>{active ? 'Continue your conversation.' : decision.action === 'break' ? 'Your break is on.' : 'Ready for your next conversation?'}</Text><Text style={s.heroBody}>{ai ? 'A conversation with Jarvis, your AI interviewer. He asks, you answer, and he gives feedback on your answer and your STAR method. Keep talking with him after the feedback, and hear his voice if you like.' : 'A conversation with Jarvis, your interviewer. Without a server AI key he answers from the practice rubric. A key adds richer replies, spoken answers and his voice.'}</Text><Text style={s.heroBody}>{technical} technical {technical === 1 ? 'question' : 'questions'} and 2 behavioral questions. {profile.minutes} minute goal.</Text>{active && <View style={{ gap: 8 }}><Text style={s.heroBody}>{activeSession.index} of {activeSession.questions.length} answered</Text><Meter value={activeSession.index / activeSession.questions.length * 100} /></View>}<StartControl decision={decision} startLabel={active ? 'Resume with Jarvis' : placement ? 'Start placement with Jarvis' : 'Start adaptive interview'} busy={busy} offline={offline} onStart={onStart} onCheckpoint={onCheckpoint} onLearn={onLearn} /></View></Reveal>
    <Reveal delay={120}><Card><Label>Check where you are now</Label><Title small>Test my knowledge.</Title><Body>A conversation with Jarvis at your current level: technical questions to talk through, a coding question on software tracks, and two behavioral stories. The evaluation shows where you stand in communication, technical discussion and coding, without changing your level or earning app access.</Body><Button title="Test my knowledge" secondary busy={busy} disabled={offline || placement || !!active} onPress={onCheckpoint} />{(placement || active) && <Body muted>{placement ? 'Complete placement first.' : 'Finish your saved interview before starting a checkpoint.'}</Body>}{offline && !placement && !active && <Body muted>{OFFLINE_REASON}</Body>}</Card></Reveal>
    <Reveal delay={130}><SkillStandings stats={stats} /></Reveal>
    <Reveal delay={140}><Card><Label>Learn before the next question</Label><Title small>Make feedback useful.</Title><Body>Review missed ideas, ask your lesson coach for an example, then complete a knowledge check. A different interview question checks what you learned.</Body><Button title="Explore lessons" secondary onPress={onLearn} /></Card></Reveal>
    <View style={s.dailySummary}><Body muted>{stats.todaySessions || 0} of {profile.sessionsPerDay || 1} daily interviews complete today. Technical and behavioral scores shape your roadmap; successful practice and evaluated lessons unlock the next level.</Body></View>
  </View>;
}
function createStyles(colors: ThemePalette) { return StyleSheet.create({
  hero: { backgroundColor: colors.hero, borderRadius: 28, padding: 24, gap: 18, overflow: 'hidden' }, heroHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, heroLabel: { color: colors.heroMuted, fontSize: 11, lineHeight: 18, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', flexShrink: 1 }, level: { borderColor: colors.heroLine, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 }, levelText: { color: colors.onHero, fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }, heroTitle: { color: colors.onHero, fontSize: 28, lineHeight: 34, letterSpacing: -0.8, fontWeight: '700' }, heroBody: { color: colors.heroMuted, fontSize: 15, lineHeight: 23 }, dailySummary: { padding: 20, backgroundColor: colors.subtle, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
}); }
