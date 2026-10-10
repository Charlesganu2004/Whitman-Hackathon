import { interpolateColors } from 'remotion';
import { TEXT } from '../fonts';
import { C, R } from '../theme';

type Props = {
  label: string;
  width: number;
  /** 0 to 1: how far the bar has filled. */
  value: number;
  /** 1 is earned (pink). 0 is withdrawn: the bar keeps its length and loses its colour. */
  earned?: number;
};

/** One skill on Jarvis's evaluation: a 40 px label over a bar. Pink only while it is earned. */
export function SkillMeter({ label, width, value, earned = 1 }: Props) {
  return (
    <div style={{ width }}>
      <div style={{ fontFamily: TEXT, fontWeight: 600, fontSize: 40, lineHeight: '48px', letterSpacing: '-0.01em', color: C.ink, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ marginTop: 14, height: 16, borderRadius: R.pill, backgroundColor: C.track, overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.max(0, Math.min(1, value)) * 100}%`,
            height: '100%',
            borderRadius: R.pill,
            backgroundColor: interpolateColors(earned, [0, 1], [C.heroLine, C.accent]),
          }}
        />
      </div>
    </div>
  );
}
