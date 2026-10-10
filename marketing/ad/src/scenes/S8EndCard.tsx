import { DISPLAY, TEXT, textWidth } from '../fonts';
import { FocusLock } from '../primitives/FocusLock';
import { KineticLine } from '../primitives/KineticLine';
import { FullStop, Wordmark, wordmarkLayout } from '../primitives/Wordmark';
import { C, GLIDE, LATCH, LINEAR, LOCK, RAIL, SWING, mix, orbitSpin, sec, sp, tw } from '../theme';
import { useAbsFrame } from '../timeline';
import { PIN_LEAVES, pinRest } from './S7Road';

const SIZE = 240;
const BASELINE = 548;
const LAND = 36.0;
const GHOST = { x: 1560, y: 540 } as const;

export function S8EndCard() {
  const frame = useAbsFrame();
  const layout = wordmarkLayout(SIZE);

  // The pin leaves the road and lands as the full stop of the name.
  const from = pinRest(sec(PIN_LEAVES));
  const to = { x: RAIL.x + layout.dot.x, y: BASELINE + layout.dot.y, d: layout.dot.d };
  const fly = tw(frame, PIN_LEAVES, LAND - PIN_LEAVES, 0, 1, SWING);
  const settle = frame < sec(LAND) ? 1 : mix(1.5, 1, sp(frame, LAND, LATCH));
  const swell = frame < sec(LAND) ? 1 + 0.5 * tw(frame, LAND - 0.2, 0.2, 0, 1, SWING) : settle;
  const ripple = tw(frame, LAND, 0.7, 0, 1, GLIDE);

  const first = 'Less scrolling.';
  const firstWidth = textWidth(`${first} `, DISPLAY, 700, 72, -0.025);

  return (
    <>
      <div style={{ position: 'absolute', left: GHOST.x, top: GHOST.y, width: 0, height: 0, opacity: 0.62 * tw(frame, 35.7, 1.2, 0, 1, LINEAR) }}>
        <FocusLock spin={orbitSpin(frame)} draw={tw(frame, 35.7, 1.5, 0, 1, SWING)} core={0} />
        <div style={{ position: 'absolute', left: -LOCK.core / 2, top: -LOCK.core / 2, width: LOCK.core, height: LOCK.core, borderRadius: '50%', boxShadow: `inset 0 0 0 2px ${C.heroLine}`, opacity: tw(frame, 36.2, 0.8, 0, 1) }} />
      </div>

      <Wordmark x={RAIL.x} baselineY={BASELINE} size={SIZE} dot={false} letterOffset={(index) => tw(frame, 35.32 + index * 0.04, 0.55, -1.3, 0, GLIDE)} />

      {ripple > 0 && ripple < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: to.x - 130,
            top: to.y - 130,
            width: 260,
            height: 260,
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 3px ${C.ink}`,
            opacity: 0.5 * (1 - ripple),
            transform: `scale(${0.16 + 0.84 * ripple})`,
          }}
        />
      ) : null}
      <FullStop x={mix(from.x, to.x, fly)} y={mix(from.y, to.y, fly) - 170 * Math.sin(Math.PI * fly)} d={mix(from.d, to.d, fly) * swell} />

      <div style={{ position: 'absolute', left: RAIL.x, top: 618 }}>
        <KineticLine frame={frame} tIn={36.3} size={72} family={DISPLAY} weight={700} color={C.muted} tracking={-0.025}>
          {first}
        </KineticLine>
      </div>
      <div style={{ position: 'absolute', left: RAIL.x + firstWidth, top: 618 }}>
        <KineticLine frame={frame} tIn={36.55} size={72} family={DISPLAY} weight={700} color={C.ink} tracking={-0.025}>
          More becoming.
        </KineticLine>
      </div>

      <div style={{ position: 'absolute', left: RAIL.x, top: 934 }}>
        <KineticLine frame={frame} tIn={36.95} size={40} family={TEXT} weight={500} color={C.muted}>
          An iPhone app built by a student team at the Whitman Hackathon.
        </KineticLine>
      </div>
    </>
  );
}
