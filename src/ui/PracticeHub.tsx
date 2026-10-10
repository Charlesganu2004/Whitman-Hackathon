import React from 'react';
import { View } from 'react-native';
import type { Snapshot } from '../core/types';
import { technicalCount } from '../core/engine';
import { Body, Button, Card, Label, Meter, Title } from './components';
import { Reveal } from './motion';

export function PracticeHub({ snapshot, busy, offline, ai, onStart, onCheckpoint, onLearn }: { snapshot: Snapshot; busy: boolean; offline: boolean; ai: boolean; onStart: () => void; onCheckpoint: () => void; onLearn: () => void }) {
  const { profile, stats, activeSession } = snapshot;
  const active = activeSession && ['active', 'review'].includes(activeSession.status);
  const placement = !profile.placementComplete;
  const technical = active ? activeSession.technicalCount : placement ? 2 : technicalCount(profile);
  return <View style={{ gap: 24 }}>
    <Reveal><Label>Your interview studio</Label><Title>{'Rehearse. Learn.\nTry again.'}</Title><Body muted>Practice at your level, get feedback, and make your next answer stronger.</Body></Reveal>
    <Reveal delay={80}><Card green><Label>{placement ? 'Placement interview' : 'Adaptive interview'}</Label><Title small>{active ? 'Continue your interview.' : 'Ready for your next rep?'}</Title><Body>{technical} technical questions and 2 behavioral questions. {profile.minutes} minute goal.</Body><Body muted>{ai ? 'Your AI interviewer gives STAR feedback and technical coaching. Hear prompts, record answers, and edit transcripts before submitting.' : 'Rubric practice and lesson hints are available. A server AI key enables spoken transcripts and AI coaching.'}</Body>{active && <Meter value={activeSession.index / activeSession.questions.length * 100} label={`${activeSession.index} of ${activeSession.questions.length} answered`} />}<Button title={active ? 'Resume interview' : placement ? 'Start placement interview' : 'Start adaptive interview'} busy={busy} disabled={offline} onPress={onStart} /></Card></Reveal>
    <Reveal delay={120}><Card><Label>Check where you are now</Label><Title small>Test my knowledge.</Title><Body>Two technical answers and two behavioral stories at your current level. See your score and gaps without changing your level or earning app access.</Body><Button title="Test my knowledge" secondary busy={busy} disabled={offline || placement || !!active} onPress={onCheckpoint} />{(placement || active) && <Body muted>{placement ? 'Complete placement first.' : 'Finish your saved interview before starting a checkpoint.'}</Body>}</Card></Reveal>
    <Reveal delay={140}><Card><Label>Learn before the next question</Label><Title small>Make feedback useful.</Title><Body>Review missed ideas, ask your lesson coach for an example, then complete a knowledge check. A different interview question checks what you learned.</Body><Button title="Explore lessons" secondary onPress={onLearn} /></Card></Reveal>
    <Body muted>{stats.todaySessions || 0} of {profile.sessionsPerDay || 1} daily interviews complete today. Technical and behavioral scores shape your roadmap; successful practice and evaluated lessons unlock the next level.</Body>
  </View>;
}
