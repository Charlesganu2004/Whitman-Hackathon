import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { pickVoice, speechText } from '../core/interview';
import { request } from './api';

// Jarvis speaks with the server's model voice when /health says it is available, and with the best installed device voice otherwise
// or on any error or delay. Nothing here ever throws or shows an error: the text on screen is always the source of truth.
const SERVER_TIMEOUT_MS = 2500;
const SERVER_BACKOFF_MS = 30_000;
const CLIP_LIMIT = 16;

let serverVoice = false;
let serverDownUntil = 0;
let epoch = 0;
let player: AudioPlayer | null = null;
let deviceVoice: string | null | undefined;
const clips = new Map<string, string>();

export function configureServerVoice(available: boolean) { serverVoice = available; }

function release() {
  const current = player;
  player = null;
  if (!current) return;
  try { current.pause(); } catch { /* The player may already be gone. */ }
  try { current.remove(); } catch { /* The player may already be gone. */ }
}

/** Stops the model voice and the device voice, and cancels any message that was prepared but not yet played. */
export function stopJarvis() {
  epoch++;
  release();
  void Speech.stop().catch(() => undefined);
}

function clipName(text: string) {
  let hash = 5381;
  for (let index = 0; index < text.length; index++) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return `jarvis-${(hash >>> 0).toString(16)}-${text.length}.wav`;
}

async function serverClip(text: string): Promise<string> {
  const known = clips.get(text);
  if (known) return known;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      request<{ audio: string; mimeType: string }>('/ai/speak', { text }, undefined, SERVER_TIMEOUT_MS),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Jarvis voice timed out.')), SERVER_TIMEOUT_MS); }),
    ]);
    let uri: string;
    if (Platform.OS === 'web') uri = `data:${result.mimeType};base64,${result.audio}`;
    else {
      const file = new File(Paths.cache, clipName(text));
      file.create({ overwrite: true });
      file.write(result.audio, { encoding: 'base64' });
      uri = file.uri;
    }
    clips.set(text, uri);
    if (clips.size > CLIP_LIMIT) clips.delete(clips.keys().next().value as string);
    return uri;
  } finally { if (timer) clearTimeout(timer); }
}

async function bestDeviceVoice(): Promise<string | undefined> {
  if (deviceVoice !== undefined) return deviceVoice ?? undefined;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    // An empty list means the voices have not loaded yet, so the choice is tried again next time.
    if (!voices.length) return undefined;
    deviceVoice = pickVoice(voices.map(voice => ({ identifier: voice.identifier, name: voice.name, quality: String(voice.quality), language: voice.language }))) ?? null;
    return deviceVoice ?? undefined;
  } catch { return undefined; }
}

async function speakOnDevice(text: string, mine: number) {
  try {
    const voice = await bestDeviceVoice();
    if (mine !== epoch) return;
    await Speech.stop();
    if (mine !== epoch) return;
    Speech.speak(text, { rate: 1.03, pitch: 1.1, ...(voice ? { voice } : { language: 'en-US' }) });
  } catch { /* Speech is unavailable or blocked, so the text stays on screen. */ }
}

function playClip(uri: string, mine: number, fallback: () => void) {
  try {
    void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
    const next = createAudioPlayer({ uri });
    player = next;
    next.addListener('playbackStatusUpdate', status => { if (status.didJustFinish && player === next) release(); });
    const started: unknown = next.play();
    // Browsers can refuse to play before the page has been used; the device voice is tried instead.
    if (started && typeof (started as Promise<void>).catch === 'function') (started as Promise<void>).catch(() => { if (player === next && mine === epoch) { release(); fallback(); } });
  } catch { release(); fallback(); }
}

export interface PreparedVoice { play: () => void }

/**
 * Gets the audio ready (at most about 2.5 seconds) so the words and the voice can start together. The returned play() does nothing
 * if the voice was stopped in the meantime, so a message from an old question never speaks over the new one.
 */
export async function prepareVoice(text: string): Promise<PreparedVoice> {
  const spoken = speechText(text);
  const mine = epoch;
  let uri: string | null = null;
  if (spoken && serverVoice && Date.now() >= serverDownUntil) {
    try { uri = await serverClip(spoken); } catch { serverDownUntil = Date.now() + SERVER_BACKOFF_MS; }
  }
  return {
    play() {
      if (!spoken || mine !== epoch) return;
      release();
      const device = () => { void speakOnDevice(spoken, mine); };
      if (uri) playClip(uri, mine, device); else device();
    },
  };
}

/** Speaks a message again, whatever the voice toggle says. */
export function replayJarvis(text: string) {
  stopJarvis();
  void prepareVoice(text).then(voice => voice.play());
}
