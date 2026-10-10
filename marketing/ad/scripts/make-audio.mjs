// Synthesises the film's soundtrack from oscillators, noise and envelopes. No samples, no
// dependencies. Writes public/soundtrack.wav: 48 kHz, stereo, 16-bit, exactly as long as the film.
//
//   node scripts/make-audio.mjs
//
// Cue times are the ones in SCRIPT.md. If a scene is re-timed, change the cue here as well.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 48000;
const DURATION = 39.6;
const N = Math.round(SR * DURATION);
const BEAT = 0.6;
const BAR = 2.4;
const MUSIC_END = 38.4;
const PEAK_DBFS = -4;

const dry = [new Float32Array(N), new Float32Array(N)];
const wet = [new Float32Array(N), new Float32Array(N)];

// A fixed-seed generator, so two runs write the same file.
let state = 0x1f2e3d4c;
const noise = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
};

const TAU = Math.PI * 2;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, p) => a + (b - a) * p;

/** Adds a mono voice to the mix. `voice(t)` is called with seconds since its start. */
const play = (start, length, voice, { pan = 0, send = 0 } = {}) => {
  const first = Math.round(start * SR);
  const count = Math.round(length * SR);
  const left = Math.cos(((pan + 1) * Math.PI) / 4);
  const right = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < count; i++) {
    const at = first + i;
    if (at < 0 || at >= N) continue;
    const sample = voice(i / SR, typeof pan === 'function' ? pan(i / count) : 0);
    dry[0][at] += sample * left;
    dry[1][at] += sample * right;
    if (send > 0) {
      wet[0][at] += sample * left * send;
      wet[1][at] += sample * right * send;
    }
  }
};

/** Band-passed noise whose centre sweeps from `from` to `to` Hz. `shape(p)` is its loudness over 0 to 1. */
const sweep = (start, length, from, to, gain, shape, panFrom = 0, panTo = 0) => {
  const first = Math.round(start * SR);
  const count = Math.round(length * SR);
  let low = 0;
  let band = 0;
  for (let i = 0; i < count; i++) {
    const at = first + i;
    const p = i / count;
    const cutoff = from * (to / from) ** p;
    const f = 2 * Math.sin((Math.PI * cutoff) / SR);
    const high = noise() - low - 0.7 * band;
    band += f * high;
    low += f * band;
    if (at < 0 || at >= N) continue;
    const sample = band * gain * shape(p);
    const pan = lerp(panFrom, panTo, p);
    const left = Math.cos(((pan + 1) * Math.PI) / 4);
    const right = Math.sin(((pan + 1) * Math.PI) / 4);
    dry[0][at] += sample * left;
    dry[1][at] += sample * right;
    wet[0][at] += sample * left * 0.3;
    wet[1][at] += sample * right * 0.3;
  }
};
const bell = (p) => Math.sin(Math.PI * p) ** 2;
const swellIn = (p) => p ** 2 * (p > 0.96 ? (1 - p) / 0.04 : 1);

const attack = (t, time = 0.003) => Math.min(1, t / time);

const tick = (at, midi, gain = 0.08, pan = 0.2, decay = 0.05) =>
  play(at, decay * 8, (t) => attack(t) * Math.exp(-t / decay) * gain * (Math.sin(TAU * hz(midi) * t) + 0.3 * Math.sin(TAU * hz(midi) * 2 * t)), { pan, send: 0.35 });

const blip = (at, from, to, gain = 0.06, pan = 0.3, length = 0.09) =>
  play(
    at,
    length,
    (t) => {
      const p = t / length;
      const f = from * (to / from) ** p;
      return Math.sin(TAU * (from * t + ((f - from) * t) / 2)) * gain * Math.sin(Math.PI * p);
    },
    { pan, send: 0.25 },
  );

const click = (at, gain = 0.05, pan = 0.2) => {
  let last = 0;
  play(
    at,
    0.02,
    (t) => {
      const n = noise();
      const edge = n - last;
      last = n;
      return edge * gain * Math.exp(-t / 0.004);
    },
    { pan, send: 0.15 },
  );
};

const thump = (at, gain = 0.4, from = 110, to = 42, decay = 0.2, pan = 0) =>
  play(
    at,
    decay * 6,
    (t) => {
      const glide = 0.035;
      const phase = TAU * (to * t + (from - to) * glide * (1 - Math.exp(-t / glide)));
      return attack(t, 0.002) * Math.exp(-t / decay) * gain * Math.sin(phase);
    },
    { pan },
  );

/** The mechanical event: a short metallic strike over a low thump. */
const latch = (at, gain = 0.5, pan = 0.25) => {
  const partials = [1320, 1985, 2740, 3520, 4410];
  play(at, 0.5, (t) => attack(t, 0.001) * gain * 0.22 * partials.reduce((sum, f, i) => sum + Math.sin(TAU * f * t) * Math.exp(-t / (0.11 - i * 0.015)), 0), { pan, send: 0.5 });
  click(at, gain * 0.3, pan);
  thump(at, gain * 0.8, 120, 46, 0.22, pan * 0.4);
};

const stab = (at, notes, gain = 0.1, decay = 1.0) =>
  notes.forEach((midi, index) =>
    play(
      at + index * 0.004,
      decay * 5,
      (t) => attack(t, 0.006) * Math.exp(-t / decay) * (gain / Math.sqrt(notes.length)) * (Math.sin(TAU * hz(midi) * t) + 0.35 * Math.sin(TAU * hz(midi) * 2 * t) * Math.exp(-t / (decay * 0.4)) + 0.12 * Math.sin(TAU * hz(midi) * 3 * t) * Math.exp(-t / (decay * 0.25))),
      { pan: lerp(-0.6, 0.6, notes.length === 1 ? 0.5 : index / (notes.length - 1)), send: 0.6 },
    ),
  );

const pluck = (at, midi, gain = 0.07, pan = 0.3) =>
  play(at, 1.2, (t) => attack(t, 0.004) * Math.exp(-t / 0.22) * gain * (Math.sin(TAU * hz(midi) * t) + 0.4 * Math.sin(TAU * hz(midi) * 2 * t) * Math.exp(-t / 0.08)), { pan, send: 0.55 });

const chime = (at, midi, gain = 0.06, pan = 0.3) =>
  play(at, 2.2, (t) => attack(t, 0.003) * gain * (Math.sin(TAU * hz(midi) * t) * Math.exp(-t / 0.5) + 0.3 * Math.sin(TAU * hz(midi) * 2.76 * t) * Math.exp(-t / 0.16)), { pan, send: 0.6 });

const kick = (at, gain = 0.34) => thump(at, gain, 118, 47, 0.13);

const hat = (at, gain = 0.03) => {
  let last = 0;
  play(
    at,
    0.08,
    (t) => {
      const n = noise();
      const edge = n - last;
      last = n;
      return edge * gain * Math.exp(-t / 0.016);
    },
    { pan: 0.25, send: 0.1 },
  );
};

const bass = (at, midi, gain = 0.2, decay = 0.34) =>
  play(at, decay * 5, (t) => attack(t, 0.008) * Math.exp(-t / decay) * gain * (Math.sin(TAU * hz(midi) * t) + 0.22 * Math.sin(TAU * hz(midi) * 2 * t)));

/** A soft additive pad. `bright` 0 to 1 opens its upper harmonics. */
const pad = (at, length, notes, gain, bright) => {
  const rise = 0.7;
  const fall = 1.1;
  notes.forEach((midi, index) => {
    for (const detune of [-1, 1]) {
      const f = hz(midi) * 2 ** ((detune * 4) / 1200);
      const drift = 0.11 + index * 0.023;
      play(
        at,
        length + fall,
        (t) => {
          const envelope = Math.min(1, t / rise) * Math.min(1, Math.max(0, (length + fall - t) / fall));
          let sum = 0;
          for (let h = 1; h <= 5; h++) sum += Math.sin(TAU * f * h * t + index) / h ** (2.7 - 1.3 * bright);
          return sum * envelope * (gain / notes.length) * (0.85 + 0.15 * Math.sin(TAU * drift * t));
        },
        { pan: detune * (0.25 + 0.1 * index), send: 0.5 },
      );
    }
  });
};

// ---- Harmony: F major and D minor, one chord a bar. ----
const Dm9 = { root: 38, notes: [50, 53, 57, 60, 64] };
const Bb = { root: 34, notes: [46, 50, 53, 57, 62] };
const F = { root: 41, notes: [45, 53, 57, 60, 65] };
const Csus = { root: 36, notes: [48, 55, 60, 62, 67] };
const Fadd9 = { root: 41, notes: [41, 53, 57, 60, 67] };

const BARS = [
  { at: 2.4, chord: Dm9, gain: 0.1, bright: 0.2 },
  { at: 4.8, chord: Bb, gain: 0.11, bright: 0.25 },
  { at: 7.2, chord: F, gain: 0.12, bright: 0.3 },
  { at: 9.6, chord: Csus, gain: 0.12, bright: 0.35 },
  { at: 12.0, chord: Dm9, gain: 0.14, bright: 0.5 },
  { at: 14.4, chord: Bb, gain: 0.13, bright: 0.4 },
  { at: 16.8, chord: F, gain: 0.14, bright: 0.5 },
  { at: 19.2, chord: Csus, gain: 0.14, bright: 0.5 },
  { at: 21.6, chord: Dm9, gain: 0.14, bright: 0.5 },
  { at: 24.0, chord: Bb, gain: 0.1, bright: 0.08 },
  { at: 26.4, chord: F, gain: 0.14, bright: 0.5 },
  { at: 28.8, chord: Csus, gain: 0.13, bright: 0.6, length: 1.2 },
  { at: 30.0, chord: F, gain: 0.16, bright: 0.75, length: 1.2 },
  { at: 31.2, chord: Bb, gain: 0.15, bright: 0.6 },
  { at: 33.6, chord: Csus, gain: 0.15, bright: 0.6 },
  { at: 36.0, chord: Fadd9, gain: 0.16, bright: 0.55 },
];
for (const bar of BARS) pad(bar.at, bar.length ?? BAR, bar.chord.notes, bar.gain, bar.bright);

// ---- Pulse: one soft kick a beat from 4.8, bass and hat from the drop at 12.0. ----
const silent = (t) => (t >= 14.4 && t < 16.8) || (t >= 23.35 && t < 24.0) || (t >= 29.35 && t < 30.0);
const muted = (t) => t >= 24.0 && t < 26.4;
for (let t = 4.8; t < 36.0 - 0.01; t += BEAT) {
  if (silent(t)) continue;
  kick(t, t < 12.0 ? 0.2 : muted(t) ? 0.14 : 0.34);
}
for (let t = 12.0; t < 36.0 - 0.01; t += BEAT) {
  if (silent(t) || muted(t)) continue;
  hat(t + BEAT / 2, 0.034);
  if (t >= 30.0) {
    hat(t + BEAT / 4, 0.014);
    hat(t + (BEAT * 3) / 4, 0.014);
  }
}
for (const bar of BARS) {
  if (bar.at < 12.0 || bar.at >= 36.0) continue;
  const voiceOnly = bar.at === 14.4;
  const hits = voiceOnly || muted(bar.at) ? [0] : bar.length ? [0, 0.6] : [0, 0.9, 1.5];
  for (const offset of hits) bass(bar.at + offset, bar.chord.root, voiceOnly ? 0.16 : 0.2, voiceOnly ? 0.9 : 0.34);
}

// ---- 1. The feed, the name ----
sweep(0.2, 0.55, 400, 3200, 0.16, bell, 0.5, 0.1);
sweep(0.9, 0.8, 500, 4800, 0.22, bell, 0.5, 0.0);
play(0.2, 1.6, (t) => 0.035 * (t / 1.6) ** 1.5 * Math.sin(TAU * (hz(72) * t + ((hz(84) - hz(72)) * t * t) / 3.2)), { pan: 0.3, send: 0.3 });
thump(1.8, 0.5, 130, 44, 0.24, -0.2);
click(1.8, 0.12, -0.3);
blip(2.46, 660, 300, 0.05, -0.2, 0.2);
thump(2.66, 0.36, 100, 50, 0.16, -0.4);
tick(2.66, 62, 0.06, -0.4);
tick(3.3, 81, 0.035, -0.4);
sweep(4.4, 0.72, 300, 2600, 0.14, bell, -0.4, 0.4);
thump(5.1, 0.26, 96, 50, 0.18, 0.35);
chime(5.1, 65, 0.05, 0.35);

// ---- 2. Pick and shield ----
[74, 77, 81].forEach((midi, index) => tick(5.9 + index * 0.3, midi, 0.07, 0.3));
sweep(6.78, 0.42, 600, 5200, 0.1, swellIn, 0.3, 0.3);
latch(7.2, 0.5, 0.3);
[7.3, 7.38, 7.46].forEach((at) => click(at, 0.05, 0.35));
tick(8.9, 77, 0.03, -0.4);
sweep(10.6, 0.9, 3600, 500, 0.12, swellIn, 0.4, 0.2);
thump(11.5, 0.2, 90, 48, 0.16, 0.3);

// ---- 3. Jarvis ----
sweep(11.8, 0.2, 900, 4200, 0.08, swellIn, 0.3, 0.3);
chime(12.0, 74, 0.06, 0.3);
[13.2, 13.3, 13.4].forEach((at) => tick(at, 81, 0.03, 0.2, 0.03));
blip(13.6, 520, 900, 0.07, 0.2);
blip(14.4, 660, 990, 0.07, 0.4, 0.12);
[62, 65, 69, 74].forEach((midi, index) => pluck(14.62 + index * 0.3, midi, 0.07, 0.35));
blip(16.0, 990, 660, 0.07, 0.4, 0.12);
for (let i = 0; i < 6; i++) click(16.1 + i * 0.085, 0.03, 0.4);
[16.8, 16.9, 17.0].forEach((at) => tick(at, 81, 0.03, 0.2, 0.03));
blip(17.2, 520, 900, 0.07, 0.2);

// ---- 4. The evaluation ----
sweep(19.2, 0.6, 500, 3400, 0.12, bell, 0.5, 0.2);
thump(19.8, 0.22, 90, 48, 0.16, 0.3);
[72, 76, 79].forEach((midi, index) => tick(20.3 + index * 0.3, midi, 0.075, 0.3));
stab(21.6, [65, 69, 72, 76], 0.13, 0.9);

// ---- 5. No skipping: two ticks land, the third is withheld ----
sweep(22.8, 0.4, 2400, 600, 0.08, bell, 0.3, 0.3);
tick(23.0, 74, 0.075, 0.3);
tick(23.2, 77, 0.075, 0.3);
[81, 79, 77, 76, 74, 72].forEach((midi, index) => tick(23.45 + index * 0.075, midi, 0.028, 0.3, 0.03));
sweep(23.66, 0.32, 700, 2600, 0.09, swellIn, 0.2, 0.6);
latch(24.0, 0.34, 0.35);
sweep(24.8, 0.55, 800, 3000, 0.08, bell, 0.2, 0.4);
for (let i = 0; i < 11; i++) click(25.5 + i * 0.074 + (i % 3) * 0.012, 0.022, 0.35);

// ---- 6. STAR, and the break: the fourth tick is the withheld note, resolved ----
stab(26.4, [53, 57, 60, 65], 0.09, 1.1);
[77, 81, 84].forEach((midi, index) => tick(27.0 + index * 0.3, midi, 0.075, 0.3));
tick(27.9, 89, 0.09, 0.3, 0.09);
chime(27.9, 77, 0.05, 0.3);
sweep(28.2, 0.6, 500, 3000, 0.1, bell, 0.0, 0.3);
sweep(28.8, 1.2, 300, 7000, 0.2, swellIn, 0.2, 0.3);
play(28.8, 1.2, (t) => 0.05 * (t / 1.2) ** 2 * Math.sin(TAU * (hz(60) * t + ((hz(72) - hz(60)) * t * t) / 2.4)), { pan: 0.3, send: 0.4 });
thump(29.3, 0.24, 96, 50, 0.16, 0.3);
tick(29.7, 84, 0.05, -0.4);
latch(30.0, 0.7, 0.3);
thump(30.0, 0.5, 90, 33, 0.5, 0);
stab(30.0, [53, 60, 65, 67, 69, 72, 77], 0.2, 1.7);
[30.1, 30.2, 30.3].forEach((at) => click(at, 0.06, 0.35));
play(30.42, 0.12, (t) => 0.06 * Math.exp(-t / 0.014) * Math.sin(TAU * 1250 * t), { pan: 0.3, send: 0.2 });
play(31.4, 0.12, (t) => 0.06 * Math.exp(-t / 0.014) * Math.sin(TAU * 1250 * t), { pan: 0.3, send: 0.2 });

// ---- 7. The road ----
sweep(31.6, 0.6, 2800, 500, 0.09, bell, 0.3, 0.2);
play(31.9, 1.0, (t) => 0.04 * Math.sin(Math.PI * t) * Math.sin(TAU * (hz(65) * t + ((hz(77) - hz(65)) * t * t) / 2)), { pan: 0.3, send: 0.4 });
chime(32.4, 77, 0.055, 0.2);
chime(33.3, 81, 0.065, 0.4);
sweep(33.7, 0.7, 500, 1500, 0.05, bell, 0.2, 0.4);

// ---- 8. End card: the stop hit from 1.8, now with a resolved chord under it ----
sweep(35.2, 0.8, 400, 4200, 0.13, swellIn, 0.4, -0.3);
thump(36.0, 0.5, 130, 44, 0.26, -0.2);
click(36.0, 0.12, -0.3);
stab(36.0, [53, 57, 60, 65, 67, 72], 0.2, 2.2);
tick(36.3, 77, 0.03, -0.4);
tick(36.95, 72, 0.025, -0.4);

// ---- Reverb: four damped combs and two all-passes per side. ----
const reverb = (input, offset) => {
  const out = new Float32Array(N);
  for (const [delay, feedback] of [
    [1687, 0.8],
    [1601, 0.79],
    [2053, 0.77],
    [2251, 0.76],
  ]) {
    const line = new Float32Array(delay + offset);
    let index = 0;
    let damp = 0;
    for (let i = 0; i < N; i++) {
      const delayed = line[index];
      damp = delayed * 0.72 + damp * 0.28;
      line[index] = input[i] + damp * feedback;
      index = (index + 1) % line.length;
      out[i] += delayed * 0.25;
    }
  }
  for (const delay of [347, 113]) {
    const line = new Float32Array(delay + offset);
    let index = 0;
    for (let i = 0; i < N; i++) {
      const delayed = line[index];
      const fed = out[i] + delayed * 0.5;
      line[index] = fed;
      index = (index + 1) % line.length;
      out[i] = delayed - fed * 0.5;
    }
  }
  return out;
};
const tails = [reverb(wet[0], 0), reverb(wet[1], 23)];

// ---- Master: sum, remove DC, shape the ends, set the peak. ----
const master = [new Float32Array(N), new Float32Array(N)];
let peak = 0;
for (let channel = 0; channel < 2; channel++) {
  let previousIn = 0;
  let previousOut = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const sum = dry[channel][i] + tails[channel][i] * 0.9;
    const filtered = sum - previousIn + 0.9972 * previousOut;
    previousIn = sum;
    previousOut = filtered;
    const fadeIn = clamp(t / 0.02, 0, 1);
    const fadeOut = t < MUSIC_END ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (t - MUSIC_END)) / (DURATION - MUSIC_END));
    master[channel][i] = filtered * fadeIn * fadeOut;
    peak = Math.max(peak, Math.abs(master[channel][i]));
  }
}
const target = 10 ** (PEAK_DBFS / 20);
const scale = target / peak;

const header = Buffer.alloc(44);
const dataBytes = N * 4;
header.write('RIFF', 0);
header.writeUInt32LE(36 + dataBytes, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(dataBytes, 40);
const body = Buffer.alloc(dataBytes);
for (let i = 0; i < N; i++) {
  body.writeInt16LE(Math.round(clamp(master[0][i] * scale, -1, 1) * 32767), i * 4);
  body.writeInt16LE(Math.round(clamp(master[1][i] * scale, -1, 1) * 32767), i * 4 + 2);
}
const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'soundtrack.wav');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.concat([header, body]));

// ---- Verify what was written, by reading the file back. ----
const file = readFileSync(out);
const frames = file.readUInt32LE(40) / 4;
let filePeak = 0;
let clipped = 0;
let squares = 0;
const windows = new Array(Math.ceil(DURATION / 4.95)).fill(0);
for (let i = 0; i < frames * 2; i++) {
  const value = file.readInt16LE(44 + i * 2);
  const magnitude = Math.abs(value) / 32768;
  filePeak = Math.max(filePeak, magnitude);
  if (Math.abs(value) >= 32767) clipped++;
  squares += magnitude * magnitude;
  windows[Math.min(windows.length - 1, Math.floor(i / 2 / SR / 4.95))] += magnitude * magnitude;
}
const db = (v) => (v > 0 ? (20 * Math.log10(v)).toFixed(2) : '-inf');
console.log(`wrote ${out}`);
console.log(`format: ${file.readUInt32LE(24)} Hz, ${file.readUInt16LE(22)} channels, ${file.readUInt16LE(34)}-bit, ${(file.length / 1048576).toFixed(2)} MB`);
console.log(`duration: ${(frames / SR).toFixed(4)} s (${frames} sample frames; film is ${DURATION} s)`);
console.log(`peak: ${db(filePeak)} dBFS, clipped samples: ${clipped}, gain applied: ${db(scale)} dB`);
console.log(`rms: ${db(Math.sqrt(squares / (frames * 2)))} dBFS`);
console.log(`rms per 4.95 s window (dBFS): ${windows.map((w) => db(Math.sqrt(w / (SR * 4.95 * 2)))).join(', ')}`);
if (Math.abs(frames / SR - DURATION) > 1 / SR || filePeak >= 10 ** (-3 / 20) || clipped > 0 || squares === 0) {
  console.error('soundtrack failed its checks');
  process.exit(1);
}
