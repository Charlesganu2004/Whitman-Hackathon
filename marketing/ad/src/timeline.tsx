import { createContext, useContext, type ReactNode } from 'react';
import { Sequence, useCurrentFrame } from 'remotion';
import { sec } from './theme';

const SceneStart = createContext(0);

/**
 * Mounts its children between two absolute times. Inside, useAbsFrame() returns the frame of the
 * whole film, so every scene is written against the same clock as the shooting script.
 */
export function Scene({ from, to, children }: { from: number; to: number; children: ReactNode }) {
  return (
    <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)} layout="none">
      <SceneStart.Provider value={sec(from)}>{children}</SceneStart.Provider>
    </Sequence>
  );
}

export const useAbsFrame = (): number => useCurrentFrame() + useContext(SceneStart);
