import type { CSSProperties, ReactNode } from 'react';
import { interpolate } from 'remotion';
import { C, FPS, R, STAGE, SWING, sec } from '../theme';

export const CARD = { w: 760, h: 580 } as const;
/** One step back in the deck: lower, further, dimmer. */
export const DECK_STEP = { y: 30, z: 130 } as const;
/** Second at which the STAR card takes the front of the deck. */
export const STAR_RISE = 26.35;
/** Second at which the cards and the phone fall away and leave only the four bars. */
export const CARDS_GONE = 28.2;

/**
 * The camera's angle on the card deck, shared by the three card scenes so the deck never jumps
 * between them. It turns in as the card arrives and squares up again before the STAR bars lift off.
 */
export const cardPose = (frame: number): { yaw: number; pitch: number } => {
  const keys = [19.3, 20.2, 22.8, 23.4, 26.4, 27.7, 28.2].map(sec);
  const options = { easing: SWING, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
  const yaw = interpolate(frame, keys, [0, -9, -8, -10, -7, -7, 0], options);
  const pitch = interpolate(frame, keys, [0, 3, 3, 3, 3, 3, 0], options);
  const live = interpolate(frame, [sec(20.2), sec(21), sec(27.7), sec(28.2)], [0, 1, 1, 0], options);
  return { yaw: yaw + Math.sin((frame / FPS) * 0.8) * 1.2 * live, pitch };
};

/** A lifted piece of the interface: surface colour, hairline, a top-edge highlight in place of glass. */
export function Card({ width = CARD.w, height = CARD.h, style, children }: { width?: number; height?: number; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: -width / 2,
        top: -height / 2,
        width,
        height,
        borderRadius: R.lg,
        backgroundColor: C.surface,
        boxShadow: `inset 0 0 0 2px ${C.line}, inset 0 3px 0 rgba(255,241,248,0.10)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The 3D rig for the card scenes: one perspective, centred on the stage. Children are placed around
 * the stage centre and may use translateZ and rotation.
 */
export function CardStage({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 2000, perspectiveOrigin: `${STAGE.x}px ${STAGE.y}px` }}>
      <div style={{ position: 'absolute', left: STAGE.x, top: STAGE.y, width: 0, height: 0, transformStyle: 'preserve-3d' }}>{children}</div>
    </div>
  );
}

/** The cards of the interview still to come, stacked behind the front card and falling off in contrast. */
export function Deck({ count = 3, lift = 0, opacity = 1 }: { count?: number; lift?: number; opacity?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const depth = count - index - lift;
        if (depth <= 0.02) return null;
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `translate3d(0px, ${depth * DECK_STEP.y}px, ${-depth * DECK_STEP.z}px)`,
              opacity: Math.max(0, 0.62 - depth * 0.2) * opacity,
            }}
          >
            <Card style={{ backgroundColor: C.raised }} />
          </div>
        );
      })}
    </>
  );
}

/** A soft contact shadow, drawn as a gradient so it costs no blur. */
export function ContactShadow({ width, y, opacity = 1 }: { width: number; y: number; opacity?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: -width / 2,
        top: y,
        width,
        height: 90,
        opacity,
        background: 'radial-gradient(50% 50% at 50% 50%, rgba(11,10,13,0.85), rgba(11,10,13,0) 100%)',
      }}
    />
  );
}
