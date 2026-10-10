import type { SkillId, SkillStanding } from './skills.ts';

export type Level = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';
export type QuestionKind = 'technical' | 'behavioral';
export interface Profile {
  id: string; name: string; email: string; major: string;
  target: 'internship' | 'full-time'; minutes: number; daysPerWeek: number;
  sessionsPerDay?: number;
  targetCompanies?: string[];
  unlockMinutes: number; focusApps: string[]; level: Level;
  placementComplete: boolean; resumeName: string; resumeText: string;
  completedLessonIds: string[];
}
export interface Question {
  id: string; kind: QuestionKind; topic: string; difficulty: Level;
  title: string; prompt: string; starter?: string; hints: string[];
}
export interface Feedback {
  passed: boolean; score: number; strengths: string[]; improvements: string[];
  explanation: string; mode: 'rubric' | 'ai';
  star?: { situation: string; task: string; action: string; result: string };
  /** Hints taken on this question, and the score that counts toward skill standings after their cost. Absent on older attempts. */
  hintsUsed?: number; evaluationScore?: number;
}
export interface CoachReply {
  message: string; hints: string[]; mode: 'rubric' | 'ai'; provider: 'rubric' | 'openai' | 'groq' | 'nvidia';
}
export type DialogueStage = 'clarify' | 'debrief';
export type DialogueIntent = 'clarify' | 'hint';
export interface DialogueTurn { role: 'interviewer' | 'student'; text: string }
export interface DialogueReply {
  message: string; followUp: string; mode: 'rubric' | 'ai'; provider: 'rubric' | 'openai' | 'groq' | 'nvidia';
  /** Clarify-stage replies report how many hints this question has used so far. */
  hintsUsed?: number;
}
export interface Attempt {
  questionId: string; answer: string; feedback: Feedback; createdAt: string;
}
/** A daily question the student failed and was given a different question for, kept so its feedback survives to the end of the session. Review only: it never counts as a pass. */
export interface MissedQuestion {
  questionId: string; title: string; topic: string; kind: QuestionKind; skill: SkillId;
  answer: string; feedback: Feedback; createdAt: string;
}
export interface PracticeSession {
  id: string; kind: 'placement' | 'daily' | 'checkpoint'; status: 'active' | 'review' | 'completed';
  startingLevel?: Level;
  /** Hints taken per question id. Each costs evaluation points and never changes the grade. */
  hints?: Record<string, number>;
  questions: Question[]; index: number; attempts: Attempt[]; review?: Feedback;
  /** Failed daily questions that were replaced, oldest first. Absent on sessions saved before this field existed. */
  missed?: MissedQuestion[];
  technicalCount: number; behavioralCount: number; startedAt: string;
}
export interface Stats {
  streak: number; bestStreak: number; sessions: number; answers: number;
  accuracy: number; technical: number; behavioral: number; studiedMinutes: number;
  activity: { date: string; count: number }[]; unlockedUntil: string | null;
  todaySessions?: number; levelPracticeDays?: number; levelPracticeRequired?: number;
  levelLessonsCompleted?: number; levelLessonsRequired?: number;
  skills?: Partial<Record<SkillId, SkillStanding>>;
}
export interface Snapshot { profile: Profile; stats: Stats; activeSession: PracticeSession | null }
export interface Lesson {
  id: string; title: string; topic: string; level: Level; minutes: number;
  summary: string; sections: { title: string; body: string }[];
  check: { prompt: string; choices: string[]; correct: number; explanation: string };
}
