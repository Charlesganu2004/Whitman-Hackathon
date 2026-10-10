import { DISPLAY, TEXT } from '../fonts';
import { CARD, CARDS_GONE, Card, CardStage, DECK_STEP, Deck, STAR_RISE, cardPose } from '../primitives/Card';
import { EvaluationFace } from '../primitives/EvaluationFace';
import { JarvisOrb, LockGlyph } from '../primitives/Glyphs';
import { C, DROP, FPS, GLIDE, LATCH, LINEAR, PRESS, R, SWING, clamp01, mix, sec, sp, tw } from '../theme';
import { useAbsFrame } from '../timeline';
import { NEXT_CARD } from './S4Evaluation';

const SNAP = 24.0;
const FLIP = 24.8;
const TYPED = ['Our project was behind,', 'so I split the work.'];

function QuestionFace({ frame }: { frame: number }) {
  const total = TYPED[0].length + TYPED[1].length;
  const typed = Math.floor(tw(frame, 25.5, 0.8, 0, total, LINEAR));
  const lines = [TYPED[0].slice(0, typed), TYPED[1].slice(0, Math.max(0, typed - TYPED[0].length))];
  const caretLine = typed > TYPED[0].length ? 1 : 0;
  const caretOn = typed < total || Math.floor((frame / FPS) * 2.5) % 2 === 0;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 48, top: 42 }}>
        <JarvisOrb size={60} turn={(frame / FPS) * 40} ring={C.heroLine} fill={C.raised} mark={C.cream} />
      </div>
      <div style={{ position: 'absolute', left: 124, top: 50, fontFamily: TEXT, fontWeight: 700, fontSize: 38, lineHeight: '44px', color: C.ink }}>Jarvis</div>
      <div style={{ position: 'absolute', right: 48, top: 56, fontFamily: TEXT, fontWeight: 700, fontSize: 28, lineHeight: '34px', letterSpacing: '0.09em', color: C.muted }}>BEHAVIORAL</div>
      <div style={{ position: 'absolute', left: 48, top: 134, fontFamily: DISPLAY, fontWeight: 700, fontSize: 62, lineHeight: '68px', letterSpacing: '-0.025em', color: C.ink, whiteSpace: 'nowrap' }}>
        When did a team
        <br />
        rely on you?
      </div>
      <div style={{ position: 'absolute', left: 48, top: 318, width: 664, height: 208, borderRadius: R.md, backgroundColor: C.bg, boxShadow: `inset 0 0 0 2px ${C.line}` }}>
        {lines.map((line, index) => (
          <div key={index} style={{ position: 'absolute', left: 30, top: 28 + index * 54, height: 54, display: 'flex', alignItems: 'center', fontFamily: TEXT, fontWeight: 500, fontSize: 38, letterSpacing: '-0.01em', color: C.ink, whiteSpace: 'pre' }}>
            {line}
            {index === caretLine && caretOn ? <div style={{ width: 4, height: 44, marginLeft: 4, borderRadius: 2, backgroundColor: C.ink }} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function S5NoSkip() {
  const frame = useAbsFrame();
  const pose = cardPose(frame);
  const rise = tw(frame, NEXT_CARD + 0.05, 0.5, 0, 1, GLIDE);
  const recede = tw(frame, STAR_RISE, 0.45, 0, 1, SWING);
  const depth = 1 - rise + recede;
  const gone = tw(frame, CARDS_GONE, 0.4, 0, 1, DROP);

  // Two meters fill on the beat, the third stalls, then the pink is withdrawn from all of it.
  const fills: [number, number, number] = [tw(frame, 23.0, 0.4, 0, 0.64, GLIDE), tw(frame, 23.2, 0.4, 0, 0.5, GLIDE), tw(frame, 23.4, 0.7, 0, 0.24, LINEAR)];
  const done = (fills[0] + fills[1] + fills[2]) / 1.38;
  const earned = tw(frame, 23.55, 0.45, 1, 0, SWING);

  // Dragged aside to skip it, and refused: one hard rebound, then a lock on the corner.
  const drag = frame < sec(SNAP) ? tw(frame, 23.66, 0.32, 0, 1, SWING) : 1 - sp(frame, SNAP, LATCH);
  const badge = sp(frame, SNAP + 0.04, PRESS);
  const flip = tw(frame, FLIP, 0.6, 0, 180, SWING);
  const front = flip < 90;

  return (
    <CardStage>
      <div style={{ position: 'absolute', left: 0, top: 0, transformStyle: 'preserve-3d', transform: `rotateY(${pose.yaw}deg) rotateX(${pose.pitch}deg)` }}>
        <Deck lift={rise + tw(frame, STAR_RISE, 0.5, 0, 1, GLIDE)} opacity={1 - gone} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: `translate3d(${drag * 250}px, ${depth * DECK_STEP.y}px, ${-depth * DECK_STEP.z - gone * 300}px) rotateZ(${drag * 4}deg) rotateY(${front ? flip : flip - 180}deg)`,
            opacity: mix(1, 0.4, clamp01(depth)) * (1 - gone),
          }}
        >
          <Card>
            {front ? (
              <EvaluationFace fills={fills} earned={earned} score={Math.round(46 * done)} lit={0.46 * done} status={frame >= sec(23.8) ? 'notYet' : 'pending'} statusIn={sp(frame, 23.8, PRESS)} question="Question 2" />
            ) : (
              <QuestionFace frame={frame} />
            )}
          </Card>
          {front && badge > 0.001 ? (
            <div
              style={{
                position: 'absolute',
                left: CARD.w / 2 - 54,
                top: -CARD.h / 2 - 30,
                width: 84,
                height: 84,
                borderRadius: '50%',
                backgroundColor: C.raised,
                boxShadow: `inset 0 0 0 2px ${C.heroLine}`,
                transform: `scale(${badge})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LockGlyph size={34} color={C.ink} keyhole={C.raised} />
            </div>
          ) : null}
        </div>
      </div>
    </CardStage>
  );
}
