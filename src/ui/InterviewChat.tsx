import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { DialogueIntent, DialogueReply, DialogueStage, DialogueTurn, Feedback, PracticeSession, Question, Stats } from '../core/types';
import { splitQuestionPrompt } from '../core/engine';
import { OFFLINE_REASON } from '../core/connection';
import { dialogueHistory, feedbackSpeech, greeting, hintButtonLabel, hintChip, listeningLine, scoreLine, standingLine, verdictLine } from '../core/interview';
import { HINT_LIMIT, INTERVIEWER_NAME, skillForQuestion, skillSummary } from '../core/skills';
import { request } from '../services/api';
import { prepareVoice, replayJarvis, stopJarvis } from '../services/voice';
import { Body, Button, Field, Label, Message, Meter } from './components';
import { CountUp, JarvisBubble, StudentBubble, TickIn, Typing, Words } from './chatParts';
import { useMotionEnabled } from './motion';
import { useTheme, type ThemePalette } from './theme';
import { useDraft } from './useDraft';
import { VoiceAnswer } from './VoiceAnswer';

export interface InterviewChatProps {
  session: PracticeSession;
  /** The question being discussed: the current one, or the one just answered while its feedback is on screen. */
  question: Question;
  feedback: Feedback | null;
  stats: Stats;
  name: string;
  offline: boolean;
  speechAvailable: boolean;
  /** Title of the existing next action ("Next question", "See your results" or the review step). */
  nextLabel: string;
  nextBusy: boolean;
  reviewing: boolean;
  /** Grades the answer through the existing answer request. It rejects when grading fails. */
  onSubmit: (answer: string) => Promise<void>;
  onNext: () => void;
  onLeave: () => void;
  /** Called after each new bubble so the page can scroll to the end. */
  onNewMessage: () => void;
}

type Bubble = { id: string; role: 'jarvis'; text: string; followUp: string } | { id: string; role: 'student'; text: string; code: boolean };
type ResultPart = 'verdict' | 'worked' | 'improve' | 'star' | 'explanation' | 'standing';

let voicePreference = true;
const sleep = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const turnsOf = (bubbles: Bubble[]): DialogueTurn[] => bubbles.map(bubble => bubble.role === 'jarvis' ? { role: 'interviewer', text: `${bubble.text} ${bubble.followUp}`.trim() } : { role: 'student', text: bubble.text });
const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
// react-native-web paints the thumb of an on switch from activeThumbColor, which defaults to teal; thumbColor only reaches its off state.
const webThumb = (color: string) => Platform.OS === 'web' ? { activeThumbColor: color } : {};

/**
 * The conversation with Jarvis for one session question. It keeps the old transcript on screen while the next question arrives:
 * the old messages fade and slide up, a thin line sweeps, then the new question enters.
 */
export function InterviewChat(props: InterviewChatProps) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const motion = useMotionEnabled();
  const [voiceOn, setVoiceOn] = useState(voicePreference);
  const [shownId, setShownId] = useState(props.question.id);
  const [phase, setPhase] = useState<'idle' | 'leaving' | 'sweeping'>('idle');
  const latest = useRef(props);
  latest.current = props;
  const frozen = useRef(props);
  const changed = props.question.id !== shownId;
  if (!changed) frozen.current = props;
  const live = changed ? frozen.current : props;
  const exit = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!changed) return;
    stopJarvis();
    if (!motion) { setShownId(latest.current.question.id); return; }
    let cancelled = false;
    setPhase('leaving');
    exit.setValue(0);
    sweep.setValue(0);
    const leave = Animated.timing(exit, { toValue: 1, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true });
    const line = Animated.timing(sweep, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    leave.start(({ finished }) => {
      if (!finished || cancelled) return;
      setPhase('sweeping');
      line.start(({ finished: swept }) => {
        if (!swept || cancelled) return;
        setShownId(latest.current.question.id);
        setPhase('idle');
      });
    });
    return () => { cancelled = true; leave.stop(); line.stop(); };
  }, [changed, motion, props.question.id]);
  useEffect(() => { if (phase === 'idle') { exit.setValue(0); sweep.setValue(0); } }, [phase, exit, sweep]);

  const { session, question, feedback } = props;
  const index = Math.max(0, session.questions.findIndex(item => item.id === question.id));
  const skill = skillSummary(skillForQuestion(question));
  const toggleVoice = (next: boolean) => { voicePreference = next; setVoiceOn(next); if (!next) stopJarvis(); };
  return <View style={s.stage}>
    <View style={s.row}>
      <Label>{session.kind === 'placement' ? 'Find your starting point' : session.kind === 'checkpoint' ? 'Test your knowledge' : 'Today’s interview'}</Label>
      <Text style={s.pill}>{index + 1}/{session.questions.length}</Text>
    </View>
    <Meter value={100 * (index + (feedback ? 1 : 0)) / session.questions.length} />
    <View style={s.row}>
      <View style={s.topic}><Label>{question.kind === 'behavioral' ? 'Behavioral' : skill.label} {'·'} {question.topic === 'Behavioral' ? 'Conversation with Jarvis' : question.topic}</Label></View>
      <Pressable accessibilityRole="switch" accessibilityLabel={`${INTERVIEWER_NAME} voice`} accessibilityState={{ checked: voiceOn }} onPress={() => toggleVoice(!voiceOn)} style={s.voice}>
        <Text style={s.voiceLabel}>{INTERVIEWER_NAME} voice</Text>
        <Switch value={voiceOn} onValueChange={toggleVoice} trackColor={{ false: colors.line, true: colors.accent }} ios_backgroundColor={colors.line} thumbColor={voiceOn ? colors.onAccent : colors.muted} {...webThumb(voiceOn ? colors.onAccent : colors.muted)} accessibilityLabel={`${INTERVIEWER_NAME} voice`} />
      </Pressable>
    </View>
    <View>
      <Animated.View style={phase === 'idle' ? undefined : { opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateY: exit.interpolate({ inputRange: [0, 1], outputRange: [0, -28] }) }] }}>
        <ChatSession key={live.question.id} {...live} voiceOn={voiceOn} locked={changed} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[s.sweep, { opacity: phase === 'sweeping' ? 1 : 0, transform: [{ scaleX: sweep }] }]} />
    </View>
  </View>;
}

type SessionProps = InterviewChatProps & { voiceOn: boolean; locked: boolean };

function ChatSession({ session, question, feedback, stats, name, offline, speechAvailable, nextLabel, nextBusy, reviewing, voiceOn, locked, onSubmit, onNext, onLeave, onNewMessage }: SessionProps) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const motion = useMotionEnabled();
  const coding = Boolean(question.starter);
  const attempt = session.attempts.find(item => item.questionId === question.id);
  const seeded = useRef(feedback !== null).current;
  const greet = useRef(!seeded && session.index === 0 && session.attempts.length === 0).current;
  const voiceRef = useRef(voiceOn);
  voiceRef.current = voiceOn;
  const [introDone, setIntroDone] = useState(seeded);
  const [thread, setThread] = useState<Bubble[]>(() => seeded && attempt ? [{ id: 'answer', role: 'student', text: attempt.answer, code: coding }] : []);
  const [debrief, setDebrief] = useState<Bubble[]>([]);
  const [waiting, setWaiting] = useState<'reply' | 'grade' | null>(null);
  const { draft, setDraft, saved: draftSaved, discard: discardDraft } = useDraft(session.id, question.id, feedback === null);
  const [hints, setHints] = useState(session.hints?.[question.id] ?? 0);
  const [problem, setProblem] = useState('');
  const skillId = skillForQuestion(question);
  const summary = skillSummary(skillId, stats.skills?.[skillId]);
  const parts = useMemo<ResultPart[]>(() => feedback ? ['verdict', ...(feedback.strengths.length ? ['worked' as const] : []), ...(feedback.improvements.length ? ['improve' as const] : []), ...(feedback.star ? ['star' as const] : []), 'explanation', 'standing'] : [], [feedback]);
  const [staged, setStaged] = useState(seeded ? parts.length : 0);
  const counter = useRef(0);
  const nextId = (prefix: string) => `${prefix}-${++counter.current}`;
  const busy = waiting !== null || locked || offline;

  useEffect(() => () => stopJarvis(), []);
  useEffect(() => {
    if (seeded) return;
    let cancelled = false;
    const began = Date.now();
    void (async () => {
      const spoken = [greet ? greeting(name) : '', `${question.title}.`, splitQuestionPrompt(question.prompt).main, listeningLine(question)].filter(Boolean).join(' ');
      const prepared = voiceRef.current ? await prepareVoice(spoken) : null;
      if (motion) await sleep(Math.max(0, 450 - (Date.now() - began)));
      if (cancelled) return;
      setIntroDone(true);
      prepared?.play();
    })();
    return () => { cancelled = true; };
  }, []);

  // A graded answer arrives: Jarvis prepares his voice behind the typing dots, then posts the result a bubble at a time.
  useEffect(() => {
    if (!feedback || seeded) return;
    let cancelled = false;
    void (async () => {
      const prepared = voiceRef.current ? await prepareVoice(feedbackSpeech(feedback)) : null;
      if (cancelled) return;
      setWaiting(null);
      prepared?.play();
      for (let shown = 1; shown <= parts.length; shown++) {
        setStaged(shown);
        if (shown < parts.length) await sleep(motion ? 220 : 0);
        if (cancelled) return;
      }
    })();
    return () => { cancelled = true; };
  }, [feedback]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    onNewMessage();
  }, [thread.length, debrief.length, staged, waiting]);

  function restore(message: string, text: string, id: string, stage: DialogueStage) {
    const drop = (bubbles: Bubble[]) => bubbles.filter(bubble => bubble.id !== id);
    if (stage === 'clarify') setThread(drop); else setDebrief(drop);
    setDraft(text);
    setProblem(message);
  }

  async function talk(stage: DialogueStage, intent: DialogueIntent) {
    const typed = draft.trim();
    const message = typed || (intent === 'hint' ? 'Could I have a hint, please?' : '');
    if (!message || busy) return;
    stopJarvis();
    setProblem('');
    setDraft('');
    const mine: Bubble = { id: nextId('student'), role: 'student', text: message, code: false };
    const earlier = stage === 'clarify' ? thread : debrief;
    if (stage === 'clarify') setThread(bubbles => [...bubbles, mine]); else setDebrief(bubbles => [...bubbles, mine]);
    setWaiting('reply');
    try {
      const reply = await request<DialogueReply>(`/sessions/${session.id}/turn`, { questionId: question.id, message, stage, ...(intent === 'hint' ? { intent } : {}), history: dialogueHistory(turnsOf(earlier)) });
      if (typeof reply.hintsUsed === 'number') setHints(reply.hintsUsed);
      const prepared = voiceRef.current ? await prepareVoice(`${reply.message} ${reply.followUp}`) : null;
      const bubble: Bubble = { id: nextId('jarvis'), role: 'jarvis', text: reply.message, followUp: reply.followUp };
      if (stage === 'clarify') setThread(bubbles => [...bubbles, bubble]); else setDebrief(bubbles => [...bubbles, bubble]);
      setWaiting(null);
      prepared?.play();
    } catch (error) {
      setWaiting(null);
      restore(error instanceof Error ? error.message : `${INTERVIEWER_NAME} could not reply. Try again.`, typed, mine.id, stage);
    }
  }

  async function submit() {
    const answer = draft.trim();
    if (answer.length < 10 || busy) return;
    stopJarvis();
    setProblem('');
    // The text stays stored until grading succeeds, so closing the app while Jarvis reviews it loses nothing.
    setDraft('', false);
    const mine: Bubble = { id: 'answer', role: 'student', text: answer, code: coding };
    setThread(bubbles => [...bubbles, mine]);
    setWaiting('grade');
    try { await onSubmit(answer); discardDraft(); }
    catch (error) { setWaiting(null); restore(error instanceof Error ? error.message : 'Your answer could not be graded. Try again.', answer, mine.id, 'clarify'); }
  }

  const { main, context } = splitQuestionPrompt(question.prompt);
  const questionSpeech = [`${question.title}.`, main, listeningLine(question)].filter(Boolean).join(' ');
  const items: { key: string; role: 'jarvis' | 'student'; render: (mark: boolean) => React.ReactNode }[] = [];
  if (introDone) items.push({ key: 'question', role: 'jarvis', render: mark => <QuestionBubble mark={mark} question={question} main={main} context={context} greet={greet ? greeting(name) : ''} listening={listeningLine(question)} speaking={voiceOn} instant={seeded} onReplay={() => replayJarvis(greet ? [greeting(name), questionSpeech].join(' ') : questionSpeech)} /> });
  const bubbleItem = (bubble: Bubble) => items.push(bubble.role === 'student'
    ? { key: bubble.id, role: 'student', render: () => <StudentBubble text={bubble.text} code={bubble.code} /> }
    : { key: bubble.id, role: 'jarvis', render: mark => <ReplyBubble mark={mark} bubble={bubble} speaking={voiceOn} /> });
  thread.forEach(bubbleItem);
  if (feedback) parts.slice(0, staged).forEach(part => items.push({ key: part, role: 'jarvis', render: mark => <ResultBubble mark={mark} part={part} feedback={feedback} summary={summary} instant={seeded} /> }));
  debrief.forEach(bubbleItem);
  if (!introDone || waiting !== null) items.push({ key: 'typing', role: 'jarvis', render: () => <Typing label={waiting === 'grade' ? `${INTERVIEWER_NAME} is reviewing your answer` : `${INTERVIEWER_NAME} is typing`} /> });

  const composer = !feedback ? (waiting === 'grade' ? null : <View style={s.composer}>
    {problem !== '' && <Message text={problem} />}
    {offline && <Body muted>{OFFLINE_REASON}</Body>}
    <Field label={`Your message to ${INTERVIEWER_NAME}`} multiline value={draft} onChangeText={text => { stopJarvis(); setDraft(text); }} autoCorrect={!coding} autoCapitalize="sentences" placeholder={coding ? 'Ask a question, or write your code and explain it…' : question.kind === 'behavioral' ? 'Ask about the question, or tell your story: situation, task, action, result…' : 'Ask about the question, or talk through your answer…'} style={coding ? s.codeInput : s.input} />
    {draftSaved && <Text style={s.saved}>Draft saved</Text>}
    {!coding && (speechAvailable ? <VoiceAnswer prompt={question.title} listen={false} enabled onTranscript={text => setDraft(current => current ? `${current} ${text}` : text)} onError={setProblem} /> : <Body muted>On iPhone, tap the microphone on the keyboard to dictate.</Body>)}
    <Button title={`Ask ${INTERVIEWER_NAME}`} secondary disabled={busy || draft.trim().length < 3} onPress={() => { void talk('clarify', 'clarify'); }} />
    <Button title={hintButtonLabel(hints)} secondary disabled={busy || hints >= HINT_LIMIT} onPress={() => { void talk('clarify', 'hint'); }} />
    <View style={s.chipRow}><Text accessibilityLabel={hintChip(hints)} style={s.chip}>{hintChip(hints)}</Text></View>
    <Body muted>{`Asking ${INTERVIEWER_NAME} is free and never graded. Submit answer sends this text for grading.`}</Body>
    <Button title="Submit answer" disabled={busy || draft.trim().length < 10} onPress={() => { void submit(); }} />
    <Button title="Save and leave interview" secondary disabled={locked} onPress={onLeave} />
  </View>) : <View style={s.composer}>
    <Button title={nextLabel} busy={nextBusy} disabled={locked || staged < parts.length || (reviewing && offline)} onPress={onNext} />
    {reviewing && <Body muted>Review what was missing. A different question checks that you learned it.</Body>}
    {offline && <Body muted>{OFFLINE_REASON}</Body>}
    {problem !== '' && <Message text={problem} />}
    <Field label={`Talk about this feedback with ${INTERVIEWER_NAME}`} multiline value={draft} onChangeText={text => { stopJarvis(); setDraft(text); }} autoCapitalize="sentences" placeholder="Ask why you lost points, or how to improve…" style={s.input} />
    <Button title={`Ask ${INTERVIEWER_NAME}`} secondary disabled={busy || draft.trim().length < 3} onPress={() => { void talk('debrief', 'clarify'); }} />
    <Body muted>This conversation never changes your grade, your standing or your unlock.</Body>
  </View>;

  let previous: 'jarvis' | 'student' | null = null;
  return <View style={s.chat}>
    <View style={s.transcript} accessibilityLiveRegion="polite">
      {items.map(item => {
        const mark = previous !== 'jarvis';
        previous = item.role;
        return <React.Fragment key={item.key}>{item.render(mark)}</React.Fragment>;
      })}
    </View>
    {composer}
  </View>;
}

function QuestionBubble({ mark, question, main, context, greet, listening, speaking, instant, onReplay }: { mark: boolean; question: Question; main: string; context: string; greet: string; listening: string; speaking: boolean; instant: boolean; onReplay: () => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [greeted, setGreeted] = useState(!greet);
  return <JarvisBubble mark={mark} instant={instant} onReplay={onReplay}>
    {greet !== '' && <Words text={greet} speaking={speaking} instant={instant} onDone={() => setGreeted(true)} />}
    <Text accessibilityRole="header" style={s.questionTitle}>{question.title}</Text>
    <Words text={main} speaking={speaking} instant={instant} start={greeted} />
    {context !== '' && <Text style={s.context}>{context}</Text>}
    {question.starter && <Text selectable style={s.code}>{question.starter}</Text>}
    {listening !== '' && <Text style={s.listening}>{listening}</Text>}
  </JarvisBubble>;
}

function ReplyBubble({ mark, bubble, speaking }: { mark: boolean; bubble: Extract<Bubble, { role: 'jarvis' }>; speaking: boolean }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [read, setRead] = useState(!bubble.followUp);
  return <JarvisBubble mark={mark} onReplay={() => replayJarvis(`${bubble.text} ${bubble.followUp}`)}>
    <Words text={bubble.text} speaking={speaking} onDone={() => setRead(true)} />
    {bubble.followUp !== '' && <Words text={bubble.followUp} speaking={speaking} start={read} style={s.followUp} />}
  </JarvisBubble>;
}

function ResultBubble({ mark, part, feedback, summary, instant }: { mark: boolean; part: ResultPart; feedback: Feedback; summary: ReturnType<typeof skillSummary>; instant: boolean }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const spoken = part === 'verdict' ? () => replayJarvis(feedbackSpeech(feedback)) : undefined;
  return <JarvisBubble mark={mark} instant={instant} onReplay={spoken}>
    {part === 'verdict' && <>
      <Label>{feedback.mode === 'ai' ? 'AI feedback' : 'Rubric feedback'}</Label>
      <View style={s.scoreRow}><CountUp value={feedback.score} instant={instant} style={s.score} /><Text style={s.scoreOf}>out of 100</Text></View>
      <Meter value={feedback.score} label="Answer score" />
      <Text style={s.verdict}>{verdictLine(feedback)}</Text>
      <Body muted>{scoreLine(feedback, summary.label)}</Body>
    </>}
    {part === 'worked' && <><Label>What worked</Label>{feedback.strengths.map((text, index) => <Body key={`strength-${index}`}>{'✓'} {text}</Body>)}</>}
    {part === 'improve' && <><Label>What to improve</Label>{feedback.improvements.map((text, index) => <Body key={`improvement-${index}`}>{text}</Body>)}</>}
    {part === 'star' && feedback.star && <>
      <Label>Your STAR story</Label>
      {(Object.entries(feedback.star) as [string, string][]).map(([name, guidance], index) => <TickIn key={name} index={index} instant={instant}><View style={s.starLine}><Text style={s.starName}>{capitalize(name)}</Text><Body>{guidance}</Body></View></TickIn>)}
    </>}
    {part === 'explanation' && <><Label>The explanation</Label><Body>{feedback.explanation}</Body></>}
    {part === 'standing' && <><Label>Your standing</Label><Body>{standingLine(summary)}</Body>{summary.score !== null && <Meter value={summary.score} label={`${summary.label} standing`} />}</>}
  </JarvisBubble>;
}

function createStyles(colors: ThemePalette) {
  return StyleSheet.create({
    stage: { gap: 14 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    topic: { flexShrink: 1 },
    pill: { color: colors.accent, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontWeight: '600', overflow: 'hidden' },
    voice: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
    voiceLabel: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: '600' },
    sweep: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: 12, backgroundColor: colors.accent, transformOrigin: 'left center' },
    chat: { gap: 18 },
    transcript: { gap: 10 },
    composer: { gap: 12 },
    input: { minHeight: 96 },
    codeInput: { fontFamily: mono, minHeight: 180, fontSize: 14 },
    saved: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    chipRow: { flexDirection: 'row' },
    chip: { color: colors.accent, backgroundColor: colors.pale, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
    questionTitle: { color: colors.ink, fontSize: 18, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
    context: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    listening: { color: colors.muted, fontSize: 14, lineHeight: 21 },
    code: { fontFamily: mono, color: colors.ink, backgroundColor: colors.subtle, padding: 14, borderRadius: 12, fontSize: 13, lineHeight: 20, overflow: 'hidden' },
    followUp: { fontWeight: '600' },
    scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    score: { color: colors.accent, fontSize: 44, lineHeight: 52, fontWeight: '700', letterSpacing: -1.4 },
    scoreOf: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    verdict: { color: colors.ink, fontSize: 17, lineHeight: 24, fontWeight: '700' },
    starLine: { gap: 4, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.accent },
    starName: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  });
}
