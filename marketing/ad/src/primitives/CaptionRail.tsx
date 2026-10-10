import { DISPLAY, TEXT } from '../fonts';
import { C, RAIL, sec } from '../theme';
import { KineticLine } from './KineticLine';

export type CaptionCue = {
  /** 'headline' is a sentence at 84 px. 'statement' is two or three words at 150 px. */
  kind: 'headline' | 'statement';
  tIn: number;
  tOut: number;
  lines: string[];
  support?: { tIn: number; lines: string[] };
};

const STAGGER = 0.07;

/**
 * The fixed caption rail. Captions live outside every 3D rig, are never transformed or blurred,
 * and always start on the same line, so a viewer learns in one scene where to read.
 */
export function CaptionRail({ frame, cues }: { frame: number; cues: CaptionCue[] }) {
  return (
    <>
      {cues.map((cue) => {
        if (frame < sec(cue.tIn) - 2 || frame > sec(cue.tOut) + sec(0.5)) return null;
        const statement = cue.kind === 'statement';
        return (
          <div key={`${cue.tIn}-${cue.lines[0]}`} style={{ position: 'absolute', left: RAIL.x, top: RAIL.top, width: RAIL.w }}>
            {cue.lines.map((line, index) => (
              <KineticLine
                key={line}
                frame={frame}
                tIn={cue.tIn + index * STAGGER}
                tOut={cue.tOut}
                size={statement ? 150 : 84}
                family={DISPLAY}
                weight={statement ? 800 : 700}
                color={C.ink}
                tracking={statement ? -0.035 : -0.025}
                leading={statement ? 0.96 : 1.08}
              >
                {line}
              </KineticLine>
            ))}
            {cue.support ? (
              <div style={{ marginTop: 34 }}>
                {cue.support.lines.map((line, index) => (
                  <KineticLine
                    key={line}
                    frame={frame}
                    tIn={(cue.support?.tIn ?? cue.tIn) + index * STAGGER}
                    tOut={cue.tOut}
                    size={56}
                    family={TEXT}
                    weight={500}
                    color={C.muted}
                    tracking={-0.01}
                    leading={1.2}
                  >
                    {line}
                  </KineticLine>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
