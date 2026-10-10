import { createServer as createHTTPServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createAI } from './ai.mjs';
import { decodeBase64, extractResume } from './resume.mjs';
import { acknowledgeReview, applyAnswer, completeLesson, createState, DomainError, getSnapshot, LEVELS, requireSession, startSession, studyDate } from '../src/core/engine.ts';
import { LESSONS, trackForMajor } from '../src/core/content.ts';

const scrypt = promisify(scryptCallback);
const BODY_LIMIT = 6 * 1024 * 1024;
const TOKEN_LIFETIME = 30 * 24 * 60 * 60 * 1000;
const hashToken = token => createHash('sha256').update(token).digest('hex');

function textField(value, label, minimum, maximum) {
  if (typeof value !== 'string' || value.trim().length < minimum || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new DomainError(`${label} must contain ${minimum}–${maximum} characters.`);
  return value.trim();
}
function emailField(value) {
  const email = textField(value, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError('Enter a valid email address.');
  return email;
}
function timeZoneField(value) {
  if (typeof value !== 'string' || value.length > 80) throw new DomainError('Choose a valid study time zone.');
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); } catch { throw new DomainError('Choose a valid study time zone.'); }
  return value;
}
function integerField(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new DomainError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  return value;
}
async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new DomainError('Request exceeds the 6 MB limit.', 413);
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Object required.');
    return result;
  } catch { throw new DomainError('Send a valid JSON object.'); }
}

export function createServer(options = {}) {
  const databasePath = options.databasePath ?? resolve('server/data/interview.sqlite');
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
      salt TEXT NOT NULL, password_hash TEXT NOT NULL,
      state TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tokens (
      hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS token_user ON tokens(user_id);
  `);
  const now = options.now ?? (() => Date.now());
  const ai = createAI({ apiKey: options.apiKey, groqApiKey: options.groqApiKey, provider: options.aiProvider ?? options.provider, speechProvider: options.speechProvider, fetchImpl: options.fetchImpl, model: options.model, groqModel: options.groqModel, transcriptionModel: options.transcriptionModel, groqTranscriptionModel: options.groqTranscriptionModel, timeoutMs: options.aiTimeoutMs });
  const grade = options.grade ?? ai.grade;
  const buckets = new Map();
  const allowedOrigins = (options.allowedOrigins ?? process.env.APP_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  let closed = false;

  function loadState(userId) {
    const row = db.prepare('SELECT state, version FROM users WHERE id = ?').get(userId);
    if (!row) throw new DomainError('Account not found.', 401);
    return { state: JSON.parse(row.state), version: row.version };
  }
  function saveState(userId, state, version) {
    const result = db.prepare('UPDATE users SET state = ?, version = version + 1 WHERE id = ? AND version = ?').run(JSON.stringify(state), userId, version);
    if (result.changes !== 1) throw new DomainError('Your progress changed. Refresh and continue.', 409);
  }
  function snapshot(userId) {
    const loaded = loadState(userId);
    const before = JSON.stringify(loaded.state);
    const result = getSnapshot(loaded.state, now());
    if (before !== JSON.stringify(loaded.state)) saveState(userId, loaded.state, loaded.version);
    return result;
  }
  function mutate(userId, action) {
    const loaded = loadState(userId);
    const result = action(loaded.state);
    getSnapshot(loaded.state, now());
    saveState(userId, loaded.state, loaded.version);
    return result;
  }
  function limit(key, maximum, duration) {
    if (options.rateLimit === false) return;
    const timestamp = now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.until <= timestamp) { bucket = { count: 0, until: timestamp + duration }; buckets.set(key, bucket); }
    if (++bucket.count > maximum) throw new DomainError('Too many requests. Wait before trying again.', 429);
    if (buckets.size > 10_000) for (const [entry, value] of buckets) if (value.until <= timestamp) buckets.delete(entry);
    if (buckets.size > 20_000) throw new DomainError('Server is busy. Try again shortly.', 503);
  }
  function authenticate(request) {
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !/^Bearer [A-Za-z0-9_-]{43}$/.test(header)) throw new DomainError('Sign in to continue.', 401);
    const row = db.prepare('SELECT user_id FROM tokens WHERE hash = ? AND expires_at > ?').get(hashToken(header.slice(7)), now());
    if (!row) throw new DomainError('Your session expired. Sign in again.', 401);
    return row.user_id;
  }
  function issueToken(userId) {
    const token = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM tokens WHERE expires_at <= ?').run(now());
    db.prepare('INSERT INTO tokens (hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), userId, now() + TOKEN_LIFETIME);
    const old = db.prepare('SELECT hash FROM tokens WHERE user_id = ? ORDER BY expires_at DESC LIMIT -1 OFFSET 5').all(userId);
    for (const row of old) db.prepare('DELETE FROM tokens WHERE hash = ?').run(row.hash);
    return token;
  }
  function updateProfile(state, body) {
    const fields = ['major', 'target', 'minutes', 'daysPerWeek', 'sessionsPerDay', 'targetCompanies', 'unlockMinutes', 'focusApps', 'timeZone'];
    if (Object.keys(body).some(key => !fields.includes(key))) throw new DomainError('The profile contains an unsupported field.');
    if (!Object.keys(body).length) throw new DomainError('Provide profile preferences to update.');
    const current = state.snapshot.activeSession;
    if (current && current.status !== 'completed') throw new DomainError('Finish your current session before changing preferences.', 409);
    const profile = state.snapshot.profile;
    if (body.major !== undefined) {
      const major = textField(body.major, 'Major', 2, 100);
      if (profile.placementComplete && trackForMajor(major) !== trackForMajor(profile.major)) {
        profile.placementComplete = false;
        profile.level = 'beginner';
        profile.completedLessonIds = [];
        state.dailyResults = [];
        state.snapshot.stats.unlockedUntil = null;
      }
      profile.major = major;
    }
    if (body.target !== undefined) {
      if (!['internship', 'full-time'].includes(body.target)) throw new DomainError('Choose internship or full-time.');
      profile.target = body.target;
    }
    if (body.minutes !== undefined) profile.minutes = integerField(body.minutes, 'Practice minutes', 5, 60);
    if (body.daysPerWeek !== undefined) profile.daysPerWeek = integerField(body.daysPerWeek, 'Study days per week', 1, 7);
    if (body.sessionsPerDay !== undefined) profile.sessionsPerDay = integerField(body.sessionsPerDay, 'Study sessions per day', 1, 4);
    if (body.targetCompanies !== undefined) {
      if (!Array.isArray(body.targetCompanies) || body.targetCompanies.length > 5 || body.targetCompanies.some(value => typeof value !== 'string' || !value.trim() || value.length > 60 || /[\u0000-\u001f]/.test(value)) || new Set(body.targetCompanies.map(value => value.trim().toLowerCase())).size !== body.targetCompanies.length) throw new DomainError('Choose up to five distinct company names, each at most 60 characters.');
      profile.targetCompanies = body.targetCompanies.map(value => value.trim());
    }
    if (body.unlockMinutes !== undefined) profile.unlockMinutes = integerField(body.unlockMinutes, 'Break minutes', 5, 120);
    if (body.focusApps !== undefined) {
      if (!Array.isArray(body.focusApps) || body.focusApps.length < 1 || body.focusApps.length > 12 || body.focusApps.some(value => typeof value !== 'string' || value.trim().length < 1 || value.length > 60) || new Set(body.focusApps.map(value => value.trim().toLowerCase())).size !== body.focusApps.length) throw new DomainError('Choose 1–12 distinct focus app names.');
      profile.focusApps = body.focusApps.map(value => value.trim());
    }
    if (body.timeZone !== undefined) state.timeZone = timeZoneField(body.timeZone);
    return state.snapshot;
  }

  async function handle(request, response) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const origin = request.headers.origin;
    if (origin) {
      if (!allowedOrigins.includes(origin) && !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(origin)) throw new DomainError('This browser origin is not allowed.', 403);
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    }
    if (request.method === 'OPTIONS') { response.statusCode = 204; response.end(); return; }
    const path = new URL(request.url, 'http://localhost').pathname;
    const method = request.method;
    const client = request.socket.remoteAddress ?? 'unknown';
    limit(`all:${client}`, 200, 60_000);
    const send = (data, status = 200) => { response.statusCode = status; response.end(JSON.stringify(data)); };
    if (path === '/health' && method === 'GET') return send({ ok: true, gradingMode: ai.enabled ? 'ai' : 'rubric', gradingProvider: ai.provider, speechAvailable: ai.speechAvailable, speechProvider: ai.speechProvider, database: 'sqlite', schemaVersion: 1 });
    if (path === '/auth/signup' && method === 'POST') {
      limit(`auth:${client}`, 15, 15 * 60_000);
      const body = await readBody(request);
      const name = textField(body.name, 'Name', 2, 80);
      const email = emailField(body.email);
      const password = textField(body.password, 'Password', 8, 128);
      const timeZone = timeZoneField(body.timeZone ?? process.env.STUDY_TIME_ZONE ?? 'America/Los_Angeles');
      const sessionsPerDay = body.sessionsPerDay === undefined ? 1 : integerField(body.sessionsPerDay, 'Study sessions per day', 1, 4);
      if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) throw new DomainError('An account already exists for this email. Sign in instead.', 409);
      const salt = randomBytes(16).toString('hex');
      const passwordHash = (await scrypt(password, salt, 64)).toString('hex');
      const id = randomUUID();
      const state = createState(id, name, email, timeZone);
      state.snapshot.profile.sessionsPerDay = sessionsPerDay;
      try { db.prepare('INSERT INTO users (id, email, salt, password_hash, state, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, email, salt, passwordHash, JSON.stringify(state), now()); }
      catch (error) { if (String(error.message).includes('UNIQUE constraint')) throw new DomainError('An account already exists for this email. Sign in instead.', 409); throw error; }
      return send({ token: issueToken(id), snapshot: state.snapshot }, 201);
    }
    if (path === '/auth/login' && method === 'POST') {
      limit(`auth:${client}`, 15, 15 * 60_000);
      const body = await readBody(request);
      const email = emailField(body.email);
      const password = textField(body.password, 'Password', 8, 128);
      const user = db.prepare('SELECT id, salt, password_hash FROM users WHERE email = ?').get(email);
      const salt = user?.salt ?? '00000000000000000000000000000000';
      const hash = await scrypt(password, salt, 64);
      if (!user || !timingSafeEqual(hash, Buffer.from(user.password_hash, 'hex'))) throw new DomainError('Email or password is incorrect.', 401);
      return send({ token: issueToken(user.id), snapshot: snapshot(user.id) });
    }
    const userId = authenticate(request);
    limit(`user:${userId}`, 100, 60_000);
    if (path === '/me' && method === 'GET') return send(snapshot(userId));
    if (path === '/auth/logout' && method === 'POST') {
      db.prepare('DELETE FROM tokens WHERE hash = ?').run(hashToken(request.headers.authorization.slice(7)));
      return send({ ok: true });
    }
    if (path === '/profile' && method === 'PUT') {
      const body = await readBody(request);
      return send(mutate(userId, state => updateProfile(state, body)));
    }
    if (path === '/resume' && method === 'POST') {
      limit(`resume:${userId}`, 6, 60_000);
      const body = await readBody(request);
      const resume = await extractResume(body);
      return send(mutate(userId, state => {
        if (state.snapshot.activeSession && state.snapshot.activeSession.status !== 'completed') throw new DomainError('Finish your current session before changing your resume.', 409);
        state.snapshot.profile.resumeName = resume.name;
        state.snapshot.profile.resumeText = resume.text;
        return state.snapshot;
      }));
    }
    if (path === '/sessions' && method === 'POST') {
      const body = await readBody(request);
      if (!['placement', 'daily', 'checkpoint'].includes(body.kind)) throw new DomainError('Choose placement, daily practice or a knowledge checkpoint.');
      return send(mutate(userId, state => startSession(state, body.kind, randomUUID(), now())), 201);
    }
    const answerRoute = path.match(/^\/sessions\/([^/]+)\/answer$/);
    if (answerRoute && method === 'POST') {
      const body = await readBody(request);
      const questionId = textField(body.questionId, 'Question ID', 1, 150);
      const answer = textField(body.answer, 'Answer', 1, 16_000);
      const initial = loadState(userId).state;
      const session = requireSession(initial, answerRoute[1]);
      const existing = session.attempts.find(attempt => attempt.questionId === questionId);
      if (existing) {
        if (existing.answer !== answer) throw new DomainError('This question was already submitted. Continue from the current step.', 409);
        return send({ feedback: existing.feedback, snapshot: getSnapshot(initial, now()) });
      }
      if (session.status !== 'active' || session.questions[session.index]?.id !== questionId) throw new DomainError('Continue from the current question or review step.', 409);
      limit(`grade:${userId}`, 25, 60_000);
      let feedback;
      try { feedback = await grade(session.questions[session.index], answer, initial.snapshot.profile); }
      catch (error) { throw new DomainError(error.message || 'Grading is unavailable. Try again.', error.status === 429 ? 429 : 503); }
      return send(mutate(userId, state => applyAnswer(state, answerRoute[1], questionId, answer, feedback, now())));
    }
    const reviewRoute = path.match(/^\/sessions\/([^/]+)\/review$/);
    if (reviewRoute && method === 'POST') {
      const body = await readBody(request);
      const questionId = textField(body.questionId, 'Question ID', 1, 150);
      return send(mutate(userId, state => acknowledgeReview(state, reviewRoute[1], questionId)));
    }
    const coachRoute = path.match(/^\/sessions\/([^/]+)\/coach$/);
    if (coachRoute && method === 'POST') {
      const body = await readBody(request);
      const questionId = textField(body.questionId, 'Question ID', 1, 150);
      const message = textField(body.message, 'Coaching message', 1, 2000);
      limit(`coach:${userId}`, 20, 60_000);
      const context = mutate(userId, state => {
        const session = requireSession(state, coachRoute[1]);
        const question = session.questions[session.index];
        if (session.status === 'completed' || !question || question.id !== questionId) throw new DomainError('Request coaching for the current question or review step.', 409);
        if (question.kind !== 'technical') throw new DomainError('Technical coaching is available for technical questions. Submit your behavioral response for STAR feedback.', 409);
        state.coachCounts ??= {};
        const key = `${session.id}:${questionId}`;
        if ((state.coachCounts[key] ?? 0) >= 5) throw new DomainError('You have used five coaching turns for this question. Apply the hints and submit your answer, or finish the review to try a different question.', 429);
        state.coachCounts[key] = (state.coachCounts[key] ?? 0) + 1;
        return { question, coachKey: key, profile: state.snapshot.profile, progress: { ...state.snapshot.stats, recentMistakes: session.attempts.filter(attempt => !attempt.feedback.passed).slice(-2).map(attempt => ({ score: attempt.feedback.score, improvements: attempt.feedback.improvements })) } };
      });
      let reply;
      try { reply = await ai.coach(context.question, message, context.profile, context.progress); }
      catch (error) {
        mutate(userId, state => { if (state.coachCounts?.[context.coachKey]) state.coachCounts[context.coachKey]--; });
        throw new DomainError(error.message || 'Coaching is unavailable. Use the question hints and try again.', error.status === 429 ? 429 : 503);
      }
      const current = requireSession(loadState(userId).state, coachRoute[1]);
      if (current.status === 'completed' || current.questions[current.index]?.id !== questionId) throw new DomainError('Your question changed while coaching was loading. Continue from the current step.', 409);
      return send(reply);
    }
    const lessonRoute = path.match(/^\/lessons\/([^/]+)\/(start|complete|coach)$/);
    if (lessonRoute && method === 'POST') {
      const body = await readBody(request);
      const lesson = LESSONS.find(item => item.id === lessonRoute[1]);
      if (!lesson) throw new DomainError('Lesson not found.', 404);
      if (lessonRoute[2] === 'coach') {
        const message = textField(body.message, 'Coaching message', 1, 2000);
        limit(`coach:${userId}`, 20, 60_000);
        const context = mutate(userId, state => {
          const profile = state.snapshot.profile;
          if (!profile.placementComplete || LEVELS.indexOf(lesson.level) > LEVELS.indexOf(profile.level)) throw new DomainError('Take lessons at your current level or an earlier level after placement.', 409);
          state.coachCounts ??= {};
          const key = `lesson:${lesson.id}:${studyDate(now(), state.timeZone)}`;
          if ((state.coachCounts[key] ?? 0) >= 5) throw new DomainError('You have used five coaching turns for this lesson today. Review the lesson and practice the principle before asking again.', 429);
          state.coachCounts[key] = (state.coachCounts[key] ?? 0) + 1;
          return { profile, coachKey: key, progress: { ...state.snapshot.stats } };
        });
        try { return send(await ai.lessonCoach(lesson, message, context.profile, context.progress)); }
        catch (error) {
          mutate(userId, state => { if (state.coachCounts?.[context.coachKey]) state.coachCounts[context.coachKey]--; });
          throw new DomainError(error.message || 'Lesson coaching is unavailable. Review the lesson and try again.', error.status === 429 ? 429 : 503);
        }
      }
      if (lessonRoute[2] === 'start') return send(mutate(userId, state => {
        if (!state.snapshot.profile.placementComplete) throw new DomainError('Complete placement before taking lessons.', 409);
        if (!state.lessonStarted[lesson.id]) state.lessonStarted[lesson.id] = now();
        return state.snapshot;
      }));
      return send(mutate(userId, state => completeLesson(state, lesson.id, body.answer, now())));
    }
    if (path === '/ai/transcribe' && method === 'POST') {
      limit(`speech:${userId}`, 10, 60_000);
      const body = await readBody(request);
      const session = loadState(userId).state.snapshot.activeSession;
      if (!session || session.status !== 'active' || session.questions[session.index]?.kind !== 'behavioral') throw new DomainError('Record speech for the current behavioral interview question.', 409);
      const buffer = decodeBase64(body.base64);
      if (typeof body.mimeType !== 'string') throw new DomainError('Provide the audio recording format.');
      try { return send({ text: await ai.transcribe(buffer, body.mimeType) }); }
      catch (error) { throw new DomainError(error.message || 'Transcription is unavailable. Type your answer instead.', error.status === 429 ? 429 : 503); }
    }
    throw new DomainError('API route not found.', 404);
  }

  const server = createHTTPServer((request, response) => {
    handle(request, response).catch(error => {
      if (response.headersSent) { response.end(); return; }
      response.statusCode = error instanceof DomainError ? error.status : 500;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ error: error instanceof DomainError ? error.message : 'An unexpected server error occurred. Try again.' }));
      if (!(error instanceof DomainError) && options.logErrors !== false) console.error('Request failed:', error.message);
    });
  });
  server.requestTimeout = 60_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.on('close', () => { if (!closed) { closed = true; db.close(); } });
  return server;
}
