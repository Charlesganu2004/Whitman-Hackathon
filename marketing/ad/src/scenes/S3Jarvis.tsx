import { TEXT, textWidth } from '../fonts';
import { OrbitTiles } from '../primitives/AppTile';
import { BUBBLE_LINE, ChatBubble, TypingDots } from '../primitives/ChatBubble';
import { FocusLock } from '../primitives/FocusLock';
import { CheckGlyph, JarvisOrb, LockGlyph, MicGlyph } from '../primitives/Glyphs';
import { PHONE, PhoneFrame, SCREEN } from '../primitives/PhoneFrame';
import { C, DROP, FPS, GLIDE, HERO_ART, PRESS, R, STAGE, SWING, mix, orbitSpin, sec, sp, tw } from '../theme';
import { useAbsFrame } from '../timeline';

// Two framings of one tall phone. TOP shows the Today screen; BOTTOM shows the conversation and
// the composer. The move between them is the scene's one camera move.
const TOP = 96;
const BOTTOM = 1000 - PHONE.h;
const SCREEN_X = PHONE.x + PHONE.bezel;
const CHAT_Y = TOP - BOTTOM; // screen y that sits at the top of the frame in the BOTTOM framing, less the bezel

export const FEEDBACK_AT = 17.2;
export const HANDOVER = 19.2;
const FEEDBACK_LINES = ['Good. Next, say why it', 'is fast.'];
const FEEDBACK_TOP = CHAT_Y + 474;

/** Where Jarvis's feedback bubble sits on the frame at the moment it becomes the evaluation card. */
export const feedbackBubbleRect = (): { x: number; y: number; w: number; h: number } => {
  const w = textWidth(FEEDBACK_LINES[0], TEXT, 500, 40, -0.01) + 60;
  const h = 26 + 36 + 8 + BUBBLE_LINE * 2 + 28;
  return { x: SCREEN_X + 36, y: FEEDBACK_TOP + BOTTOM + PHONE.bezel, w, h };
};

const label = (size: number, weight: number, color: string) => ({
  fontFamily: TEXT,
  fontWeight: weight,
  fontSize: size,
  lineHeight: 1.15,
  color,
  whiteSpace: 'nowrap' as const,
});

function TodayScreen({ frame }: { frame: number }) {
  const leave = tw(frame, 12.04, 0.36, 0, 1, DROP);
  if (leave >= 1) return null;
  const press = frame < sec(12.0) ? tw(frame, 11.88, 0.12, 1, 0.955, SWING) : mix(0.955, 1, sp(frame, 12.0, PRESS));
  const artX = HERO_ART.x - SCREEN_X;
  const artY = HERO_ART.y - TOP - PHONE.bezel;
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN.w, height: 1100, opacity: 1 - leave, transform: `translateX(${-70 * leave}px)` }}>
      <div style={{ position: 'absolute', left: 40, top: 38, ...label(28, 700, C.muted), letterSpacing: '0.1em' }}>TODAY</div>

      <div style={{ position: 'absolute', left: 32, top: 88, width: 704, height: 360, borderRadius: R.lg, backgroundColor: C.hero, boxShadow: `inset 0 0 0 2px ${C.heroLine}`, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 40, top: 42, ...label(56, 700, C.ink), lineHeight: '62px', letterSpacing: '-0.02em' }}>
          Today&rsquo;s
          <br />
          interview
        </div>
        <div style={{ position: 'absolute', left: 40, top: 270, display: 'flex', alignItems: 'center', gap: 14 }}>
          <LockGlyph size={24} color={C.muted} keyhole={C.hero} />
          <div style={{ ...label(32, 500, C.muted) }}>3 apps shielded</div>
        </div>
        {frame >= sec(11.8) ? (
          <div style={{ position: 'absolute', left: artX - 32, top: artY - 88, width: 0, height: 0, transform: `scale(${HERO_ART.s})` }}>
            <FocusLock spin={orbitSpin(frame)} />
            <OrbitTiles frame={frame} shield={() => 1} />
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 32,
          top: 480,
          width: 704,
          height: 108,
          borderRadius: R.md,
          backgroundColor: C.accent,
          transform: `scale(${press})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...label(42, 700, C.onAccent),
          letterSpacing: '-0.01em',
        }}
      >
        Start today&rsquo;s interview
      </div>

      <div style={{ position: 'absolute', left: 40, top: 636, ...label(30, 600, C.muted) }}>This week</div>
      {days.map((day, index) => {
        const done = index < 3;
        const today = index === 3;
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: 32 + index * (76 + 28.6),
              top: 692,
              width: 76,
              height: 76,
              borderRadius: '50%',
              backgroundColor: done ? C.pale : 'transparent',
              boxShadow: `inset 0 0 0 ${today ? 3 : 2}px ${today ? C.ink : done ? C.heroLine : C.line}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...label(30, 600, today ? C.ink : C.muted),
            }}
          >
            {done ? <CheckGlyph size={34} color={C.muted} /> : day}
          </div>
        );
      })}

      <div style={{ position: 'absolute', left: 32, top: 820, width: 704, height: 300, borderRadius: R.lg, backgroundColor: C.surface, boxShadow: `inset 0 0 0 2px ${C.line}` }}>
        <div style={{ position: 'absolute', left: 40, top: 36, ...label(36, 600, C.ink) }}>Focus and app access</div>
      </div>
    </div>
  );
}

const ANSWER = ['Binary', 'search:', 'halve', 'it', 'each', 'step.'];
const REC_ON = 14.4;
const REC_OFF = 16.0;

function ChatScreen({ frame }: { frame: number }) {
  const t = frame / FPS;
  const enter = tw(frame, 12.36, 0.42, 0, 1, GLIDE);
  if (enter <= 0) return null;
  const recording = tw(frame, REC_ON, 0.16, 0, 1) * tw(frame, REC_OFF, 0.14, 1, 0);
  const flatten = tw(frame, REC_OFF, 0.22, 1, 0, SWING);
  const swell = 0.3 + 0.7 * Math.abs(Math.sin(((t - REC_ON) * Math.PI) / 0.56));
  const pulse = ((t - REC_ON) % 0.6) / 0.6;
  const seconds = Math.min(1, Math.max(0, Math.floor(t - REC_ON)));
  const composerTop = CHAT_Y + 724;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN.w, height: SCREEN.h, opacity: enter, transform: `translateY(${(1 - enter) * 70}px)` }}>
      <div style={{ position: 'absolute', left: 36, top: CHAT_Y - 4 }}>
        <JarvisOrb size={68} turn={t * 40} ring={C.heroLine} fill={C.raised} mark={C.cream} />
      </div>
      <div style={{ position: 'absolute', left: 122, top: CHAT_Y + 6, ...label(40, 700, C.ink), letterSpacing: '-0.01em' }}>Jarvis</div>
      <div style={{ position: 'absolute', right: 36, top: CHAT_Y + 14, ...label(30, 500, C.muted) }}>AI interviewer</div>
      <div style={{ position: 'absolute', left: 36, right: 36, top: CHAT_Y + 84, height: 2, backgroundColor: C.line }} />

      <TypingDots frame={frame} tIn={13.2} tOut={13.6} top={CHAT_Y + 110} side={36} />
      <ChatBubble frame={frame} tIn={13.6} from="jarvis" top={CHAT_Y + 110} side={36}>
        How do you search a
        <br />
        sorted list?
      </ChatBubble>

      <ChatBubble frame={frame} tIn={REC_OFF} from="student" top={CHAT_Y + 296} side={36} travel={360}>
        {[ANSWER.slice(0, 4), ANSWER.slice(4)].map((line, lineIndex) => (
          <div key={lineIndex} style={{ textAlign: 'right' }}>
            {line.map((word, wordIndex) => {
              const order = lineIndex * 4 + wordIndex;
              const shown = tw(frame, REC_OFF + 0.1 + order * 0.085, 0.16, 0, 1, GLIDE);
              return (
                <span key={word} style={{ display: 'inline-block', opacity: shown, transform: `translateY(${(1 - shown) * 14}px)`, marginLeft: wordIndex === 0 ? 0 : '0.26em' }}>
                  {word}
                </span>
              );
            })}
          </div>
        ))}
      </ChatBubble>

      <TypingDots frame={frame} tIn={16.8} tOut={FEEDBACK_AT} top={FEEDBACK_TOP} side={36} />
      {frame < sec(HANDOVER) ? (
        <ChatBubble frame={frame} tIn={FEEDBACK_AT} from="jarvis" top={FEEDBACK_TOP} side={36} label="Feedback">
          {FEEDBACK_LINES[0]}
          <br />
          {FEEDBACK_LINES[1]}
        </ChatBubble>
      ) : null}

      <div style={{ position: 'absolute', left: 36, top: composerTop, width: 568, height: 108, borderRadius: R.pill, backgroundColor: C.surface, boxShadow: `inset 0 0 0 2px ${C.line}`, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 40, top: 32, ...label(36, 500, C.muted), opacity: 1 - recording }}>Type or speak</div>
        <div style={{ position: 'absolute', left: 40, top: 0, height: 108, display: 'flex', alignItems: 'center', gap: 6, opacity: Math.max(recording, tw(frame, REC_OFF + 0.34, 0.14, 1, 0) * (frame >= sec(REC_OFF) ? 1 : 0)) }}>
          {Array.from({ length: 28 }, (_, index) => {
            const voice = (0.5 + 0.5 * Math.sin(t * 13 + index * 1.7)) * (0.45 + 0.55 * Math.sin(t * 7.3 + index * 0.6) ** 2) * swell;
            return <div key={index} style={{ width: 8, height: 6 + 66 * voice * flatten, borderRadius: R.pill, backgroundColor: C.ink, opacity: 0.86 }} />;
          })}
        </div>
        <div style={{ position: 'absolute', right: 34, top: 34, ...label(34, 600, C.muted), fontVariantNumeric: 'tabular-nums', opacity: recording }}>0:0{seconds}</div>
      </div>
      <div style={{ position: 'absolute', left: 624, top: composerTop, width: 108, height: 108 }}>
        {recording > 0.01 ? (
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: `inset 0 0 0 4px ${C.accent}`, opacity: recording * 0.6 * (1 - pulse), transform: `scale(${1 + 0.42 * pulse})` }} />
        ) : null}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 - 0.06 * recording})` }}>
          <div style={{ position: 'absolute', opacity: 1 - recording }}>
            <MicGlyph size={52} color={C.onAccent} />
          </div>
          <div style={{ width: 34, height: 34, borderRadius: R.xs * 0.7, backgroundColor: C.onAccent, opacity: recording }} />
        </div>
      </div>
    </div>
  );
}

export function S3Jarvis() {
  const frame = useAbsFrame();
  const t = frame / FPS;
  const rise = tw(frame, 10.7, 0.95, 560, 0, GLIDE);
  const tilt = tw(frame, 12.0, 0.9, 0, 1, SWING);
  const settle = tw(frame, 18.5, 0.7, 1, 0, SWING);
  const yaw = (tw(frame, 12.0, 0.9, 0, -6, SWING) + Math.sin(t * 0.9) * 1.1 * tilt) * settle;
  const back = tw(frame, HANDOVER, 0.6, 0, 1, SWING);
  const gone = tw(frame, 28.2, 0.45, 0, 1, DROP);
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 2400, perspectiveOrigin: `${STAGE.x}px ${STAGE.y}px`, opacity: tw(frame, 10.7, 0.35, 0, 1) * mix(1, 0.26, back) * (1 - gone) }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: `${STAGE.x}px ${STAGE.y}px`,
          transform: `translate3d(${back * 210}px, ${rise}px, ${-back * 560 - gone * 300}px) rotateY(${yaw}deg) rotateX(${1.6 * tilt * settle}deg)`,
        }}
      >
        <PhoneFrame top={mix(TOP, BOTTOM, tilt)}>
          <TodayScreen frame={frame} />
          <ChatScreen frame={frame} />
        </PhoneFrame>
      </div>
    </div>
  );
}
