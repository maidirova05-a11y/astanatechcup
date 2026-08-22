/**
 * SINGLE SOURCE OF TRUTH for every factual claim the landing page makes.
 *
 * Nothing in `src/components` or `src/app` hardcodes a date, a team size, an
 * age range or a price. Change it here and it changes everywhere, including
 * the server-side validation that guards the registration endpoint.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ASSUMPTIONS TAKEN FROM THE BRIEF (marked `@assumption`) — CONFIRM THESE:
 *
 *  1. YEAR. The brief describes the 2026 edition in the past tense (~2500
 *     participants at ENU) yet lists qualifiers on 15–16 May with a 30 April
 *     deadline and an August final in Beijing. Since today is past August
 *     2026, this page is built for the **2027** edition. If that is wrong,
 *     change `EVENT_YEAR` below — one line — and every date, countdown and
 *     deadline check follows.
 *
 *  2. ROBOSUMO. Q7 names RoboSumo as the flagship discipline to promote, but
 *     it is absent from the disciplines table (VEX / LEGO / Arduino / Drones /
 *     Esports). It is modelled here as a sixth, flagship discipline with
 *     `provisional: true` on the fields the brief does not state. Provisional
 *     fields render as "уточняется" / "нақтыланады" rather than as invented
 *     facts, and are NOT enforced by server-side validation.
 *
 *  3. CONTACTS. Section 9 of the brief was left entirely blank. Every field in
 *     `contacts` is `null`. The UI hides null contacts instead of rendering
 *     placeholder junk. Fill them in and they appear.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** @assumption Edition year — see note 1 above. Change this one value to re-date the whole site. */
export const EVENT_YEAR = 2027;

/**
 * Kazakhstan unified on UTC+05:00 on 2024-03-01, so Astana local time is +05:00
 * year-round. All deadlines are absolute instants — never "midnight in the
 * visitor's timezone" — so the server and the browser agree on what is expired.
 */
export const EVENT_TZ = "Asia/Almaty";
export const EVENT_UTC_OFFSET = "+05:00";

export const EVENT = {
  name: "AstanaTechCup",
  edition: 3,
  organizer: "SmartHub",
  coOrganizer: "AZ Group",
  format: "offline",
  city: "Astana",
  /** ENU im. L.N. Gumilyov hosted the previous edition per the brief. */
  venueKey: "enu",
} as const;

/* ── Dates ──────────────────────────────────────────────────────────────── */

/** Applications close 30 April, end of day, Astana time. @assumption year */
export const REGISTRATION_DEADLINE = new Date(
  `${EVENT_YEAR}-04-30T23:59:59${EVENT_UTC_OFFSET}`,
);

/** Republican qualifiers, 15–16 May, Astana. @assumption year */
export const QUALIFIER_START = new Date(
  `${EVENT_YEAR}-05-15T09:00:00${EVENT_UTC_OFFSET}`,
);
export const QUALIFIER_END = new Date(
  `${EVENT_YEAR}-05-16T18:00:00${EVENT_UTC_OFFSET}`,
);

/**
 * International final — August, Beijing. The brief gives a month, not a day,
 * so this is deliberately month-precision and the UI says "August {year}"
 * rather than inventing a date. The countdown targets the deadline, not this.
 */
export const FINAL_MONTH = { year: EVENT_YEAR, month: 8 } as const;
export const FINAL_LOCATION = { cityKey: "beijing", countryKey: "china" } as const;

/** What the hero countdown counts down to. */
export const COUNTDOWN_TARGET = REGISTRATION_DEADLINE;

/* ── Entry fee ──────────────────────────────────────────────────────────── */

export const ENTRY_FEE = {
  amount: 50,
  currency: "USD",
  /** Stripe and most PSPs take the smallest unit. 50 USD => 5000 cents. */
  minorUnits: 5000,
  /** Charged once per team, not per participant. */
  per: "team",
} as const;

/* ── Social proof (previous edition, per the brief) ─────────────────────── */

export const STATS = [
  { key: "participants", value: 2500, prefix: "~" },
  { key: "teams", value: 720, prefix: "" },
  { key: "regions", value: 17, prefix: "" },
  { key: "edition", value: EVENT.edition, prefix: "" },
] as const;

/* ── Disciplines ────────────────────────────────────────────────────────── */

export type DisciplineId =
  | "robosumo"
  | "vex"
  | "lego"
  | "arduino"
  | "drones"
  | "esports";

export type Discipline = {
  id: DisciplineId;
  /** Minimum / maximum participant age, inclusive. Enforced server-side. */
  ageMin: number;
  ageMax: number;
  /** Maximum members per team, inclusive. Enforced server-side. */
  teamSizeMax: number | null;
  format: "offline";
  /** True when the brief did not supply the numbers and they are placeholders. */
  provisional: boolean;
  /** Flagship discipline gets its own cinematic section (Q7). */
  flagship: boolean;
  /** Hue used to derive this discipline's accent from the shared brand ramp. */
  hue: number;
};

export const DISCIPLINES: readonly Discipline[] = [
  {
    // @assumption Not in the brief's table; promoted per Q7. Numbers provisional.
    id: "robosumo",
    ageMin: 6,
    ageMax: 18,
    teamSizeMax: null,
    format: "offline",
    provisional: true,
    flagship: true,
    hue: 45,
  },
  {
    id: "vex",
    ageMin: 9,
    ageMax: 15,
    teamSizeMax: 4,
    format: "offline",
    provisional: false,
    flagship: false,
    hue: 220,
  },
  {
    id: "lego",
    ageMin: 6,
    ageMax: 18,
    teamSizeMax: 3,
    format: "offline",
    provisional: false,
    flagship: false,
    hue: 190,
  },
  {
    id: "arduino",
    ageMin: 6,
    ageMax: 18,
    teamSizeMax: 3,
    format: "offline",
    provisional: false,
    flagship: false,
    hue: 160,
  },
  {
    id: "drones",
    ageMin: 6,
    ageMax: 18,
    teamSizeMax: 3,
    format: "offline",
    provisional: false,
    flagship: false,
    hue: 265,
  },
  {
    id: "esports",
    ageMin: 6,
    ageMax: 18,
    teamSizeMax: 6,
    format: "offline",
    provisional: false,
    flagship: false,
    hue: 305,
  },
] as const;

export const DISCIPLINE_IDS = DISCIPLINES.map((d) => d.id) as DisciplineId[];

export function getDiscipline(id: string): Discipline | undefined {
  return DISCIPLINES.find((d) => d.id === id);
}

/** Largest team any discipline allows — the hard ceiling for array validation. */
export const MAX_TEAM_SIZE = DISCIPLINES.reduce(
  (max, d) => Math.max(max, d.teamSizeMax ?? 0),
  1,
);

/** Absolute age bounds across all disciplines, used as an outer sanity check. */
export const AGE_BOUNDS = {
  min: Math.min(...DISCIPLINES.map((d) => d.ageMin)),
  max: Math.max(...DISCIPLINES.map((d) => d.ageMax)),
} as const;

/** Below this age a parent / legal representative must consent (KZ law 94-V). */
export const MINOR_AGE_THRESHOLD = 18;

/* ── Participant journey (Q8) ───────────────────────────────────────────── */

export const JOURNEY_STEPS = [
  "application",
  "confirmation",
  "preparation",
  "techCheck",
  "qualification",
  "final",
  "awards",
] as const;

export type JourneyStep = (typeof JOURNEY_STEPS)[number];

/* ── Audience entry points (Q6) ─────────────────────────────────────────── */

export const AUDIENCE_ROLES = [
  "participant",
  "parent",
  "teacher",
  "spectator",
  "volunteer",
  "sponsor",
  "media",
] as const;

export type AudienceRole = (typeof AUDIENCE_ROLES)[number];

/** Roles that route to the full team-registration flow rather than a short form. */
export const REGISTRATION_ROLES: readonly AudienceRole[] = [
  "participant",
  "parent",
  "teacher",
];

/* ── FAQ (built to answer the barriers named in Q4) ─────────────────────── */

export const FAQ_KEYS = [
  "cost",
  "travel",
  "accommodation",
  "skillLevel",
  "rules",
  "selection",
  "teamChanges",
  "refund",
  "equipment",
  "deadline",
] as const;

/* ── Contacts (section 9 of the brief — left blank) ─────────────────────── */

export type ContactChannels = {
  phone: string | null;
  whatsapp: string | null;
  telegram: string | null;
  email: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  website: string | null;
  /** Full street address; the venue *name* is translated, the address is not. */
  address: string | null;
  mapsUrl: string | null;
};

/** @assumption All null — the brief left section 9 empty. UI hides null entries. */
export const CONTACTS: ContactChannels = {
  phone: null,
  whatsapp: null,
  telegram: null,
  email: null,
  instagram: null,
  tiktok: null,
  youtube: null,
  website: null,
  address: null,
  mapsUrl: null,
};

/* ── Brand assets ───────────────────────────────────────────────────────── */

/**
 * Supplied marks, trimmed of their original padding and capped at 1200px on
 * the long edge. Intrinsic dimensions are recorded so `next/image` can reserve
 * the right box and never shift the layout while the file loads.
 *
 * The championship mark is a white plate with a #00243c border — the same navy
 * the dark sections use — so on any `.on-dark` surface it must be rendered
 * with `plate`. See src/components/layout/Logo.tsx.
 */
export const BRAND_ASSETS = {
  championship: {
    src: "/brand/astanatechcup.png",
    alt: "AstanaTechCup",
    width: 1200,
    height: 506,
  },
  organizer: {
    src: "/brand/smarthub.png",
    alt: "SmartHub — Robotics & Drone Academy",
    width: 1200,
    height: 506,
  },
  coOrganizer: {
    src: "/brand/azgroup.png",
    alt: "AZ Group",
    width: 1200,
    height: 155,
  },
} as const;

/** Partner logos: drop files in /public/partners and list them here. */
export const PARTNERS: readonly { name: string; logo: string; url?: string }[] = [];

/** Regulations PDF (the brief says one exists). Put it in /public and link here. */
export const REGULATIONS_PDF: string | null = null;

/** Promo trailer (the brief says one exists). A local file or an embed URL. */
export const TRAILER_URL: string | null = null;

/* ── Derived helpers ────────────────────────────────────────────────────── */

/** Authoritative on the server; the client copy is UX only. */
export function isRegistrationOpen(now: Date = new Date()): boolean {
  return now.getTime() <= REGISTRATION_DEADLINE.getTime();
}

export function msUntilDeadline(now: Date = new Date()): number {
  return Math.max(0, REGISTRATION_DEADLINE.getTime() - now.getTime());
}
