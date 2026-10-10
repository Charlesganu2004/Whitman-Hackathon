import { LESSONS, QUESTION_SPECS, specForQuestion, trackForMajor } from './content.ts';
import type { CoachReply, Feedback, Lesson, Level, PracticeSession, Profile, Question, Snapshot, Stats } from './types.ts';

export const LEVELS: readonly Level[] = ['beginner', 'intermediate', 'advanced', 'expert', 'master'];
export class DomainError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export interface EngineState {
  snapshot: Snapshot;
  timeZone: string;
  ordinal: number;
  answerCounts: { technical: number; behavioral: number; technicalPassed: number; behavioralPassed: number };
  dailyResults: { level: Level; accuracy: number; date: string }[];
  dailySessionCounts?: Record<string, number>;
  coachCounts?: Record<string, number>;
  lessonStarted: Record<string, number>;
  lastActivityAt: number | null;
  usedQuestionIds: string[];
}

export function createState(id: string, name: string, email: string, timeZone: string): EngineState {
  return {
    snapshot: {
      profile: { id, name, email, major: '', target: 'internship', minutes: 15, daysPerWeek: 4, sessionsPerDay: 1, targetCompanies: [], unlockMinutes: 30, focusApps: ['Instagram', 'TikTok'], level: 'beginner', placementComplete: false, resumeName: '', resumeText: '', completedLessonIds: [] },
      stats: { streak: 0, bestStreak: 0, sessions: 0, answers: 0, accuracy: 0, technical: 0, behavioral: 0, studiedMinutes: 0, activity: [], unlockedUntil: null, todaySessions: 0, levelPracticeDays: 0, levelPracticeRequired: 2, levelLessonsCompleted: 0, levelLessonsRequired: 2 },
      activeSession: null,
    },
    timeZone, ordinal: 0, answerCounts: { technical: 0, behavioral: 0, technicalPassed: 0, behavioralPassed: 0 }, dailyResults: [], dailySessionCounts: {}, lessonStarted: {}, lastActivityAt: null, usedQuestionIds: [],
  };
}

export function studyDate(now: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}
function previousDate(date: string): string { return new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10); }

export function refreshStreak(state: EngineState, now: number): void {
  const activity = state.snapshot.stats.activity;
  const today = studyDate(now, state.timeZone);
  const latest = activity.at(-1)?.date;
  if (latest !== today && latest !== previousDate(today)) { state.snapshot.stats.streak = 0; return; }
  const dates = new Set(activity.map(entry => entry.date));
  let current = latest;
  let streak = 0;
  while (current && dates.has(current)) { streak++; current = previousDate(current); }
  state.snapshot.stats.streak = streak;
  state.snapshot.stats.bestStreak = Math.max(state.snapshot.stats.bestStreak, streak);
}

function dailyCounts(state: EngineState): Record<string, number> {
  if (!state.dailySessionCounts) {
    state.dailySessionCounts = {};
    for (const result of state.dailyResults) state.dailySessionCounts[result.date] = (state.dailySessionCounts[result.date] ?? 0) + 1;
  }
  return state.dailySessionCounts;
}

export function getSnapshot(state: EngineState, now: number): Snapshot {
  const { profile, stats } = state.snapshot;
  profile.sessionsPerDay ??= 1;
  profile.targetCompanies ??= [];
  refreshStreak(state, now);
  if (stats.unlockedUntil && Date.parse(stats.unlockedUntil) <= now) stats.unlockedUntil = null;
  stats.todaySessions = dailyCounts(state)[studyDate(now, state.timeZone)] ?? 0;
  stats.levelPracticeDays = new Set(state.dailyResults.filter(result => result.level === profile.level && result.accuracy >= 75).map(result => result.date)).size;
  stats.levelPracticeRequired = 2;
  stats.levelLessonsCompleted = LESSONS.filter(lesson => lesson.level === profile.level && profile.completedLessonIds.includes(lesson.id)).length;
  stats.levelLessonsRequired = 2;
  return state.snapshot;
}

function recordStudy(state: EngineState, now: number, elapsedMs: number): void {
  const stats = state.snapshot.stats;
  const date = studyDate(now, state.timeZone);
  const existing = stats.activity.find(entry => entry.date === date);
  if (existing) existing.count++; else stats.activity.push({ date, count: 1 });
  stats.activity.sort((a, b) => a.date.localeCompare(b.date));
  stats.studiedMinutes = Math.round((stats.studiedMinutes + Math.max(0, elapsedMs) / 60_000) * 10) / 10;
  state.lastActivityAt = now;
  refreshStreak(state, now);
}

export function technicalCount(profile: Profile): number {
  if (profile.level === 'expert' || profile.level === 'master') return 1;
  const timeCount = profile.minutes >= 25 ? 6 : profile.minutes >= 15 ? 5 : 4;
  return profile.level === 'beginner' ? timeCount : Math.max(4, timeCount - 1);
}

function rotate<T>(items: T[], offset: number): T[] {
  if (!items.length) return [];
  const start = offset % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}
function selectQuestions(state: EngineState, kind: 'technical' | 'behavioral', count: number, placement: boolean, checkpoint = false): Question[] {
  const profile = state.snapshot.profile;
  const track = trackForMajor(profile.major);
  const level = LEVELS.indexOf(profile.level);
  let pool = QUESTION_SPECS.filter(spec => spec.question.kind === kind && (spec.track === track || spec.track === 'all'));
  if (kind === 'technical' && !placement) {
    pool = pool.filter(spec => {
      const difficulty = LEVELS.indexOf(spec.question.difficulty);
      return checkpoint ? difficulty === Math.min(level, 3) : level >= 3 ? difficulty >= 3 : difficulty === level || difficulty === Math.min(level + 1, 2);
    });
  }
  if (placement && kind === 'technical') {
    const intermediate = pool.filter(spec => spec.question.difficulty === 'intermediate');
    const expert = pool.filter(spec => spec.question.difficulty === 'expert');
    return [rotate(intermediate, state.ordinal)[0]!, rotate(expert, state.ordinal)[0]!].map(spec => spec.question);
  }
  const ordered = rotate(pool, state.ordinal * 3);
  const unseen = ordered.filter(spec => !state.usedQuestionIds.includes(spec.question.id));
  const seen = ordered.filter(spec => state.usedQuestionIds.includes(spec.question.id));
  return [...unseen, ...seen].slice(0, count).map(spec => spec.question);
}

function personalize(question: Question, profile: Profile, suffix: string): Question {
  const themes = [...new Set(profile.resumeText.match(/\b(?:python|javascript|java|sql|research|volunteer|leadership|finance|marketing|analysis|nursing|community|design|project|internship)\b/gi) ?? [])].slice(0, 3);
  const companies = profile.targetCompanies ?? [];
  const context = ` Interview context: ${profile.major}, ${profile.target === 'internship' ? 'internship' : 'full-time'} role.${themes.length ? ` Your resume mentions ${themes.join(', ')}; connect a relevant example when appropriate.` : ''}${companies.length ? ` Preparation goals: ${companies.join(', ')}. This is original practice content, not an exact or proprietary question from these employers.` : ''}`;
  return { ...question, id: `${question.id}~${suffix}`, prompt: question.prompt + context, hints: [...question.hints] };
}

export function startSession(state: EngineState, kind: 'placement' | 'daily' | 'checkpoint', id: string, now: number): Snapshot {
  const profile = state.snapshot.profile;
  const current = state.snapshot.activeSession;
  if (current && current.status !== 'completed') throw new DomainError('Finish the current session before starting another.', 409);
  if (!profile.major || !profile.resumeText.trim()) throw new DomainError('Add your major and resume text before starting placement.');
  if (kind === 'placement' && profile.placementComplete) throw new DomainError('Placement is already complete.', 409);
  if (kind !== 'placement' && !profile.placementComplete) throw new DomainError('Complete placement before starting practice or a knowledge checkpoint.', 409);
  if (kind === 'daily' && state.snapshot.stats.unlockedUntil && Date.parse(state.snapshot.stats.unlockedUntil) > now) throw new DomainError('Your earned break is still active. Practice again after it ends.', 409);
  state.ordinal++;
  const technical = selectQuestions(state, 'technical', kind === 'daily' ? technicalCount(profile) : 2, kind === 'placement', kind === 'checkpoint');
  const behavioral = selectQuestions(state, 'behavioral', 2, kind === 'placement');
  const questions = [...technical, ...behavioral].map((question, index) => personalize(question, profile, `${state.ordinal}-${index}`));
  state.usedQuestionIds.push(...questions.map(question => question.id.split('~')[0]!));
  state.usedQuestionIds = state.usedQuestionIds.slice(-200);
  state.snapshot.activeSession = { id, kind, status: 'active', startingLevel: profile.level, questions, index: 0, attempts: [], technicalCount: technical.length, behavioralCount: 2, startedAt: new Date(now).toISOString() };
  if (kind === 'daily') state.snapshot.stats.unlockedUntil = null;
  state.lastActivityAt = now;
  return state.snapshot;
}

export function questionSpec(question: Question) { return specForQuestion(question.id.split('~')[0]!); }

function starWithRubric(answer: string): NonNullable<Feedback['star']> {
  const situation = /\b(?:during|when|at|in a|in our)\b/i.test(answer);
  const task = /my (?:task|role|responsibility)|I (?:needed|had to|was responsible|wanted)/i.test(answer);
  const action = /\bI\b[\s\S]*(?:built|created|organized|wrote|asked|tested|changed|scheduled|proposed|led|reviewed|prioritized|listened|clarified)/i.test(answer);
  const result = /result|improved|reduced|increased|delivered|completed|resolved|shipped|finished|launched|adopted|on.time|fewer/i.test(answer);
  return {
    situation: situation ? 'You provide context. Keep the setting and challenge concise so your contribution stays central.' : 'Describe one real setting and the challenge before explaining your actions.',
    task: task ? 'Your responsibility is visible. Distinguish your task from the overall team goal.' : 'State what you personally needed to accomplish and why it mattered.',
    action: action ? 'You describe a personal action. Explain why you chose it and how it addressed the challenge.' : 'Name a specific action you personally took, including your reasoning; avoid relying only on "we".',
    result: result ? 'An outcome is mentioned. Support it with an honest observation and connect it to what you learned; do not invent metrics.' : 'Give an observable outcome and what you learned. A qualitative result is valid when you have no measured number.',
  };
}

export function coachWithRubric(question: Question, message: string, profile: Profile, stats: Stats): CoachReply {
  let index = 0;
  if (/test|edge|empty|boundary|verify/i.test(message)) index = question.hints.length - 1;
  else if (/complexity|time|space|cost|reason|why/i.test(message)) index = Math.min(1, question.hints.length - 1);
  const hint = question.hints[Math.max(0, index)] ?? 'Restate the required result and work through one small example.';
  const pace = profile.level === 'beginner' || stats.technical < 60 ? 'Start with one small case and explain each step.' : 'State your assumption, compare an alternative and test a boundary case.';
  return { message: `Focus on one part: ${hint} ${pace} Apply it to this question and tell me what you would check next. This coaching does not grade or submit an answer.`, hints: [hint], mode: 'rubric', provider: 'rubric' };
}

export function lessonCoachWithRubric(lesson: Lesson, message: string, profile: Profile): CoachReply {
  const section = lesson.sections.find(item => message.toLowerCase().includes(item.title.toLowerCase())) ?? lesson.sections[0]!;
  return { message: `${section.title}: ${section.body} Try a different example from your ${profile.major} work and explain the principle in your own words before answering the knowledge check.`, hints: [lesson.summary, 'Explain why your approach fits the situation; coaching does not choose a quiz answer or complete the lesson.'], mode: 'rubric', provider: 'rubric' };
}

const reservedIdentifiers = new Set(['await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'implements', 'interface', 'package', 'private', 'protected', 'public', 'arguments', 'eval']);

function codeOutsideLiterals(source: string): string {
  let result = '';
  let mode: 'code' | 'line' | 'block' | '"' | "'" | '`' = 'code';
  const lineBreak = /[\r\n\u2028\u2029]/;
  for (let index = 0; index < source.length; index++) {
    const character = source[index]!;
    const next = source[index + 1];
    if (mode === 'line') {
      result += lineBreak.test(character) ? character : ' ';
      if (lineBreak.test(character)) mode = 'code';
    } else if (mode === 'block') {
      if (character === '*' && next === '/') {
        result += '  ';
        index++;
        mode = 'code';
      } else result += lineBreak.test(character) ? character : ' ';
    } else if (mode !== 'code') {
      result += lineBreak.test(character) ? character : '?';
      if (character === '\\' && next !== undefined) {
        result += lineBreak.test(next) ? next : '?';
        index++;
      } else if (character === mode) mode = 'code';
    } else if (character === '/' && (next === '/' || next === '*')) {
      mode = next === '/' ? 'line' : 'block';
      result += '  ';
      index++;
    } else if (character === '"' || character === "'" || character === '`') {
      mode = character;
      result += '?';
    } else result += character;
  }
  return result;
}

function namedFunction(answer: string, name: string): { parameter: string; body: string } | null {
  const trimmed = answer.trim();
  const fence = trimmed.match(/^```(?:javascript|js)?[^\S\r\n]*\r?\n([\s\S]*?)```/);
  if (trimmed.startsWith('```') && !fence) return null;
  const source = codeOutsideLiterals(fence ? fence[1]! : trimmed);
  const pattern = new RegExp(`\\bfunction\\s+${name}\\s*\\(\\s*([A-Za-z_$][\\w$]*)\\s*\\)\\s*\\{`, 'g');
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1 || new RegExp(`\\b${name}\\s*(?:=|(?:\\?\\?|&&|\\|\\||[+*/%&|^\\-])=)`).test(source)) return null;
  const match = matches[0]!;
  if (source.slice(0, match.index).trim() || reservedIdentifiers.has(match[1]!)) return null;
  const start = match.index! + match[0].length;
  let depth = 1;
  for (let index = start; index < source.length; index++) {
    const character = source[index];
    if (character === '{') depth++;
    if (character === '}' && --depth === 0) {
      const suffix = source.slice(index + 1).trim();
      if (fence && !/^;?\s*$/.test(suffix)) return null;
      const wordExpression = /^(?:(?:new|typeof|void|await|delete|yield)\s+)*[A-Za-z]+(?:\s+(?:in|instanceof)\s+(?:(?:new|typeof|void|await|delete|yield)\s+)*[A-Za-z]+)*$/;
      const prose = suffix.replace(/\bO\((?:n|1|log\s+n|n\s+log\s+n|n\s*\^\s*\d+)\)/g, '').replace(/\(([^()]*)\)/g, (group, contents: string) =>
        /^[A-Za-z]+(?:\s+[A-Za-z]+)+$/.test(contents.trim()) && !wordExpression.test(contents.trim()) ? '' : group);
      if (!fence && (/[{}=()]/.test(prose) || /\+\+|--/.test(prose) || /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*[,;]/.test(prose) || /(?:^|[;\r\n\u2028\u2029])\s*(?:if|for|while|switch|throw|try|return|void|delete|new|await)\b/.test(prose))) return null;
      return { parameter: match[1]!, body: source.slice(start, index).trim() };
    }
  }
  return null;
}

function supportedCodeIsCorrect(question: Question, answer: string): boolean {
  const identifier = '[A-Za-z_$][\\w$]*';
  const sameLineSpace = '[^\\S\\r\\n\\u2028\\u2029]';
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (question.id.startsWith('sw-unique')) {
    const fn = namedFunction(answer, 'unique');
    if (!fn || fn.parameter === 'Set' || (fn.parameter === 'Array' && /^return\s+Array\.from/.test(fn.body))) return false;
    const input = escape(fn.parameter);
    return new RegExp(`^return${sameLineSpace}+(?:\\[\\s*\\.\\.\\.\\s*new\\s+Set\\(\\s*${input}\\s*\\)\\s*\\]|Array\\.from\\(\\s*new\\s+Set\\(\\s*${input}\\s*\\)\\s*\\))\\s*;?$`).test(fn.body);
  }
  if (question.id.startsWith('sw-positive-sum')) {
    const fn = namedFunction(answer, 'sumPositive');
    if (!fn) return false;
    const input = escape(fn.parameter);
    const declaration = fn.body.match(new RegExp(`^(?:let|var)\\s+(${identifier})\\s*=\\s*0\\s*;\\s*for\\s*\\(\\s*(?:const|let|var)\\s+(${identifier})\\s+of\\s+${input}\\s*\\)`));
    if (declaration) {
      const accumulator = declaration[1]!;
      const item = declaration[2]!;
      if (reservedIdentifiers.has(accumulator) || reservedIdentifiers.has(item) || accumulator === item || accumulator === fn.parameter || item === fn.parameter) return false;
      const acc = escape(accumulator);
      const value = escape(item);
      const add = `${acc}\\s*(?:\\+=\\s*${value}|=\\s*${acc}\\s*\\+\\s*${value})\\s*;`;
      const update = `(?:${add}|\\{\\s*${add}\\s*\\})`;
      const condition = `(?:${value}\\s*>\\s*0|0\\s*<\\s*${value})`;
      return new RegExp(`^(?:let|var)\\s+${acc}\\s*=\\s*0\\s*;\\s*for\\s*\\(\\s*(?:const|let|var)\\s+${value}\\s+of\\s+${input}\\s*\\)\\s*\\{\\s*if\\s*\\(\\s*${condition}\\s*\\)\\s*${update}\\s*\\}\\s*return${sameLineSpace}+${acc}\\s*;?$`).test(fn.body);
    }
    const reduction = fn.body.match(new RegExp(`^return${sameLineSpace}+${input}\\.reduce\\(\\s*\\(\\s*(${identifier})\\s*,\\s*(${identifier})\\s*\\)${sameLineSpace}*=>\\s*([\\s\\S]*)\\);?$`));
    if (!reduction || reservedIdentifiers.has(reduction[1]!) || reservedIdentifiers.has(reduction[2]!) || reduction[1] === reduction[2] || reduction[1] === fn.parameter || reduction[2] === fn.parameter) return false;
    const acc = escape(reduction[1]!);
    const value = escape(reduction[2]!);
    return new RegExp(`^${acc}\\s*\\+\\s*\\(\\s*${value}\\s*>\\s*0\\s*\\?\\s*${value}\\s*:\\s*0\\s*\\)\\s*,\\s*0\\s*$`).test(reduction[3]!);
  }
  return false;
}

export function gradeWithRubric(question: Question, answer: string): Feedback {
  const spec = questionSpec(question);
  const words = answer.match(/\b[\p{L}\p{N}_]+\b/gu) ?? [];
  const uniqueRatio = new Set(words.map(word => word.toLowerCase())).size / Math.max(1, words.length);
  const coding = Boolean(question.starter);
  const minimumWords = question.kind === 'behavioral' ? 60 : coding ? 25 : 40;
  const sentences = answer.split(/[.!?;\n]+/).filter(value => value.trim().length > 12).length;
  const substantial = words.length >= minimumWords && uniqueRatio >= 0.4 && sentences >= 2;
  const results = spec.criteria.map(item => {
    const pattern = item.pattern.ignoreCase ? item.pattern : new RegExp(item.pattern.source, `${item.pattern.flags}i`);
    return { ...item, met: pattern.test(answer) };
  });
  if (coding && !supportedCodeIsCorrect(question, answer)) {
    results[1]!.met = false;
  }
  const strengths = results.filter(item => item.met).map(item => item.label);
  const improvements = results.filter(item => !item.met).map(item => item.label);
  if (coding && !supportedCodeIsCorrect(question, answer)) improvements.push('Place a standalone JavaScript function first, optionally in a code block. The local checker accepts a limited loop/reduce or Set pattern, verifies its return and boundary behavior, and never executes your code. Correct unsupported forms need AI review; review the example and try a different question.');
  if (!substantial) improvements.unshift(`Give a coherent explanation of at least ${minimumWords} words with a specific example; a list of keywords is insufficient.`);
  const score = substantial ? Math.round(strengths.length / results.length * 100) : Math.min(30, Math.round(strengths.length / results.length * 30));
  return { passed: substantial && improvements.length === 0, score, strengths, improvements, explanation: `${substantial && !improvements.length ? 'Your response meets the local practice rubric.' : 'Review the missing criteria, then apply the idea to a different question.'} Example reasoning: ${spec.example} Local rubric checks wording and structure; it does not execute code or provide a full semantic assessment.`, mode: 'rubric', ...(question.kind === 'behavioral' ? { star: starWithRubric(answer) } : {}) };
}

function updateAccuracy(state: EngineState, kind: 'technical' | 'behavioral', passed: boolean): void {
  const counts = state.answerCounts;
  counts[kind]++;
  if (passed) counts[kind === 'technical' ? 'technicalPassed' : 'behavioralPassed']++;
  const stats = state.snapshot.stats;
  stats.answers = counts.technical + counts.behavioral;
  stats.accuracy = Math.round((counts.technicalPassed + counts.behavioralPassed) / stats.answers * 100);
  stats.technical = counts.technical ? Math.round(counts.technicalPassed / counts.technical * 100) : 0;
  stats.behavioral = counts.behavioral ? Math.round(counts.behavioralPassed / counts.behavioral * 100) : 0;
}

export function maybePromote(state: EngineState): void {
  const profile = state.snapshot.profile;
  const index = LEVELS.indexOf(profile.level);
  if (index >= LEVELS.length - 1) return;
  const required = LESSONS.filter(lesson => lesson.level === profile.level);
  const lessonsPassed = required.length >= 2 && required.every(lesson => profile.completedLessonIds.includes(lesson.id));
  const successful = state.dailyResults.filter(result => result.level === profile.level && result.accuracy >= 75);
  if (lessonsPassed && new Set(successful.map(result => result.date)).size >= 2) profile.level = LEVELS[index + 1]!;
}

function completeSession(state: EngineState, session: PracticeSession, now: number): void {
  session.status = 'completed';
  state.snapshot.stats.sessions++;
  if (session.kind === 'placement') {
    const technicalAttempts = session.attempts.filter(attempt => session.questions.find(question => question.id === attempt.questionId)?.kind === 'technical');
    const behaviorAttempts = session.attempts.filter(attempt => session.questions.find(question => question.id === attempt.questionId)?.kind === 'behavioral');
    const techScore = technicalAttempts.reduce((sum, attempt) => sum + attempt.feedback.score, 0) / Math.max(1, technicalAttempts.length);
    const behaviorScore = behaviorAttempts.reduce((sum, attempt) => sum + attempt.feedback.score, 0) / Math.max(1, behaviorAttempts.length);
    const score = techScore * 0.65 + behaviorScore * 0.35;
    state.snapshot.profile.level = score >= 85 && technicalAttempts.every(attempt => attempt.feedback.passed) ? 'expert' : score >= 65 ? 'advanced' : score >= 40 ? 'intermediate' : 'beginner';
    state.snapshot.profile.placementComplete = true;
  } else if (session.kind === 'daily') {
    const passed = session.attempts.filter(attempt => attempt.feedback.passed).length;
    const date = studyDate(now, state.timeZone);
    const counts = dailyCounts(state);
    counts[date] = (counts[date] ?? 0) + 1;
    state.dailyResults.push({ level: session.startingLevel ?? state.snapshot.profile.level, accuracy: Math.round(passed / session.attempts.length * 100), date });
    state.dailyResults = state.dailyResults.slice(-100);
    state.snapshot.stats.unlockedUntil = new Date(now + state.snapshot.profile.unlockMinutes * 60_000).toISOString();
    maybePromote(state);
  }
}

export function requireSession(state: EngineState, sessionId: string): PracticeSession {
  const session = state.snapshot.activeSession;
  if (!session || session.id !== sessionId) throw new DomainError('Session not found.', 404);
  return session;
}

export function applyAnswer(state: EngineState, sessionId: string, questionId: string, answer: string, feedback: Feedback, now: number): { feedback: Feedback; snapshot: Snapshot } {
  const session = requireSession(state, sessionId);
  const existing = session.attempts.find(attempt => attempt.questionId === questionId);
  if (existing) {
    if (existing.answer !== answer) throw new DomainError('This question was already submitted. Continue from the current step.', 409);
    return { feedback: existing.feedback, snapshot: state.snapshot };
  }
  if (session.status !== 'active') throw new DomainError(session.status === 'review' ? 'Read the feedback and acknowledge it before the next question.' : 'This session is complete.', 409);
  const question = session.questions[session.index];
  if (!question || question.id !== questionId) throw new DomainError('Answer the current question before continuing.', 409);
  session.attempts.push({ questionId, answer, feedback, createdAt: new Date(now).toISOString() });
  updateAccuracy(state, question.kind, feedback.passed);
  const checkpoint = state.lastActivityAt ?? Date.parse(session.startedAt);
  recordStudy(state, now, Math.min(Math.max(0, now - checkpoint), 15 * 60_000));
  if (session.kind === 'daily' && !feedback.passed) { session.status = 'review'; session.review = feedback; }
  else {
    session.index++;
    if (session.index === session.questions.length) completeSession(state, session, now);
  }
  return { feedback, snapshot: state.snapshot };
}

export function acknowledgeReview(state: EngineState, sessionId: string, questionId: string): Snapshot {
  const session = requireSession(state, sessionId);
  const current = session.questions[session.index];
  if (session.status !== 'review' || !current || current.id !== questionId) throw new DomainError('There is no feedback to acknowledge for this question.', 409);
  const currentBase = current.id.split('~')[0]!;
  const track = trackForMajor(state.snapshot.profile.major);
  const candidates = QUESTION_SPECS.filter(spec => spec.question.kind === current.kind && (spec.track === track || spec.track === 'all') && spec.question.id !== currentBase);
  const unavailable = new Set([...session.questions.map(question => question.id.split('~')[0]!), ...session.attempts.map(attempt => attempt.questionId.split('~')[0]!)]);
  const sameDifficulty = candidates.filter(spec => spec.question.difficulty === current.difficulty);
  const free = sameDifficulty.filter(spec => !unavailable.has(spec.question.id));
  const replacement = free[0] ?? sameDifficulty[session.attempts.length % sameDifficulty.length] ?? candidates.find(spec => !unavailable.has(spec.question.id)) ?? candidates[0];
  if (!replacement) throw new DomainError('No replacement question is available.', 503);
  session.questions[session.index] = personalize(replacement.question, state.snapshot.profile, `${state.ordinal}-retry-${session.attempts.length}`);
  state.usedQuestionIds.push(replacement.question.id);
  session.status = 'active';
  delete session.review;
  return state.snapshot;
}

export function completeLesson(state: EngineState, lessonId: string, answer: number, now: number): { feedback: Feedback; snapshot: Snapshot } {
  const lesson = LESSONS.find(item => item.id === lessonId);
  if (!lesson) throw new DomainError('Lesson not found.', 404);
  if (!state.snapshot.profile.placementComplete) throw new DomainError('Complete placement before taking lessons.', 409);
  if (LEVELS.indexOf(lesson.level) > LEVELS.indexOf(state.snapshot.profile.level)) throw new DomainError('Complete your current level before taking this lesson.', 409);
  if (!Number.isInteger(answer) || answer < 0 || answer >= lesson.check.choices.length) throw new DomainError('Choose one of the lesson answers.');
  const passed = answer === lesson.check.correct;
  const feedback: Feedback = { passed, score: passed ? 100 : 0, strengths: passed ? ['You applied the lesson principle correctly.'] : [], improvements: passed ? [] : ['Review the lesson and explain why your choice missed the principle.'], explanation: lesson.check.explanation, mode: 'rubric' };
  if (passed && !state.snapshot.profile.completedLessonIds.includes(lessonId)) {
    const started = state.lessonStarted[lessonId];
    if (!started || now - started < 15_000) throw new DomainError('Read the lesson before completing its knowledge check.', 409);
    state.snapshot.profile.completedLessonIds.push(lessonId);
    recordStudy(state, now, Math.min(now - started, lesson.minutes * 60_000));
    maybePromote(state);
  }
  return { feedback, snapshot: state.snapshot };
}
