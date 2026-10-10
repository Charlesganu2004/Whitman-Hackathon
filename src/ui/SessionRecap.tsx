import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RecapQuestion, RecapStep, SessionRecap as Recap, WeakTopic } from '../core/recap';
import { OFFLINE_REASON } from '../core/connection';
import type { MissedQuestion, QuestionKind } from '../core/types';
import type { SkillId } from '../core/skills';
import { Body, Card, Label, Meter, SurfaceAction, Title } from './components';
import { Reveal } from './motion';
import { useTheme, type ThemePalette } from './theme';

interface Props {
  recap: Recap;
  offline: boolean;
  busy: boolean;
  onLesson: (lessonId: string) => void;
  onDaily: () => void;
  onEvaluate: () => void;
}

const kindLabel = (kind: QuestionKind, skill: SkillId) => kind === 'behavioral' ? 'Behavioral' : skill === 'coding' ? 'Coding' : 'Technical';
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

/** What happened in a finished session: the result per question, where to focus, what to revisit and what to do next. */
export function SessionRecap({ recap, offline, busy, onLesson, onDaily, onEvaluate }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const act = (step: RecapStep) => step.kind === 'lesson' && step.lessonId ? onLesson(step.lessonId) : step.kind === 'daily' ? onDaily() : onEvaluate();
  const needsServer = (step: RecapStep) => step.kind !== 'daily' && offline;
  return <View style={s.stack}>
    {recap.total > 0 && <Reveal><Card>
      <Label>Your session recap</Label>
      <Title small>{recap.passed} of {recap.total} passed</Title>
      <View style={s.pills}>
        <Pill text={`Average ${recap.averageScore}`} />
        {recap.averageEvaluation !== recap.averageScore && <Pill text={`Evaluation ${recap.averageEvaluation}`} />}
        {recap.hintsTaken > 0 && <Pill text={plural(recap.hintsTaken, 'hint')} />}
        {recap.revisit.length > 0 && <Pill text={`${recap.revisit.length} to revisit`} tone="alert" />}
      </View>
      <Meter value={recap.total ? recap.passed / recap.total * 100 : 0} label="Passed" />
    </Card></Reveal>}

    {recap.questions.length > 0 && <Reveal delay={60}><Card>
      <Label>Question by question</Label>
      {recap.questions.map((item, index) => <QuestionRow key={item.id} item={item} divided={index > 0} />)}
    </Card></Reveal>}

    {recap.weakTopics.length > 0 && <Reveal delay={90}><Card>
      <Label>Where to focus</Label>
      {recap.weakTopics.map((item, index) => <WeakRow key={item.topic} item={item} divided={index > 0} />)}
    </Card></Reveal>}

    {recap.revisit.length > 0 && <Reveal delay={120}><Card>
      <Label>What to revisit</Label>
      <Body muted>These questions were swapped for a different one after a miss. They did not count as a pass.</Body>
      {recap.revisit.map((item, index) => <RevisitRow key={`${item.questionId}-${index}`} item={item} divided={index > 0} />)}
    </Card></Reveal>}

    {recap.steps.length > 0 && <Reveal delay={150}><Card>
      <Label>What to do next</Label>
      {recap.steps.map((step, index) => <SurfaceAction key={step.kind} label={`${step.title}. ${step.detail}`} disabled={busy || needsServer(step)} onPress={() => act(step)} style={[s.step, index > 0 && s.divider]}>
        <View style={s.stepMark}><Text style={s.stepNumber}>{index + 1}</Text></View>
        <View style={s.stepCopy}>
          <Text style={s.rowTitle}>{step.title}</Text>
          <Text style={s.muted}>{step.detail}</Text>
          {step.kind === 'daily' && <Pill text={step.ready ? 'Ready now' : 'After your break'} tone={step.ready ? 'accent' : 'plain'} />}
        </View>
        <Text style={s.chevron}>›</Text>
      </SurfaceAction>)}
      {offline && recap.steps.some(needsServer) && <Body muted>{OFFLINE_REASON}</Body>}
    </Card></Reveal>}
  </View>;
}

function Pill({ text, tone = 'plain' }: { text: string; tone?: 'plain' | 'accent' | 'alert' }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  return <Text style={[s.pill, tone === 'accent' && s.pillAccent, tone === 'alert' && s.pillAlert]}>{text}</Text>;
}

function QuestionRow({ item, divided }: { item: RecapQuestion; divided: boolean }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const reduced = item.evaluation !== item.score;
  return <View style={[s.row, divided && s.divider]}>
    <View style={s.rowHead}>
      <View accessibilityLabel={item.passed ? 'Passed' : 'Not passed'} style={[s.mark, item.passed ? s.markPass : s.markFail]}><Text style={[s.markText, item.passed ? { color: colors.onAccent } : { color: colors.danger }]}>{item.passed ? '✓' : '✕'}</Text></View>
      <View style={s.rowCopy}>
        <Text style={s.rowTitle}>{item.title}</Text>
        <View style={s.pills}><Pill text={item.topic} /><Pill text={kindLabel(item.kind, item.skill)} /></View>
      </View>
      <Text accessibilityLabel={`Score ${item.score}`} style={[s.score, !item.passed && { color: colors.danger }]}>{item.score}</Text>
    </View>
    <Meter value={item.score} />
    {reduced && <Text style={s.muted}>Evaluation {item.evaluation} after {plural(item.hintsUsed, 'hint')}. The grade and pass stay as they are.</Text>}
  </View>;
}

function WeakRow({ item, divided }: { item: WeakTopic; divided: boolean }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  return <View style={[s.row, divided && s.divider]}>
    <View style={s.rowHead}>
      <View style={s.rowCopy}>
        <Text style={s.rowTitle}>{item.topic}</Text>
        <View style={s.pills}><Pill text={kindLabel(item.kind, item.skill)} />{item.missed && <Pill text="Swapped after a miss" tone="alert" />}</View>
      </View>
      <Text accessibilityLabel={`Score ${item.score}`} style={[s.score, !item.passed && { color: colors.danger }]}>{item.score}</Text>
    </View>
    {item.improvement && <Body muted>{item.improvement}</Body>}
  </View>;
}

function RevisitRow({ item, divided }: { item: MissedQuestion; divided: boolean }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const { feedback } = item;
  return <View style={[s.row, divided && s.divider]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${open ? 'hide' : 'show'} your answer and feedback`} accessibilityState={{ expanded: open }} aria-expanded={open} onPress={() => setOpen(!open)} style={s.rowHead}>
      <View style={s.rowCopy}>
        <Text style={s.rowTitle}>{item.title}</Text>
        <View style={s.pills}><Pill text={item.topic} /><Pill text={kindLabel(item.kind, item.skill)} /></View>
      </View>
      <Text style={[s.score, { color: colors.danger }]}>{feedback.score}</Text>
      <Text style={s.chevron}>{open ? '−' : '+'}</Text>
    </Pressable>
    {open && <View style={s.detail}>
      <Text style={s.detailLabel}>Your answer</Text>
      <Text selectable style={[s.answer, item.skill === 'coding' && { fontFamily: mono }]}>{item.answer}</Text>
      {feedback.strengths.length > 0 && <Lines label="What worked" lines={feedback.strengths} />}
      {feedback.improvements.length > 0 && <Lines label="What to improve" lines={feedback.improvements} />}
      {feedback.star && <View style={s.lines}>
        <Text style={s.detailLabel}>Your STAR method</Text>
        {(['situation', 'task', 'action', 'result'] as const).map(part => <Text key={part} style={s.line}><Text style={s.bold}>{part.charAt(0).toUpperCase() + part.slice(1)}: </Text>{feedback.star![part]}</Text>)}
      </View>}
      <Lines label="Why" lines={[feedback.explanation]} />
    </View>}
  </View>;
}

function Lines({ label, lines }: { label: string; lines: readonly string[] }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  return <View style={s.lines}>
    <Text style={s.detailLabel}>{label}</Text>
    {lines.map((line, index) => <Text key={index} style={s.line}>{line}</Text>)}
  </View>;
}

function createStyles(colors: ThemePalette) {
  return StyleSheet.create({
    stack: { gap: 16 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: { color: colors.ink, backgroundColor: colors.subtle, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, lineHeight: 17, fontWeight: '600', overflow: 'hidden' },
    pillAccent: { color: colors.accent, backgroundColor: colors.pale, borderColor: colors.pale },
    pillAlert: { color: colors.danger, backgroundColor: colors.dangerSurface, borderColor: colors.dangerLine },
    row: { gap: 10 },
    divider: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16 },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
    rowCopy: { flex: 1, gap: 6 },
    rowTitle: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: '700' },
    score: { color: colors.accent, fontSize: 22, lineHeight: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
    muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    mark: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    markPass: { backgroundColor: colors.accent, borderColor: colors.accent },
    markFail: { backgroundColor: colors.dangerSurface, borderColor: colors.dangerLine },
    markText: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
    chevron: { color: colors.accent, fontSize: 26, lineHeight: 28, minWidth: 20, textAlign: 'center' },
    step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    stepMark: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
    stepNumber: { color: colors.accent, fontSize: 15, lineHeight: 20, fontWeight: '700' },
    stepCopy: { flex: 1, gap: 4, alignItems: 'flex-start' },
    detail: { gap: 14, backgroundColor: colors.subtle, borderRadius: 12, padding: 16 },
    detailLabel: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
    answer: { color: colors.ink, fontSize: 15, lineHeight: 22 },
    lines: { gap: 6 },
    line: { color: colors.ink, fontSize: 15, lineHeight: 22 },
    bold: { fontWeight: '700' },
  });
}
