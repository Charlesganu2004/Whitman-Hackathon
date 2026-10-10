// Generates the narrator's lines with Groq's Orpheus voice and writes the schedule the film reads.
// Run from marketing/ad:  node --env-file=../../.env scripts/make-narration.mjs
// The key is read from the environment and never printed. Orpheus accepts 200 characters per request.
import { mkdirSync, writeFileSync } from 'node:fs';

const FILM_SECONDS = 39.6;
const GAP = 0.2;
const MODEL = process.env.GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english';
const VOICE = process.env.NARRATOR_VOICE || 'troy';

// Target start times follow the captions in src/Film.tsx, so the voice says what the screen shows.
const LINES = [
  { at: 0.5, text: 'It always starts with one more scroll.' },
  { at: 5.2, text: "Unscroll lets you pick the apps that distract you, and keeps them locked until you pass today's interview." },
  { at: 12.3, text: 'Meet Jarvis, your AI interviewer. Answer out loud, or type it.' },
  { at: 17.2, text: 'You get feedback right away.' },
  { at: 19.8, text: 'Every answer is scored on three skills.' },
  { at: 23.2, text: 'No skipping. You get feedback, then a different question.' },
  { at: 26.8, text: 'Behavioral answers get STAR feedback.' },
  { at: 30.0, text: 'Break earned.' },
  { at: 32.5, text: 'Every step, closer to ready.' },
  { at: 36.0, text: 'Unscroll. Less scrolling. More becoming.' },
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

async function speak(text) {
  if (text.length > 200) throw new Error(`Line is ${text.length} characters; the limit is 200.`);
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
const end = schedule.at(-1).at + schedule.at(-1).duration;
if (end > FILM_SECONDS) console.warn(`Narration ends at ${end.toFixed(2)}s, after the film (${FILM_SECONDS}s). Shorten a line.`);
writeFileSync('src/narration.json', `${JSON.stringify(schedule, null, 2)}\n`);
console.log(`Wrote src/narration.json with ${schedule.length} lines. Voice: ${VOICE}.`);
