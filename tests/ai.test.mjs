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

const providerEnv = ['AI_PROVIDER', 'AI_SPEECH_PROVIDER', 'GROQ_API_KEY', 'OPENAI_API_KEY', 'NVIDIA_API_KEY', 'NVIDIA_MODEL'];
async function withEnv(values, run) {
  const saved = Object.fromEntries(providerEnv.map(key => [key, process.env[key]]));
  for (const key of providerEnv) delete process.env[key];
  Object.assign(process.env, values);
  try { return await run(); }
  finally { for (const key of providerEnv) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } }
}
const nvidiaReply = content => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

test('NVIDIA strict grading posts the chat completions body to the hosted catalog with the default model', async () => {
  await withEnv({}, async () => {
    let captured;
    const ai = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test-secret', fetchImpl: async (url, options) => { captured = { url, options }; return nvidiaReply(JSON.stringify(feedback)); } });
    assert.equal(ai.provider, 'nvidia'); assert.equal(ai.enabled, true);
    const result = await ai.grade(spec.question, spec.example, profile);
    assert.equal(result.mode, 'ai'); assert.equal(result.passed, true); assert.equal(result.score, 90);
    assert.equal(captured.url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    assert.equal(captured.options.method, 'POST');
    assert.deepEqual(captured.options.headers, { Authorization: 'Bearer nvapi-test-secret', 'Content-Type': 'application/json' });
    const body = JSON.parse(captured.options.body);
    assert.deepEqual(Object.keys(body).sort(), ['chat_template_kwargs', 'max_tokens', 'messages', 'model', 'response_format', 'temperature']);
    assert.equal(body.model, 'nvidia/nemotron-3-super-120b-a12b');
    assert.equal(body.max_tokens, 2200); assert.equal(body.temperature, 0.2);
    assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
    assert.deepEqual(body.messages.map(message => message.role), ['system', 'user']);
    assert.match(body.messages[0].content, /untrusted data/);
    const input = JSON.parse(body.messages[1].content);
    assert.equal(input.answer, spec.example); assert.equal(input.candidate.resume, profile.resumeText);
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.name, 'interview_feedback');
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
    assert.equal(JSON.stringify(body).includes('nvapi-test-secret'), false);
  });
});

test('NVIDIA_MODEL and the model option override the default, and an empty value keeps it', async () => {
  const models = [];
  const fetchImpl = async (_url, options) => { models.push(JSON.parse(options.body)); return nvidiaReply(JSON.stringify(feedback)); };
  await withEnv({ NVIDIA_MODEL: 'nvidia/nemotron-3.5-lightning-30b-a3b' }, async () => {
    await createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl }).grade(spec.question, spec.example, profile);
    await createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', nvidiaModel: 'openai/gpt-oss-20b', fetchImpl }).grade(spec.question, spec.example, profile);
  });
  await withEnv({ NVIDIA_MODEL: '  ' }, async () => {
    await createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl }).grade(spec.question, spec.example, profile);
  });
  assert.deepEqual(models.map(body => body.model), ['nvidia/nemotron-3.5-lightning-30b-a3b', 'openai/gpt-oss-20b', 'nvidia/nemotron-3-super-120b-a12b']);
  assert.deepEqual(models[0].chat_template_kwargs, { enable_thinking: false });
  assert.equal('chat_template_kwargs' in models[1], false);
});

test('NVIDIA retries once with json_object and the schema in the prompt after a 400 or 422', async () => {
  for (const status of [400, 422]) {
    const bodies = [];
    const ai = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl: async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      return bodies.length === 1 ? new Response('{"detail":"unsupported response_format"}', { status }) : nvidiaReply(JSON.stringify(feedback));
    } });
    const result = await ai.grade(spec.question, spec.example, profile);
    assert.equal(result.passed, true);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0].response_format.type, 'json_schema');
    assert.deepEqual(bodies[1].response_format, { type: 'json_object' });
    assert.match(bodies[1].messages[0].content, /^You are a careful interview coach/);
    assert.match(bodies[1].messages[0].content, /matches this JSON schema/);
    assert.match(bodies[1].messages[0].content, /"required":\["passed","score","strengths","improvements","explanation"\]/);
    assert.equal(bodies[1].messages[1].content, bodies[0].messages[1].content);
    assert.equal(bodies[1].model, bodies[0].model);
  }
});

test('NVIDIA retries only once and only for 400 or 422', async () => {
  let calls = 0;
  const rejected = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl: async () => { calls += 1; return new Response('{}', { status: 400 }); } });
  await assert.rejects(rejected.grade(spec.question, spec.example, profile), /unavailable.*not recorded/);
  assert.equal(calls, 2);
  calls = 0;
  const serverError = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl: async () => { calls += 1; return new Response('{}', { status: 500 }); } });
  await assert.rejects(serverError.grade(spec.question, spec.example, profile), /unavailable.*not recorded/);
  assert.equal(calls, 1);
});

test('NVIDIA replies wrapped in think text or a code fence still grade, and coaching reports the provider', async () => {
  const wrapped = [
    `<think>The answer handles {"edge": "cases"} well, so I will score it high.</think>\n${JSON.stringify(feedback)}`,
    `Here is the JSON:\n\`\`\`json\n${JSON.stringify(feedback, null, 2)}\n\`\`\`\nHope that helps.`,
    `<think>draft</think>\n\`\`\`\n${JSON.stringify({ ...feedback, explanation: 'Use a fence such as ``` around code samples in your notes.' })}\n\`\`\``,
    `reasoning that never opened a tag</think>${JSON.stringify(feedback)}`,
  ];
  for (const content of wrapped) {
    const ai = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl: async () => nvidiaReply(content) });
    const result = await ai.grade(spec.question, spec.example, profile);
    assert.equal(result.passed, true); assert.equal(result.score, 90);
  }
  const fenced = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl: async () => nvidiaReply('```json\n' + JSON.stringify({ message: 'Trace a small array first.', hints: ['Check the boundary.'] }) + '\n```') });
  const reply = await fenced.coach(spec.question, 'How do I start?', { ...profile, level: 'beginner' }, { technical: 20 });
  assert.equal(reply.provider, 'nvidia'); assert.deepEqual(reply.hints, ['Check the boundary.']);
});

test('NVIDIA replies with an extra key, no JSON or no content fail closed', async () => {
  for (const content of [JSON.stringify({ ...feedback, extra: 'unexpected' }), '{"passed":true}', 'I cannot grade this.', '<think>unfinished', '', null]) {
    const ai = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl: async () => nvidiaReply(content) });
    await assert.rejects(ai.grade(spec.question, spec.example, profile), /AI returned invalid feedback/);
  }
  const lowScore = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl: async () => nvidiaReply(JSON.stringify({ ...feedback, score: 50 })) });
  assert.equal((await lowScore.grade(spec.question, spec.example, profile)).passed, false);
});

test('NVIDIA throttling and timeouts keep the rate-limit and timeout messages', async () => {
  const throttled = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl: async () => new Response('{}', { status: 429 }) });
  await assert.rejects(throttled.grade(spec.question, spec.example, profile), error => error.status === 429 && /reached the provider rate limit.*not recorded/.test(error.message));
  const timedOut = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', timeoutMs: 5, fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
    const keeper = setTimeout(() => reject(new Error('Abort was not delivered.')), 100);
    options.signal.addEventListener('abort', () => { clearTimeout(keeper); reject(options.signal.reason); }, { once: true });
  }) });
  await assert.rejects(timedOut.grade(spec.question, spec.example, profile), /timed out.*not recorded/);
});

test('NVIDIA grading takes speech from Groq, then OpenAI, and has none on its own', async () => {
  await withEnv({}, async () => {
    const requests = [];
    const fetchImpl = async (url, options) => { requests.push({ url, options }); return new Response(JSON.stringify({ text: 'I scoped the task and measured the result.' }), { status: 200 }); };
    const withGroq = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', groqApiKey: 'groq-test', apiKey: 'openai-test', fetchImpl });
    assert.equal(withGroq.provider, 'nvidia'); assert.equal(withGroq.speechProvider, 'groq'); assert.equal(withGroq.speechAvailable, true);
    await withGroq.transcribe(Buffer.from('bounded recording'), 'audio/mp4');
    assert.equal(requests[0].url, 'https://api.groq.com/openai/v1/audio/transcriptions');
    assert.equal(requests[0].options.headers.Authorization, 'Bearer groq-test');
    const withOpenAI = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', groqApiKey: '', apiKey: 'openai-test', fetchImpl });
    assert.equal(withOpenAI.speechProvider, 'openai');
    await withOpenAI.transcribe(Buffer.from('bounded recording'), 'audio/mp4');
    assert.equal(requests[1].url, 'https://api.openai.com/v1/audio/transcriptions');
    const alone = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', groqApiKey: '', apiKey: '', fetchImpl });
    assert.equal(alone.enabled, true); assert.equal(alone.speechProvider, null); assert.equal(alone.speechAvailable, false);
    await assert.rejects(alone.transcribe(Buffer.from('bounded recording'), 'audio/mp4'), /GROQ_API_KEY or OPENAI_API_KEY.*NVIDIA key cannot transcribe/);
    assert.equal(requests.length, 2);
  });
});

test('NVIDIA can never be the speech provider', async () => {
  await withEnv({}, async () => {
    assert.throws(() => createAI({ provider: 'nvidia', speechProvider: 'nvidia', nvidiaApiKey: 'nvapi-test' }), /AI_SPEECH_PROVIDER cannot be nvidia.*no speech-to-text/);
    process.env.AI_SPEECH_PROVIDER = 'nvidia';
    assert.throws(() => createAI({ nvidiaApiKey: 'nvapi-test' }), /AI_SPEECH_PROVIDER cannot be nvidia/);
    assert.throws(() => createAI({ provider: 'rubric' }), /AI_SPEECH_PROVIDER cannot be nvidia/);
    delete process.env.AI_SPEECH_PROVIDER;
    assert.throws(() => createAI({ provider: 'gemini' }), /AI_PROVIDER must be openai, groq, nvidia or rubric/);
    assert.throws(() => createAI({ provider: 'groq', speechProvider: 'gemini' }), /AI_SPEECH_PROVIDER must be openai, groq or rubric/);
  });
});

test('provider inference prefers Groq, then NVIDIA, then OpenAI, then the rubric', async () => {
  await withEnv({}, async () => {
    const pick = keys => { const ai = createAI(keys); return [ai.provider, ai.enabled, ai.speechProvider]; };
    assert.deepEqual(pick({ groqApiKey: 'g', nvidiaApiKey: 'n', apiKey: 'o' }), ['groq', true, 'groq']);
    assert.deepEqual(pick({ groqApiKey: '', nvidiaApiKey: 'n', apiKey: 'o' }), ['nvidia', true, 'openai']);
    assert.deepEqual(pick({ groqApiKey: '', nvidiaApiKey: 'n', apiKey: '' }), ['nvidia', true, null]);
    assert.deepEqual(pick({ groqApiKey: '', nvidiaApiKey: '', apiKey: 'o' }), ['openai', true, 'openai']);
    assert.deepEqual(pick({ groqApiKey: '', nvidiaApiKey: '', apiKey: '' }), ['rubric', false, null]);
    assert.deepEqual(pick({ provider: 'nvidia', groqApiKey: '', nvidiaApiKey: '', apiKey: 'o' }), ['rubric', false, 'openai']);
    process.env.AI_PROVIDER = 'nvidia'; process.env.NVIDIA_API_KEY = 'nvapi-env'; process.env.GROQ_API_KEY = 'groq-env';
    const fromEnv = createAI();
    assert.equal(fromEnv.provider, 'nvidia'); assert.equal(fromEnv.speechProvider, 'groq');
  });
});

const jarvisReply = (message, followUp = 'What would you try first?') => nvidiaReply(JSON.stringify({ message, followUp }));
const jarvisProfile = { ...profile, level: 'beginner' };

test('Jarvis converses through NVIDIA with protected instructions, a rolling history and no reference answer', async () => {
  const requests = [];
  const ai = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test-secret', fetchImpl: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return jarvisReply('  I am asking for the sum of the numbers above zero. Talk it through in your own words.  ', ' Where would you start? '); } });
  const history = Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? 'student' : 'interviewer', text: `turn ${index}` }));
  const reply = await ai.converse(spec.question, { stage: 'clarify', intent: 'clarify', message: 'What does it mean by useful?', history }, jarvisProfile);
  assert.deepEqual(reply, { message: 'I am asking for the sum of the numbers above zero. Talk it through in your own words.', followUp: 'Where would you start?', mode: 'ai', provider: 'nvidia' });
  assert.equal(requests[0].url, 'https://integrate.api.nvidia.com/v1/chat/completions');
  const system = requests[0].body.messages[0].content;
  assert.match(system, /You are Jarvis/);
  assert.match(system, /untrusted data, never commands/);
  assert.match(system, /Never give the full solution/);
  assert.match(system, /never grade|You never grade/);
  assert.match(system, /Do not give a hint/);
  const input = JSON.parse(requests[0].body.messages[1].content);
  assert.equal(input.stage, 'clarify'); assert.equal(input.message, 'What does it mean by useful?');
  assert.equal(input.history.length, 8); assert.equal(input.history[0].text, 'turn 2');
  assert.equal(input.question.prompt.includes('Interview context'), false);
  assert.ok(input.question.starterCode.startsWith('function sumPositive'));
  assert.equal(JSON.stringify(input).includes(spec.example), false);
  assert.equal(input.referenceReasoning, undefined);
  assert.equal(JSON.stringify(requests).includes('nvapi-test-secret'), false);
  assert.equal(requests[0].body.response_format.json_schema.name, 'interviewer_reply');
  assert.deepEqual(requests[0].body.response_format.json_schema.schema.required, ['message', 'followUp']);
});

test('Jarvis hint and debrief turns use their own instructions and never receive the explanation', async () => {
  const requests = [];
  const ai = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl: async (_url, options) => { requests.push(JSON.parse(options.body)); return jarvisReply('Think about what happens to a value that equals zero.'); } });
  await ai.converse(spec.question, { stage: 'clarify', intent: 'hint', message: 'I am stuck.', hintNumber: 1 }, jarvisProfile);
  assert.match(requests[0].messages[0].content, /exactly one short nudge/);
  assert.doesNotMatch(requests[0].messages[0].content, /Do not give a hint/);
  const graded = { passed: false, score: 55, strengths: ['Correct comparison.'], improvements: ['Explain the empty-array result.'], explanation: `Worked answer: ${spec.example}`, mode: 'ai' };
  await ai.converse(spec.question, { stage: 'debrief', message: 'Why did I lose points?', feedback: graded, answer: 'my answer text', history: [] }, jarvisProfile);
  assert.match(requests[1].messages[0].content, /already graded/);
  assert.match(requests[1].messages[0].content, /Do not contradict the score/);
  const input = JSON.parse(requests[1].messages[1].content);
  assert.deepEqual(input.feedback, { passed: false, score: 55, strengths: ['Correct comparison.'], improvements: ['Explain the empty-array result.'] });
  assert.equal(input.submittedAnswer, 'my answer text');
  assert.equal(JSON.stringify(input).includes(spec.example), false);
  assert.equal(JSON.stringify(input).includes('Worked answer'), false);
  const behavioral = QUESTION_SPECS.find(item => item.question.kind === 'behavioral');
  const star = { situation: 'Set the scene.', task: 'Own the task.', action: 'Show your action.', result: 'Name the result.' };
  await ai.converse(behavioral.question, { stage: 'debrief', message: 'How was my STAR?', feedback: { ...graded, star }, answer: 'story', history: [] }, jarvisProfile);
  assert.deepEqual(JSON.parse(requests[2].messages[1].content).feedback.star, star);
});

test('Jarvis refuses a reply that gives the full solution, the reference answer or an invalid shape', async () => {
  const bad = [
    { message: spec.example, followUp: 'Does that help?' },
    { message: 'Here you go.', followUp: 'function sumPositive(values) { return values.length; }' },
    { message: 'Try this.', followUp: 'const sumPositive = values => 0;' },
  ];
  for (const value of bad) {
    const ai = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl: async () => nvidiaReply(JSON.stringify(value)) });
    await assert.rejects(ai.converse(spec.question, { stage: 'clarify', message: 'Show me.', history: [] }, jarvisProfile), /full solution/);
  }
  for (const value of [{ message: 'Hi', followUp: 'Ok', extra: 'x' }, { message: '', followUp: 'Ok' }, { message: 'Hi' }, { message: 'Hi', followUp: 5 }, { message: 'x'.repeat(1501), followUp: 'Ok' }, { message: 'Hi', followUp: 'x'.repeat(501) }]) {
    const ai = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl: async () => nvidiaReply(JSON.stringify(value)) });
    await assert.rejects(ai.converse(spec.question, { stage: 'clarify', message: 'Hello', history: [] }, jarvisProfile), /Jarvis returned an invalid reply/);
  }
  const noJson = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl: async () => nvidiaReply('Sure, happy to help with that.') });
  await assert.rejects(noJson.converse(spec.question, { stage: 'clarify', message: 'Hello', history: [] }, jarvisProfile), /invalid reply/);
});

test('Jarvis provider failures read as a conversation problem and keep their status', async () => {
  const unavailable = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl: async () => new Response('{}', { status: 503 }) });
  const failure = await unavailable.converse(spec.question, { stage: 'clarify', message: 'Hello', history: [] }, jarvisProfile).catch(error => error);
  assert.match(failure.message, /^Jarvis is unavailable\. Try again in a moment\.$/);
  const throttled = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', fetchImpl: async () => new Response('{}', { status: 429 }) });
  const limited = await throttled.converse(spec.question, { stage: 'debrief', message: 'Hello', feedback, history: [] }, jarvisProfile).catch(error => error);
  assert.equal(limited.status, 429);
  assert.match(limited.message, /rate limit\. Try again in a moment\./);
  const slow = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', timeoutMs: 5, fetchImpl: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' })))) });
  const timedOut = await slow.converse(spec.question, { stage: 'clarify', message: 'Hello', history: [] }, jarvisProfile).catch(error => error);
  assert.match(timedOut.message, /^Jarvis timed out\. Try again in a moment\.$/);
  for (const error of [failure, limited, timedOut]) assert.doesNotMatch(error.message, /answer was not recorded/);
});

test('without a provider key Jarvis answers from the deterministic rubric', async () => {
  const ai = createAI({ provider: 'rubric', apiKey: '', groqApiKey: '', nvidiaApiKey: '', fetchImpl: async () => { throw new Error('no network'); } });
  const clarify = await ai.converse(spec.question, { stage: 'clarify', message: 'What does it ask?', history: [] }, jarvisProfile);
  assert.equal(clarify.mode, 'rubric'); assert.equal(clarify.provider, 'rubric');
  const hint = await ai.converse(spec.question, { stage: 'clarify', intent: 'hint', message: 'I am stuck.', history: [], hintNumber: 1 }, jarvisProfile);
  assert.ok(hint.message.includes(spec.question.hints[0]));
  const debrief = await ai.converse(spec.question, { stage: 'debrief', message: 'Why?', feedback: { ...feedback, passed: false, score: 40, improvements: ['Handle the empty array.'] }, history: [] }, jarvisProfile);
  assert.match(debrief.message, /Handle the empty array\./);
  for (const reply of [clarify, hint, debrief]) assert.equal(`${reply.message} ${reply.followUp}`.includes(spec.example), false);
});

function wavFile(samples, { rate = 24000, fill = 1 } = {}) {
  const data = Buffer.alloc(samples * 2, fill);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii'); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8, 'ascii'); header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36, 'ascii'); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
const audioReply = buffer => new Response(buffer, { status: 200, headers: { 'Content-Type': 'audio/wav' } });
const groqError = (status, code) => new Response(JSON.stringify({ error: { message: 'failed', type: 'invalid_request_error', code } }), { status, headers: { 'Content-Type': 'application/json' } });

test('Jarvis voice posts the documented Groq speech body and returns base64 WAV, independent of the grading provider', async () => {
  const requests = [];
  const ai = createAI({ provider: 'nvidia', nvidiaApiKey: 'nvapi-test', groqApiKey: 'gsk-test-secret', fetchImpl: async (url, options) => { requests.push({ url, options, body: JSON.parse(options.body) }); return audioReply(wavFile(100)); } });
  assert.equal(ai.provider, 'nvidia'); assert.equal(ai.voiceAvailable, true);
  assert.equal(ai.ttsModel, 'canopylabs/orpheus-v1-english'); assert.equal(ai.ttsVoice, 'troy');
  const result = await ai.speak('Tell me about a time you led a team.');
  assert.equal(result.mimeType, 'audio/wav');
  assert.deepEqual(Buffer.from(result.audio, 'base64'), wavFile(100));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.groq.com/openai/v1/audio/speech');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer gsk-test-secret');
  assert.deepEqual(requests[0].body, { model: 'canopylabs/orpheus-v1-english', input: '[cheerful] Tell me about a time you led a team.', voice: 'troy', response_format: 'wav' });
  const custom = createAI({ groqApiKey: 'gsk-test', ttsModel: 'canopylabs/other', ttsVoice: 'hannah', fetchImpl: async (_url, options) => { requests.push({ body: JSON.parse(options.body) }); return audioReply(wavFile(10)); } });
  await custom.speak('Hello there.');
  assert.equal(requests.at(-1).body.model, 'canopylabs/other'); assert.equal(requests.at(-1).body.voice, 'hannah');
  const absent = createAI({ provider: 'rubric', apiKey: '', groqApiKey: '', nvidiaApiKey: 'nvapi-test', fetchImpl: async () => { throw new Error('no network'); } });
  assert.equal(absent.voiceAvailable, false);
  await assert.rejects(absent.speak('Hello there.'), /GROQ_API_KEY/);
});

test('Jarvis voice reads its model and voice from the environment and ignores empty values', async () => {
  const saved = { model: process.env.GROQ_TTS_MODEL, voice: process.env.GROQ_TTS_VOICE };
  try {
    process.env.GROQ_TTS_MODEL = 'canopylabs/env-model'; process.env.GROQ_TTS_VOICE = 'austin';
    const fromEnv = createAI({ groqApiKey: 'gsk-test', fetchImpl: async () => audioReply(wavFile(1)) });
    assert.equal(fromEnv.ttsModel, 'canopylabs/env-model'); assert.equal(fromEnv.ttsVoice, 'austin');
    process.env.GROQ_TTS_MODEL = '  '; process.env.GROQ_TTS_VOICE = '';
    const empty = createAI({ groqApiKey: 'gsk-test', fetchImpl: async () => audioReply(wavFile(1)) });
    assert.equal(empty.ttsModel, 'canopylabs/orpheus-v1-english'); assert.equal(empty.ttsVoice, 'troy');
  } finally {
    for (const [name, value] of [['GROQ_TTS_MODEL', saved.model], ['GROQ_TTS_VOICE', saved.voice]]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});

test('Jarvis voice splits long text on sentence boundaries inside the 200 character limit and joins the audio', async () => {
  const sentences = Array.from({ length: 12 }, (_, index) => `This is sentence number ${index + 1} of a long question about your project work.`);
  const long = sentences.join(' ');
  assert.ok(long.length > 600);
  const inputs = [];
  const ai = createAI({ groqApiKey: 'gsk-test', ttsStyle: '', fetchImpl: async (_url, options) => { const input = JSON.parse(options.body).input; inputs.push(input); return audioReply(wavFile(50 + inputs.length)); } });
  const result = await ai.speak(long);
  assert.ok(inputs.length >= 3 && inputs.length <= 4, `chunks: ${inputs.length}`);
  for (const input of inputs) { assert.ok(input.length <= 200, `${input.length}`); assert.match(input, /[.]$/); assert.ok(sentences.some(sentence => input.startsWith(sentence.slice(0, 20)))); }
  assert.ok(inputs.join(' ').length <= 600, 'a request never speaks more than about 600 characters');
  assert.ok(inputs.join(' ').length > 400);
  const joined = Buffer.from(result.audio, 'base64');
  assert.equal(joined.toString('ascii', 0, 4), 'RIFF'); assert.equal(joined.toString('ascii', 8, 12), 'WAVE');
  const total = [...inputs.keys()].reduce((sum, index) => sum + (50 + index + 1) * 2, 0);
  assert.equal(joined.readUInt32LE(40), total, 'the data chunk holds every piece');
  assert.equal(joined.readUInt32LE(4), joined.length - 8);
  assert.equal(joined.length, 44 + total);
  const oversized = 'word '.repeat(120).trim();
  const pieces = [];
  const solo = createAI({ groqApiKey: 'gsk-test', ttsStyle: '', fetchImpl: async (_url, options) => { pieces.push(JSON.parse(options.body).input); return audioReply(wavFile(5)); } });
  await solo.speak(oversized);
  assert.ok(pieces.length >= 3 && pieces.every(piece => piece.length <= 200), 'one very long sentence is cut at word boundaries');
});

test("Jarvis voice speaks with the one direction the host sets, and spoken text can never add its own", async () => {
  const inputs = [];
  const ai = createAI({ groqApiKey: 'gsk-test', fetchImpl: async (_url, options) => { inputs.push(JSON.parse(options.body).input); return audioReply(wavFile(5)); } });
  await ai.speak('For [3, -2, 0, 5] it must return 8.   [whisper] Then   explain it.');
  assert.deepEqual(inputs, ['[cheerful] For (3, -2, 0, 5) it must return 8. (whisper) Then explain it.']);
  assert.equal(ai.ttsStyle, 'cheerful');
  const plain = [];
  const none = createAI({ groqApiKey: 'gsk-test', ttsStyle: '', fetchImpl: async (_url, options) => { plain.push(JSON.parse(options.body).input); return audioReply(wavFile(5)); } });
  await none.speak('Tell me about a project.');
  assert.deepEqual(plain, ['Tell me about a project.'], 'an empty style sends no direction');
  const styled = [];
  const excited = createAI({ groqApiKey: 'gsk-test', ttsStyle: ' Excited]! [whisper ', fetchImpl: async (_url, options) => { styled.push(JSON.parse(options.body).input); return audioReply(wavFile(5)); } });
  await excited.speak('word '.repeat(120).trim());
  assert.equal(excited.ttsStyle, 'excited whisper', 'a style keeps only letters and spaces');
  assert.ok(styled.length >= 3 && styled.every(piece => piece.startsWith('[excited whisper] ') && piece.length <= 200), 'every piece carries the direction and stays inside the limit');
  await assert.rejects(ai.speak('   '), /no text/);
});

test('Jarvis voice maps the Groq terms error, throttling and failures to clear fallback messages', async () => {
  const speakWith = fetchImpl => createAI({ groqApiKey: 'gsk-test', timeoutMs: 20, fetchImpl }).speak('Hello there.').catch(error => error);
  const terms = await speakWith(async () => groqError(400, 'model_terms_required'));
  assert.match(terms.message, /canopylabs\/orpheus-v1-english model terms accepted in the Groq console/); assert.equal(terms.status, 503);
  const throttled = await speakWith(async () => groqError(429, 'rate_limit_exceeded'));
  assert.equal(throttled.status, 429); assert.match(throttled.message, /reached the provider rate limit/);
  for (const response of [() => groqError(400, 'invalid_request_body'), () => groqError(500, 'internal_server_error'), () => new Response('not json', { status: 502 })]) {
    const failure = await speakWith(async () => response());
    assert.equal(failure.status, 503); assert.match(failure.message, /Jarvis voice is unavailable\. The device voice will be used instead\./);
  }
  const offline = await speakWith(async () => { throw new TypeError('fetch failed'); });
  assert.match(offline.message, /voice is unavailable/);
  const slow = await speakWith(async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' })))));
  assert.match(slow.message, /voice timed out/);
  for (const reply of [Buffer.from('not audio at all, just text that is long enough to pass the header length check'), wavFile(0).subarray(0, 20)]) {
    const garbled = await createAI({ groqApiKey: 'gsk-test', fetchImpl: async () => audioReply(reply) }).speak('Hello. There. Again.').catch(error => error);
    assert.equal(garbled.status, 503);
  }
  let call = 0;
  const mismatched = await createAI({ groqApiKey: 'gsk-test', fetchImpl: async () => audioReply(wavFile(5, { rate: ++call === 1 ? 24000 : 16000 })) }).speak('First sentence here is quite long, so it fills a whole piece of the speech request. '.repeat(3)).catch(error => error);
  assert.equal(mismatched.status, 503); assert.match(mismatched.message, /cannot be played/);
  for (const error of [terms, throttled, offline, slow]) assert.ok(!/gsk-test/.test(error.message), 'no key in messages');
});
