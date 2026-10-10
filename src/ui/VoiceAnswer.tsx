import React, { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { AudioWave } from './AudioWave';
import { request } from '../services/api';
import { stopJarvis } from '../services/voice';
import { Body, Button } from './components';

export function VoiceAnswer({ prompt, onTranscript, onError, enabled, listen = true }: { prompt: string; onTranscript: (text: string) => void; onError: (text: string) => void; enabled: boolean; listen?: boolean }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stopJarvis(); void setAudioModeAsync({ allowsRecording: false }); }; }, []);
  useEffect(() => {
    if (state.isRecording && state.durationMillis >= 120000) void stop();
  }, [state.durationMillis, state.isRecording]);
  async function start() {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('Microphone permission denied. Enable it in Settings or type your answer below.');
      stopJarvis();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) { onError(error instanceof Error ? error.message : 'Recording failed.'); }
  }
  async function stop() {
    if (busy) return;
    setBusy(true);
    try {
      await recorder.stop();
      if (!recorder.uri) throw new Error('No recording was saved. Please record again.');
      let base64: string;
      if (Platform.OS === 'web') {
        const blob = await (await fetch(recorder.uri)).blob();
        base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
      } else { base64 = await new File(recorder.uri).base64(); }
      const result = await request<{ text: string }>('/ai/transcribe', { base64, mimeType: Platform.OS === 'web' ? 'audio/webm' : 'audio/m4a' });
      if (mounted.current) onTranscript(result.text);
    } catch (error) { if (mounted.current) onError(error instanceof Error ? error.message : 'Transcription failed. You can type your answer.'); }
    finally { await setAudioModeAsync({ allowsRecording: false }); if (mounted.current) setBusy(false); }
  }
  return <View style={{ gap: 12 }}>
    <AudioWave active={state.isRecording || busy} />
    {listen && <Button title="Hear the interviewer" secondary onPress={() => { stopJarvis(); void Speech.stop().then(() => Speech.speak(prompt, { rate: 0.95 })); }} />}
    {enabled ? <Button title={state.isRecording ? `Stop and transcribe · ${Math.floor(state.durationMillis / 1000)}s` : 'Record your answer'} secondary busy={busy} onPress={() => { void (state.isRecording ? stop() : start()); }} /> : <Body muted>Voice transcription needs an AI key on the server. Rehearse aloud, then type your answer for rubric feedback.</Body>}
    {state.isRecording && <Body>Recording. Two-minute maximum. Stop when you finish.</Body>}
  </View>;
}
