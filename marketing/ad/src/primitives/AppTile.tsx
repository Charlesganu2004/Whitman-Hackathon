import { TEXT } from '../fonts';
import { C, R, onOrbit, orbitSpin, LOCK } from '../theme';
import { LockGlyph } from './Glyphs';

export const TILE = { w: 236, h: 84 } as const;

type Props = {
  name: string;
  /** Centre of the tile, relative to its parent's origin. */
  x: number;
  y: number;
  /** 0 is free (cream, the brightest thing in the film). 1 is shielded (dark surface). Between is the flip. */
  shield?: number;
  scale?: number;
  opacity?: number;
  /** 0 to 1: an ink outline that marks a tile as picked. */
  picked?: number;
};

/**
 * A distracting app, named in plain text on a generic card. No icon and no brand colour.
 * Luminance carries its state: cream when free, surface when shielded.
 */
export function AppTile({ name, x, y, shield = 0, scale = 1, opacity = 1, picked = 0 }: Props) {
  const dark = shield > 0.5;
  // A flip about the horizontal axis, drawn as a squash so it costs no 3D context.
  const squash = Math.abs(Math.cos(shield * Math.PI));
  // The second half of the flip is the lock landing: the badge overshoots, then settles.
  const locked = dark ? Math.min(1, (shield - 0.5) * 2) : 0;
  const snap = locked + 0.35 * Math.sin(locked * Math.PI);
  return (
    <div
      style={{
        position: 'absolute',
        left: x - TILE.w / 2,
        top: y - TILE.h / 2,
        width: TILE.w,
        height: TILE.h,
        opacity,
        transform: `scale(${scale}, ${scale * Math.max(0.04, squash)})`,
      }}
    >
      {picked > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            inset: -9,
            borderRadius: R.sm + 9,
            boxShadow: `inset 0 0 0 3px ${C.ink}`,
            opacity: picked,
            transform: `scale(${1.08 - 0.08 * picked})`,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: R.sm,
          backgroundColor: dark ? C.surface : C.cream,
          boxShadow: dark ? `inset 0 0 0 2px ${C.line}, inset 0 0 0 ${5 * (1 - locked)}px ${C.accent}` : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: TEXT,
          fontWeight: 600,
          fontSize: 40,
          letterSpacing: '-0.01em',
          color: dark ? C.muted : C.hero,
        }}
      >
        {name}
      </div>
      {dark ? (
        <div
          style={{
            position: 'absolute',
            right: -20,
            top: -24,
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: C.accent,
            boxShadow: `0 0 0 5px ${C.bg}, 0 0 ${26 * (1 - locked) + 10}px ${C.accent}`,
            transform: `scale(${snap})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LockGlyph size={25} color={C.onAccent} keyhole={C.accent} />
        </div>
      ) : null}
    </div>
  );
}

export const PICKED = ['Instagram', 'TikTok', 'YouTube'] as const;

/** The three picked tiles riding the lock's orbit, 120 degrees apart. `shield` may differ per tile. */
export function OrbitTiles({ frame, shield, opacity = 1 }: { frame: number; shield: (index: number) => number; opacity?: number }) {
  const spin = orbitSpin(frame);
  return (
    <>
      {PICKED.map((name, index) => {
        const at = onOrbit(spin + index * 120, LOCK.orbit);
        return <AppTile key={name} name={name} x={at.x} y={at.y} shield={shield(index)} opacity={opacity} />;
      })}
    </>
  );
}
