import React, { useState } from 'react';
import { OFFLINE_REASON } from '../core/connection';
import { View } from 'react-native';
import { request } from '../services/api';
import { Body, Button, Card, Field, Label } from './components';
import { useTheme } from './theme';

export function TechnicalCoach({ sessionId, questionId, lessonId, offline, onError }: { sessionId?: string; questionId?: string; lessonId?: string; offline: boolean; onError: (message: string) => void }) {
  const { colors } = useTheme();
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<{ message: string; hints: string[]; mode: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function ask() {
    if (busy) return;
    setBusy(true);
    try {
      const endpoint = lessonId ? `/lessons/${lessonId}/coach` : `/sessions/${sessionId}/coach`;
      const result = await request<{ message: string; hints: string[]; mode: string }>(endpoint, { ...(lessonId ? {} : { questionId }), message });
      setReply(result);
    } catch (error) { onError(error instanceof Error ? error.message : 'Coaching unavailable. Your answer is still saved in the editor.'); }
    finally { setBusy(false); }
  }
  return <Card>
    <Label>{lessonId ? 'Learn with your coach' : 'Work through it with your coach'}</Label>
    <Body muted>{lessonId ? 'Ask about an idea in this lesson. Apply it in the knowledge check to record progress.' : 'Ask about your approach or request a hint. Coaching does not submit an answer or earn app access.'}</Body>
    <Field label={lessonId ? 'Ask your lesson coach' : 'Ask your technical coach'} multiline value={message} onChangeText={setMessage} placeholder={lessonId ? 'Can you explain this idea with another example?' : 'I’m considering a hash map. What tradeoffs should I think about?'} />
    <Button title="Get a hint or feedback" secondary busy={busy} disabled={offline || message.trim().length < 3} onPress={() => { void ask(); }} />{offline && <Body muted>{OFFLINE_REASON}</Body>}
    {reply && <View style={{ gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line }}><Label>{reply.mode === 'ai' ? 'AI coaching' : 'Question hints'}</Label><Body>{reply.message}</Body>{reply.hints.map((hint, index) => <View key={index} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.accent }}><Body muted>{hint}</Body></View>)}</View>}
  </Card>;
}
