import { interpolateColors } from 'remotion';
import { TEXT } from '../fonts';
import { BUBBLE_LINE } from '../primitives/ChatBubble';
import { CARD, Card, CardStage, Deck, cardPose } from '../primitives/Card';
import { EvaluationFace } from '../primitives/EvaluationFace';
import { C, DROP, GLIDE, PRESS, R, STAGE, mix, sec, sp, tw } from '../theme';
import { useAbsFrame } from '../timeline';
import { HANDOVER, feedbackBubbleRect } from './S3Jarvis';

// Demo values of the interface: three skills, an overall mark. Not a statistic and not a promise.
const VALUES = [0.86, 0.78, 0.71];
const MARK = 84;
export const NEXT_CARD = 22.8;

export function S4Evaluation() {
  const frame = useAbsFrame();
  const bubble = feedbackBubbleRect();
  const grow = tw(frame, HANDOVER, 0.6, 0, 1, GLIDE);
  const width = mix(bubble.w, CARD.w, grow);
  const height = mix(bubble.h, CARD.h, grow);
  const x = mix(bubble.x + bubble.w / 2, STAGE.x, grow) - STAGE.x;
  const y = mix(bubble.y + bubble.h / 2, STAGE.y, grow) - STAGE.y;
  const pose = cardPose(frame);
  const drop = tw(frame, NEXT_CARD, 0.3, 0, 1, DROP);

  const fills = VALUES.map((value, index) => tw(frame, 20.3 + index * 0.3, 0.55, 0, value, GLIDE)) as [number, number, number];
  const done = (fills[0] + fills[1] + fills[2]) / (VALUES[0] + VALUES[1] + VALUES[2]);

  return (
    <CardStage>
      <div style={{ position: 'absolute', left: 0, top: 0, transformStyle: 'preserve-3d', transform: `rotateY(${pose.yaw}deg) rotateX(${pose.pitch}deg)` }}>
        {frame < sec(NEXT_CARD) ? <Deck opacity={tw(frame, 19.5, 0.5, 0, 1)} /> : null}
        <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate3d(${x}px, ${y + drop * 44}px, ${-drop * 320}px)`, opacity: 1 - drop }}>
          <Card
            width={width}
            height={height}
            style={{
              borderRadius: mix(R.md, R.lg, grow),
              backgroundColor: interpolateColors(grow, [0, 1], [C.raised, C.surface]),
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 30,
                top: 26,
                opacity: tw(frame, HANDOVER, 0.18, 1, 0),
                fontFamily: TEXT,
                fontWeight: 500,
                fontSize: 40,
                lineHeight: `${BUBBLE_LINE}px`,
                letterSpacing: '-0.01em',
                color: C.ink,
                whiteSpace: 'nowrap',
              }}
            >
              <div style={{ fontSize: 28, lineHeight: '36px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Feedback</div>
              Good. Next, say why it
              <br />
              is fast.
            </div>
            <div style={{ position: 'absolute', left: 0, top: 0, width: CARD.w, height: CARD.h, opacity: tw(frame, HANDOVER + 0.22, 0.34, 0, 1) }}>
              <EvaluationFace fills={fills} earned={1} score={Math.round(MARK * done)} lit={(MARK / 100) * done} status={frame >= sec(21.6) ? 'passed' : 'pending'} statusIn={sp(frame, 21.6, PRESS)} question="Question 1" />
            </div>
          </Card>
        </div>
      </div>
    </CardStage>
  );
}
