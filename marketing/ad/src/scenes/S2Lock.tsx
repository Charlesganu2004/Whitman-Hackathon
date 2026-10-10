import { AppTile } from '../primitives/AppTile';
import { FocusLock } from '../primitives/FocusLock';
import { C, DROP, GLIDE, HERO_ART, LATCH, LINEAR, LOCK, PRESS, STAGE, SWING, mix, onOrbit, orbitSpin, sec, sp, tw } from '../theme';
import { useAbsFrame } from '../timeline';

// Six cards arrive from the feed. Even slots are the ones the student picks; they sit 120 degrees
// apart, which is where the three shielded tiles ride for the rest of the film.
const TILES = [
  { name: 'Instagram', pickedAt: 5.9 },
  { name: 'Snapchat', pickedAt: null },
  { name: 'TikTok', pickedAt: 6.2 },
  { name: 'Reddit', pickedAt: null },
  { name: 'YouTube', pickedAt: 6.5 },
  { name: 'Twitch', pickedAt: null },
];
const SHUT = 7.2;

export function S2Lock() {
  const frame = useAbsFrame();
  const spin = orbitSpin(frame);

  // The pull-back: the lock that filled the stage comes to rest as artwork on the phone's Today card.
  const pull = tw(frame, 10.6, 1.2, 0, 1, SWING);
  const creep = 1 + 0.035 * tw(frame, 5.0, 5.6, 0, 1, LINEAR) * (1 - pull);
  const x = mix(STAGE.x, HERO_ART.x, pull);
  const y = mix(STAGE.y, HERO_ART.y, pull);
  const scale = mix(1, HERO_ART.s, pull) * creep;

  const landed = frame >= sec(5.1);
  const core = landed ? mix(0.8, 1, sp(frame, 5.1, LATCH)) : 0;
  const shackle = 1 - sp(frame, SHUT - 0.05, LATCH);
  const ripple = tw(frame, SHUT, 0.75, 0, 1, GLIDE);

  let pickIndex = 0;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, transform: `scale(${scale})` }}>
      <FocusLock spin={spin} draw={tw(frame, 5.0, 1.1, 0, 1, SWING)} core={core} shackle={shackle} />

      {ripple > 0 && ripple < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: -LOCK.outer - 60,
            top: -LOCK.outer - 60,
            width: (LOCK.outer + 60) * 2,
            height: (LOCK.outer + 60) * 2,
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 4px ${C.accentBright}`,
            opacity: 0.55 * (1 - ripple),
            transform: `scale(${0.34 + 0.66 * ripple})`,
          }}
        />
      ) : null}

      {TILES.map((tile, index) => {
        const arrive = tw(frame, 4.86 + index * 0.06, 0.85, 0, 1, GLIDE);
        const slot = onOrbit(spin + index * 60, LOCK.orbit);
        const from = { x: 180 + (index % 3) * 150, y: -640 + index * 250 };
        if (tile.pickedAt === null) {
          const leave = tw(frame, 6.72, 0.4, 0, 1, DROP);
          const out = onOrbit(spin + index * 60, LOCK.orbit + 90 * leave);
          return (
            <AppTile
              key={tile.name}
              name={tile.name}
              x={mix(from.x, out.x, arrive)}
              y={mix(from.y, out.y, arrive)}
              opacity={tw(frame, 4.86 + index * 0.06, 0.25, 0, 1) * mix(1, 0.5, tw(frame, 5.9, 0.6, 0, 1)) * (1 - leave)}
              scale={1 - 0.14 * leave}
            />
          );
        }
        const order = pickIndex++;
        const picked = sp(frame, tile.pickedAt, PRESS);
        return (
          <AppTile
            key={tile.name}
            name={tile.name}
            x={mix(from.x, slot.x, arrive)}
            y={mix(from.y, slot.y, arrive)}
            opacity={tw(frame, 4.86 + index * 0.06, 0.25, 0, 1)}
            picked={picked * tw(frame, SHUT + 0.05, 0.3, 1, 0)}
            shield={tw(frame, SHUT + 0.06 + order * 0.08, 0.42, 0, 1, SWING)}
          />
        );
      })}
    </div>
  );
}
