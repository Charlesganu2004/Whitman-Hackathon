import type { DialogueTurn, Feedback, Question } from './types.ts';
import { HINT_COST, HINT_LIMIT, INTERVIEWER_NAME, type SkillSummary } from './skills.ts';

/** A message is revealed word by word at this pace, but never for longer than the cap, so a long question still lands quickly. */
export const REVEAL_WORD_MS = 35;
export const REVEAL_CAP_MS = 2500;
/** While Jarvis speaks, the reveal runs a little slower so the words stay close to the voice. */
export const VOICE_WORD_MS = 60;
export const VOICE_CAP_MS = 5000;
/** A message longer than this is shown as one block instead of word by word. */
export const REVEAL_WORD_LIMIT = 90;
export const HISTORY_TURNS = 8;
export const HISTORY_CHARACTERS = 2000;

export function revealStagger(words: number, speaking: boolean): number {
  if (!(words > 0)) return 0;
  const [each, cap] = speaking ? [VOICE_WORD_MS, VOICE_CAP_MS] : [REVEAL_WORD_MS, REVEAL_CAP_MS];
  return Math.min(each, cap / words);
}

export const splitWords = (text: string): string[] => text.split(/\s+/).filter(Boolean);

export function greeting(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return `${first ? `Hi ${first}, ` : 'Hi, '}I am ${INTERVIEWER_NAME}, your interviewer today. Talk to me like a real interview. You can ask me about the question, take a hint, or give your answer whenever you are ready.`;
}

export function listeningLine(question: Pick<Question, 'kind'>): string {
  return question.kind === 'behavioral' ? 'I am listening for the situation, your task, your action and the result.' : '';
}

const COUNT_WORDS = ['No hints', 'One hint', 'Two hints', 'Three hints'];
export const hintCount = (used: number) => COUNT_WORDS[Math.max(0, Math.min(HINT_LIMIT, Math.floor(used)))] ?? COUNT_WORDS[0]!;
export const hintChip = (used: number) => `Hints used: ${Math.max(0, Math.min(HINT_LIMIT, Math.floor(used)))} of ${HINT_LIMIT}`;
export function hintButtonLabel(used: number): string {
  if (used >= HINT_LIMIT) return 'No hints left';
  return used === 0 ? `Get a hint · costs ${HINT_COST} evaluation points` : 'Get another hint';
}

export const verdictLine = (feedback: Pick<Feedback, 'passed'>) => feedback.passed ? 'That answer passes.' : 'That is not a pass yet.';

/** The plain statement of what the answer is worth: the grade, then what the hints took off toward the skill. */
export function scoreLine(feedback: Pick<Feedback, 'score' | 'hintsUsed' | 'evaluationScore'>, skillLabel: string): string {
  const hints = feedback.hintsUsed ?? 0;
  const counted = feedback.evaluationScore ?? feedback.score;
  if (hints <= 0) return `Answer score ${feedback.score}. No hints used, so it counts in full toward ${skillLabel}.`;
  return `Answer score ${feedback.score}. ${hintCount(hints)} used, so it counts as ${counted} toward ${skillLabel}.`;
}

export function standingLine(summary: SkillSummary): string {
  if (summary.level === null || summary.score === null) return `${summary.label} is not measured yet.`;
  return `Your ${summary.label} standing is now ${summary.level.charAt(0).toUpperCase()}${summary.level.slice(1)}, ${summary.score} out of 100. ${summary.evidence}.`;
}

/** What Jarvis says aloud after grading: the verdict, the score and the first thing to work on. */
export function feedbackSpeech(feedback: Feedback): string {
  const next = feedback.improvements[0] ?? feedback.strengths[0] ?? '';
  return [verdictLine(feedback), `Your score is ${feedback.score}.`, next].filter(Boolean).join(' ');
}

/** The rolling window sent with each turn: the last few exchanges, trimmed to the server limits. */
export function dialogueHistory(turns: DialogueTurn[]): DialogueTurn[] {
  return turns
    .map(turn => ({ role: turn.role, text: turn.text.trim().slice(0, HISTORY_CHARACTERS) }))
    .filter(turn => turn.text)
    .slice(-HISTORY_TURNS);
}

/** The server speaks at most this many characters per request. */
export const SPEECH_CHARACTERS = 600;

/** Collapses whitespace and, when the text is too long, keeps whole sentences (or words) up to the limit. */
export function speechText(text: string, limit = SPEECH_CHARACTERS): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const head = clean.slice(0, limit);
  const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('? '), head.lastIndexOf('! '));
  if (sentence > limit / 3) return head.slice(0, sentence + 1);
  const word = head.lastIndexOf(' ');
  return (word > 0 ? head.slice(0, word) : head).trim();
}

export interface DeviceVoice { identifier: string; name: string; quality: string; language: string }
/** The most natural installed English voice: Premium or Enhanced first, then neural-sounding names, then US English. */
export function pickVoice(voices: readonly DeviceVoice[]): string | undefined {
  const english = voices.filter(voice => /^en([-_]|$)/i.test(voice.language));
  const score = (voice: DeviceVoice) => {
    const label = `${voice.name} ${voice.identifier}`;
    return (/premium/i.test(voice.quality) || /premium/i.test(label) ? 12 : 0) + (/enhanced/i.test(voice.quality) || /enhanced/i.test(label) ? 8 : 0)
      + (/natural|neural|siri/i.test(label) ? 5 : 0) + (/^en[-_]us$/i.test(voice.language) ? 3 : 0) + (/^en[-_](gb|au|ca|ie|za|in)$/i.test(voice.language) ? 1 : 0);
  };
  return [...english].sort((a, b) => score(b) - score(a))[0]?.identifier;
}
