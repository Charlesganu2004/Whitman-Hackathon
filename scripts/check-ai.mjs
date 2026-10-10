import { createAI } from '../server/ai.mjs';
import { QUESTION_SPECS } from '../src/core/content.ts';

// One live structured grading call with fictional data. Keys are read by createAI and are never printed.
const spec = QUESTION_SPECS.find(item => item.question.kind === 'technical');
const profile = { major: 'Computer Science', target: 'internship', targetCompanies: [], resumeText: 'Fictional candidate with a JavaScript course project.' };

let ai;
try { ai = createAI(); }
catch (error) {
  console.error(`FAIL: AI provider settings are invalid. ${error.message}`);
  process.exit(1);
}

if (!ai.enabled) {
  console.log('Rubric mode is active: no usable GROQ_API_KEY, NVIDIA_API_KEY or OPENAI_API_KEY was found, so no provider request was sent.');
  console.log('Free NVIDIA key: sign in at https://build.nvidia.com, open a model page with the Free Endpoint tag, click Get API Key, then add NVIDIA_API_KEY=<key> and AI_PROVIDER=nvidia to .env. See docs/NVIDIA.md.');
  process.exit(0);
}

console.log(`Provider: ${ai.provider}`);
console.log(`Model: ${ai.model}`);
const started = performance.now();
try {
  await ai.grade(spec.question, spec.example, profile);
  console.log(`Latency: ${Math.round(performance.now() - started)} ms`);
  console.log('Reply validated: yes');
} catch (error) {
  console.log(`Latency: ${Math.round(performance.now() - started)} ms`);
  console.log('Reply validated: no');
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
