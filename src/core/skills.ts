import type { Level, Question } from './types.ts';

/** The one place the interviewer persona is named. */
export const INTERVIEWER_NAME = 'Jarvis';

export type SkillId = 'communication' | 'technical' | 'coding';
export interface SkillStanding { score: number; answers: number }
export interface SkillSummary {
  id: SkillId; label: string; description: string;
  /** Null when no graded answer backs this skill. */
  level: Level | null; score: number | null;
  /** "Not measured yet" or "Based on N answers". */
  evidence: string; nextStep: string;
}

export const SKILL_IDS: readonly SkillId[] = ['communication', 'technical', 'coding'];
/** A standing follows roughly the last five graded answers. */
export const SKILL_WINDOW = 5;

export function skillForQuestion(question: Pick<Question, 'kind' | 'starter'>): SkillId {
  if (question.kind === 'behavioral') return 'communication';
  return question.starter ? 'coding' : 'technical';
}

/** Each hint costs this many evaluation points on its question, up to HINT_LIMIT hints. The grade itself never changes. */
export const HINT_COST = 10;
export const HINT_LIMIT = 3;

const percent = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

/**
 * Only the score and the answer count are stored, so the rolling mean is the running form of an average over at most
 * the last five answers: the newest answer carries weight 1/min(answers + 1, 5) and older answers fade out.
 */
export function updateSkill(previous: SkillStanding | undefined, score: number): SkillStanding {
  const answers = Math.max(0, Math.floor(previous?.answers ?? 0));
  const kept = Math.min(answers, SKILL_WINDOW - 1);
  const average = (percent(previous?.score ?? 0) * kept + percent(score)) / (kept + 1);
  return { score: Math.round(percent(average)), answers: answers + 1 };
}

/** The score that counts toward a skill standing: the grade minus the hint cost, never below zero. */
export function evaluationScore(score: number, hintsUsed = 0): number {
  const hints = Number.isFinite(hintsUsed) ? Math.max(0, Math.min(HINT_LIMIT, Math.floor(hintsUsed))) : 0;
  return Math.round(Math.max(0, percent(score) - hints * HINT_COST));
}

export function skillLevel(score: number): Level {
  const value = percent(score);
  if (value >= 90) return 'master';
  if (value >= 75) return 'expert';
  if (value >= 60) return 'advanced';
  if (value >= 40) return 'intermediate';
  return 'beginner';
}

const SKILL_COPY: Record<SkillId, { label: string; description: string; unmeasured: string; steps: Record<Level, string> }> = {
  communication: {
    label: 'Communication',
    description: 'How clearly you tell a behavioral story with the STAR method.',
    unmeasured: `Answer one behavioral question. ${INTERVIEWER_NAME} listens for situation, task, action and result.`,
    steps: {
      beginner: 'Pick one real example and name your own action and its result in plain words.',
      intermediate: 'Open with the situation in one sentence, then spend most of the answer on your action and result.',
      advanced: 'Say what you learned or would change, and keep the result observable without invented numbers.',
      expert: 'Tighten each story to about two minutes and keep a second example ready for follow-ups.',
      master: 'Keep your edge: take the hardest follow-up and answer it with a fresh example.',
    },
  },
  technical: {
    label: 'Technical discussion',
    description: 'How well you talk through a technical problem in your own words.',
    unmeasured: 'Talk one technical question through: assumptions first, then your approach, then one tradeoff.',
    steps: {
      beginner: 'Restate the problem, work one small case aloud and say why each step holds.',
      intermediate: 'State your assumption, compare two approaches and test one boundary case.',
      advanced: 'Name the constraint that decides between your options and the failure you would watch for.',
      expert: 'Reason across the whole system: retries, failure boundaries and how you would verify the result.',
      master: 'Explain a hard tradeoff to a non-expert in two minutes, then defend it under a follow-up.',
    },
  },
  coding: {
    label: 'Coding',
    description: 'How correct and clear your code and its explanation are.',
    unmeasured: 'Answer a coding question that comes with starter code. Software interview tracks include them.',
    steps: {
      beginner: 'Write one standalone function, then walk through an example input and the empty case.',
      intermediate: 'State the time and space cost, and test one boundary input before you submit.',
      advanced: 'Choose a data structure on purpose, say why, and cover duplicates and failure paths.',
      expert: 'Handle scale or concurrency in the design and justify the tradeoff you accepted.',
      master: 'Review your own solution for a second approach and explain when it would win.',
    },
  },
};

/** A skill with no graded answers is "Not measured yet" and never shows a number. */
export function skillSummary(id: SkillId, standing?: SkillStanding): SkillSummary {
  const copy = SKILL_COPY[id];
  const answers = Math.max(0, Math.floor(standing?.answers ?? 0));
  if (!standing || answers === 0) return { id, label: copy.label, description: copy.description, level: null, score: null, evidence: 'Not measured yet', nextStep: copy.unmeasured };
  const score = Math.round(percent(standing.score));
  const level = skillLevel(score);
  return { id, label: copy.label, description: copy.description, level, score, evidence: `Based on ${answers} ${answers === 1 ? 'answer' : 'answers'}`, nextStep: copy.steps[level] };
}
