import { evolvePath } from '@remotion/paths';
import { C, H, W } from '../theme';

/**
 * A point on a line of fixed length that is being bent into a circle.
 * `curl` 0 is a straight vertical line through the anchor; `curl` 1 is a circle of radius `radius`
 * whose leftmost point is the anchor. `s` is the distance along the line from its midpoint.
 * The length never changes while it bends, which is why the move does not look rubbery.
 */
export const curlPoint = (anchorX: number, anchorY: number, radius: number, curl: number, s: number): { x: number; y: number } => {
  if (curl < 0.0005) return { x: anchorX, y: anchorY + s };
  const curvature = curl / radius;
  const theta = curvature * s;
  return { x: anchorX + (1 - Math.cos(theta)) / curvature, y: anchorY + Math.sin(theta) / curvature };
};

type Props = {
  anchorX: number;
  anchorY: number;
  radius: number;
  curl: number;
  /** Total length of the broken line. At `curl` 1 it should be the circumference. */
  length: number;
  /** Length of the break between two of the four bars. */
  gap: number;
  width: number;
  /** How many of the four bars are lit, 0 to 4. */
  lit?: number;
  opacity?: number;
};

const SEGMENTS = 4;
const SAMPLES = 28;

/** The four STAR bars as one broken line that bends, at constant length, into the break ring. */
export function CurlBars({ anchorX, anchorY, radius, curl, length, gap, width, lit = 4, opacity = 1 }: Props) {
  const each = length / SEGMENTS;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, opacity }}>
      {Array.from({ length: SEGMENTS }, (_, segment) => {
        const from = -length / 2 + segment * each + gap / 2;
        const to = -length / 2 + (segment + 1) * each - gap / 2;
        const points = Array.from({ length: SAMPLES + 1 }, (_, i) => curlPoint(anchorX, anchorY, radius, curl, from + ((to - from) * i) / SAMPLES));
        const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
        return <path key={segment} d={d} fill="none" stroke={segment < lit ? C.accent : C.track} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </svg>
  );
}

/** The closed break ring. `progress` 1 is the full ring; lower values pay it out from the top, clockwise. */
export function TimerRing({ cx, cy, radius, width, progress }: { cx: number; cy: number; radius: number; width: number; progress: number }) {
  if (progress <= 0.001) return null;
  const path = `M ${cx} ${cy - radius} a ${radius} ${radius} 0 1 1 0 ${2 * radius} a ${radius} ${radius} 0 1 1 0 ${-2 * radius}`;
  const dash = evolvePath(progress, path);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <path d={path} fill="none" stroke={C.accent} strokeWidth={width} strokeLinecap="round" strokeDasharray={dash.strokeDasharray} strokeDashoffset={dash.strokeDashoffset} />
    </svg>
  );
}
