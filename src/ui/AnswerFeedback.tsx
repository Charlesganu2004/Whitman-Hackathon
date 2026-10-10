import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import type { Feedback } from '../core/types';
import { Body, Button, Card, Label, Title } from './components';
import { useTheme } from './theme';

export function AnswerFeedback({ feedback }: { feedback: Feedback }) {
  const { colors } = useTheme();
  useEffect(() => () => { void Speech.stop(); }, []);
  const star = feedback.star;
  const spoken = [feedback.explanation, ...feedback.improvements, ...(star ? Object.entries(star).map(([part, guidance]) => `${part}. ${guidance}`) : [])].join(' ');
  return <Card green={feedback.passed}>
    <Label>{feedback.mode === 'ai' ? 'AI coach feedback' : 'Rubric feedback'}</Label>
    <Title small>{feedback.passed ? 'A stronger answer.' : 'Here’s your next step.'}</Title>
    <Text accessibilityLabel={`Score ${feedback.score} percent`} style={{ color: colors.accent, fontSize: 42, fontWeight: '700' }}>{feedback.score}%</Text>
    <Body>{feedback.explanation}</Body>
    {feedback.strengths.map((text, index) => <Body key={`strength-${index}`}>✓ {text}</Body>)}
    {feedback.improvements.map((text, index) => <Body key={`improvement-${index}`}>{text}</Body>)}
    {star && <View style={{ gap: 16, paddingTop: 12 }}><Title small>Your STAR story</Title>{Object.entries(star).map(([part, guidance]) => <View key={part} style={{ gap: 6 }}><Label>{part.charAt(0).toUpperCase() + part.slice(1)}</Label><Body>{guidance}</Body></View>)}</View>}
    <Button title="Hear coach feedback" secondary onPress={() => { void Speech.stop().then(() => Speech.speak(spoken, { rate: 0.95 })); }} />
    <Button title="Stop speaking" secondary onPress={() => { void Speech.stop(); }} />
  </Card>;
}
