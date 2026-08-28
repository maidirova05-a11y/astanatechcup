import type { SVGProps } from "react";

/**
 * Robot mascots.
 *
 * Six original characters, one per discipline. Chunky rounded bodies, thick
 * dark outlines, oversized friendly eyes — the visual language of a toy rather
 * than a diagram. They are what turns a competent tech landing page into one a
 * nine-year-old wants to scroll.
 *
 * ── Rules ────────────────────────────────────────────────────────────────
 * · ORIGINAL WORK. These are drawn from primitives, not traced from any
 *   existing character. A national championship must not ship someone else's
 *   mascot, however "inspired by" the brief gets.
 * · Every mascot is decorative and marked `aria-hidden`. None of them carries
 *   meaning that is not also in adjacent text, so a screen reader loses
 *   nothing by skipping them.
 * · They colour themselves from `currentColor` and the discipline accent
 *   variables, so a card's hue drives its robot with no per-robot palette.
 * · Inline SVG, no image requests: keeps `img-src 'self'` honest, costs no
 *   round trip, and scales without artefacts on a 3x phone screen.
 * ─────────────────────────────────────────────────────────────────────────
 */

type RobotProps = SVGProps<SVGSVGElement>;

/** Thick outline weight shared by every mascot — the "toy" signature. */
const STROKE = 2.4;

function Mascot({ children, ...props }: RobotProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Shared eye pair. `bright` gives the highlight that makes them read as alive. */
function Eyes({ cx1 = 39, cx2 = 57, cy = 46, r = 5 }) {
  return (
    <>
      <circle cx={cx1} cy={cy} r={r} fill="var(--ink)" />
      <circle cx={cx2} cy={cy} r={r} fill="var(--ink)" />
      <circle cx={cx1 + 1.8} cy={cy - 1.8} r={r * 0.34} fill="#fff" />
      <circle cx={cx2 + 1.8} cy={cy - 1.8} r={r * 0.34} fill="#fff" />
    </>
  );
}

/** RoboSumo — wide, low, planted. Built to look immovable. */
export const RobotSumo = (props: RobotProps) => (
  <Mascot {...props}>
    {/* antenna */}
    <path d="M48 20v-7" stroke="var(--ink)" strokeWidth={STROKE} />
    <circle cx="48" cy="10" r="4.5" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* body */}
    <rect x="18" y="20" width="60" height="46" rx="15" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* face plate */}
    <rect x="27" y="32" width="42" height="26" rx="11" fill="#fff" stroke="var(--ink)" strokeWidth={STROKE} />
    <Eyes />
    {/* determined mouth */}
    <path d="M42 52h12" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* planted feet, wider than the body */}
    <rect x="12" y="66" width="26" height="16" rx="8" fill="var(--ink)" />
    <rect x="58" y="66" width="26" height="16" rx="8" fill="var(--ink)" />
    {/* pusher blade */}
    <path d="M22 74h52" stroke="var(--r-accent, currentColor)" strokeWidth={STROKE * 1.4} />
  </Mascot>
);

/** VEX — competition frame, tall and precise. */
export const RobotVex = (props: RobotProps) => (
  <Mascot {...props}>
    <path d="M32 22V12M64 22V12" stroke="var(--ink)" strokeWidth={STROKE} />
    <circle cx="32" cy="9" r="3.6" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <circle cx="64" cy="9" r="3.6" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="22" y="22" width="52" height="42" rx="13" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="30" y="32" width="36" height="24" rx="10" fill="#fff" stroke="var(--ink)" strokeWidth={STROKE} />
    <Eyes cx1={40} cx2={56} cy={44} />
    <path d="M42 51q6 4 12 0" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* lifting arms */}
    <path d="M22 40H12v14" stroke="var(--ink)" strokeWidth={STROKE} />
    <path d="M74 40h10v14" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* treads */}
    <rect x="20" y="66" width="56" height="16" rx="8" fill="var(--ink)" />
    <circle cx="32" cy="74" r="3.4" fill="#fff" />
    <circle cx="48" cy="74" r="3.4" fill="#fff" />
    <circle cx="64" cy="74" r="3.4" fill="#fff" />
  </Mascot>
);

/** LEGO — built from visible blocks, studs on top. The beginner's robot. */
export const RobotBlocks = (props: RobotProps) => (
  <Mascot {...props}>
    {/* studs */}
    <rect x="34" y="12" width="10" height="7" rx="3" fill="var(--ink)" />
    <rect x="52" y="12" width="10" height="7" rx="3" fill="var(--ink)" />
    <rect x="20" y="19" width="56" height="44" rx="13" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* block seam — this is what makes it read as assembled */}
    <path d="M20 41h56" stroke="var(--ink)" strokeWidth={STROKE * 0.7} strokeDasharray="5 5" opacity="0.5" />
    <rect x="28" y="26" width="40" height="22" rx="9" fill="#fff" stroke="var(--ink)" strokeWidth={STROKE} />
    <Eyes cx1={40} cx2={56} cy={37} r={4.4} />
    <path d="M43 44q5 3 10 0" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* stubby arms */}
    <rect x="8" y="34" width="12" height="18" rx="6" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="76" y="34" width="12" height="18" rx="6" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="26" y="63" width="18" height="18" rx="7" fill="var(--ink)" />
    <rect x="52" y="63" width="18" height="18" rx="7" fill="var(--ink)" />
  </Mascot>
);

/** Arduino — exposed board, visible circuitry. The "how it works inside" robot. */
export const RobotCircuit = (props: RobotProps) => (
  <Mascot {...props}>
    <path d="M48 18v-6" stroke="var(--ink)" strokeWidth={STROKE} />
    <circle cx="48" cy="9" r="4" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="20" y="18" width="56" height="46" rx="14" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* circuit traces */}
    <path d="M26 26h8v6M70 26h-8v6M26 56h8v-6M70 56h-8v-6" stroke="var(--ink)" strokeWidth={STROKE * 0.7} opacity="0.55" />
    <rect x="30" y="30" width="36" height="22" rx="9" fill="#fff" stroke="var(--ink)" strokeWidth={STROKE} />
    <Eyes cx1={40} cx2={56} cy={41} r={4.4} />
    <path d="M42 48h12" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* pins along the base */}
    <path d="M28 64v6M38 64v6M48 64v6M58 64v6M68 64v6" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="22" y="70" width="52" height="12" rx="6" fill="var(--ink)" />
  </Mascot>
);

/** Drone — airborne, four rotors, no feet. */
export const RobotDrone = (props: RobotProps) => (
  <Mascot {...props}>
    {/* rotor arms */}
    <path d="M34 40 18 26M62 40l16-14M34 58 18 72M62 58l16 14" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* rotors */}
    <ellipse cx="16" cy="24" rx="11" ry="4" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <ellipse cx="80" cy="24" rx="11" ry="4" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <ellipse cx="16" cy="74" rx="11" ry="4" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <ellipse cx="80" cy="74" rx="11" ry="4" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* hull */}
    <rect x="28" y="32" width="40" height="34" rx="14" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="34" y="39" width="28" height="20" rx="9" fill="#fff" stroke="var(--ink)" strokeWidth={STROKE} />
    <Eyes cx1={42} cx2={54} cy={48} r={4} />
    {/* camera gimbal */}
    <circle cx="48" cy="68" r="5" fill="var(--ink)" />
    <circle cx="48" cy="68" r="1.9" fill="#fff" />
  </Mascot>
);

/** Esports — headset and a game face. The team-sport robot. */
export const RobotGamer = (props: RobotProps) => (
  <Mascot {...props}>
    {/* headset band */}
    <path d="M24 40a24 24 0 0 1 48 0" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="14" y="36" width="14" height="22" rx="7" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="68" y="36" width="14" height="22" rx="7" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="26" y="30" width="44" height="40" rx="14" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="32" y="38" width="32" height="22" rx="9" fill="#fff" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* focused, slightly narrowed eyes */}
    <path d="M37 46h7M52 46h7" stroke="var(--ink)" strokeWidth={STROKE * 1.6} />
    <path d="M42 55q6 3 12 0" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* boom mic */}
    <path d="M28 58q-6 8 4 12" stroke="var(--ink)" strokeWidth={STROKE} />
    <circle cx="34" cy="72" r="4" fill="var(--ink)" />
    <rect x="34" y="70" width="30" height="12" rx="6" fill="var(--ink)" />
  </Mascot>
);

/** Ring Master — a gripper arm holding a ring over a scoring pole. */
export const RobotRing = (props: RobotProps) => (
  <Mascot {...props}>
    {/* the ring it is about to place, held high */}
    <ellipse cx="70" cy="18" rx="13" ry="5.5" fill="none" stroke="var(--ink)" strokeWidth={STROKE * 1.6} />
    <ellipse cx="70" cy="18" rx="13" ry="5.5" fill="none" stroke="var(--r-accent, currentColor)" strokeWidth={STROKE * 0.8} />
    <rect x="22" y="26" width="48" height="40" rx="14" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="29" y="34" width="34" height="22" rx="9" fill="#fff" stroke="var(--ink)" strokeWidth={STROKE} />
    <Eyes cx1={39} cx2={53} cy={44} r={4.4} />
    {/* a small, concentrating mouth — this one is aiming */}
    <path d="M42 51h8" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* lifting arm reaching up to the ring */}
    <path d="M66 34 70 22" stroke="var(--ink)" strokeWidth={STROKE * 1.2} />
    {/* scoring pole on its base */}
    <path d="M18 66V44" stroke="var(--ink)" strokeWidth={STROKE * 1.2} />
    <ellipse cx="18" cy="52" rx="9" ry="4" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="16" y="66" width="62" height="15" rx="7" fill="var(--ink)" />
    <circle cx="30" cy="73" r="3.2" fill="#fff" />
    <circle cx="64" cy="73" r="3.2" fill="#fff" />
  </Mascot>
);

/** Bowling — a launcher with a ball loaded and pins waiting. */
export const RobotPin = (props: RobotProps) => (
  <Mascot {...props}>
    {/* pins standing behind it */}
    <path d="M14 30q4-6 8 0v10q-4 5-8 0z" fill="#fff" stroke="var(--ink)" strokeWidth={STROKE} />
    <path d="M82 30q-4-6-8 0v10q4 5 8 0z" fill="#fff" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="26" y="22" width="44" height="40" rx="14" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="32" y="29" width="32" height="22" rx="9" fill="#fff" stroke="var(--ink)" strokeWidth={STROKE} />
    <Eyes cx1={41} cx2={55} cy={39} r={4.4} />
    <path d="M43 47q5 3 10 0" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* launch arm, cocked back */}
    <path d="M70 44h9v-9" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* the ball, loaded */}
    <circle cx="17" cy="62" r="9" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <circle cx="14" cy="59" r="1.6" fill="var(--ink)" />
    <circle cx="19" cy="58" r="1.6" fill="var(--ink)" />
    <rect x="28" y="62" width="42" height="16" rx="8" fill="var(--ink)" />
    <circle cx="39" cy="70" r="3.4" fill="#fff" />
    <circle cx="59" cy="70" r="3.4" fill="#fff" />
  </Mascot>
);

/** Discipline id -> mascot, so a card can render its own character. */
export const DISCIPLINE_ROBOTS = {
  robosumo: RobotSumo,
  vex: RobotVex,
  lego: RobotBlocks,
  arduino: RobotCircuit,
  drones: RobotDrone,
  esports: RobotGamer,
} as const;

export type RobotName = keyof typeof DISCIPLINE_ROBOTS;

/**
 * Mascot key -> character, for the competition categories.
 *
 * A separate map from `DISCIPLINE_ROBOTS` because the two taxonomies are
 * separate (see src/config/categories.ts) and several characters appear in
 * both — a shared map would have to invent a key that means "LEGO the
 * technology family" and "Leap the category" at once.
 */
export const CATEGORY_ROBOTS = {
  sumo: RobotSumo,
  circuit: RobotCircuit,
  vex: RobotVex,
  drone: RobotDrone,
  ring: RobotRing,
  pin: RobotPin,
  blocks: RobotBlocks,
} as const;

export type CategoryRobotName = keyof typeof CATEGORY_ROBOTS;

/**
 * A waving robot for the hero and the 404 page. Larger, friendlier and more
 * detailed than the discipline set — this one is the face of the championship.
 */
export const RobotHero = (props: RobotProps) => (
  <Mascot {...props}>
    {/* antenna with a pulsing bulb */}
    <path d="M48 16V6" stroke="var(--ink)" strokeWidth={STROKE} />
    <circle cx="48" cy="5" r="4.5" fill="var(--accent)" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* head */}
    <rect x="22" y="16" width="52" height="40" rx="16" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    <rect x="29" y="24" width="38" height="24" rx="10" fill="#fff" stroke="var(--ink)" strokeWidth={STROKE} />
    <Eyes cx1={40} cx2={56} cy={35} r={5.2} />
    {/* open, friendly smile */}
    <path d="M41 43q7 5 14 0" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* cheeks — the detail that reads as "friendly" rather than "machine" */}
    <circle cx="33" cy="43" r="2.6" fill="var(--accent)" opacity="0.55" />
    <circle cx="63" cy="43" r="2.6" fill="var(--accent)" opacity="0.55" />
    {/* body */}
    <rect x="30" y="58" width="36" height="26" rx="12" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* chest badge */}
    <circle cx="48" cy="70" r="6" fill="#fff" stroke="var(--ink)" strokeWidth={STROKE} />
    <circle cx="48" cy="70" r="2.4" fill="var(--accent)" />
    {/* waving arm, raised */}
    <path d="M30 64 16 54" stroke="var(--ink)" strokeWidth={STROKE} />
    <circle cx="13" cy="51" r="6" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
    {/* resting arm */}
    <path d="M66 66h12" stroke="var(--ink)" strokeWidth={STROKE} />
    <circle cx="82" cy="66" r="6" fill="var(--r-accent, currentColor)" stroke="var(--ink)" strokeWidth={STROKE} />
  </Mascot>
);
