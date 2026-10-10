import { useEffect, useState } from 'react';
import { Composition, cancelRender, continueRender, delayRender } from 'remotion';
import { Film } from './Film';
import { fontsReady } from './fonts';
import { DURATION, FPS, H, W } from './theme';

// The film measures its own type (the wordmark, the full stop), so nothing mounts and no frame is
// captured until both families have loaded.
function FilmWhenFontsAreReady() {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('Loading Bricolage Grotesque and Instrument Sans'));
  useEffect(() => {
    fontsReady
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((error: unknown) => cancelRender(error));
  }, [handle]);
  return ready ? <Film /> : null;
}

export function Root() {
  return <Composition id="UnscrollAd" component={FilmWhenFontsAreReady} durationInFrames={DURATION} fps={FPS} width={W} height={H} />;
}
