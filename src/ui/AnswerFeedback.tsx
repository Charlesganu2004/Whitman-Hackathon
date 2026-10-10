import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import type { Feedback } from '../core/types';
import { Body, Button, Card, Label, Meter, Title } from './components';
import { stopJarvis } from '../services/voice';
import { useTheme } from './theme';

export function AnswerFeedback({ feedback }: { feedback: Feedback }) {
  const { colors } = useTheme();
  useEffect(() => () => { stopJarvis(); }, []);
  const star = feedback.star;
  const spoken = [feedback.explanation, ...feedback.improvements, ...(star ? Object.entries(star).map(([part, guidance]) => `${part}. ${guidance}`) : [])].join(' ');
  return <Card green={feedback.passed}>
    <Label>{feedback.mode === 'ai' ? 'AI coach feedback' : 'Rubric feedback'}</Label>
    <Title small>{feedback.passed ? 'A stronger answer.' : 'Here’s your next step.'}</Title>
    <View style={{ gap: 12 }}><Text accessibilityLabel={`Score ${feedback.score} percent`} style={{ color: colors.accent, fontSize: 48, lineHeight: 56, fontWeight: '700', letterSpacing: -1.6, fontVariant: ['tabular-nums'] }}>{feedback.score}<Text style={{ fontSize: 24, letterSpacing: 0 }}>%</Text></Text><Meter value={feedback.score} label="Answer score" /></View>
    <Body>{feedback.explanation}</Body>
    {feedback.strengths.length > 0 && <View style={{ gap: 10 }}><Label>What worked</Label>{feedback.strengths.map((text, index) => <Body key={`strength-${index}`}>✓ {text}</Body>)}</View>}
    {feedback.improvements.length > 0 && <View style={{ gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line }}><Label>For your next answer</Label>{feedback.improvements.map((text, index) => <Body key={`improvement-${index}`}>{text}</Body>)}</View>}
    {star && <View style={{ gap: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line }}><Title small>Your STAR story</Title>{Object.entries(star).map(([part, guidance]) => <View key={part} style={{ gap: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.accent }}><Label>{part.charAt(0).toUpperCase() + part.slice(1)}</Label><Body>{guidance}</Body></View>)}</View>}
    <Button title="Hear coach feedback" secondary onPress={() => { stopJarvis(); void Speech.stop().then(() => Speech.speak(spoken, { rate: 0.95 })); }} />
    <Button title="Stop speaking" secondary onPress={() => { stopJarvis(); }} />
  </Card>;
}
