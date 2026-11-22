import type { CSSProperties, ReactNode } from "react";

/**
 * The championship mascot — "Nova" — assembled on screen, then powering on.
 *
 * ── The character ────────────────────────────────────────────────────────
 * A sleek hover-robot: a pearl capsule body shaded for volume, a dark glass
 * visor with glowing LED eyes and smile, headphone-style ear pods with magenta
 * cores, a pulsing energy core in the chest and a thruster instead of legs. It
 * floats above a holographic pad and waves. Original work, drawn from
 * primitives — no existing character is referenced.
 *
 * ── The choreography ─────────────────────────────────────────────────────
 * Every part is its own `<g class="part">` flying in from its own direction:
 * thruster, torso, arms, head, ear pods, visor. Each landing throws a small
 * spark. Then it powers on — eyes open with a blink, the smile draws itself,
 * the antenna beacon lights, the core starts to pulse — and a burst of pixel
 * confetti marks "ready". After that it idles: hovering, blinking, waving.
 *
 * All timings live in `T`, in ms from mount; the build log under the stage
 * reads the same table, so the caption can never drift from the picture.
 *
 * ── Why the whole sequence is CSS ────────────────────────────────────────
 * Every keyframe lives in `globals.css` and this stays a server component, so
 * the hero never waits on a bundle. Every animation uses `fill-mode: both`,
 * and every idle loop starts and ends on its rest pose: under the global
 * reduced-motion rule the robot simply appears, built and still.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** The build schedule, ms from mount. */
const T = {
  thruster: 250,
  torso: 560,
  armL: 920,
  armR: 1040,
  head: 1340,
  earL: 1640,
  earR: 1720,
  visor: 1860,
  eyes: 2100,
  smile: 2300,
  antenna: 2420,
  beacon: 2640,
  ready: 2820,
  confetti: 2860,
  /** Idle loops wait until the build has settled. */
  idle: 3500,
} as const;

/** Captions for the build log, each shown from its start until the next. */
const LOG = [
  { key: "chassis", at: T.thruster },
  { key: "body", at: T.torso },
  { key: "arms", at: T.armL },
  { key: "head", at: T.head },
  { key: "boot", at: T.eyes },
] as const;

export type AssemblyLabels = Record<(typeof LOG)[number]["key"] | "ready", string>;

/** Pixel confetti thrown when the robot is ready: [dx, dy, rotate, colour]. */
const CONFETTI: [number, number, number, string][] = [
  [-190, -120, -160, "var(--electric-500)"],
  [-120, -170, 120, "var(--gold-400)"],
  [-30, -190, -90, "var(--magenta-500)"],
  [70, -180, 140, "#7fe9ff"],
  [160, -140, -120, "var(--gold-400)"],
  [210, -40, 200, "var(--magenta-500)"],
  [190, 90, -150, "var(--electric-500)"],
  [-200, 60, 160, "var(--magenta-500)"],
  [-150, 140, -200, "var(--gold-400)"],
  [120, 150, 110, "#7fe9ff"],
  [-60, 170, 90, "var(--electric-400)"],
  [30, -120, -60, "#ffffff"],
];

const ms = (n: number) => `${n}ms`;

/** LED colour of the eyes and smile. */
const LED = "#8ff0ff";

/** One moving part. x/y/r/s are where it starts, relative to where it lands. */
function Part({
  at,
  x = 0,
  y = 0,
  r = 0,
  s = 1,
  children,
}: {
  at: number;
  x?: number;
  y?: number;
  r?: number;
  s?: number;
  children: ReactNode;
}) {
  return (
    <g
      className="part"
      style={
        {
          "--fx": `${x}px`,
          "--fy": `${y}px`,
          "--fr": `${r}deg`,
          "--fs": s,
          "--d": ms(at),
        } as CSSProperties
      }
    >
      {children}
    </g>
  );
}

/** A small burst at the joint where a part lands, timed to the landing. */
function Spark({ x, y, at }: { x: number; y: number; at: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="spark" style={{ "--d": ms(at) } as CSSProperties}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <path
            key={deg}
            d="M0 -10V-18"
            transform={`rotate(${deg})`}
            stroke={deg % 90 === 0 ? "var(--gold-400)" : LED}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}
        <circle r="4" fill="#fff" />
      </g>
    </g>
  );
}

/** Gradients and the glow filter. Ids are prefixed: one hero per page. */
function Defs() {
  return (
    <defs>
      {/* Pearl shell: lit from the top-left, falling into a cool blue shade. */}
      <linearGradient id="nova-pearl" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.45" stopColor="#e9eeff" />
        <stop offset="1" stopColor="#9fb0e6" />
      </linearGradient>
      <linearGradient id="nova-pearl-side" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#a9b8ea" />
      </linearGradient>
      {/* Joints and the thruster housing: brushed graphite. */}
      <linearGradient id="nova-metal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5d6b94" />
        <stop offset="1" stopColor="#252f52" />
      </linearGradient>
      {/* Visor glass. */}
      <linearGradient id="nova-visor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1b2a5c" />
        <stop offset="0.6" stopColor="#0a1230" />
        <stop offset="1" stopColor="#050a1e" />
      </linearGradient>
      <linearGradient id="nova-visor-rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7b96ff" />
        <stop offset="0.5" stopColor="#d940e6" />
        <stop offset="1" stopColor="#7b96ff" />
      </linearGradient>
      {/* Chest core: white-hot centre through electric blue to magenta. */}
      <radialGradient id="nova-core" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.35" stopColor="#9fe9ff" />
        <stop offset="0.7" stopColor="#5c7bff" />
        <stop offset="1" stopColor="#c118cf" />
      </radialGradient>
      <radialGradient id="nova-ear" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffd6ff" />
        <stop offset="0.5" stopColor="#d940e6" />
        <stop offset="1" stopColor="#7a0085" />
      </radialGradient>
      {/* Thruster flame and the beam down to the pad. */}
      <radialGradient id="nova-flame" cx="0.5" cy="0.15" r="0.85">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.3" stopColor="#9fe9ff" />
        <stop offset="0.7" stopColor="#5c7bff" stopOpacity="0.6" />
        <stop offset="1" stopColor="#5c7bff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="nova-beam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8fa8ff" stopOpacity="0.55" />
        <stop offset="1" stopColor="#8fa8ff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="nova-pad" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#8fa8ff" stopOpacity="0.55" />
        <stop offset="0.6" stopColor="#5c7bff" stopOpacity="0.18" />
        <stop offset="1" stopColor="#5c7bff" stopOpacity="0" />
      </radialGradient>
      {/* Soft bloom for anything that emits light. */}
      <filter id="nova-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* Contact shade where one shell part sits on another. */}
      <filter id="nova-soft" x="-20%" y="-50%" width="140%" height="200%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
    </defs>
  );
}

function Robot() {
  // Sparks land a beat after the part starts moving: the spring settles at
  // roughly 55% of its 700ms run.
  const land = (at: number) => at + 380;

  return (
    <svg
      viewBox="0 0 400 400"
      className="absolute inset-0 size-full overflow-visible"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <Defs />

      {/* ── Holographic pad. Stays put while the robot hovers above it. ── */}
      <ellipse cx="200" cy="372" rx="130" ry="22" fill="url(#nova-pad)" />
      <ellipse
        className="pad-ring"
        cx="200"
        cy="372"
        rx="112"
        ry="17"
        stroke="#8fa8ff"
        strokeWidth={2}
        style={{ "--d": ms(T.ready) } as CSSProperties}
      />
      <ellipse
        className="pad-ring"
        cx="200"
        cy="372"
        rx="150"
        ry="24"
        stroke="#d940e6"
        strokeWidth={1.5}
        strokeDasharray="6 10"
        style={{ "--d": ms(T.ready + 120) } as CSSProperties}
      />

      {/* ── The robot. Everything in here hovers. ── */}
      <g className="nova-hover" style={{ "--d": ms(T.idle) } as CSSProperties}>
        {/* Thruster: housing, flame and the light beam down to the pad. */}
        <Part at={T.thruster} y={60} s={0.6}>
          <path
            className="nova-beam"
            d="M184 318 L120 372 H280 L216 318 Z"
            fill="url(#nova-beam)"
            style={{ "--d": ms(T.ready) } as CSSProperties}
          />
          <g className="nova-flame">
            <ellipse cx="200" cy="332" rx="15" ry="26" fill="url(#nova-flame)" filter="url(#nova-glow)" />
          </g>
          <path d="M174 296 H226 L218 318 Q200 324 182 318 Z" fill="url(#nova-metal)" />
          <path d="M184 318 Q200 323 216 318" stroke={LED} strokeWidth={2.5} filter="url(#nova-glow)" />
        </Part>

        {/* Left arm, relaxed, drawn behind the torso. */}
        <Part at={T.armL} x={-90} y={-20} r={-30}>
          <path d="M150 206 Q122 226 116 258" stroke="url(#nova-metal)" strokeWidth={14} />
          <path d="M150 206 Q122 226 116 258" stroke="url(#nova-pearl-side)" strokeWidth={10} />
          <circle cx="114" cy="268" r="15" fill="url(#nova-pearl)" />
          <circle cx="114" cy="268" r="15" stroke="#ffffff" strokeOpacity="0.6" strokeWidth={1.5} />
          <circle cx="126" cy="262" r="6" fill="url(#nova-pearl)" />
        </Part>

        {/* Torso: a pearl shell tapering to the thruster. */}
        <Part at={T.torso} y={-170} r={-6}>
          <path
            d="M146 204 Q146 172 182 170 H218 Q254 172 254 204 L248 262 Q242 302 200 304 Q158 302 152 262 Z"
            fill="url(#nova-pearl)"
          />
          {/* Rim light on the shaded side, specular on the lit side. */}
          <path
            d="M250 210 L245 262 Q240 296 205 302"
            stroke="#8fa8ff"
            strokeWidth={3}
            strokeOpacity="0.7"
          />
          <path d="M160 196 Q162 182 180 180" stroke="#ffffff" strokeWidth={5} strokeOpacity="0.9" />
          {/* Panel line and a belt of light. */}
          <path d="M158 266 Q200 284 242 266" stroke="#7b96ff" strokeWidth={2} strokeOpacity="0.55" />
          {/* Energy core in a graphite socket. */}
          <circle cx="200" cy="226" r="25" fill="url(#nova-metal)" />
          <circle cx="200" cy="226" r="25" stroke="#ffffff" strokeOpacity="0.35" strokeWidth={1.5} />
          <g className="nova-core" style={{ "--d": ms(T.ready) } as CSSProperties}>
            <circle cx="200" cy="226" r="17" fill="url(#nova-core)" filter="url(#nova-glow)" />
          </g>
          <path
            d="M200 213 L203.4 222 L213 222 L205.3 227.6 L208.2 237 L200 231.2 L191.8 237 L194.7 227.6 L187 222 L196.6 222 Z"
            fill="#ffffff"
            fillOpacity="0.85"
          />
        </Part>

        {/* Right arm, raised to wave. The wave pivots at the shoulder. */}
        <Part at={T.armR} x={90} y={-40} r={30}>
          <g
            className="nova-wave"
            style={{ "--d": ms(T.idle + 400), transformOrigin: "250px 204px" } as CSSProperties}
          >
            <path d="M250 206 Q286 198 302 174" stroke="url(#nova-metal)" strokeWidth={14} />
            <path d="M250 206 Q286 198 302 174" stroke="url(#nova-pearl-side)" strokeWidth={10} />
            <path d="M302 174 L320 140" stroke="url(#nova-metal)" strokeWidth={13} />
            <path d="M302 174 L320 140" stroke="url(#nova-pearl-side)" strokeWidth={9} />
            <circle cx="302" cy="174" r="8" fill="url(#nova-metal)" />
            <circle cx="325" cy="128" r="16" fill="url(#nova-pearl)" />
            <circle cx="325" cy="128" r="16" stroke="#ffffff" strokeOpacity="0.6" strokeWidth={1.5} />
            <circle cx="312" cy="120" r="6.5" fill="url(#nova-pearl)" />
          </g>
        </Part>

        {/* Shoulder joints, over both arm roots. */}
        <Part at={T.armL} x={-40}>
          <circle cx="152" cy="204" r="13" fill="url(#nova-pearl)" />
          <circle cx="152" cy="204" r="5" fill={LED} filter="url(#nova-glow)" />
        </Part>
        <Part at={T.armR} x={40}>
          <circle cx="248" cy="204" r="13" fill="url(#nova-pearl)" />
          <circle cx="248" cy="204" r="5" fill={LED} filter="url(#nova-glow)" />
        </Part>

        {/* Neck: a graphite collar with a soft contact shadow. */}
        <Part at={T.head} y={-40}>
          <rect x="182" y="156" width="36" height="18" rx="7" fill="url(#nova-metal)" />
          <ellipse cx="200" cy="170" rx="34" ry="5" fill="#1b2550" opacity="0.35" filter="url(#nova-soft)" />
        </Part>

        {/* Antenna, rising out of the head once the head is on. */}
        <Part at={T.antenna} y={30}>
          <path d="M200 46 V22" stroke="#c9d4f5" strokeWidth={5} />
          <path d="M198.5 44 V24" stroke="#ffffff" strokeWidth={1.5} strokeOpacity="0.8" />
          <circle
            className="beacon"
            cx="200"
            cy="16"
            r="16"
            fill="var(--gold-400)"
            style={{ "--d": ms(T.beacon) } as CSSProperties}
          />
          <circle cx="200" cy="16" r="7.5" fill="var(--gold-300)" filter="url(#nova-glow)" />
          <circle cx="197.5" cy="13.5" r="2.2" fill="#fff" />
        </Part>

        {/* Head: a wide pearl capsule. */}
        <Part at={T.head} y={-210} r={8}>
          <rect x="114" y="40" width="172" height="122" rx="58" fill="url(#nova-pearl)" />
          <path d="M150 52 Q170 44 200 44" stroke="#ffffff" strokeWidth={6} />
          <path
            d="M282 92 Q284 140 240 158"
            stroke="#8fa8ff"
            strokeWidth={3}
            strokeOpacity="0.7"
          />
        </Part>

        {/* Ear pods with magenta cores. */}
        <Part at={T.earL} x={-50}>
          <ellipse cx="112" cy="102" rx="15" ry="27" fill="url(#nova-pearl-side)" />
          <ellipse cx="110" cy="102" rx="6" ry="15" fill="url(#nova-ear)" filter="url(#nova-glow)" />
        </Part>
        <Part at={T.earR} x={50}>
          <ellipse cx="288" cy="102" rx="15" ry="27" fill="url(#nova-pearl-side)" />
          <ellipse cx="290" cy="102" rx="6" ry="15" fill="url(#nova-ear)" filter="url(#nova-glow)" />
        </Part>

        {/* Visor: dark glass with a gradient rim and a reflection. */}
        <Part at={T.visor} s={0.4}>
          <rect x="132" y="64" width="136" height="78" rx="36" fill="url(#nova-visor)" />
          <rect
            x="132"
            y="64"
            width="136"
            height="78"
            rx="36"
            stroke="url(#nova-visor-rim)"
            strokeWidth={2.5}
          />
          <path
            d="M150 84 Q160 72 184 70"
            stroke="#ffffff"
            strokeOpacity="0.28"
            strokeWidth={5}
          />
        </Part>

        {/* Power-on: LED eyes open with a blink, then blink now and again. */}
        <g className="eye" style={{ "--d": ms(T.eyes) } as CSSProperties}>
          <g className="nova-blink" style={{ "--d": ms(T.idle + 1200) } as CSSProperties}>
            <rect x="164" y="86" width="20" height="30" rx="10" fill={LED} filter="url(#nova-glow)" />
            <rect x="216" y="86" width="20" height="30" rx="10" fill={LED} filter="url(#nova-glow)" />
            <circle cx="178" cy="94" r="3.5" fill="#ffffff" />
            <circle cx="230" cy="94" r="3.5" fill="#ffffff" />
          </g>
        </g>

        {/* The smile draws itself, in light. */}
        <path
          className="draw"
          d="M188 126 q12 9 24 0"
          pathLength={1}
          stroke={LED}
          strokeWidth={4}
          filter="url(#nova-glow)"
          style={{ "--d": ms(T.smile) } as CSSProperties}
        />

        {/* Cheeks — the detail that reads as friendly rather than mechanical. */}
        <g className="fade" style={{ "--d": ms(T.smile + 160) } as CSSProperties}>
          <ellipse cx="152" cy="122" rx="8" ry="5" fill="#d940e6" opacity="0.55" filter="url(#nova-glow)" />
          <ellipse cx="248" cy="122" rx="8" ry="5" fill="#d940e6" opacity="0.55" filter="url(#nova-glow)" />
        </g>

        {/* Sparks at every joint, on top of everything. */}
        <Spark x={200} y={300} at={land(T.thruster)} />
        <Spark x={200} y={172} at={land(T.torso)} />
        <Spark x={152} y={204} at={land(T.armL)} />
        <Spark x={248} y={204} at={land(T.armR)} />
        <Spark x={200} y={160} at={land(T.head)} />
        <Spark x={112} y={102} at={land(T.earL)} />
        <Spark x={288} y={102} at={land(T.earR)} />
        <Spark x={200} y={16} at={land(T.antenna)} />
      </g>
    </svg>
  );
}

/**
 * The caption under the stage: what is being built right now, then "ready".
 * Decorative — hidden from assistive technology rather than announced five
 * times.
 */
function BuildLog({ labels }: { labels: AssemblyLabels }) {
  return (
    <div aria-hidden="true" className="mx-auto mt-2 w-full max-w-xs">
      {/* Captions share one grid cell, so a label that wraps on a narrow
          phone grows the row instead of running into the progress bar. */}
      <div className="grid min-h-6 place-items-center text-center font-mono text-2xs font-semibold uppercase leading-snug tracking-[0.14em]">
        {LOG.map((step, i) => {
          const end = i + 1 < LOG.length ? LOG[i + 1].at : T.ready;
          return (
            <span
              key={step.key}
              className="log-step col-start-1 row-start-1 text-brand"
              style={{ "--d": ms(step.at), "--len": ms(end - step.at) } as CSSProperties}
            >
              {labels[step.key]}
            </span>
          );
        })}
        <span
          className="log-ready col-start-1 row-start-1 inline-flex items-center justify-center gap-2 text-accent-ink"
          style={{ "--d": ms(T.ready) } as CSSProperties}
        >
          <span className="size-2 shrink-0 rounded-full bg-accent" />
          {labels.ready}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div
          className="build-progress h-full rounded-full"
          style={{ "--d": ms(T.thruster), "--len": ms(T.ready - T.thruster) } as CSSProperties}
        />
      </div>
    </div>
  );
}

export function HeroRobot({
  className,
  style,
  labels,
}: {
  className?: string;
  style?: CSSProperties;
  labels: AssemblyLabels;
}) {
  return (
    <div className={className} style={style}>
      <div className="assembly-stage relative mx-auto aspect-square w-full max-w-lg">
        {/* Backlight: a soft halo in the logo's blue and magenta, so the
            pearl shell glows against the night canvas. */}
        <div aria-hidden="true" className="nova-halo pointer-events-none absolute inset-[6%] rounded-full" />

        {/* Blueprint frame: corner brackets and a scan line that sweeps the
            stage while the robot is being built. */}
        <div aria-hidden="true" className="pointer-events-none absolute -inset-3 sm:-inset-5">
          <span className="stage-corner left-0 top-0 border-l-[3px] border-t-[3px]" />
          <span className="stage-corner right-0 top-0 border-r-[3px] border-t-[3px]" />
          <span className="stage-corner bottom-0 left-0 border-b-[3px] border-l-[3px]" />
          <span className="stage-corner bottom-0 right-0 border-b-[3px] border-r-[3px]" />
          <span
            className="scan-line"
            style={{ "--d": ms(T.thruster), "--len": ms(T.ready - T.thruster) } as CSSProperties}
          />
        </div>

        <Robot />

        {/* Pixel confetti from the chest core when the robot is ready. */}
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[56%]">
          {CONFETTI.map(([dx, dy, rot, color], i) => (
            <span
              key={i}
              className="confetti"
              style={
                {
                  "--dx": `${dx}px`,
                  "--dy": `${dy}px`,
                  "--rot": `${rot}deg`,
                  "--d": ms(T.confetti + (i % 4) * 30),
                  background: color,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>

      <BuildLog labels={labels} />
    </div>
  );
}
