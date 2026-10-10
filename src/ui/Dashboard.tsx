import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Lesson, Snapshot } from '../core/types';
import { technicalCount } from '../core/engine';
import { Body, Button, Card, Label, Meter, Title } from './components';
import { Reveal } from './motion';
import { FocusOrbit, StreakBadge } from './visuals';
import { LESSONS } from '../core/content';
import { useTheme, type ThemePalette } from './theme';

interface FocusInfo { supported: boolean; authorized: boolean; selectedCount: number; blocking: boolean; emergencyReleased: boolean; reason: string }
interface Props {
  snapshot: Snapshot; focus: FocusInfo; remaining: number; busy: boolean; offline: boolean;
  onStart: () => void; onManage: () => void; onLearn: () => void; recommended?: Lesson;
}
export function Dashboard({ snapshot, focus, remaining, busy, offline, onStart, onManage, onLearn, recommended }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { profile, stats, activeSession } = snapshot;
  const completedLessons = LESSONS.filter(lesson => profile.completedLessonIds.includes(lesson.id)).length;
  const companies = profile.targetCompanies ?? [];
  const dailyGoal = profile.sessionsPerDay ?? 1;
  const todaySessions = stats.todaySessions ?? 0;
  const needsPlacement = !profile.placementComplete;
  const active = activeSession && ['active', 'review'].includes(activeSession.status);
  const technical = active ? activeSession.technicalCount : technicalCount(profile);
  const behavioral = active ? activeSession.behavioralCount : 2;
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(); day.setHours(12, 0, 0, 0); day.setDate(day.getDate() - 6 + index);
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    return { key: date, label: day.toLocaleDateString('en-US', { weekday: 'narrow' }), studied: stats.activity.some(activity => activity.date === date && activity.count > 0), today: index === 6 };
  });
  const studied = week.filter(day => day.studied).length;
  return <View style={s.stack}>
    <Reveal><View style={s.greeting}><View style={{ flex: 1, gap: 5 }}><Label>Your future starts here</Label><Title>Hey, {profile.name.split(' ')[0]}.</Title><Text style={s.meta}>{profile.major} · {profile.target === 'internship' ? 'Internship' : 'Full-time role'}</Text></View><StreakBadge days={stats.streak} /></View></Reveal>
    <Reveal delay={60}><View style={s.hero}>
      <View style={s.heroTop}><Text style={s.eyebrow}>{needsPlacement ? 'YOUR STARTING POINT' : active ? 'PICK UP YOUR PRACTICE' : 'YOUR DAILY CHALLENGE'}</Text><View style={s.level}><Text style={s.levelText}>{profile.level.toUpperCase()}</Text></View></View>
      <View style={s.heroMiddle}><View style={s.heroCopy}><Text style={s.heroTitle}>{needsPlacement ? 'Meet your\nnext chapter.' : 'Less scrolling.\nMore becoming.'}</Text><Text style={s.heroBody}>{needsPlacement ? 'Four answers to find your starting level.' : 'A stronger interview is one good habit away.'}</Text></View><View style={s.heroArt}><FocusOrbit compact unlocked={remaining > 0} /></View></View>
      <View style={s.heroDetails}><Text style={s.heroDetail}>{profile.minutes} MIN GOAL</Text><View style={s.heroDivider} /><Text style={s.heroDetail}>{needsPlacement ? 4 : technical + behavioral} QUESTIONS</Text><View style={s.heroDivider} /><Text style={s.heroDetail}>{profile.unlockMinutes} MIN REWARD</Text></View>
      <Button title={active ? 'Resume interview' : needsPlacement ? 'Start placement interview' : 'Start today’s interview'} busy={busy} disabled={offline} onPress={onStart} />
      {companies.length > 0 && <Text style={s.heroFoot}>Preparing for {companies.join(' · ')}</Text>}<Text style={s.heroFoot}>{needsPlacement ? '2 technical · 2 behavioral' : `${technical} ${profile.level === 'expert' || profile.level === 'master' ? 'hard technical' : 'technical'} · ${behavioral} behavioral`}</Text>
    </View></Reveal>
    <Reveal delay={120}><Card><View style={s.sectionHeading}><View><Label>Show up for yourself</Label><Text style={s.sectionTitle}>Your week, in motion.</Text></View><Text style={s.weekCount}>{studied}<Text style={s.weekGoal}>/{profile.daysPerWeek}</Text></Text></View><View style={s.week}>{week.map(day => <View key={day.key} style={s.day}><Text style={s.dayLabel}>{day.label}</Text><View accessibilityLabel={`${day.key}: ${day.studied ? 'studied' : 'no study recorded'}`} style={[s.dayCircle, day.studied && s.studiedDay, day.today && !day.studied && s.todayCircle]}><Text style={[s.dayMark, day.studied && { color: colors.onAccent }]}>{day.studied ? '✓' : day.today ? '·' : ''}</Text></View></View>)}</View><Body muted>{studied >= profile.daysPerWeek ? 'Weekly study goal reached. Keep the habit at your pace.' : `${profile.daysPerWeek - studied} more study ${profile.daysPerWeek - studied === 1 ? 'day' : 'days'} to reach your weekly goal.`}</Body><View style={s.dailyGoal}><View style={s.sectionHeading}><Text style={s.dailyLabel}>Interviews completed today</Text><Text style={s.dailyCount}>{todaySessions}/{dailyGoal}</Text></View><Meter value={todaySessions / dailyGoal * 100} /></View></Card></Reveal>
    <Reveal delay={180}><Pressable accessibilityRole="button" accessibilityLabel="Manage focus" onPress={onManage}><View style={s.focusCard}><View style={s.focusSymbol}><View style={s.lockArch} /><View style={s.lockBody}><View style={s.keyhole} /></View></View><View style={s.focusCopy}><Label>Focus & app access</Label><Text style={s.focusTitle}>{remaining > 0 ? `${remaining} minutes earned` : focus.emergencyReleased ? 'Focus is paused' : focus.blocking ? 'Distractions paused' : 'Room to grow'}</Text><Text style={s.focusDescription}>{focus.supported ? focus.authorized ? `${focus.selectedCount} iPhone apps selected` : 'Connect Screen Time' : 'Expo Go · practice mode'}</Text></View><Text style={s.chevron}>›</Text></View></Pressable></Reveal>
    <Reveal delay={220}><Pressable accessibilityRole="button" accessibilityLabel="Explore lessons" onPress={onLearn}><Card><View style={s.sectionHeading}><Label>Your next building block</Label><Text style={s.chevron}>›</Text></View><Title small>{recommended?.title || 'Keep your skills sharp.'}</Title><Body muted>{recommended?.summary || 'Revisit a lesson and put its ideas into your next answer.'}</Body><View style={s.lessonFooter}><Text style={s.lessonTag}>{recommended ? `${recommended.minutes} MIN LESSON` : 'LESSON LIBRARY'}</Text><Text style={s.lessonProgress}>{completedLessons} of {LESSONS.length} complete</Text></View><Meter value={completedLessons / LESSONS.length * 100} /></Card></Pressable></Reveal>
  </View>;
}
function createStyles(colors: ThemePalette) { return StyleSheet.create({
  dailyGoal: { gap: 9, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16 }, dailyLabel: { color: colors.ink, fontSize: 13 }, dailyCount: { color: colors.accent, fontSize: 17, fontWeight: '700' },
  stack: { gap: 20 }, greeting: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6, paddingBottom: 4 }, meta: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  hero: { backgroundColor: colors.hero, borderRadius: 28, padding: 24, gap: 18, overflow: 'hidden' }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }, eyebrow: { color: colors.heroMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, flexShrink: 1 },
  level: { borderWidth: 1, borderColor: colors.heroLine, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 }, levelText: { color: colors.onHero, fontSize: 9, letterSpacing: 1, fontWeight: '700' }, heroMiddle: { minHeight: 156, flexDirection: 'row', alignItems: 'center' }, heroCopy: { flex: 1, zIndex: 1, gap: 12 }, heroTitle: { color: colors.onHero, fontSize: 29, lineHeight: 35, fontWeight: '700', letterSpacing: -1.1 }, heroBody: { color: colors.heroMuted, fontSize: 13, lineHeight: 20, maxWidth: 220 }, heroArt: { width: 104, alignItems: 'center', marginRight: -16, opacity: 0.95 },
  heroDetails: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 }, heroDetail: { color: colors.heroMuted, fontSize: 9, letterSpacing: 0.6, fontWeight: '600' }, heroDivider: { width: 1, height: 12, backgroundColor: colors.heroLine }, heroFoot: { color: colors.heroMuted, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionTitle: { fontSize: 20, lineHeight: 28, color: colors.ink, fontWeight: '600', letterSpacing: -0.4 }, weekCount: { fontSize: 29, color: colors.ink, fontWeight: '700' }, weekGoal: { fontSize: 15, fontWeight: '400', color: colors.muted }, week: { flexDirection: 'row', justifyContent: 'space-between', gap: 5, paddingVertical: 4 }, day: { alignItems: 'center', flex: 1, gap: 8 }, dayLabel: { fontSize: 11, color: colors.muted }, dayCircle: { width: 31, height: 31, borderRadius: 16, backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center' }, studiedDay: { backgroundColor: colors.accent }, todayCircle: { borderColor: colors.accent, borderWidth: 1.5 }, dayMark: { color: colors.accent, fontSize: 19, fontWeight: '600' },
  focusCard: { padding: 20, borderRadius: 20, backgroundColor: colors.pale, flexDirection: 'row', alignItems: 'center', gap: 16 }, focusSymbol: { width: 44, height: 50, alignItems: 'center', justifyContent: 'center' }, lockArch: { position: 'absolute', width: 20, height: 20, top: 2, borderWidth: 2, borderColor: colors.accent, borderRadius: 12 }, lockBody: { width: 32, height: 28, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, keyhole: { width: 3, height: 9, backgroundColor: colors.pale, borderRadius: 2 }, focusCopy: { flex: 1, gap: 3 }, focusTitle: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.5 }, focusDescription: { color: colors.muted, fontSize: 12, lineHeight: 18 }, chevron: { color: colors.accent, fontSize: 30, lineHeight: 30 }, lessonFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, lessonTag: { color: colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }, lessonProgress: { color: colors.muted, fontSize: 12 },
}); }
