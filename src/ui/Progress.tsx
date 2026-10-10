import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Snapshot } from '../core/types';
import { LEVELS } from '../core/engine';
import { LESSONS } from '../core/content';
import { Body, Card, Label, Meter, Title } from './components';
import { Reveal } from './motion';
import { SkillRing, StreakBadge } from './visuals';
import { useTheme, type ThemePalette } from './theme';

export function Progress({ snapshot }: { snapshot: Snapshot }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { profile, stats } = snapshot;
  const levelIndex = LEVELS.indexOf(profile.level);
  const nextLevel = LEVELS[levelIndex + 1];
  const completedLessons = LESSONS.filter(lesson => profile.completedLessonIds.includes(lesson.id)).length;
  const levelLessons = LESSONS.filter(lesson => lesson.level === profile.level);
  const lessonCount = stats.levelLessonsCompleted ?? levelLessons.filter(lesson => profile.completedLessonIds.includes(lesson.id)).length;
  const lessonGoal = stats.levelLessonsRequired ?? levelLessons.length;
  const practiceDays = stats.levelPracticeDays ?? 0;
  const practiceGoal = stats.levelPracticeRequired ?? 2;
  const dailyGoal = profile.sessionsPerDay ?? 1;
  const todaySessions = stats.todaySessions ?? 0;
  const recentDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  const weekDays = new Set(stats.activity.filter(day => recentDates.includes(day.date) && day.count > 0).map(day => day.date)).size;
  return <View style={s.stack}>
    <Reveal><Label>Your plan. Your progress.</Label><Title>{'Every step,\ncloser to ready.'}</Title><Body muted>{profile.major} · {profile.target === 'internship' ? 'Internship' : 'Full-time role'}</Body><Body muted>Target companies: {profile.targetCompanies?.length ? profile.targetCompanies.join(' · ') : 'Choose in Profile'}</Body></Reveal>
    <Reveal delay={50}><View style={s.levelCard}>
      <Label>Current interview level</Label><View style={s.levelRow}><Text style={s.levelTitle}>{profile.level[0].toUpperCase() + profile.level.slice(1)}</Text><StreakBadge days={stats.streak} /></View>
      <View style={s.levelTrack}>{LEVELS.map((level, index) => <View key={level} accessibilityLabel={`${level}: ${index < levelIndex ? 'reached' : index === levelIndex ? 'current level' : 'ahead'}`} style={s.levelStop}><View style={[s.stop, index <= levelIndex && { backgroundColor: colors.accent }]}><Text style={[s.stopText, index <= levelIndex && { color: colors.onAccent }]}>{index < levelIndex ? '✓' : index + 1}</Text></View><Text style={[s.stopLabel, index === levelIndex && { color: colors.accent, fontWeight: '700' }]}>{level[0].toUpperCase() + level.slice(1)}</Text></View>)}</View>
      {nextLevel ? <View style={s.promotion}><Text style={s.promotionTitle}>Next stop: {nextLevel}</Text><Goal label="Lessons at this level" value={lessonCount} goal={lessonGoal} /><Goal label="Qualifying practice days" value={practiceDays} goal={practiceGoal} /><Body muted>Finish this level’s lessons and pass practice on {practiceGoal} different days to advance.</Body></View> : <Body muted>Master reached. Keep your interview skills sharp with practice and lesson refreshers.</Body>}
    </View></Reveal>
    <Reveal delay={90}><Card><View style={s.heading}><Title small>Placement interview</Title><Text style={s.status}>{profile.placementComplete ? 'COMPLETE' : 'TO DO'}</Text></View><Meter value={profile.placementComplete ? 100 : 0} /><Body muted>{profile.placementComplete ? 'Your assessment set your starting level. Practice and lessons build from here.' : 'Answer 2 technical and 2 behavioral questions to find your starting level.'}</Body></Card></Reveal>
    <Reveal delay={120}><Card><Title small>Your study rhythm</Title><Goal label="Interviews completed today" value={todaySessions} goal={dailyGoal} /><Goal label="Study days in the last 7 days" value={weekDays} goal={profile.daysPerWeek} /><View style={s.planRow}><View style={s.planMetric}><Text style={s.planValue}>{profile.minutes} min</Text><Text style={s.metricLabel}>Interview time goal</Text></View><View style={s.planMetric}><Text style={s.planValue}>{profile.unlockMinutes} min</Text><Text style={s.metricLabel}>Break after passing</Text></View></View><Body muted>Frequency and time goals shape your practice. Actual interviews may take longer when an answer needs another try.</Body></Card></Reveal>
    <Reveal delay={160}><Card><View style={s.heading}><Title small>Lesson roadmap</Title><Text style={s.count}>{completedLessons}/{LESSONS.length}</Text></View><Meter value={completedLessons / LESSONS.length * 100} /><Body muted>Complete each knowledge check. Lessons unlock as you reach their interview level.</Body>{LEVELS.filter(level => level !== 'master').map(level => { const lessons = LESSONS.filter(lesson => lesson.level === level); const done = lessons.filter(lesson => profile.completedLessonIds.includes(lesson.id)).length; return <View key={level} style={s.lessonRow}><Text style={s.lessonLevel}>{level[0].toUpperCase() + level.slice(1)}</Text><Text style={s.lessonCount}>{done}/{lessons.length} complete</Text></View>; })}</Card></Reveal>
    <Reveal delay={190}><Card><Label>Your interview balance</Label><View style={s.rings}><SkillRing value={stats.technical} label="Technical" size={130} /><SkillRing value={stats.behavioral} label="Behavioral" size={130} /></View><Body muted>{stats.answers ? 'Average scores from your evaluated answers, including retries.' : 'Your first evaluated answers start these scores.'}</Body></Card></Reveal>
    <Reveal delay={220}><View style={s.metrics}>{[{ value: `${stats.accuracy}%`, label: 'Answer accuracy' }, { value: stats.sessions, label: 'Interviews finished' }, { value: stats.bestStreak, label: 'Best day streak' }, { value: stats.studiedMinutes, label: 'Study minutes' }].map(metric => <View key={metric.label} style={s.metric}><Text style={s.metricValue}>{metric.value}</Text><Text style={s.metricLabel}>{metric.label}</Text></View>)}</View></Reveal>
    <Reveal delay={240}><Card><Title small>Your focus goals</Title><Body>{profile.focusApps.length ? profile.focusApps.join(' · ') : 'No distracting apps selected yet.'}</Body><Body muted>These are your selected focus goals. App blocking requires an authorized iPhone build with Screen Time support. Expo Go records practice and earned breaks.</Body></Card></Reveal>
    <Reveal delay={260}><Card><Title small>Keep showing up.</Title><Label>Recent study activity</Label>{stats.activity.length ? <View style={s.activity}>{stats.activity.slice(-14).map(day => <View key={day.date} accessible accessibilityLabel={`${day.date}: ${day.count} study actions`} style={s.activityDay}><View style={[s.activityBar, { height: Math.min(90, 14 + day.count * 8) }]} /><Text style={s.activityLabel}>{day.date.slice(5)}</Text></View>)}</View> : <Body muted>No activity yet. Your first answer or lesson begins the story.</Body>}</Card></Reveal>
  </View>;
}
function Goal({ label, value, goal }: { label: string; value: number; goal: number }) {
  const { colors } = useTheme();
  return <View style={{ gap: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text style={{ color: colors.ink, fontSize: 13, lineHeight: 20, flex: 1 }}>{label}</Text><Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>{value}/{goal}</Text></View><Meter value={goal ? value / goal * 100 : 100} /></View>;
}
function createStyles(colors: ThemePalette) { return StyleSheet.create({
  stack: { gap: 22 }, levelCard: { padding: 24, borderRadius: 28, backgroundColor: colors.pale, gap: 18 }, levelRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, levelTitle: { color: colors.ink, fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: -1 }, levelTrack: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 }, levelStop: { flex: 1, alignItems: 'center', gap: 8 }, stop: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, stopText: { color: colors.muted, fontSize: 12, fontWeight: '600' }, stopLabel: { color: colors.ink, fontSize: 9 }, promotion: { gap: 16, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 18 }, promotionTitle: { color: colors.ink, fontSize: 17, fontWeight: '600', textTransform: 'capitalize' },
  rings: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', alignItems: 'center', gap: 14, paddingVertical: 8 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, metric: { width: '45%', flexGrow: 1, borderRadius: 20, padding: 22, gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }, metricValue: { color: colors.ink, fontSize: 31, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -1 }, metricLabel: { color: colors.muted, fontSize: 12, lineHeight: 18 }, heading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, count: { color: colors.accent, fontSize: 20, fontWeight: '600' }, status: { color: colors.accent, fontSize: 10, letterSpacing: 1, fontWeight: '700', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.pale }, planRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16 }, planMetric: { flex: 1, minWidth: 100, gap: 5 }, planValue: { color: colors.ink, fontSize: 24, fontWeight: '700' }, lessonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line }, lessonLevel: { color: colors.ink, fontSize: 14 }, lessonCount: { color: colors.muted, fontSize: 12 },
  activity: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14, paddingTop: 12 }, activityDay: { alignItems: 'center', gap: 8 }, activityBar: { width: 24, backgroundColor: colors.accent, borderRadius: 8 }, activityLabel: { fontSize: 10, color: colors.muted },
}); }
