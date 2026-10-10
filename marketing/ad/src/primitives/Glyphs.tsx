// Small drawn marks. All are generic shapes; none is a third-party logo.

/** A padlock. `open` 0 is latched, 1 has the shackle swung up and out on its right leg. */
export function LockGlyph({ size, color, keyhole, open = 0 }: { size: number; color: string; keyhole: string; open?: number }) {
  return (
    <svg width={size} height={(size * 140) / 120} viewBox="0 0 120 140" style={{ display: 'block', overflow: 'visible' }}>
      <g transform={`rotate(${-36 * open} 84 62) translate(0 ${-7 * open})`}>
        <path d="M36 64 V42 a24 24 0 0 1 48 0 V64" fill="none" stroke={color} strokeWidth={13} strokeLinecap="round" />
      </g>
      <rect x={14} y={58} width={92} height={74} rx={16} fill={color} />
      <circle cx={60} cy={88} r={9.5} fill={keyhole} />
      <rect x={55.5} y={90} width={9} height={22} rx={4.5} fill={keyhole} />
    </svg>
  );
}

export function CheckGlyph({ size, color, weight = 3.2 }: { size: number; color: string; weight?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      <path d="M5 12.6 L10 17.4 L19 7" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MicGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      <rect x={8.5} y={2.5} width={7} height={12} rx={3.5} fill={color} />
      <path d="M5 11.5 a7 7 0 0 0 14 0 M12 18.5 V22" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

/** Jarvis's mark: two open arcs around a point. It echoes the lock's rings and uses no accent. */
export function JarvisOrb({ size, turn, ring, fill, mark }: { size: number; turn: number; ring: string; fill: string; mark: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }}>
      <circle cx={32} cy={32} r={30.5} fill={fill} stroke={ring} strokeWidth={2} />
      <g transform={`rotate(${turn} 32 32)`}>
        <path d="M32 13 a19 19 0 0 1 19 19" fill="none" stroke={mark} strokeWidth={4} strokeLinecap="round" />
        <path d="M32 51 a19 19 0 0 1 -19 -19" fill="none" stroke={mark} strokeWidth={4} strokeLinecap="round" opacity={0.55} />
      </g>
      <circle cx={32} cy={32} r={6.5} fill={mark} />
    </svg>
  );
}
