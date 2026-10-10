import { AbsoluteFill } from 'remotion';
import { C, FPS, H, W } from '../theme';

export type Bloom = { x: number; y: number; radius: number; alpha: number };

/** The stage: one dark plum field, a slow ambient drift, and at most one bloom. Sits under every scene. */
export function Backdrop({ frame, bloom }: { frame: number; bloom: Bloom }) {
  const t = frame / FPS;
  const driftX = 640 + Math.sin(t * 0.21) * 90;
  const driftY = 420 + Math.cos(t * 0.17) * 60;
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 700px at ${driftX}px ${driftY}px, rgba(53,35,47,0.55), rgba(53,35,47,0) 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(${bloom.radius}px ${bloom.radius}px at ${bloom.x}px ${bloom.y}px, rgba(242,141,187,${bloom.alpha}), rgba(242,141,187,0) 70%)`,
        }}
      />
    </AbsoluteFill>
  );
}

/** A soft vignette. Sits over every scene so the whole frame shares one surface. */
export function Finish() {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `radial-gradient(${W * 0.76}px ${H * 0.9}px at 50% 50%, rgba(11,10,13,0) 60%, rgba(11,10,13,0.6) 100%)`,
      }}
    />
  );
}
