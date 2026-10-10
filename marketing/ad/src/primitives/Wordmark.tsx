import { interpolateColors } from 'remotion';
import { DISPLAY, baselineFromTop, textWidth } from '../fonts';
import { C } from '../theme';

export const WORD = 'unscroll';
export const WORD_WEIGHT = 800;
export const WORD_TRACKING = -0.04;

export type WordmarkLayout = {
  /** Left edge of each letter, measured from the start of the word, kerning included. */
  letterX: number[];
  width: number;
  /** Centre of the full stop, relative to the start of the word and to the baseline. */
  dot: { x: number; y: number; d: number };
  lineHeight: number;
  baseline: number;
};

/** Measures the word at a size. The full stop is placed from the measurement, never hard-coded. */
export const wordmarkLayout = (size: number): WordmarkLayout => {
  const letterX = WORD.split('').map((_, index) => textWidth(WORD.slice(0, index), DISPLAY, WORD_WEIGHT, size, WORD_TRACKING));
  const width = textWidth(WORD, DISPLAY, WORD_WEIGHT, size, WORD_TRACKING);
  const d = size * 0.158;
  const lineHeight = size * 1.2;
  return {
    letterX,
    width,
    dot: { x: width + size * 0.03 + d / 2, y: -d / 2, d },
    lineHeight,
    baseline: baselineFromTop(DISPLAY, WORD_WEIGHT, size, lineHeight),
  };
};

type Props = {
  x: number;
  baselineY: number;
  size: number;
  /** Vertical offset of letter `index`, in em. 0 is at rest; negative is above the mask. */
  letterOffset?: (index: number) => number;
  /** Draw the full stop at rest. Scenes that fly it in draw it themselves. */
  dot?: boolean;
  color?: string;
};

/**
 * Lowercase "unscroll" with a drawn pink disc as its full stop. The letters sit in one mask so
 * they can roll in from above or drop out below; the disc is not a glyph because it travels.
 */
export function Wordmark({ x, baselineY, size, letterOffset, dot = true, color = C.ink }: Props) {
  const layout = wordmarkLayout(size);
  const top = baselineY - layout.baseline;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - size,
          top,
          width: layout.width + size * 2,
          height: layout.baseline + size * 0.06,
          overflow: 'hidden',
        }}
      >
        {WORD.split('').map((letter, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: size + layout.letterX[index],
              top: 0,
              fontFamily: DISPLAY,
              fontWeight: WORD_WEIGHT,
              fontSize: size,
              lineHeight: `${layout.lineHeight}px`,
              letterSpacing: `${WORD_TRACKING}em`,
              color,
              whiteSpace: 'nowrap',
              transform: `translateY(${(letterOffset ? letterOffset(index) : 0) * size}px)`,
            }}
          >
            {letter}
          </div>
        ))}
      </div>
      {dot ? <FullStop x={x + layout.dot.x} y={baselineY + layout.dot.y} d={layout.dot.d} /> : null}
    </>
  );
}

/**
 * The travelling object: a pink disc, wherever it is drawn. `rim` 0 is the flat full stop; `rim` 1
 * is the lock's core, with its brighter fill, border and top light, so the two can hand over.
 */
export function FullStop({ x, y, d, rim = 0, opacity = 1 }: { x: number; y: number; d: number; rim?: number; opacity?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - d / 2,
        top: y - d / 2,
        width: d,
        height: d,
        borderRadius: '50%',
        backgroundColor: interpolateColors(rim, [0, 1], [C.accent, C.accentBright]),
        backgroundImage: `linear-gradient(180deg, rgba(255,255,255,${0.34 * rim}), rgba(255,255,255,0) 46%)`,
        boxShadow: `inset 0 0 0 ${(9 * d * rim) / 280}px ${C.accent}`,
        opacity,
      }}
    />
  );
}
