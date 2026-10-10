import type { ReactNode } from 'react';
import { C, R } from '../theme';

// Seen close: the slab is taller than the frame, so the camera can tilt along it.
export const PHONE = { x: 990, w: 800, h: 1736, bezel: 16 } as const;
export const SCREEN = { w: PHONE.w - PHONE.bezel * 2, h: PHONE.h - PHONE.bezel * 2 } as const;

/**
 * A plain phone slab: hairline outline, shell concentric with the screen corner, and nothing else.
 * No notch, island, buttons or logo. Children are placed in screen coordinates.
 */
export function PhoneFrame({ top, children }: { top: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: PHONE.x,
        top,
        width: PHONE.w,
        height: PHONE.h,
        borderRadius: R.phone,
        backgroundColor: '#18151B',
        boxShadow: `inset 0 0 0 2px ${C.line}, inset 0 3px 0 rgba(255,241,248,0.10)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: PHONE.bezel,
          top: PHONE.bezel,
          width: SCREEN.w,
          height: SCREEN.h,
          borderRadius: R.phone - PHONE.bezel,
          overflow: 'hidden',
          backgroundColor: C.bg,
          boxShadow: `inset 0 0 0 2px ${C.bgDeep}`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
