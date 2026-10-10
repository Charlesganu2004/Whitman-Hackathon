import { Easing, interpolate, spring } from 'remotion';

// One constant decides the frame rate. Every time in the film is written in seconds and
// converted through sec(), so changing FPS re-times the whole film.
export const FPS = 60;
export const W = 1920;
export const H = 1080;
export const DURATION_S = 39.6;
export const sec = (seconds: number): number => Math.round(seconds * FPS);
export const DURATION = sec(DURATION_S);

// The app's dark pink theme. Every neutral is plum-tinted; there is no second hue.
export const C = {
  bg: '#111014',
  bgDeep: '#0B0A0D',
  surface: '#1D1A20',
  raised: '#252027',
  hero: '#211820',
  heroLine: '#624050',
  ink: '#FAEFF5',
  cream: '#FFF1F8',
  muted: '#B9A7B3',
  line: '#3D303A',
  track: '#44303E',
  accent: '#F28DBB',
  accentBright: '#FFB0D4',
  onAccent: '#27121E',
  pale: '#35232F',
} as const;

// One radius scale. Pills are fully round; nothing else is invented per component.
export const R = { xs: 12, sm: 20, md: 28, lg: 40, xl: 56, phone: 78, pill: 999 } as const;

export const SAFE = 80;
export const RAIL = { x: 96, w: 764, top: 330 } as const;
export const STAGE = { x: 1390, y: 540 } as const;
export const LOCK = { core: 280, inner: 200, mid: 290, outer: 380, orbit: 330 } as const;

// Six curves, used by name. Nothing else moves anything.
export const GLIDE = Easing.bezier(0.16, 1, 0.3, 1);
export const SWING = Easing.bezier(0.65, 0, 0.35, 1);
export const DROP = Easing.bezier(0.7, 0, 0.84, 0);
export const LINEAR = Easing.linear;
export const PRESS = { mass: 1, stiffness: 180, damping: 18 } as const;
export const LATCH = { mass: 1, stiffness: 260, damping: 18 } as const;
export const SETTLE = { mass: 1, stiffness: 100, damping: 200 } as const;

type Ease = (t: number) => number;
type SpringConfig = { mass: number; stiffness: number; damping: number };

/** Tween from `from` to `to`, starting at `start` seconds and lasting `dur` seconds, clamped both sides. */
export const tw = (frame: number, start: number, dur: number, from: number, to: number, easing: Ease = GLIDE): number =>
  interpolate(frame, [sec(start), sec(start) + Math.max(1, sec(dur))], [from, to], {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** A spring that starts at `start` seconds and settles at 1. Zero before it starts. */
export const sp = (frame: number, start: number, config: SpringConfig = PRESS): number =>
  frame < sec(start) ? 0 : spring({ frame: frame - sec(start), fps: FPS, config });

export const mix = (a: number, b: number, p: number): number => a + (b - a) * p;
export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const deg = (d: number): number => (d * Math.PI) / 180;

/** The lock's markers and orbiting tiles turn at one shared, linear rate so every scene agrees. */
export const orbitSpin = (frame: number): number => 14 + (frame / FPS) * 5;
export const onOrbit = (angleDeg: number, radius: number): { x: number; y: number } => ({
  x: Math.cos(deg(angleDeg)) * radius,
  y: Math.sin(deg(angleDeg)) * radius,
});

/** Where the lock sits once it has become the artwork on the phone's Today card. */
export const HERO_ART = { x: 1582, y: 380, s: 0.34 } as const;
