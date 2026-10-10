import type { ReactNode } from 'react';
import { TEXT } from '../fonts';
import { C, FPS, PRESS, R, sp, tw } from '../theme';

type Props = {
  frame: number;
  /** Second at which the bubble arrives. */
  tIn: number;
  from: 'jarvis' | 'student';
  /** Screen coordinates of the bubble's top edge and its anchored side. */
  top: number;
  side: number;
  /** A small uppercase tag above the text, for Jarvis's feedback. */
  label?: string;
  /** Extra downward travel on arrival, so a bubble can rise out of the composer. */
  travel?: number;
  children: ReactNode;
};

export const BUBBLE_LINE = 54;

/** One turn of the conversation. Jarvis speaks from the left on a raised surface, the student from the right. */
export function ChatBubble({ frame, tIn, from, top, side, label, travel = 0, children }: Props) {
  const pop = sp(frame, tIn, PRESS);
  const jarvis = from === 'jarvis';
  return (
    <div
      style={{
        position: 'absolute',
        top,
        [jarvis ? 'left' : 'right']: side,
        opacity: tw(frame, tIn, 0.14, 0, 1),
        transform: `translateY(${(1 - pop) * (26 + travel)}px) scale(${0.9 + 0.1 * pop})`,
        transformOrigin: jarvis ? '0% 100%' : '100% 100%',
        padding: '26px 30px 28px',
        borderRadius: R.md,
        [jarvis ? 'borderBottomLeftRadius' : 'borderBottomRightRadius']: R.xs,
        backgroundColor: jarvis ? C.raised : C.pale,
        boxShadow: `inset 0 0 0 2px ${jarvis ? C.line : C.heroLine}, inset 0 3px 0 rgba(255,241,248,0.06)`,
        fontFamily: TEXT,
        fontWeight: 500,
        fontSize: 40,
        lineHeight: `${BUBBLE_LINE}px`,
        letterSpacing: '-0.01em',
        color: C.ink,
        whiteSpace: 'nowrap',
      }}
    >
      {label ? (
        <div style={{ fontSize: 28, lineHeight: '36px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>{label}</div>
      ) : null}
      {children}
    </div>
  );
}

/** Three dots that rise in turn: Jarvis is composing. */
export function TypingDots({ frame, tIn, tOut, top, side }: { frame: number; tIn: number; tOut: number; top: number; side: number }) {
  const shown = tw(frame, tIn, 0.12, 0, 1) * tw(frame, tOut - 0.1, 0.1, 1, 0);
  if (shown <= 0.001) return null;
  const t = frame / FPS;
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: side,
        opacity: shown,
        display: 'flex',
        gap: 12,
        padding: '30px 30px',
        borderRadius: R.md,
        borderBottomLeftRadius: R.xs,
        backgroundColor: C.raised,
        boxShadow: `inset 0 0 0 2px ${C.line}`,
      }}
    >
      {[0, 1, 2].map((index) => {
        const lift = Math.max(0, Math.sin((t - tIn) * 10 - index * 0.9));
        return <div key={index} style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: C.ink, opacity: 0.4 + 0.5 * lift, transform: `translateY(${-9 * lift}px)` }} />;
      })}
    </div>
  );
}
