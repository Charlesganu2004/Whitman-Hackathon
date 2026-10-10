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
}
export interface CoachReply {
  message: string; hints: string[]; mode: 'rubric' | 'ai'; provider: 'rubric' | 'openai' | 'groq';
}
export interface Attempt {
  questionId: string; answer: string; feedback: Feedback; createdAt: string;
}
export interface PracticeSession {
  id: string; kind: 'placement' | 'daily' | 'checkpoint'; status: 'active' | 'review' | 'completed';
  startingLevel?: Level;
  questions: Question[]; index: number; attempts: Attempt[]; review?: Feedback;
  technicalCount: number; behavioralCount: number; startedAt: string;
}
export interface Stats {
  streak: number; bestStreak: number; sessions: number; answers: number;
  accuracy: number; technical: number; behavioral: number; studiedMinutes: number;
  activity: { date: string; count: number }[]; unlockedUntil: string | null;
  todaySessions?: number; levelPracticeDays?: number; levelPracticeRequired?: number;
  levelLessonsCompleted?: number; levelLessonsRequired?: number;
}
export interface Snapshot { profile: Profile; stats: Stats; activeSession: PracticeSession | null }
export interface Lesson {
  id: string; title: string; topic: string; level: Level; minutes: number;
  summary: string; sections: { title: string; body: string }[];
  check: { prompt: string; choices: string[]; correct: number; explanation: string };
}
