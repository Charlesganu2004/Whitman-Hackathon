import type { ReactNode } from 'react';
import { evolvePath } from '@remotion/paths';
import { C, LOCK, deg } from '../theme';
import { LockGlyph } from './Glyphs';

const circlePath = (r: number): string => `M ${-r} 0 a ${r} ${r} 0 1 1 ${2 * r} 0 a ${r} ${r} 0 1 1 ${-2 * r} 0`;

type Props = {
  /** Rotation of the marker ring, in degrees. */
  spin: number;
  /** 0 to 1: how much of each hairline ring has drawn itself. */
  draw?: number;
  /** Opacity of the hairline rings and markers, for ghosting. */
  rings?: number;
  /** Hide the innermost hairline when the pink timer ring stands in its place. */
  showInner?: boolean;
  /** Scale of the pink core, 0 to 1 and beyond for overshoot. */
  core?: number;
  /** 0 latched, 1 open. */
  shackle?: number;
  /** Opacity of the padlock on the core. */
  glyph?: number;
  /** Drawn in the middle of the core, over the padlock. */
  children?: ReactNode;
};

/**
 * The app's focus-lock illustration: three hairline rings, sixteen markers, one diagonal, and the
 * pink core that is the film's travelling full stop. Drawn around its own origin, so a parent
 * places and scales it.
 */
export function FocusLock({ spin, draw = 1, rings = 1, showInner = true, core = 1, shackle = 0, glyph = 1, children }: Props) {
  const radii = [
    { r: LOCK.outer, stroke: 'rgba(222,194,209,0.20)', delay: 0.0 },
    { r: LOCK.mid, stroke: 'rgba(255,176,212,0.22)', delay: 0.14 },
    { r: LOCK.inner, stroke: 'rgba(222,194,209,0.32)', delay: 0.28 },
  ];
  const box = LOCK.outer * 2 + 40;
  const markerRadius = 245;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}>
      <svg width={box} height={box} viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`} style={{ position: 'absolute', left: -box / 2, top: -box / 2, overflow: 'visible', opacity: rings }}>
        {radii.map((ring, index) => {
          if (index === 2 && !showInner) return null;
          const local = Math.min(1, Math.max(0, (draw - ring.delay) / (1 - 0.28)));
          const path = circlePath(ring.r);
          const dash = evolvePath(local, path);
          return (
            <path
              key={ring.r}
              d={path}
              fill="none"
              stroke={ring.stroke}
              strokeWidth={2}
              strokeDasharray={dash.strokeDasharray}
              strokeDashoffset={dash.strokeDashoffset}
              transform={`rotate(${-90 - index * 40})`}
            />
          );
        })}
        <line
          x1={-Math.cos(deg(32)) * 330 * draw}
          y1={Math.sin(deg(32)) * 330 * draw}
          x2={Math.cos(deg(32)) * 330 * draw}
          y2={-Math.sin(deg(32)) * 330 * draw}
          stroke="rgba(98,64,80,0.55)"
          strokeWidth={2}
        />
        <g transform={`rotate(${-spin * 1.6})`}>
          {Array.from({ length: 16 }, (_, index) => {
            const shown = draw * 16 > index ? 1 : 0;
            const a = deg((index / 16) * 360);
            const long = index % 4 === 0;
            return (
              <line
                key={index}
                x1={Math.cos(a) * (markerRadius - (long ? 12 : 6))}
                y1={Math.sin(a) * (markerRadius - (long ? 12 : 6))}
                x2={Math.cos(a) * (markerRadius + (long ? 12 : 6))}
                y2={Math.sin(a) * (markerRadius + (long ? 12 : 6))}
                stroke={long ? 'rgba(250,239,245,0.55)' : 'rgba(185,167,179,0.42)'}
                strokeWidth={long ? 4 : 3}
                strokeLinecap="round"
                opacity={shown}
              />
            );
          })}
        </g>
      </svg>
      {core > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: -LOCK.core / 2,
            top: -LOCK.core / 2,
            width: LOCK.core,
            height: LOCK.core,
            borderRadius: '50%',
            transform: `scale(${core})`,
            backgroundColor: C.accentBright,
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0) 46%)',
            boxShadow: `inset 0 0 0 9px ${C.accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ opacity: glyph, transform: 'translateY(-6px)' }}>
            <LockGlyph size={104} color={C.hero} keyhole={C.accentBright} open={shackle} />
          </div>
          {children ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
