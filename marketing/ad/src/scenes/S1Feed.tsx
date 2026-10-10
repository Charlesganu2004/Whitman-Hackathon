import { DISPLAY, TEXT, baselineFromTop, textWidth } from '../fonts';
import { KineticLine } from '../primitives/KineticLine';
import { FullStop, WORD_TRACKING, WORD_WEIGHT } from '../primitives/Wordmark';
import { C, DROP, FPS, GLIDE, LATCH, LOCK, R, RAIL, STAGE, SWING, clamp01, mix, sec, sp, tw } from '../theme';
import { useAbsFrame } from '../timeline';

const SIZE = 210;
const LINE = SIZE * 1.2;
const BASE_LESS = 424;
const BASE_WORD = 624;
const STOP = 1.8;
const NAMES = ['Instagram', 'TikTok', 'YouTube', 'Snapchat', 'Reddit', 'Twitch'];

// The feed is thrown twice, then braked. Travel is an explicit function of time so the brake can
// start from the exact speed the feed had on contact.
const flick = (t: number, t0: number, dist: number, dur: number): number => dist * (1 - Math.pow(1 - clamp01((t - t0) / dur), 2.2));
const flickSpeed = (t: number, t0: number, dist: number, dur: number): number => {
  const p = (t - t0) / dur;
  return p < 0 || p >= 1 ? 0 : ((dist * 2.2) / dur) * Math.pow(1 - p, 1.2);
};
const travel = (t: number): number => 50 * t + flick(t, 0.2, 1300, 1.2) + flick(t, 0.9, 2600, 1.6);
const speed = (t: number): number => 50 + flickSpeed(t, 0.2, 1300, 1.2) + flickSpeed(t, 0.9, 2600, 1.6);
const feedOffset = (t: number, lag: number): number => {
  const stop = STOP + lag;
  if (t <= stop) return travel(t);
  const since = t - stop;
  return travel(stop) + (speed(stop) / 22) * Math.exp(-9 * since) * Math.sin(22 * since);
};

const COLUMNS = [
  { x: 1245, scale: 0.8, opacity: 0.5, rate: 0.82, lag: 0.035, shift: 3 },
  { x: 1535, scale: 1, opacity: 1, rate: 1, lag: 0, shift: 0 },
  { x: 1778, scale: 0.64, opacity: 0.28, rate: 0.66, lag: 0.07, shift: 1 },
];
const CARD = { w: 252, h: 100, pitch: 132, count: 12 };

function FeedWall({ t, frame }: { t: number; frame: number }) {
  const dim = tw(frame, 2.4, 0.6, 1, 0.42, SWING);
  const leave = tw(frame, 4.4, 0.5, 0, 1, DROP);
  const stretch = t < STOP ? 1 + Math.min(0.2, speed(t) / 11000) : 1;
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 1800, perspectiveOrigin: '1500px 540px', opacity: dim * (1 - leave) }}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '1500px 540px', transform: `rotateX(14deg) rotateZ(-5deg) scale(${1 - 0.08 * leave})` }}>
        {COLUMNS.map((column) => {
          const offset = feedOffset(t, column.lag) * column.rate;
          const total = CARD.pitch * CARD.count;
          return Array.from({ length: CARD.count }, (_, index) => {
            const y = ((((index * CARD.pitch - offset) % total) + total) % total) - CARD.pitch * 1.5;
            return (
              <div
                key={`${column.x}-${index}`}
                style={{
                  position: 'absolute',
                  left: column.x - CARD.w / 2,
                  top: y * column.scale + 60,
                  width: CARD.w,
                  height: CARD.h,
                  borderRadius: R.sm,
                  backgroundColor: C.cream,
                  opacity: column.opacity,
                  transform: `scale(${column.scale}, ${column.scale * stretch})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: TEXT,
                  fontWeight: 600,
                  fontSize: 40,
                  letterSpacing: '-0.01em',
                  color: C.hero,
                }}
              >
                {NAMES[(index + column.shift) % NAMES.length]}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}

export function S1Feed() {
  const frame = useAbsFrame();
  const t = frame / FPS;
  const measure = (value: string): number => textWidth(value, DISPLAY, WORD_WEIGHT, SIZE, WORD_TRACKING);
  const wUn = measure('un');
  const wScroll = measure('scroll');
  const wIng = measure('ing');
  const baseline = baselineFromTop(DISPLAY, WORD_WEIGHT, SIZE, LINE);
  const type = {
    position: 'absolute' as const,
    fontFamily: DISPLAY,
    fontWeight: WORD_WEIGHT,
    fontSize: SIZE,
    lineHeight: `${LINE}px`,
    letterSpacing: `${WORD_TRACKING}em`,
    color: C.ink,
    whiteSpace: 'nowrap' as const,
  };

  // "un" arrives from beyond the frame edge and shunts "scroll" across with one hard rebound.
  const CONTACT = 2.66;
  const shunt = sp(frame, CONTACT, LATCH);
  const scrollX = wUn * shunt;
  const unX = frame < sec(CONTACT) ? tw(frame, CONTACT - 0.26, 0.26, -(wUn + RAIL.x + 30), -wUn, DROP) : scrollX - wUn;

  const lessFall = tw(frame, 2.4, 0.3, 0, 1.15, DROP);
  const ingGone = tw(frame, 2.4, 0.42, 0, 1, DROP);
  const ingClosed = tw(frame, 2.46, 0.4, 0, 1, SWING);
  const wordFall = tw(frame, 4.4, 0.3, 0, 1.15, DROP);

  // The full stop: drops in, hops to the new end of the word, then crosses to the stage.
  const d0 = SIZE * 0.158;
  const restX = RAIL.x + scrollX + wScroll + wIng * (1 - ingClosed) + SIZE * 0.03 + d0 / 2;
  const restY = BASE_WORD - d0 / 2;
  const fall = tw(frame, STOP - 0.2, 0.2, -460, 0, DROP);
  const since = Math.max(0, t - STOP);
  const bounce = t >= STOP ? -26 * Math.exp(-8 * since) * Math.abs(Math.sin(17 * since)) : 0;
  const hop = -54 * Math.sin(Math.PI * tw(frame, 2.46, 0.46, 0, 1, SWING));
  const fly = tw(frame, 4.4, 0.7, 0, 1, SWING);
  const dotX = mix(restX, STAGE.x, fly);
  const dotY = mix(restY + fall + bounce + hop, STAGE.y, fly) - 130 * Math.sin(Math.PI * fly);
  const dotD = mix(d0, LOCK.core * 0.8, fly);
  const ripple = tw(frame, STOP, 0.55, 0, 1, GLIDE);

  return (
    <>
      <FeedWall t={t} frame={frame} />

      <div style={{ position: 'absolute', left: 0, top: BASE_LESS - baseline, width: 1100, height: baseline + SIZE * 0.06, overflow: 'hidden' }}>
        <div style={{ ...type, left: RAIL.x, top: 0, transform: `translateY(${lessFall * SIZE}px)` }}>Less</div>
      </div>

      <div style={{ position: 'absolute', left: 0, top: BASE_WORD - baseline, width: 1100, height: baseline + SIZE * 0.06, overflow: 'hidden' }}>
        <div style={{ ...type, left: RAIL.x + unX, top: 0, transform: `translateY(${wordFall * SIZE}px)` }}>un</div>
        <div style={{ ...type, left: RAIL.x + scrollX, top: 0, transform: `translateY(${wordFall * SIZE}px)` }}>scroll</div>
      </div>
      {ingGone < 1 ? (
        <div
          style={{
            ...type,
            left: RAIL.x + wScroll,
            top: BASE_WORD - baseline,
            opacity: 1 - tw(frame, 2.62, 0.2, 0, 1),
            transformOrigin: '0% 70%',
            transform: `translateY(${ingGone * 330}px) rotate(${ingGone * 16}deg)`,
          }}
        >
          ing
        </div>
      ) : null}

      <div style={{ position: 'absolute', left: RAIL.x, top: BASE_WORD + 44 }}>
        <KineticLine frame={frame} tIn={3.3} tOut={4.32} size={56} family={TEXT} weight={500} color={C.muted} tracking={-0.01}>
          A better kind of screen time
        </KineticLine>
      </div>

      {ripple > 0 && ripple < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: restX - 120,
            top: restY - 120,
            width: 240,
            height: 240,
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 3px ${C.ink}`,
            opacity: 0.5 * (1 - ripple),
            transform: `scale(${0.14 + 0.86 * ripple})`,
          }}
        />
      ) : null}
      {frame >= sec(STOP - 0.2) && frame < sec(5.1) ? <FullStop x={dotX} y={dotY} d={dotD} rim={tw(frame, 4.75, 0.35, 0, 1, SWING)} /> : null}
    </>
  );
}
