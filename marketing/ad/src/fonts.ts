import { loadFont as loadDisplay } from '@remotion/google-fonts/BricolageGrotesque';
import { loadFont as loadText } from '@remotion/google-fonts/InstrumentSans';

// One display face and one text family, both SIL Open Font License, both loaded by the package.
const display = loadDisplay('normal', { weights: ['700', '800'], subsets: ['latin'] });
const text = loadText('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });

export const DISPLAY = display.fontFamily;
export const TEXT = text.fontFamily;

/** Resolves once every weight is usable. The film does not mount, and nothing is measured, before it does. */
export const fontsReady: Promise<unknown> = Promise.all([display.waitUntilDone(), text.waitUntilDone()]);

let measureContext: CanvasRenderingContext2D | null = null;
const context = (): CanvasRenderingContext2D => {
  if (!measureContext) {
    const made = document.createElement('canvas').getContext('2d');
    if (!made) throw new Error('2D canvas is unavailable, so type cannot be measured.');
    measureContext = made;
  }
  return measureContext;
};

const widths = new Map<string, number>();

/** Advance width of a run of text, including tracking, in logical pixels. */
export const textWidth = (value: string, family: string, weight: number, size: number, trackingEm = 0): number => {
  const key = `${family}|${weight}|${size}|${trackingEm}|${value}`;
  const known = widths.get(key);
  if (known !== undefined) return known;
  const c = context();
  c.font = `${weight} ${size}px "${family}"`;
  (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${trackingEm * size}px`;
  const measured = c.measureText(value).width;
  widths.set(key, measured);
  return measured;
};

/** Distance from the top of a line box of height `lineHeight` down to the baseline (CSS half-leading model). */
export const baselineFromTop = (family: string, weight: number, size: number, lineHeight: number): number => {
  const c = context();
  c.font = `${weight} ${size}px "${family}"`;
  const m = c.measureText('Hxg');
  return (lineHeight - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
};
