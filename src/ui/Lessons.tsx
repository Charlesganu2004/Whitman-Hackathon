import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { Lesson, Profile } from '../core/types';
import { OFFLINE_REASON } from '../core/connection';
import { LEVELS } from '../core/engine';
import { Body, Button, Card, Label, Message, Meter, SurfaceAction, Title } from './components';
import { Reveal } from './motion';
import { useTheme, type ThemePalette } from './theme';

export function Lessons({ profile, lessons, busy, offline, onOpen }: { profile: Profile; lessons: Lesson[]; busy: boolean; offline: boolean; onOpen: (lesson: Lesson) => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [linkError, setLinkError] = useState<string | null>(null);
  const openReference = (url: string) => { setLinkError(null); Linking.openURL(url).catch(() => setLinkError('This reference could not be opened. Check your connection and try again.')); };
  const completed = lessons.filter(lesson => profile.completedLessonIds.includes(lesson.id)).length;
  return <View style={{ gap: 24 }}>
    <Reveal style={{ gap: 8 }}><Label>Small lessons. Lasting confidence.</Label><Title>{'Your path\nto master.'}</Title><Body muted>Learn the idea. Check your understanding. Put it to work.</Body>{profile.targetCompanies?.length ? <Body muted>Preparing for {profile.targetCompanies.join(' · ')}.</Body> : null}{offline && <Body muted>{OFFLINE_REASON}</Body>}</Reveal>
    <Reveal delay={60}><View style={s.overview}><View style={s.overviewRow}><Text style={s.overviewTitle}>One step at a time.</Text><Text style={s.count}>{completed}<Text style={s.total}>/{lessons.length}</Text></Text></View><Meter value={lessons.length ? completed / lessons.length * 100 : 0} /><Text style={s.overviewCopy}>Your completed lessons stay here whenever you need a refresher.</Text></View></Reveal>
    {LEVELS.filter(level => level !== 'master').map((level, groupIndex) => <Reveal key={level} delay={100 + groupIndex * 45}><View style={s.groupHeading}><View style={s.groupDot} /><Label>{level} foundations</Label><View style={s.groupLine} /></View><View style={s.group}>{lessons.filter(lesson => lesson.level === level).map((lesson, index) => {
      const complete = profile.completedLessonIds.includes(lesson.id);
      const locked = LEVELS.indexOf(lesson.level) > LEVELS.indexOf(profile.level);
      return <SurfaceAction key={lesson.id} label={`${lesson.title}, ${complete ? 'completed' : locked ? `requires ${level} level` : 'open lesson'}`} disabled={busy || locked || offline} onPress={() => onOpen(lesson)} style={[s.lesson, index > 0 && s.lessonBorder, locked && { opacity: 0.6 }]}><View style={[s.lessonMark, complete && s.completedMark]}><Text style={[s.markText, complete && { color: colors.onAccent }]}>{complete ? '✓' : locked ? '·' : String(lessons.findIndex(item => item.id === lesson.id) + 1).padStart(2, '0')}</Text></View><View style={s.lessonCopy}><Text style={s.lessonTitle}>{lesson.title}</Text><Text style={s.lessonSummary}>{lesson.summary}</Text><Text style={s.lessonMeta}>{locked ? `Unlock at ${level} level` : `${lesson.minutes} min · ${lesson.topic}`}</Text></View><Text style={s.chevron}>{complete ? '✓' : locked ? '' : '›'}</Text></SurfaceAction>;
    })}</View></Reveal>)}
    <Reveal delay={280}><Card><Label>Continue your practice</Label><Title small>Go deeper.</Title><Body muted>These official resources open in your browser. Unscroll lessons and interview questions are original.</Body><Button title="NeetCode roadmap" secondary onPress={() => openReference('https://neetcode.io/roadmap')} /><Button title="LeetCode study plans" secondary onPress={() => openReference('https://leetcode.com/studyplan/')} /><Button title="HackerRank practice" secondary onPress={() => openReference('https://www.hackerrank.com/dashboard')} />{linkError && <Message text={linkError} />}</Card></Reveal>
  </View>;
}
function createStyles(colors: ThemePalette) { return StyleSheet.create({
  overview: { padding: 24, borderRadius: 28, backgroundColor: colors.pale, gap: 14 }, overviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, overviewTitle: { color: colors.ink, fontSize: 20, fontWeight: '600', letterSpacing: -0.4 }, count: { color: colors.accent, fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'] }, total: { fontSize: 15, fontWeight: '400', color: colors.muted }, overviewCopy: { color: colors.muted, fontSize: 13, lineHeight: 21 }, groupHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }, groupDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent }, groupLine: { flex: 1, height: 1, backgroundColor: colors.line }, group: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 24, overflow: 'hidden' }, lesson: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12, minHeight: 120 }, lessonBorder: { borderTopWidth: 1, borderTopColor: colors.line }, lessonMark: { width: 37, height: 44, borderRadius: 12, backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center' }, completedMark: { backgroundColor: colors.accent }, markText: { color: colors.accent, fontSize: 15, fontWeight: '600' }, lessonCopy: { flex: 1, gap: 5 }, lessonTitle: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 }, lessonSummary: { color: colors.muted, fontSize: 13, lineHeight: 20 }, lessonMeta: { color: colors.accent, fontSize: 11, fontWeight: '600', lineHeight: 17 }, chevron: { fontSize: 25, color: colors.accent },
}); }
