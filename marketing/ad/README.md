# Unscroll launch film

A 39.6 second film for Unscroll, drawn and scored entirely in code with [Remotion](https://www.remotion.dev). No stock footage, photos or downloaded assets: every frame is React, SVG and CSS, the score is synthesised by a script, and the narrator is generated from text.

The finished 1080p cut and its poster are in [`docs/media`](../../docs/media). The 4K master is rendered locally and stays out of git.

## Preview and render

```bash
npm install
```

```bash
npm run studio
```

```bash
npm run render
```

```bash
npm run render:hd
```

- `studio` opens the timeline in a browser.
- `render` writes the 3840 by 2160 master to `out/unscroll-ad-4k.mp4`.
- `render:hd` writes a 1920 by 1080 file to `out/unscroll-ad-1080p.mp4`.

The film is authored at 1920 by 1080 and 60 frames per second. Every time in the source is written in seconds through `sec()` in `src/theme.ts`, so changing `FPS` there re-times the whole film. On an 8 thread laptop the 4K render takes about 17 minutes.

## Sound

```bash
npm run audio
```

```bash
npm run narration
```

- `audio` runs `scripts/make-audio.mjs`, which writes `public/soundtrack.wav` from oscillators, noise and envelopes.
- `narration` runs `scripts/make-narration.mjs`, which sends each narrator line to Groq's `canopylabs/orpheus-v1-english` voice and writes `public/narration-*.wav` and the schedule in `src/narration.json`. It reads `GROQ_API_KEY` from the repository `.env` and never prints it. Each line must stay under 200 characters, and the free tier allows only a small number of requests a day.

## Where things are

- `SCRIPT.md`: the shooting script, scene by scene.
- `src/Film.tsx`: scene order, captions, score and narration.
- `src/scenes`: one file per scene.
- `src/primitives`: the shared pieces (wordmark, lock, app tiles, chat bubbles, meters, road).
- `src/theme.ts`: colours, easing, springs and timing helpers.

## Licence note

Remotion is free for individuals and for companies of up to three people. Larger companies need a Remotion company licence. The graphics, score and narration script in this folder are original to this project.
