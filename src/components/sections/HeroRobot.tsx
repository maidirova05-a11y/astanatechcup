import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { BRAND_ASSETS } from "@/config/event";

/**
 * The championship mascot, assembled on screen part by part, then presenting
 * the logo.
 *
 * ── The choreography ─────────────────────────────────────────────────────
 * Every painted part is its own `<g class="part">` and flies in from its own
 * direction, in build order: feet, legs, torso, arms, head, ear pods, face
 * plate. Each landing throws a small spark at the joint. Then the robot powers
 * on — eyes open with a blink, the smile draws itself, the antenna beacon
 * lights — and only then does the logo pop in between its hands, with a burst
 * of pixel confetti in the logo's own colours.
 *
 * All timings live in `T` below, in milliseconds from mount, so the whole
 * sequence can be retuned in one place. The build log under the stage reads
 * from the same table, so the caption can never drift from the picture.
 *
 * ── How it is composed ───────────────────────────────────────────────────
 * Three layers stacked in a square container, all sharing one 400×400
 * coordinate space:
 *
 *   1. `<RobotBody />`  — every part except the hands. Behind.
 *   2. the logo         — a real `next/image`, absolutely positioned at the
 *                         percentages that correspond to the sign box in the
 *                         SVG viewBox.
 *   3. `<RobotHands />`  — only the hands, drawn on top so they overlap the
 *                         logo's edges. That overlap is the entire illusion:
 *                         behind it, the robot is merely near the logo.
 *
 * The container is `aspect-square` and both SVGs use the same square viewBox,
 * so viewBox units map to percentages at a fixed 1:4 ratio and the hands land
 * on the logo edges at every screen size. Change the sign box below and the
 * `LOGO_BOX` percentages must change with it.
 *
 * ── Why the whole sequence is CSS ────────────────────────────────────────
 * A JavaScript entrance ships `opacity: 0` from the server and needs the
 * bundle to run before anything is visible. On the hero that is not a risk
 * worth taking, so every keyframe lives in `globals.css` and this file stays a
 * server component — no Motion in the hero bundle at all. Every animation uses
 * `fill-mode: both`, so under the global reduced-motion rule (zero duration,
 * negative delay) the robot simply appears already built, holding the logo.
 * ─────────────────────────────────────────────────────────────────────────
 */

const STROKE = 7;

/** Sign box in viewBox units: x 44, y 170, w 312, h 132 — 2.36:1, the logo's ratio. */
const LOGO_BOX = {
  left: "11%",
  top: "42.5%",
  width: "78%",
  height: "33%",
} as const;

/** The build schedule, ms from mount. */
const T = {
  stage: 0,
  feet: 250,
  legs: 520,
  torso: 820,
  armL: 1180,
  armR: 1300,
  head: 1600,
  earL: 1900,
  earR: 1980,
  face: 2120,
  eyes: 2360,
  smile: 2560,
  antenna: 2680,
  beacon: 2900,
  logo: 3100,
  confetti: 3360,
  /** Idle float waits until the build has settled. */
  idle: 3900,
} as const;

/** Captions for the build log, each shown from its start until the next. */
const LOG = [
  { key: "chassis", at: T.feet },
  { key: "body", at: T.torso },
  { key: "arms", at: T.armL },
  { key: "head", at: T.head },
  { key: "boot", at: T.eyes },
] as const;

export type AssemblyLabels = Record<(typeof LOG)[number]["key"] | "ready", string>;

/** Pixel confetti thrown from the logo when it lands: [dx, dy, rotate, colour]. */
const CONFETTI: [number, number, number, string][] = [
  [-190, -120, -160, "var(--electric-500)"],
  [-120, -170, 120, "var(--gold-400)"],
  [-30, -190, -90, "var(--magenta-600)"],
  [70, -180, 140, "var(--electric-800)"],
  [160, -140, -120, "var(--gold-400)"],
  [210, -40, 200, "var(--magenta-600)"],
  [190, 90, -150, "var(--electric-500)"],
  [-200, 60, 160, "var(--magenta-600)"],
  [-150, 140, -200, "var(--gold-400)"],
  [120, 150, 110, "var(--deep-900)"],
  [-60, 170, 90, "var(--electric-800)"],
  [30, -120, -60, "var(--deep-900)"],
];

const ms = (n: number) => `${n}ms`;

/**
 * One moving part. `from` is where it starts, in viewBox units, relative to
 * where it lands.
 */
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
            d="M0 -12V-22"
            transform={`rotate(${deg})`}
            stroke={deg % 90 === 0 ? "var(--gold-400)" : "var(--electric-500)"}
            strokeWidth={4}
            strokeLinecap="round"
          />
        ))}
        <circle r="5" fill="var(--gold-400)" />
      </g>
    </g>
  );
}

function RobotBody() {
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
      {/* Assembly pad. The ring lights up once the robot is complete. */}
      <ellipse cx="200" cy="384" rx="118" ry="12" fill="var(--ink)" opacity="0.1" />
      <ellipse
        className="pad-ring"
        cx="200"
        cy="384"
        rx="150"
        ry="16"
        stroke="var(--electric-500)"
        strokeWidth={3}
        strokeDasharray="10 8"
        style={{ "--d": ms(T.logo) } as CSSProperties}
      />

      {/* Antenna — rises out of the head once the head is on. */}
      <Part at={T.antenna} y={34}>
        <path d="M200 30V16" stroke="var(--ink)" strokeWidth={STROKE} />
        <circle
          className="beacon"
          cx="200"
          cy="10"
          r="22"
          fill="var(--gold-400)"
          style={{ "--d": ms(T.beacon) } as CSSProperties}
        />
        <circle
          cx="200"
          cy="10"
          r="10"
          fill="var(--gold-400)"
          stroke="var(--ink)"
          strokeWidth={STROKE}
        />
      </Part>

      {/* Legs and feet, drawn first so the torso overlaps them cleanly. */}
      <Part at={T.legs} y={-90}>
        <rect x="156" y="312" width="30" height="42" rx="14" fill="var(--ink)" />
        <rect x="214" y="312" width="30" height="42" rx="14" fill="var(--ink)" />
      </Part>
      <Part at={T.feet} x={-70} y={40} r={-18}>
        <rect x="132" y="346" width="70" height="30" rx="15" fill="var(--ink)" />
      </Part>
      <Part at={T.feet + 90} x={70} y={40} r={18}>
        <rect x="198" y="346" width="70" height="30" rx="15" fill="var(--ink)" />
      </Part>

      {/* Torso. Mostly hidden behind the logo once it lands, so the chest
          panel and its power core are only ever seen during the build. */}
      <Part at={T.torso} y={-190} r={-8}>
        <rect
          x="148"
          y="150"
          width="104"
          height="172"
          rx="34"
          fill="var(--r-accent)"
          stroke="var(--ink)"
          strokeWidth={STROKE}
        />
        <rect x="170" y="196" width="60" height="72" rx="14" fill="#fff" stroke="var(--ink)" strokeWidth={5} />
        <circle cx="200" cy="222" r="11" fill="var(--gold-400)" stroke="var(--ink)" strokeWidth={4} />
        <path d="M184 250h32" stroke="var(--ink)" strokeWidth={4} opacity="0.5" />
      </Part>

      {/* Arms reaching around to grip the sign. */}
      <Part at={T.armL} x={-110} y={-30} r={-28}>
        <path
          d="M152 200C112 200 78 212 56 240"
          stroke="var(--ink)"
          strokeWidth={STROKE + 12}
        />
        <path
          d="M152 200C112 200 78 212 56 240"
          stroke="var(--r-accent)"
          strokeWidth={STROKE + 2}
        />
      </Part>
      <Part at={T.armR} x={110} y={-30} r={28}>
        <path
          d="M248 200c40 0 74 12 96 40"
          stroke="var(--ink)"
          strokeWidth={STROKE + 12}
        />
        <path
          d="M248 200c40 0 74 12 96 40"
          stroke="var(--r-accent)"
          strokeWidth={STROKE + 2}
        />
      </Part>

      {/* Head */}
      <Part at={T.head} y={-230} r={10}>
        <rect
          x="126"
          y="30"
          width="148"
          height="118"
          rx="38"
          fill="var(--r-accent)"
          stroke="var(--ink)"
          strokeWidth={STROKE}
        />
      </Part>

      {/* Ear pods snap on from the sides. */}
      <Part at={T.earL} x={-60}>
        <rect
          x="108"
          y="66"
          width="20"
          height="44"
          rx="10"
          fill="var(--r-accent)"
          stroke="var(--ink)"
          strokeWidth={STROKE}
        />
      </Part>
      <Part at={T.earR} x={60}>
        <rect
          x="272"
          y="66"
          width="20"
          height="44"
          rx="10"
          fill="var(--r-accent)"
          stroke="var(--ink)"
          strokeWidth={STROKE}
        />
      </Part>

      {/* Face plate */}
      <Part at={T.face} s={0.3}>
        <rect
          x="146"
          y="52"
          width="108"
          height="74"
          rx="28"
          fill="#fff"
          stroke="var(--ink)"
          strokeWidth={STROKE}
        />
      </Part>

      {/* Power-on: eyes open with a blink, with the highlight that makes them
          read as alive rather than lit. */}
      <g className="eye" style={{ "--d": ms(T.eyes) } as CSSProperties}>
        <circle cx="178" cy="84" r="13" fill="var(--ink)" />
        <circle cx="182.5" cy="79.5" r="4.6" fill="#fff" />
      </g>
      <g className="eye" style={{ "--d": ms(T.eyes + 60) } as CSSProperties}>
        <circle cx="222" cy="84" r="13" fill="var(--ink)" />
        <circle cx="226.5" cy="79.5" r="4.6" fill="#fff" />
      </g>

      {/* The smile draws itself. */}
      <path
        className="draw"
        d="M182 104q18 14 36 0"
        pathLength={1}
        stroke="var(--ink)"
        strokeWidth={STROKE}
        style={{ "--d": ms(T.smile) } as CSSProperties}
      />

      {/* Cheeks — the detail that reads as friendly rather than mechanical. */}
      <g className="fade" style={{ "--d": ms(T.smile + 160) } as CSSProperties}>
        <circle cx="160" cy="104" r="7" fill="var(--accent)" opacity="0.45" />
        <circle cx="240" cy="104" r="7" fill="var(--accent)" opacity="0.45" />
      </g>

      {/* Sparks at every joint, on top of everything. */}
      <Spark x={167} y={372} at={land(T.feet)} />
      <Spark x={233} y={372} at={land(T.feet + 90)} />
      <Spark x={200} y={318} at={land(T.legs)} />
      <Spark x={200} y={150} at={land(T.torso)} />
      <Spark x={152} y={200} at={land(T.armL)} />
      <Spark x={248} y={200} at={land(T.armR)} />
      <Spark x={200} y={148} at={land(T.head)} />
      <Spark x={112} y={88} at={land(T.earL)} />
      <Spark x={288} y={88} at={land(T.earR)} />
      <Spark x={200} y={10} at={land(T.antenna)} />
    </svg>
  );
}

function RobotHands() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Both hands overlap the logo's outer edge by a few units. Without that
          overlap the robot is standing next to a sign, not holding one. They
          arrive with their arms. */}
      <Part at={T.armL} x={-110} y={-30} r={-28}>
        <rect
          x="30"
          y="212"
          width="44"
          height="48"
          rx="18"
          fill="var(--r-accent)"
          stroke="var(--ink)"
          strokeWidth={STROKE}
        />
        <path d="M44 228v16" stroke="var(--ink)" strokeWidth={4} strokeLinecap="round" opacity="0.5" />
      </Part>
      <Part at={T.armR} x={110} y={-30} r={28}>
        <rect
          x="326"
          y="212"
          width="44"
          height="48"
          rx="18"
          fill="var(--r-accent)"
          stroke="var(--ink)"
          strokeWidth={STROKE}
        />
        <path d="M356 228v16" stroke="var(--ink)" strokeWidth={4} strokeLinecap="round" opacity="0.5" />
      </Part>
    </svg>
  );
}

/**
 * The caption under the stage: what is being built right now, then "ready".
 * Decorative — the picture and the logo's alt text carry the meaning — so it
 * is hidden from assistive technology rather than announced five times.
 */
function BuildLog({ labels }: { labels: AssemblyLabels }) {
  return (
    <div aria-hidden="true" className="mx-auto mt-2 w-full max-w-xs">
      {/* The captions are stacked in one grid cell rather than absolutely
          positioned, so a label that wraps on a narrow phone (the Kazakh
          "ready" line does at 256px) grows the row instead of running into
          the progress bar below it. */}
      <div className="grid min-h-6 place-items-center text-center text-2xs font-bold uppercase leading-snug tracking-[0.14em]">
        {LOG.map((step, i) => {
          const end = i + 1 < LOG.length ? LOG[i + 1].at : T.logo;
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
          className="log-ready col-start-1 row-start-1 inline-flex items-center justify-center gap-2 text-accent"
          style={{ "--d": ms(T.logo) } as CSSProperties}
        >
          <span className="size-2 shrink-0 rounded-full bg-accent" />
          {labels.ready}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="build-progress h-full rounded-full"
          style={{ "--d": ms(T.feet), "--len": ms(T.logo - T.feet) } as CSSProperties}
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
  /** Carries `--r-accent`, which every painted part of the robot reads. */
  style?: CSSProperties;
  labels: AssemblyLabels;
}) {
  return (
    <div className={className} style={style}>
      <div className="assembly-stage relative mx-auto aspect-square w-full max-w-lg">
        {/* Blueprint frame: corner brackets and a scan line that sweeps the
            stage while the robot is being built. */}
        <div aria-hidden="true" className="pointer-events-none absolute -inset-3 sm:-inset-5">
          <span className="stage-corner left-0 top-0 border-l-[3px] border-t-[3px]" />
          <span className="stage-corner right-0 top-0 border-r-[3px] border-t-[3px]" />
          <span className="stage-corner bottom-0 left-0 border-b-[3px] border-l-[3px]" />
          <span className="stage-corner bottom-0 right-0 border-b-[3px] border-r-[3px]" />
          <span
            className="scan-line"
            style={{ "--d": ms(T.feet), "--len": ms(T.logo - T.feet) } as CSSProperties}
          />
        </div>

        {/* The idle float is a separate element from the build so the two
            never fight over the same transform, and it waits for the build. */}
        <div
          className="animate-float-slow absolute inset-0"
          style={{ animationDelay: ms(T.idle) }}
        >
          <RobotBody />

          {/* The logo lands last and overshoots, so the eye reads it as being
              presented — the robot is built, then shows you what it holds. */}
          <div
            className="absolute"
            style={{
              left: LOGO_BOX.left,
              top: LOGO_BOX.top,
              width: LOGO_BOX.width,
              height: LOGO_BOX.height,
            }}
          >
            <span
              aria-hidden="true"
              className="logo-glow absolute -inset-8 rounded-full"
              style={{ "--d": ms(T.logo) } as CSSProperties}
            />
            <div
              className="pop-in relative size-full"
              style={{ "--rise-delay": ms(T.logo) } as CSSProperties}
            >
              {/* The plate inside the logo border is transparent in the PNG;
                  without a backing the torso shows through the lettering. */}
              <span className="absolute inset-[3%] rounded-[8%/19%] bg-white" />
              <Image
                src={BRAND_ASSETS.championship.src}
                alt={BRAND_ASSETS.championship.alt}
                width={BRAND_ASSETS.championship.width}
                height={BRAND_ASSETS.championship.height}
                priority
                // 78% (LOGO_BOX) of the robot, whose width Hero caps at 16rem,
                // 20rem from `sm`, 28rem from `2xl`: at most 250px, 350px on
                // a 2xl screen. It used to say 78vw, which on a phone asked
                // for a third more pixels than the logo ever covers.
                sizes="(min-width: 1536px) 350px, 250px"
                className="relative size-full object-contain drop-shadow-[0_6px_0_rgba(0,36,60,0.14)]"
              />
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2">
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

          <RobotHands />
        </div>
      </div>

      <BuildLog labels={labels} />
    </div>
  );
}
