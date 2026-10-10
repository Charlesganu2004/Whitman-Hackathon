import { TEXT } from '../fonts';
import { type Camera, RoadPath, project, roadAt } from '../primitives/RoadPath';
import { FullStop } from '../primitives/Wordmark';
import { C, DROP, GLIDE, H, LINEAR, LOCK, PRESS, STAGE, SWING, W, mix, sec, sp, tw } from '../theme';
import { useAbsFrame } from '../timeline';
import { CORE_LEAVES } from './S6StarUnlock';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master'];
const LABEL_SIZE = [50, 48, 46, 43, 40];
/** The student's place. The road beyond it stays unlit: the film promises no outcome. */
const PLACED = 2;
const PIN = 46;
export const PIN_LEAVES = 35.2;

// Eight lessons as stepping stones beside the first stretches of road.
const STONES = [1.2, 1.42, 1.64, 1.86, 2.2, 2.42, 2.64, 2.86];

const cameraAt = (frame: number): Camera => ({
  x: tw(frame, 33.7, 0.9, 0, 44, SWING),
  z: tw(frame, 31.8, 3.8, -70, 30, LINEAR),
});

const hover = (frame: number, u: number): { x: number; y: number } => {
  const point = roadAt(u);
  const on = project(point.x, point.z, cameraAt(frame));
  return { x: on.x, y: on.y - 78 * on.s };
};

/** Where the pin rests on the frame, so the end card can pick it up from exactly there. */
export const pinRest = (frame: number): { x: number; y: number; d: number } => ({ ...hover(frame, PLACED), d: PIN });

export function S7Road() {
  const frame = useAbsFrame();
  const camera = cameraAt(frame);
  const drawn = tw(frame, CORE_LEAVES + 0.1, 1.1, 0, 6, GLIDE);
  const arrive = tw(frame, CORE_LEAVES, 0.6, 0, 1, SWING);
  const walk = tw(frame, CORE_LEAVES + 0.6, 0.9, 0, 1, SWING);
  const travelled = arrive + walk;
  const shown = tw(frame, CORE_LEAVES - 0.1, 0.4, 0, 1) * tw(frame, PIN_LEAVES, 0.45, 1, 0, DROP);
  const sink = tw(frame, PIN_LEAVES, 0.45, 0, 46, DROP);

  // The core shrinks to a pin and comes down onto the first level, then walks to the student's place.
  const start = hover(frame, 1);
  const riding = hover(frame, Math.max(1, travelled));
  const pinX = mix(STAGE.x, start.x, arrive) + (riding.x - start.x);
  const pinY = mix(STAGE.y, start.y, arrive) + (riding.y - start.y) - 60 * Math.sin(Math.PI * arrive);
  const pinD = mix(LOCK.core, PIN, arrive);

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, opacity: shown, transform: `translateY(${sink}px)` }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(760px 300px at 1390px 900px, rgba(53,35,47,0.75), rgba(53,35,47,0) 100%)' }} />

        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
          {STONES.map((u, index) => {
            const point = roadAt(u);
            const side = index % 2 === 0 ? 1 : -1;
            const cx = point.x + point.nx * 168 * side;
            const cz = point.z + point.nz * 168 * side;
            const corners = [
              [-66, -58],
              [66, -58],
              [66, 58],
              [-66, 58],
            ].map(([dx, dz]) => project(cx + dx, cz + dz, camera));
            const centre = project(cx, cz, camera);
            const pop = sp(frame, CORE_LEAVES + 0.3 + index * 0.05, PRESS);
            return (
              <g key={u} opacity={pop} transform={`translate(0 ${(1 - pop) * -30})`}>
                <polygon points={corners.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} fill={C.surface} stroke={C.line} strokeWidth={2} strokeLinejoin="round" />
                <text x={centre.x} y={centre.y + 11 * centre.s} textAnchor="middle" fontFamily={TEXT} fontWeight={600} fontSize={34 * centre.s} fill={C.muted} opacity={0.8}>
                  {String(index + 1).padStart(2, '0')}
                </text>
              </g>
            );
          })}
        </svg>

        <RoadPath camera={camera} drawn={drawn} travelled={travelled} />

        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
          {LEVELS.map((level, index) => {
            const u = index + 1;
            const point = roadAt(u);
            const on = project(point.x, point.z, camera);
            const pop = sp(frame, CORE_LEAVES + 0.2 + index * 0.13, PRESS);
            const reached = travelled >= u - 0.02;
            return (
              <g key={level} opacity={Math.min(1, pop)}>
                <ellipse cx={on.x} cy={on.y} rx={66 * on.s * pop} ry={29 * on.s * pop} fill={reached ? C.pale : C.surface} stroke={reached ? C.accent : C.heroLine} strokeWidth={Math.max(2, 5 * on.s)} />
                <ellipse cx={on.x} cy={on.y} rx={24 * on.s * pop} ry={10.5 * on.s * pop} fill={reached ? C.accent : C.heroLine} />
              </g>
            );
          })}
        </svg>

        {LEVELS.map((level, index) => {
          const u = index + 1;
          const point = roadAt(u);
          const on = project(point.x, point.z, camera);
          const reached = travelled >= u - 0.02;
          const size = LABEL_SIZE[index];
          const shownLabel = tw(frame, CORE_LEAVES + 0.3 + index * 0.13, 0.4, 0, 1, GLIDE);
          const toRight = index % 2 === 0;
          const offset = 66 * on.s + 26;
          return (
            <div
              key={level}
              style={{
                position: 'absolute',
                top: on.y - size * 0.62,
                ...(toRight ? { left: on.x + offset } : { right: W - on.x + offset }),
                fontFamily: TEXT,
                fontWeight: reached ? 700 : 500,
                fontSize: size,
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                color: reached ? C.ink : C.muted,
                opacity: shownLabel * (reached ? 1 : 0.78),
                transform: `translateY(${(1 - shownLabel) * 18}px)`,
              }}
            >
              {level}
            </div>
          );
        })}

        {(() => {
          const point = roadAt(Math.max(1, travelled));
          const on = project(point.x, point.z, camera);
          return (
            <div
              style={{
                position: 'absolute',
                left: on.x - 34 * on.s,
                top: on.y - 9 * on.s,
                width: 68 * on.s,
                height: 18 * on.s,
                borderRadius: '50%',
                backgroundColor: 'rgba(11,10,13,0.55)',
                opacity: arrive,
              }}
            />
          );
        })()}
      </div>

      {frame >= sec(CORE_LEAVES) && frame < sec(PIN_LEAVES) ? <FullStop x={pinX} y={pinY} d={pinD} rim={1 - arrive} /> : null}
    </>
  );
}
