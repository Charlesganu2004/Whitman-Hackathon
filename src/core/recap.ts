import { LESSONS, trackForMajor } from './content.ts';
import { LEVELS } from './engine.ts';
import { startDecision } from './break.ts';
import { SKILL_IDS, skillForQuestion, skillSummary, type SkillId } from './skills.ts';
import type { Lesson, MissedQuestion, PracticeSession, Profile, QuestionKind, Stats } from './types.ts';

/** Below this score the lowest answer of a fully passed session is still named as the topic to strengthen. */
export const WEAK_BELOW = 90;
export const WEAK_TOPIC_LIMIT = 3;

export interface RecapQuestion {
  id: string; title: string; topic: string; kind: QuestionKind; skill: SkillId;
  /** The grade. */
  score: number;
  /** The score that counts toward the skill standing, after hint costs. */
  evaluation: number;
  hintsUsed: number;
  passed: boolean;
}
export interface WeakTopic {
  topic: string; kind: QuestionKind; skill: SkillId; score: number; passed: boolean;
  /** The first improvement line from that answer's feedback. */
  improvement: string | null;
  /** The answer belonged to a question that was replaced, so it is listed under what to revisit too. */
  missed: boolean;
}
export type RecapStepKind = 'lesson' | 'daily' | 'evaluation';
export interface RecapStep {
  kind: RecapStepKind; title: string; detail: string;
  lessonId?: string;
  /** For the daily step: when the next daily interview opens, or null when it is ready now. */
  availableAt?: string | null;
  ready?: boolean;
}
export interface SessionRecap {
  /** Questions of this session that were answered and are still part of it, in order. */
  questions: RecapQuestion[];
  total: number; passed: number;
  averageScore: number; averageEvaluation: number; hintsTaken: number;
  weakTopics: WeakTopic[];
  /** Failed daily questions that were replaced, with the answer and the full feedback. */
  revisit: MissedQuestion[];
  steps: RecapStep[];
}
export interface RecapContext { profile: Profile; stats: Stats; now: number; lessons?: readonly Lesson[] }

const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
const firstLine = (lines: readonly string[]) => lines.find(line => line.trim())?.trim() ?? null;

/** The lowest scores come first; a failed answer outranks a passed one at the same score. */
const weaker = (a: WeakTopic, b: WeakTopic) => a.score - b.score || Number(a.passed) - Number(b.passed);

function weakTopics(rows: { row: RecapQuestion; improvement: string | null }[], revisit: readonly MissedQuestion[]): WeakTopic[] {
  const candidates: WeakTopic[] = [
    ...rows.map(({ row, improvement }) => ({ topic: row.topic, kind: row.kind, skill: row.skill, score: row.score, passed: row.passed, improvement, missed: false })),
    ...revisit.map(item => ({ topic: item.topic, kind: item.kind, skill: item.skill, score: item.feedback.score, passed: false, improvement: firstLine(item.feedback.improvements), missed: true })),
  ].sort(weaker);
  const failed = candidates.filter(candidate => !candidate.passed);
  const chosen = failed.length ? failed : candidates.filter(candidate => candidate.score < WEAK_BELOW).slice(0, 1);
  // One entry per topic, the lowest scoring answer on it.
  const unique: WeakTopic[] = [];
  for (const candidate of chosen) if (!unique.some(item => item.topic === candidate.topic)) unique.push(candidate);
  return unique.slice(0, WEAK_TOPIC_LIMIT);
}

/** The unfinished lesson that best matches the weakest area: the student's own level first, then the nearest level below it. */
function lessonFor(skill: SkillId | null, profile: Profile, lessons: readonly Lesson[]): { lesson: Lesson; matched: boolean } | null {
  const reached = LEVELS.indexOf(profile.level);
  const open = lessons.filter(lesson => !profile.completedLessonIds.includes(lesson.id) && LEVELS.indexOf(lesson.level) <= reached);
  const nearest = (list: readonly Lesson[]) => [...list].sort((a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level))[0];
  if (skill) {
    // Behavioral lessons train communication; every other lesson trains discussing and writing technical answers.
    const family = open.filter(lesson => (lesson.topic === 'Behavioral') === (skill === 'communication'));
    const best = nearest(family);
    if (best) return { lesson: best, matched: true };
  }
  const any = nearest(open);
  return any ? { lesson: any, matched: false } : null;
}

export function summarizeSession(session: PracticeSession, context: RecapContext): SessionRecap {
  const { profile, stats, now } = context;
  const lessons = context.lessons ?? LESSONS;
  const revisit = session.missed ?? [];
  const built = session.questions.flatMap(question => {
    const attempt = session.attempts.find(item => item.questionId === question.id);
    if (!attempt) return [];
    const feedback = attempt.feedback;
    const row: RecapQuestion = {
      id: question.id, title: question.title, topic: question.topic, kind: question.kind, skill: skillForQuestion(question),
      score: feedback.score, evaluation: feedback.evaluationScore ?? feedback.score, hintsUsed: feedback.hintsUsed ?? 0, passed: feedback.passed,
    };
    return [{ row, improvement: firstLine(feedback.improvements) }];
  });
  const questions = built.map(item => item.row);
  const weak = weakTopics(built, revisit);

  // The weakest area steers the lesson even when every answer passed: it is the lowest scoring one.
  const lowest = [...questions].sort((a, b) => a.score - b.score)[0];
  const area = weak[0]?.skill ?? lowest?.skill ?? null;
  const steps: RecapStep[] = [];
  const pick = lessonFor(area, profile, lessons);
  if (pick) {
    const { lesson, matched } = pick;
    const focus = matched && area ? `Aimed at ${skillSummary(area).label.toLowerCase()}, your weakest area this time. ` : '';
    steps.push({ kind: 'lesson', title: lesson.title, detail: `${focus}${lesson.minutes} minute lesson. ${lesson.summary}`, lessonId: lesson.id });
  }
  const decision = startDecision({ profile, stats, activeSession: session }, now);
  if (profile.placementComplete) {
    steps.push(decision.action === 'break'
      ? { kind: 'daily', title: 'Your next daily interview', detail: `It opens in ${decision.minutesLeft} ${decision.minutesLeft === 1 ? 'minute' : 'minutes'}, when your earned break ends.`, availableAt: decision.endsAt, ready: false }
      : { kind: 'daily', title: 'Your next daily interview', detail: 'It is ready whenever you are.', availableAt: null, ready: true });
  }
  // Coding is only asked on the software track, so a student on another track is never sent to measure it.
  const measurable = SKILL_IDS.filter(id => id !== 'coding' || trackForMajor(profile.major) === 'software');
  const unmeasured = measurable.filter(id => !(stats.skills?.[id]?.answers));
  if (unmeasured.length && decision.canEvaluate) {
    const names = unmeasured.map(id => skillSummary(id).label.toLowerCase());
    steps.push({ kind: 'evaluation', title: 'Evaluate with Jarvis', detail: `No graded answers yet for ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]}. A knowledge check shows where you stand.` });
  }

  return {
    questions, total: questions.length, passed: questions.filter(item => item.passed).length,
    averageScore: average(questions.map(item => item.score)), averageEvaluation: average(questions.map(item => item.evaluation)),
    hintsTaken: questions.reduce((sum, item) => sum + item.hintsUsed, 0),
    weakTopics: weak, revisit: [...revisit], steps,
  };
}
