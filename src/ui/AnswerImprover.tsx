import React from 'react';
import { View } from 'react-native';
import type { Feedback, QuestionKind } from '../core/types.ts';
import { Body, Card, Label, Title } from './components.tsx';
import { useTheme } from './theme.tsx';

export function AnswerImprover({ feedback, kind }: { feedback: Feedback; kind: QuestionKind }) {
  useTheme(); // consume theme for consistent styling context
  const star = feedback.star;

  return (
    <Card>
      <Label>Improvement scaffold</Label>
      <Title small>How to make this answer stronger.</Title>

      {feedback.strengths.length > 0 && (
        <View style={{ gap: 6 }}>
          <Label>What you covered:</Label>
          {feedback.strengths.map((text, i) => (
            <Body key={`strength-${i}`}>✓ {text}</Body>
          ))}
        </View>
      )}

      {feedback.improvements.length > 0 && (
        <View style={{ gap: 6 }}>
          <Label>What to add:</Label>
          {feedback.improvements.map((text, i) => (
            <Body key={`improvement-${i}`}>→ {text}</Body>
          ))}
        </View>
      )}

      {kind === 'behavioral' && (
        <View style={{ gap: 10 }}>
          <Label>Your STAR structure</Label>
          {star ? (
            <View style={{ gap: 8 }}>
              {(['situation', 'task', 'action', 'result'] as const).map(part => (
                <View key={part} style={{ gap: 4 }}>
                  <Label>{part.charAt(0).toUpperCase() + part.slice(1)}</Label>
                  <Body>{star[part]}</Body>
                </View>
              ))}
            </View>
          ) : (
            <Body>Structure: In [situation], my task was [task]. I [action]. The result was [result].</Body>
          )}
        </View>
      )}

      {kind === 'technical' && (
        <View style={{ gap: 6 }}>
          <Label>Technical structure</Label>
          <Body>Problem → Approach → Complexity → Edge Cases</Body>
        </View>
      )}
    </Card>
  );
}
