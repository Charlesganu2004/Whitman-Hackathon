import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Backdrop, type Bloom, Finish } from './primitives/Backdrop';
import { type CaptionCue, CaptionRail } from './primitives/CaptionRail';
import { S1Feed } from './scenes/S1Feed';
import { S2Lock } from './scenes/S2Lock';
import { S3Jarvis } from './scenes/S3Jarvis';
import { S4Evaluation } from './scenes/S4Evaluation';
import { S5NoSkip } from './scenes/S5NoSkip';
import { S6StarUnlock } from './scenes/S6StarUnlock';
import { S7Road } from './scenes/S7Road';
import { S8EndCard } from './scenes/S8EndCard';
import { DURATION_S, STAGE, SWING, sec } from './theme';
import { Scene } from './timeline';
import narration from './narration.json';

// Every sentence the film says, on one track. Each stays fully revealed for about a second per
// twenty characters, and no two are on the rail together.
const CAPTIONS: CaptionCue[] = [
  { kind: 'headline', tIn: 5.1, tOut: 6.85, lines: ['Pick the apps', 'that distract you.'] },
  {
    kind: 'headline',
    tIn: 7.1,
    tOut: 11.75,
    lines: ['They stay locked', 'until you pass', 'today’s interview.'],
    support: { tIn: 8.9, lines: ['Shielded through Apple', 'Screen Time on iPhone.'] },
  },
  { kind: 'headline', tIn: 12.3, tOut: 14.05, lines: ['Meet Jarvis, your', 'AI interviewer.'] },
  { kind: 'headline', tIn: 14.3, tOut: 19.1, lines: ['Answer out loud,', 'or type it.'] },
  { kind: 'headline', tIn: 19.9, tOut: 22.75, lines: ['Scored on', 'three skills.'] },
  { kind: 'statement', tIn: 23.35, tOut: 23.9, lines: ['Not yet.'] },
  { kind: 'statement', tIn: 24.0, tOut: 24.62, lines: ['No', 'skipping.'] },
  { kind: 'headline', tIn: 24.8, tOut: 26.3, lines: ['Feedback, then a', 'different question.'] },
  { kind: 'headline', tIn: 26.6, tOut: 29.2, lines: ['Behavioral answers', 'get STAR feedback.'] },
  { kind: 'statement', tIn: 30.0, tOut: 31.5, lines: ['Break', 'earned.'] },
  { kind: 'headline', tIn: 32.5, tOut: 35.15, lines: ['Every step,', 'closer to ready.'], support: { tIn: 33.4, lines: ['Five levels.', 'Eight short lessons.'] } },
];

const key = (frame: number, times: number[], values: number[]): number =>
  interpolate(frame, times.map(sec), values, { easing: SWING, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

// One bloom in the whole film. It follows the travelling object and lifts once, for the unlock.
const bloomAt = (frame: number): Bloom => ({
  x: key(frame, [4.4, 5.2, 35.2, 36.0], [1500, STAGE.x, STAGE.x, 1560]),
  y: key(frame, [31.6, 32.4, 35.2, 36.0], [STAGE.y, 760, 760, STAGE.y]),
  radius: key(frame, [29.9, 30.1, 31.4], [640, 760, 640]),
  alpha: key(frame, [4.8, 5.6, 10.6, 12.0, 28.6, 29.4, 29.95, 30.08, 31.4, 32.4, 35.4, 36.2], [0.05, 0.1, 0.1, 0.045, 0.045, 0.1, 0.1, 0.24, 0.13, 0.07, 0.07, 0.1]),
});

export function Film() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop frame={frame} bloom={bloomAt(frame)} />

      <Scene from={10.6} to={28.7}>
        <S3Jarvis />
      </Scene>
      <Scene from={4.8} to={11.8}>
        <S2Lock />
      </Scene>
      <Scene from={0} to={5.2}>
        <S1Feed />
      </Scene>
      <Scene from={19.2} to={23.2}>
        <S4Evaluation />
      </Scene>
      <Scene from={22.8} to={28.7}>
        <S5NoSkip />
      </Scene>
      <Scene from={26.3} to={32.3}>
        <S6StarUnlock />
      </Scene>
      <Scene from={31.6} to={35.7}>
        <S7Road />
      </Scene>
      <Scene from={35.2} to={DURATION_S}>
        <S8EndCard />
      </Scene>

      <CaptionRail frame={frame} cues={CAPTIONS} />
      <Finish />
      <Audio src={staticFile('soundtrack.wav')} volume={0.42} />
      {narration.map(line => (
        <Sequence key={line.file} from={sec(line.at)} durationInFrames={sec(line.duration) + 6}>
          <Audio src={staticFile(line.file)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
