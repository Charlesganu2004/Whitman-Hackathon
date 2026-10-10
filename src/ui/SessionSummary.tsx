import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Lesson, PracticeSession, Profile, Snapshot } from '../core/types.ts';
import { Body, Button, Card, Label, Title } from './components.tsx';
import { useTheme } from './theme.tsx';

interface SessionSummaryProps {
  session: PracticeSession;
  snapshot: Snapshot;
  profile: Profile;
  focus: {
    supported: boolean;
    authorized: boolean;
    selectedCount: number;
    blocking: boolean;
    emergencyReleased: boolean;
    reason: string;
  };
  remaining: number;
  onNext: () => void;
  lessons: Lesson[];
}

export function SessionSummary({ session, snapshot, profile, focus, remaining, onNext, lessons }: SessionSummaryProps) {
  useTheme();

  // Section 1: overall score
  const overallScore = Math.round(
    session.attempts.reduce((s, a) => s + a.feedback.score, 0) / Math.max(1, session.attempts.length)
  );
  const passedCount = session.attempts.filter(a => a.feedback.passed).length;

  const headerTitle =
    session.kind === 'placement'
      ? `Your starting level:\n${profile.level.charAt(0).toUpperCase() + profile.level.slice(1)}`
      : session.kind === 'checkpoint'
      ? `Checkpoint score:\n${overallScore}%`
      : 'Prepared looks\ngood on you.';

  const headerLabel =
    session.kind === 'placement'
      ? 'Placement complete'
      : session.kind === 'checkpoint'
      ? 'Checkpoint complete'
      : 'Practice complete';

  // Section 3: topic breakdown
  // Build topic map: base question id → topic
  const topicMap = new Map<string, string>();
  for (const q of session.questions) {
    topicMap.set(q.id.split('~')[0], q.topic);
  }

  // Group attempts by base question id, track pass/fail per topic
  const topicPassed = new Map<string, boolean>(); // topic → all attempts passed?
  for (const attempt of session.attempts) {
    const baseId = attempt.questionId.split('~')[0];
    const topic = topicMap.get(baseId) ?? baseId;
    const prev = topicPassed.get(topic);
    if (prev === undefined) {
      topicPassed.set(topic, attempt.feedback.passed);
    } else {
      topicPassed.set(topic, prev && attempt.feedback.passed);
    }
  }

  const strengths: string[] = [];
  const focusNext: string[] = [];
  for (const [topic, allPassed] of topicPassed.entries()) {
    if (allPassed) strengths.push(topic);
    else focusNext.push(topic);
  }

  // Section 4: per-failed-question tips
  const failedAttempts = session.attempts.filter(a => !a.feedback.passed);

  // Section 5: recommended lesson
  const recommended =
    lessons.find(
      l => l.level === profile.level && !profile.completedLessonIds.includes(l.id)
    ) ?? lessons.find(l => !profile.completedLessonIds.includes(l.id)) ?? null;

  return (
    <View style={s.stack}>
      {/* Section 1 — header */}
      <Card green>
        <Label>{headerLabel}</Label>
        <Title>{headerTitle}</Title>
        <Body>
          {passedCount} of {session.attempts.length} answered correctly ({overallScore}%)
        </Body>
      </Card>

      {/* Section 2 — earned break notice */}
      {session.kind === 'daily' && remaining > 0 && (
        <Card>
          <Title small>{remaining} min earned</Title>
          <Body>
            {focus.supported && focus.authorized
              ? 'Selected apps have been unlocked on your iPhone.'
              : 'You earned app access. In the native build this unlocks your selected apps.'}
          </Body>
        </Card>
      )}

      {/* Section 3 — topic breakdown */}
      {(strengths.length > 0 || focusNext.length > 0) && (
        <Card>
          <Title small>Your topic breakdown</Title>
          {strengths.length > 0 && (
            <View style={{ gap: 4 }}>
              <Label>Strengths</Label>
              {strengths.map(t => (
                <Body key={t}>✓ {t}</Body>
              ))}
            </View>
          )}
          {focusNext.length > 0 && (
            <View style={{ gap: 4 }}>
              <Label>Focus next</Label>
              {focusNext.map(t => (
                <Body key={t}>→ {t}</Body>
              ))}
            </View>
          )}
        </Card>
      )}

      {/* Section 4 — per-failed-question improvement tips */}
      {failedAttempts.map(attempt => {
        const baseId = attempt.questionId.split('~')[0];
        const matchedQ = session.questions.find(
          q => q.id === attempt.questionId || q.id.split('~')[0] === baseId
        );
        const topic = matchedQ?.topic ?? topicMap.get(baseId) ?? baseId;
        const tip =
          attempt.feedback.improvements[0] ?? attempt.feedback.explanation;

        // Check whether a retry of this question passed
        const retryPassed = session.attempts.some(
          a =>
            a !== attempt &&
            a.questionId.split('~')[0] === baseId &&
            a.questionId.includes('~') &&
            a.feedback.passed
        );

        return (
          <Card key={attempt.questionId}>
            <Label>{topic}</Label>
            <Body>{tip}</Body>
            {retryPassed && <Body>✓ Retried and passed.</Body>}
          </Card>
        );
      })}

      {/* Section 5 — recommended lesson */}
      {recommended ? (
        <Card>
          <Label>Your next lesson</Label>
          <Title small>{recommended.title}</Title>
          <Body>{recommended.summary}</Body>
          <Button title="Start this lesson" onPress={onNext} />
        </Card>
      ) : (
        <Body muted>All lessons at your level are complete. Great work.</Body>
      )}

      {/* Section 6 — motivational note + back button */}
      <Body muted>
        {profile.name.split(' ')[0]}, you've answered {snapshot.stats.answers} questions total. Keep building.
      </Body>
      <Button title="Back to your dashboard" onPress={onNext} />
    </View>
  );
}

const s = StyleSheet.create({
  stack: { gap: 22 },
});
