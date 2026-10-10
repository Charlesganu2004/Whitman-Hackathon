import type { CSSProperties, ReactNode } from 'react';
import { DROP, GLIDE, tw } from '../theme';

type Props = {
  frame: number;
  /** Second at which the line starts to rise. */
  tIn: number;
  /** Second at which it starts to leave. Omit to hold. */
  tOut?: number;
  size: number;
  family: string;
  weight: number;
  color: string;
  /** Tracking in em. */
  tracking?: number;
  /** Visual line height as a multiple of size; the mask itself is taller so descenders survive. */
  leading?: number;
  style?: CSSProperties;
  children: ReactNode;
};

const MASK = 1.32;

/**
 * One line of type that rises from behind a line mask and leaves downward. Words do not bounce,
 * fade or type on: they are revealed, held and withdrawn.
 */
export function KineticLine({ frame, tIn, tOut, size, family, weight, color, tracking = 0, leading = 1.04, style, children }: Props) {
  const box = size * MASK;
  const rise = tw(frame, tIn, 0.5, 1.08, 0, GLIDE);
  const fall = tOut === undefined ? 0 : tw(frame, tOut, 0.3, 0, 1.08, DROP);
  return (
    <div style={{ height: box, marginBottom: (leading - MASK) * size, overflow: 'hidden', ...style }}>
      <div
        style={{
          transform: `translateY(${(rise + fall) * box}px)`,
          fontFamily: family,
          fontWeight: weight,
          fontSize: size,
          lineHeight: `${box}px`,
          letterSpacing: `${tracking}em`,
          color,
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </div>
    </div>
  );
}
