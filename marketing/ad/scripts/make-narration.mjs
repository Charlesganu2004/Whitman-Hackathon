// Generates the narrator's lines with Groq's Orpheus voice and writes the schedule the film reads.
// Run from marketing/ad:  node --env-file=../../.env scripts/make-narration.mjs
// The key is read from the environment and never printed. Orpheus accepts 200 characters per request.
import { mkdirSync, writeFileSync } from 'node:fs';

const FILM_SECONDS = 39.6;
const GAP = 0.15;
const MODEL = process.env.GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english';
const VOICE = process.env.NARRATOR_VOICE || 'troy';
// One vocal direction for the whole read. Orpheus takes it as a bracketed word at the start of the text.
const STYLE = (process.env.NARRATOR_STYLE ?? 'cheerful').toLowerCase().replace(/[^a-z ]/g, '').trim();
const DIRECTION = STYLE ? `[${STYLE}] ` : '';

// Target start times follow the captions in src/Film.tsx, so the voice says what the screen shows.
const LINES = [
  { at: 0.5, text: 'It always starts with one more scroll.' },
  { at: 5.2, text: "Unscroll lets you pick the apps that distract you, and keeps them locked until you pass today's interview." },
  { at: 12.3, text: 'Meet Jarvis, your AI interviewer. Answer out loud, or type it.' },
  { at: 17.2, text: 'You get feedback right away.' },
  { at: 19.8, text: 'Every answer is scored on three skills.' },
  { at: 23.2, text: 'No skipping. Feedback, then a different question.' },
  { at: 27.0, text: 'Behavioral answers get STAR feedback.' },
  { at: 30.4, text: 'Break earned.' },
  { at: 32.0, text: 'Every step, closer to ready.' },
  { at: 35.6, text: 'Unscroll. Less scrolling. More becoming.' },
];

const key = (process.env.GROQ_API_KEY || '').trim();
if (!key) { console.error('GROQ_API_KEY is not set. Add it to the repository .env first.'); process.exit(1); }

// Seconds of audio in a WAV buffer. Streaming encoders may leave the data size open, so fall back to the bytes present.
function wavSeconds(buffer) {
  let offset = 12, byteRate = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'fmt ') byteRate = buffer.readUInt32LE(offset + 16);
    if (id === 'data') {
      const bytes = size === 0 || size === 0xffffffff || offset + 8 + size > buffer.length ? buffer.length - offset - 8 : size;
      return byteRate ? bytes / byteRate : 0;
    }
    offset += 8 + size + (size % 2);
  }
  return 0;
}

async function speak(line) {
  const text = DIRECTION + line;
  if (text.length > 200) throw new Error(`Line is ${text.length} characters with its direction; the limit is 200.`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input: text, voice: VOICE, response_format: 'wav' }),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status !== 429) throw new Error(`Speech request failed with HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
    await new Promise(resolve => setTimeout(resolve, 20_000));
  }
  throw new Error('Speech request kept hitting the rate limit.');
}

mkdirSync('public', { recursive: true });
const schedule = [];
let free = 0;
for (const [index, line] of LINES.entries()) {
  const audio = await speak(line.text);
  const file = `narration-${String(index + 1).padStart(2, '0')}.wav`;
  writeFileSync(`public/${file}`, audio);
  const duration = Number(wavSeconds(audio).toFixed(2));
  const at = Number(Math.max(line.at, free).toFixed(2));
  free = at + duration + GAP;
  schedule.push({ file, at, duration, text: line.text });
  const drift = at - line.at;
  console.log(`${file}  ${at.toFixed(2)}s to ${(at + duration).toFixed(2)}s${drift > 0.05 ? `  (pushed ${drift.toFixed(2)}s later)` : ''}  ${line.text}`);
  await new Promise(resolve => setTimeout(resolve, 1500));
}
// A longer read can run past the end. Pull lines earlier from the back, each only as far as the gap before it allows.
let limit = FILM_SECONDS - 0.05;
for (let index = schedule.length - 1; index >= 0; index -= 1) {
  const line = schedule[index];
  if (line.at + line.duration > limit) line.at = Number(Math.max(0, limit - line.duration).toFixed(2));
  limit = line.at - GAP;
}
const overlap = schedule.some((line, index) => index > 0 && line.at < schedule[index - 1].at + schedule[index - 1].duration);
if (overlap) console.warn('The lines do not fit in the film without overlapping. Shorten one.');
for (const line of schedule) console.log(`final  ${line.at.toFixed(2)}s to ${(line.at + line.duration).toFixed(2)}s  ${line.text}`);
writeFileSync('src/narration.json', `${JSON.stringify(schedule, null, 2)}\n`);
console.log(`Wrote src/narration.json with ${schedule.length} lines. Voice: ${VOICE}${STYLE ? `, ${STYLE}` : ''}.`);
