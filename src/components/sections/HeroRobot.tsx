import Image from "next/image";
import type { CSSProperties } from "react";
import { BRAND_ASSETS } from "@/config/event";

/**
 * The championship mascot, holding the logo.
 *
 * ── How it is composed ───────────────────────────────────────────────────
 * Three layers stacked in a square container, all sharing one 400×400
 * coordinate space:
 *
 *   1. `<RobotBody />`  — head, torso, arms, legs. Behind.
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
 * The logo stays a `next/image` rather than an SVG `<image href>` so it is
 * still served as AVIF/WebP at the right size — on a hero, that is the
 * difference between 88 KB and about 20 KB.
 *
 * ── Why the entrance is CSS ──────────────────────────────────────────────
 * A JavaScript entrance ships `opacity: 0` from the server and needs the
 * bundle to run before anything is visible. On the hero that is not a risk
 * worth taking, so the animation lives in `globals.css` and this whole file
 * stays a server component — no Motion in the hero bundle at all.
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

function RobotBody() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="absolute inset-0 size-full"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Ground shadow — grounds the figure so it is standing, not floating. */}
      <ellipse cx="200" cy="384" rx="118" ry="12" fill="var(--ink)" opacity="0.1" />

      {/* Antenna */}
      <path d="M200 30V16" stroke="var(--ink)" strokeWidth={STROKE} />
      <circle
        cx="200"
        cy="10"
        r="10"
        fill="var(--gold-400)"
        stroke="var(--ink)"
        strokeWidth={STROKE}
      />

      {/* Legs and feet, drawn first so the torso overlaps them cleanly. */}
      <rect x="156" y="312" width="30" height="42" rx="14" fill="var(--ink)" />
      <rect x="214" y="312" width="30" height="42" rx="14" fill="var(--ink)" />
      <rect x="132" y="346" width="70" height="30" rx="15" fill="var(--ink)" />
      <rect x="198" y="346" width="70" height="30" rx="15" fill="var(--ink)" />

      {/* Torso — mostly hidden behind the logo; the collar and hem show. */}
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

      {/* Arms reaching around to grip the sign. */}
      <path
        d="M152 200C112 200 78 212 56 240"
        stroke="var(--ink)"
        strokeWidth={STROKE + 12}
        strokeLinecap="round"
      />
      <path
        d="M152 200C112 200 78 212 56 240"
        stroke="var(--r-accent)"
        strokeWidth={STROKE + 2}
        strokeLinecap="round"
      />
      <path
        d="M248 200c40 0 74 12 96 40"
        stroke="var(--ink)"
        strokeWidth={STROKE + 12}
        strokeLinecap="round"
      />
      <path
        d="M248 200c40 0 74 12 96 40"
        stroke="var(--r-accent)"
        strokeWidth={STROKE + 2}
        strokeLinecap="round"
      />

      {/* Head */}
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

      {/* Ear pods */}
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

      {/* Face plate */}
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

      {/* Eyes, with the highlight that makes them read as alive rather than lit. */}
      <circle cx="178" cy="84" r="13" fill="var(--ink)" />
      <circle cx="222" cy="84" r="13" fill="var(--ink)" />
      <circle cx="182.5" cy="79.5" r="4.6" fill="#fff" />
      <circle cx="226.5" cy="79.5" r="4.6" fill="#fff" />

      {/* Open smile */}
      <path
        d="M182 104q18 14 36 0"
        stroke="var(--ink)"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />

      {/* Cheeks — the detail that reads as friendly rather than mechanical. */}
      <circle cx="160" cy="104" r="7" fill="var(--accent)" opacity="0.45" />
      <circle cx="240" cy="104" r="7" fill="var(--accent)" opacity="0.45" />
    </svg>
  );
}

function RobotHands() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="pointer-events-none absolute inset-0 size-full"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Both hands overlap the logo's outer edge by a few units. Without that
          overlap the robot is standing next to a sign, not holding one. */}
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
    </svg>
  );
}

export function HeroRobot({
  className,
  style,
}: {
  className?: string;
  /** Carries `--r-accent`, which every painted part of the robot reads. */
  style?: CSSProperties;
}) {
  return (
    <div
      className={`lift-in ${className ?? ""}`}
      style={{ ...style, "--rise-delay": "100ms" } as CSSProperties}
    >
      {/* The idle float is a separate element from the entrance so the two
          animations never fight over the same transform. */}
      <div className="animate-float-slow relative mx-auto aspect-square w-full max-w-lg">
        <RobotBody />

        {/* The logo lands last and overshoots, so the eye reads it as being
            presented — the robot arrives, then shows you what it is holding. */}
        <div
          className="pop-in absolute"
          style={
            {
              left: LOGO_BOX.left,
              top: LOGO_BOX.top,
              width: LOGO_BOX.width,
              height: LOGO_BOX.height,
              "--rise-delay": "520ms",
            } as CSSProperties
          }
        >
          <Image
            src={BRAND_ASSETS.championship.src}
            alt={BRAND_ASSETS.championship.alt}
            width={BRAND_ASSETS.championship.width}
            height={BRAND_ASSETS.championship.height}
            priority
            sizes="(max-width: 1024px) 78vw, 400px"
            className="size-full object-contain drop-shadow-[0_6px_0_rgba(0,36,60,0.14)]"
          />
        </div>

        <RobotHands />
      </div>
    </div>
  );
}
