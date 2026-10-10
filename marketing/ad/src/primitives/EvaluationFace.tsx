import { DISPLAY, TEXT } from '../fonts';
import { C } from '../theme';
import { CheckGlyph } from './Glyphs';
import { ScoreRing } from './ScoreRing';
import { SkillMeter } from './SkillMeter';

export const SKILLS = ['Communication', 'Technical discussion', 'Coding'] as const;

type Props = {
  /** Fill of each of the three meters, 0 to 1. */
  fills: [number, number, number];
  /** 1 is earned (pink). 0 is withdrawn. */
  earned: number;
  /** The mark inside the ring. A demo state of the interface, not a claim. */
  score: number;
  /** Fraction of the ring's markers that are lit. */
  lit: number;
  status: 'pending' | 'passed' | 'notYet';
  /** 0 to 1 arrival of the status line. */
  statusIn: number;
  question: string;
};

/** Jarvis's evaluation of one answer: an overall mark in a ring and three skills, each on its own meter. */
export function EvaluationFace({ fills, earned, score, lit, status, statusIn, question }: Props) {
  const settled = status !== 'pending';
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 48, top: 40, fontFamily: DISPLAY, fontWeight: 700, fontSize: 54, lineHeight: '62px', letterSpacing: '-0.025em', color: C.ink }}>Evaluation</div>

      <div style={{ position: 'absolute', left: 48, top: 112, height: 48, display: 'flex', alignItems: 'center', fontFamily: TEXT, fontWeight: 500, fontSize: 32, color: C.muted, opacity: settled ? 1 - statusIn : 1 }}>{question}</div>
      {settled ? (
        <div style={{ position: 'absolute', left: 48, top: 112, height: 48, display: 'flex', alignItems: 'center', gap: 14, opacity: statusIn, transform: `translateY(${(1 - statusIn) * 14}px)` }}>
          {status === 'passed' ? (
            <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckGlyph size={30} color={C.hero} weight={3.6} />
            </div>
          ) : null}
          <div style={{ fontFamily: TEXT, fontWeight: 600, fontSize: 40, letterSpacing: '-0.01em', color: status === 'passed' ? C.ink : C.muted }}>{status === 'passed' ? 'Passed' : 'Not yet'}</div>
        </div>
      ) : null}

      <div style={{ position: 'absolute', right: 44, top: 36 }}>
        <ScoreRing size={140} lit={lit} earned={earned}>
          <div style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 50, letterSpacing: '-0.02em', color: earned > 0.5 ? C.ink : C.muted, fontVariantNumeric: 'tabular-nums' }}>{score}</div>
        </ScoreRing>
      </div>

      {SKILLS.map((skill, index) => (
        <div key={skill} style={{ position: 'absolute', left: 48, top: 212 + index * 114 }}>
          <SkillMeter label={skill} width={664} value={fills[index]} earned={earned} />
        </div>
      ))}
    </div>
  );
}
