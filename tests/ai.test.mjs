import test from 'node:test';
import assert from 'node:assert/strict';
import { createAI } from '../server/ai.mjs';
import { LESSONS, QUESTION_SPECS } from '../src/core/content.ts';

const profile = { major: 'Computer Science', target: 'internship', targetCompanies: ['Example Company'], resumeText: 'JavaScript project and community research.' };
const spec = QUESTION_SPECS[0];
const feedback = { passed: true, score: 90, strengths: ['Correct reasoning.'], improvements: [], explanation: 'You handle the boundary and explain the cost.' };

test('AI grading sends resume context, protected instructions and strict schema server-side', async () => {
  let request;
  const ai = createAI({ provider: 'openai', apiKey: 'test-secret', fetchImpl: async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(feedback) }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } });
  const result = await ai.grade(spec.question, spec.example, profile);
  assert.equal(result.mode, 'ai'); assert.equal(result.passed, true);
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.options.headers.Authorization, 'Bearer test-secret');
  const body = JSON.parse(request.options.body);
  assert.equal(body.store, false); assert.equal(body.text.format.type, 'json_schema'); assert.equal(body.text.format.strict, true);
  assert.match(body.instructions, /untrusted data/);
  const input = JSON.parse(body.input[0].content[0].text);
  assert.equal(input.candidate.resume, profile.resumeText); assert.equal(input.answer, spec.example);
  assert.deepEqual(input.candidate.targetCompanies, profile.targetCompanies);
  assert.equal(JSON.stringify(body).includes('test-secret'), false);
});

test('invalid AI feedback and provider errors never grant a pass', async () => {
  const invalid = createAI({ provider: 'openai', apiKey: 'test', fetchImpl: async () => new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: '{"passed":true}' }] }] }), { status: 200 }) });
  await assert.rejects(invalid.grade(spec.question, spec.example, profile), /invalid feedback/);
  const unavailable = createAI({ provider: 'openai', apiKey: 'test', fetchImpl: async () => new Response('{}', { status: 503 }) });
  await assert.rejects(unavailable.grade(spec.question, spec.example, profile), /not recorded/);
  const lowScore = createAI({ provider: 'openai', apiKey: 'test', fetchImpl: async () => new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ ...feedback, score: 50 }) }] }] }), { status: 200 }) });
  assert.equal((await lowScore.grade(spec.question, spec.example, profile)).passed, false);
});

test('speech transcription sends a supported binary recording as multipart', async () => {
  let captured;
  const ai = createAI({ provider: 'openai', speechProvider: 'openai', apiKey: 'test', fetchImpl: async (url, options) => { captured = { url, options }; return new Response(JSON.stringify({ text: 'I organized a project and learned from the result.' }), { status: 200 }); } });
  const text = await ai.transcribe(Buffer.from('bounded recording'), 'audio/mp4');
  assert.match(text, /organized/);
  assert.equal(captured.url, 'https://api.openai.com/v1/audio/transcriptions');
  assert.ok(captured.options.body instanceof FormData);
  assert.equal(captured.options.body.get('file').name, 'answer.m4a');
  assert.equal(captured.options.headers['Content-Type'], undefined);
  await assert.rejects(ai.transcribe(Buffer.from('data'), 'application/pdf'), /recording/);
});

test('Groq strict grading and STAR guidance use the documented server-only endpoint', async () => {
  const behavior = QUESTION_SPECS.find(item => item.question.kind === 'behavioral');
  const star = { situation: 'Name the project context.', task: 'Make your personal responsibility explicit.', action: 'Explain why you chose the action.', result: 'Give an honest observed result and reflection.' };
  let captured;
  const ai = createAI({ provider: 'groq', groqApiKey: 'groq-test-secret', fetchImpl: async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ...feedback, star }) } }] }), { status: 200 });
  } });
  const result = await ai.grade(behavior.question, behavior.example, profile);
  assert.deepEqual(result.star, star);
  assert.equal(captured.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(captured.options.headers.Authorization, 'Bearer groq-test-secret');
  const body = JSON.parse(captured.options.body);
  assert.equal(body.model, 'openai/gpt-oss-20b');
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
  assert.deepEqual(body.response_format.json_schema.schema.properties.star.required, ['situation', 'task', 'action', 'result']);
  assert.match(body.messages[0].content, /Never invent resume/);
  assert.equal(JSON.stringify(body).includes('groq-test-secret'), false);
});

test('Groq rejects malformed JSON and incomplete or oversized STAR feedback', async () => {
  const behavior = QUESTION_SPECS.find(item => item.question.kind === 'behavioral');
  for (const value of ['not JSON', JSON.stringify(feedback), JSON.stringify({ ...feedback, star: { situation: 'context', task: '', action: 'action', result: 'result' } }), JSON.stringify({ ...feedback, star: { situation: 'x'.repeat(1001), task: 'task', action: 'action', result: 'result' } })]) {
    const ai = createAI({ provider: 'groq', groqApiKey: 'test', fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: value } }] }), { status: 200 }) });
    await assert.rejects(ai.grade(behavior.question, behavior.example, profile), /invalid (?:STAR )?feedback/);
  }
});

test('provider throttling and timeout preserve an unrecorded answer', async () => {
  const throttled = createAI({ provider: 'groq', groqApiKey: 'test', fetchImpl: async () => new Response('{}', { status: 429 }) });
  await assert.rejects(throttled.grade(spec.question, spec.example, profile), error => error.status === 429 && /not recorded/.test(error.message));
  const timedOut = createAI({ provider: 'groq', groqApiKey: 'test', timeoutMs: 5, fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
    const keeper = setTimeout(() => reject(new Error('Abort was not delivered.')), 100);
    options.signal.addEventListener('abort', () => { clearTimeout(keeper); reject(options.signal.reason); }, { once: true });
  }) });
  await assert.rejects(timedOut.grade(spec.question, spec.example, profile), /timed out.*not recorded/);
});

test('speech can use Groq independently of rubric grading', async () => {
  let captured;
  const ai = createAI({ provider: 'rubric', speechProvider: 'groq', groqApiKey: 'speech-key', fetchImpl: async (url, options) => { captured = { url, options }; return new Response(JSON.stringify({ text: 'I clarified my task and learned from the result.' }), { status: 200 }); } });
  assert.equal(ai.enabled, false);
  assert.equal(ai.speechAvailable, true);
  assert.equal(ai.speechProvider, 'groq');
  await ai.transcribe(Buffer.from('bounded voice recording'), 'audio/mp4');
  assert.equal(captured.url, 'https://api.groq.com/openai/v1/audio/transcriptions');
  assert.equal(captured.options.body.get('model'), 'whisper-large-v3-turbo');
  assert.equal(captured.options.body.get('file').name, 'answer.m4a');
});

test('AI coaching uses progress and bounded hints without exposing reference solutions', async () => {
  let captured;
  const ai = createAI({ provider: 'groq', groqApiKey: 'test', fetchImpl: async (_url, options) => {
    captured = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ message: 'Trace a small array before deciding how to update the total.', hints: ['Check which values satisfy the comparison.'] }) } }] }), { status: 200 });
  } });
  const response = await ai.coach(spec.question, 'How do I start?', { ...profile, level: 'beginner' }, { technical: 35, recentMistakes: [{ improvements: ['Handle empty input.'] }] });
  assert.equal(response.provider, 'groq');
  assert.equal(response.hints.length, 1);
  assert.match(captured.messages[0].content, /Never provide the full final answer/);
  const input = JSON.parse(captured.messages[1].content);
  assert.equal(input.progress.technical, 35);
  assert.deepEqual(input.candidate.targetCompanies, profile.targetCompanies);
  assert.equal(input.referenceReasoning, undefined);
  assert.equal(JSON.stringify(input).includes(spec.example), false);
});

test('technical coaching rejects invalid hints and a complete exercise function', async () => {
  for (const value of [{ message: 'Hint', hints: [] }, { message: 'function sumPositive(values) { return 999; }', hints: ['Copy this function.'] }]) {
    const ai = createAI({ provider: 'groq', groqApiKey: 'test', fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }), { status: 200 }) });
    await assert.rejects(ai.coach(spec.question, 'Explain one idea.', { ...profile, level: 'beginner' }, { technical: 10 }), /invalid coaching|full solution/);
  }
});

test('lesson coaching supplies lesson principles without correct choice or options', async () => {
  let captured;
  const ai = createAI({ provider: 'groq', groqApiKey: 'test', fetchImpl: async (_url, options) => {
    captured = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ message: 'Describe a situation where defining the constraint changes your approach.', hints: ['State what success means before comparing methods.'] }) } }] }), { status: 200 });
  } });
  const lesson = LESSONS[0];
  const reply = await ai.lessonCoach(lesson, 'Help me understand the principle.', { ...profile, level: 'beginner' }, { levelPracticeDays: 0 });
  assert.equal(reply.mode, 'ai');
  const input = JSON.parse(captured.messages[1].content);
  assert.equal(input.lesson.title, lesson.title);
  assert.equal(input.lesson.knowledgeCheckPrompt, lesson.check.prompt);
  assert.equal(input.lesson.correct, undefined);
  assert.equal(input.lesson.choices, undefined);
  assert.equal(input.lesson.check, undefined);
  assert.deepEqual(input.candidate.targetCompanies, profile.targetCompanies);
  assert.match(captured.messages[0].content, /Do not select, identify, rank or eliminate/);
});
