import { C, H, W } from '../theme';

// The road is drawn by projecting floor points to the screen in code rather than by tilting an
// element in CSS, so labels stay upright and sharp and the stroke tapers with distance.
export type Camera = { x: number; z: number };
export type Projected = { x: number; y: number; s: number };

const VANISH_X = 1390;
const HORIZON_Y = 250;
const CAMERA_HEIGHT = 760;
const FOCAL = 900;

export const project = (worldX: number, worldZ: number, camera: Camera): Projected => {
  const s = FOCAL / (FOCAL + Math.max(-FOCAL * 0.6, worldZ - camera.z));
  return { x: VANISH_X + (worldX - camera.x) * s, y: HORIZON_Y + CAMERA_HEIGHT * s, s };
};

/** Lead-in, the five levels, lead-out. Levels sit at whole numbers of the path parameter, 1 to 5. */
export const ROAD_POINTS: ReadonlyArray<readonly [number, number]> = [
  [-40, -320],
  [-238, 121],
  [244, 391],
  [-342, 811],
  [408, 1543],
  [-253, 2900],
  [260, 5200],
];

const at = (index: number): readonly [number, number] => ROAD_POINTS[Math.min(ROAD_POINTS.length - 1, Math.max(0, index))];

/** Catmull-Rom through the road's points. `u` runs 0 to 6. Returns position and unit normal on the floor. */
export const roadAt = (u: number): { x: number; z: number; nx: number; nz: number } => {
  const clamped = Math.min(ROAD_POINTS.length - 1 - 0.0001, Math.max(0, u));
  const i = Math.floor(clamped);
  const t = clamped - i;
  const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
  const basis = (a: number, b: number, c: number, d: number): number =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  const slope = (a: number, b: number, c: number, d: number): number =>
    0.5 * (-a + c + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t * t);
  const dx = slope(p0[0], p1[0], p2[0], p3[0]);
  const dz = slope(p0[1], p1[1], p2[1], p3[1]);
  const len = Math.hypot(dx, dz) || 1;
  return { x: basis(p0[0], p1[0], p2[0], p3[0]), z: basis(p0[1], p1[1], p2[1], p3[1]), nx: dz / len, nz: -dx / len };
};

const strip = (from: number, to: number, halfWidth: number, camera: Camera): string => {
  if (to - from < 0.002) return '';
  const steps = Math.max(2, Math.ceil((to - from) * 26));
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = roadAt(from + ((to - from) * i) / steps);
    const a = project(p.x + p.nx * halfWidth, p.z + p.nz * halfWidth, camera);
    const b = project(p.x - p.nx * halfWidth, p.z - p.nz * halfWidth, camera);
    left.push(`${a.x.toFixed(1)},${a.y.toFixed(1)}`);
    right.unshift(`${b.x.toFixed(1)},${b.y.toFixed(1)}`);
  }
  return [...left, ...right].join(' ');
};

type Props = {
  camera: Camera;
  /** How far the unlit road has drawn itself, 0 to 6. */
  drawn: number;
  /** How far the travelled, pink part reaches, 0 to 6. */
  travelled: number;
  opacity?: number;
};

/** A road receding across the floor. The travelled part is the only pink; the rest is track colour. */
export function RoadPath({ camera, drawn, travelled, opacity = 1 }: Props) {
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, opacity }}>
      <defs>
        <linearGradient id="road-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.24" stopColor={C.track} stopOpacity="0" />
          <stop offset="0.42" stopColor={C.track} stopOpacity="1" />
          <stop offset="1" stopColor={C.heroLine} stopOpacity="1" />
        </linearGradient>
      </defs>
      <polygon points={strip(0, drawn, 46, camera)} fill="url(#road-fade)" />
      <polygon points={strip(0, Math.min(drawn, travelled), 46, camera)} fill={C.accent} />
    </svg>
  );
}
