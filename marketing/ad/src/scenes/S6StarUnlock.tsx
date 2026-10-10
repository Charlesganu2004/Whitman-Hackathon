import { DISPLAY, TEXT } from '../fonts';
import { OrbitTiles } from '../primitives/AppTile';
import { CARDS_GONE, Card, CardStage, DECK_STEP, STAR_RISE, cardPose } from '../primitives/Card';
import { FocusLock } from '../primitives/FocusLock';
import { CurlBars, TimerRing } from '../primitives/TimerRing';
import { C, DROP, GLIDE, LATCH, LOCK, PRESS, R, RAIL, STAGE, SWING, mix, orbitSpin, sec, sp, tw } from '../theme';
import { useAbsFrame } from '../timeline';

const ROWS = [
  ['Situation', 'You provide context.'],
  ['Task', 'Your responsibility is visible.'],
  ['Action', 'You describe a personal action.'],
  ['Result', 'An outcome is mentioned.'],
] as const;
const LIGHT = [27.0, 27.3, 27.6, 27.9];
const STAR = { w: 760, h: 620, rowTop: 150, pitch: 108, barX: 48, barW: 14, barH: 76, barInset: 16 } as const;

const CURL = 28.75;
const CLOSED = 29.42;
const OPEN = 30.0;
const TICK = 31.4;
/** Second at which the core leaves the lock and becomes the pin on the road. */
export const CORE_LEAVES = 31.8;

// Where the four bars sit on the frame once the card has squared up to the camera.
const BAR_X = STAGE.x - STAR.w / 2 + STAR.barX + STAR.barW / 2;
const BAR_MID_Y = STAGE.y - STAR.h / 2 + STAR.rowTop + STAR.barInset + STAR.barH / 2 + STAR.pitch * 1.5;
const CIRCUMFERENCE = 2 * Math.PI * LOCK.inner;

function StarFace({ frame }: { frame: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 48, top: 44, fontFamily: DISPLAY, fontWeight: 700, fontSize: 54, lineHeight: '62px', letterSpacing: '-0.025em', color: C.ink }}>Your STAR story</div>
      {ROWS.map(([name, note], index) => {
        const lit = sp(frame, LIGHT[index], PRESS);
        const on = frame >= sec(LIGHT[index]);
        const top = STAR.rowTop + index * STAR.pitch;
        return (
          <div key={name}>
            {frame < sec(CARDS_GONE) ? (
              <div
                style={{
                  position: 'absolute',
                  left: STAR.barX,
                  top: top + STAR.barInset,
                  width: STAR.barW,
                  height: STAR.barH,
                  borderRadius: R.pill,
                  backgroundColor: on ? C.accent : C.track,
                  transform: `scaleY(${on ? mix(0.5, 1, lit) : 1})`,
                }}
              />
            ) : null}
            <div style={{ position: 'absolute', left: 92, top: top + 6, fontFamily: TEXT, fontWeight: 600, fontSize: 44, lineHeight: '52px', letterSpacing: '-0.01em', color: on ? C.ink : C.muted }}>{name}</div>
            <div style={{ position: 'absolute', left: 92, top: top + 60, fontFamily: TEXT, fontWeight: 500, fontSize: 30, lineHeight: '38px', color: C.muted, opacity: on ? 0.9 : 0.55 }}>{note}</div>
          </div>
        );
      })}
    </div>
  );
}

// The break running in real time: 30:00, and one second later 29:59. Fixed-width cells, so nothing jitters.
function Countdown({ frame }: { frame: number }) {
  const roll = tw(frame, TICK, 0.28, 0, 1, SWING);
  const size = 80;
  const before = '30:00';
  const after = '29:59';
  return (
    <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: `${size}px`, color: C.hero, opacity: tw(frame, OPEN + 0.42, 0.2, 0, 1) * tw(frame, CORE_LEAVES - 0.12, 0.1, 1, 0) }}>
      {before.split('').map((character, index) => (
        <div key={index} style={{ width: character === ':' ? size * 0.28 : size * 0.6, height: size, overflow: 'hidden', textAlign: 'center' }}>
          <div style={{ transform: `translateY(${character === after[index] ? 0 : -roll * size}px)` }}>
            <div style={{ height: size }}>{character}</div>
            <div style={{ height: size }}>{after[index]}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BreakChips({ frame }: { frame: number }) {
  const leave = tw(frame, 31.5, 0.3, 0, 1, DROP);
  const chosen = sp(frame, 29.7, PRESS);
  return (
    <div style={{ position: 'absolute', left: RAIL.x, top: 700, display: 'flex', gap: 20, opacity: 1 - leave, transform: `translateY(${leave * 30}px)` }}>
      {['15 min', '30 min', '60 min'].map((chip, index) => {
        const pop = sp(frame, 29.3 + index * 0.08, PRESS);
        const picked = index === 1 ? chosen : 0;
        return (
          <div
            key={chip}
            style={{
              height: 88,
              padding: '0 36px',
              borderRadius: R.pill,
              display: 'flex',
              alignItems: 'center',
              fontFamily: TEXT,
              fontWeight: 600,
              fontSize: 44,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              color: picked > 0.5 ? C.hero : C.ink,
              backgroundColor: picked > 0.5 ? C.ink : 'transparent',
              boxShadow: `inset 0 0 0 2px ${picked > 0.5 ? C.ink : C.heroLine}`,
              opacity: pop,
              transform: `translateY(${(1 - pop) * 26}px) scale(${1 + 0.05 * Math.sin(Math.PI * Math.min(1, picked))})`,
            }}
          >
            {chip}
          </div>
        );
      })}
    </div>
  );
}

export function S6StarUnlock() {
  const frame = useAbsFrame();
  const pose = cardPose(frame);
  const depth = 1 - tw(frame, STAR_RISE, 0.5, 0, 1, GLIDE);
  const gone = tw(frame, CARDS_GONE, 0.4, 0, 1, DROP);

  // Lift: the bars leave the card as one broken line. Curl: the line bends into the ring.
  const lift = tw(frame, CARDS_GONE, 0.6, 0, 1, SWING);
  const curl = tw(frame, CURL, 0.65, 0, 1, SWING);
  const length = mix(mix(STAR.pitch * 4, 600, lift), CIRCUMFERENCE, curl);
  const gap = mix(STAR.pitch - (STAR.barH - STAR.barW), 44, lift) * tw(frame, 29.0, 0.4, 1, 0, SWING);

  const core = frame < sec(CORE_LEAVES) ? sp(frame, 29.25, LATCH) : 0;
  const lockLeaves = tw(frame, 31.55, 0.4, 0, 1, DROP);
  const ripple = tw(frame, OPEN, 0.8, 0, 1, GLIDE);

  return (
    <>
      {gone < 1 ? (
        <CardStage>
          <div style={{ position: 'absolute', left: 0, top: 0, transformStyle: 'preserve-3d', transform: `rotateY(${pose.yaw}deg) rotateX(${pose.pitch}deg)` }}>
            <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate3d(0px, ${depth * DECK_STEP.y + (1 - tw(frame, STAR_RISE, 0.5, 0, 1, GLIDE)) * 90}px, ${-depth * DECK_STEP.z - gone * 300}px)`, opacity: tw(frame, STAR_RISE, 0.3, 0, 1) * (1 - gone) }}>
              <Card width={STAR.w} height={STAR.h}>
                <StarFace frame={frame} />
              </Card>
            </div>
          </div>
        </CardStage>
      ) : null}

      {frame >= sec(29.0) ? (
        <div style={{ position: 'absolute', left: STAGE.x, top: STAGE.y, width: 0, height: 0 }}>
          <FocusLock spin={orbitSpin(frame)} draw={tw(frame, 29.0, 0.8, 0, 1, SWING)} rings={1 - lockLeaves} showInner={false} core={core} shackle={sp(frame, OPEN, LATCH)} glyph={1 - tw(frame, OPEN + 0.3, 0.16, 0, 1)}>
            <Countdown frame={frame} />
          </FocusLock>
          {ripple > 0 && ripple < 1 ? (
            <div
              style={{
                position: 'absolute',
                left: -560,
                top: -560,
                width: 1120,
                height: 1120,
                borderRadius: '50%',
                boxShadow: `inset 0 0 0 5px ${C.accentBright}`,
                opacity: 0.6 * (1 - ripple),
                transform: `scale(${0.26 + 0.74 * ripple})`,
              }}
            />
          ) : null}
          <OrbitTiles frame={frame} shield={(index) => 1 - tw(frame, OPEN + 0.08 + index * 0.1, 0.42, 0, 1, SWING)} opacity={tw(frame, 29.2, 0.4, 0, 1) * (1 - lockLeaves)} />
        </div>
      ) : null}

      {frame >= sec(CARDS_GONE) && frame < sec(CLOSED) ? (
        <CurlBars anchorX={mix(BAR_X, STAGE.x - LOCK.inner, lift)} anchorY={mix(BAR_MID_Y, STAGE.y, lift)} radius={LOCK.inner} curl={curl} length={length} gap={gap} width={mix(STAR.barW, 16, curl)} />
      ) : null}
      {frame >= sec(CLOSED) ? <TimerRing cx={STAGE.x} cy={STAGE.y} radius={LOCK.inner} width={16} progress={1 - tw(frame, 31.6, 0.6, 0, 1, SWING)} /> : null}

      <BreakChips frame={frame} />
    </>
  );
}
