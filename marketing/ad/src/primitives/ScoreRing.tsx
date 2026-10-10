import type { ReactNode } from 'react';
import { interpolateColors } from 'remotion';
import { C, deg } from '../theme';

const TICKS = 40;

type Props = {
  size: number;
  /** 0 to 1: the fraction of the forty markers that are lit, clockwise from the top. */
  lit: number;
  /** 1 is earned (pink). 0 is withdrawn. */
  earned?: number;
  children?: ReactNode;
};

/** A ring of forty markers that light one by one. The answer's overall mark sits inside it. */
export function ScoreRing({ size, lit, earned = 1, children }: Props) {
  const outer = size / 2 - 2;
  const inner = outer - size * 0.13;
  const on = interpolateColors(earned, [0, 1], [C.heroLine, C.accent]);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} style={{ display: 'block' }}>
        {Array.from({ length: TICKS }, (_, index) => {
          const a = deg((index / TICKS) * 360 - 90);
          const isLit = lit * TICKS > index + 0.5;
          return (
            <line
              key={index}
              x1={Math.cos(a) * inner}
              y1={Math.sin(a) * inner}
              x2={Math.cos(a) * outer}
              y2={Math.sin(a) * outer}
              stroke={isLit ? on : C.track}
              strokeWidth={size * 0.034}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  );
}
