/**
 * THE COMPETITION CATEGORIES, as published in the RobotChallenge rulebooks.
 *
 * This is a different axis from `DISCIPLINES` in src/config/event.ts, and the
 * two are deliberately not merged:
 *
 *   · A DISCIPLINE is what a team registers into — a technology family (VEX,
 *     LEGO, Arduino, drones, esports). It drives the registration form, the
 *     server-side validation and the admin panel, and its ids are already
 *     written into every stored application.
 *   · A CATEGORY is what a team actually competes in on the day — Sumo, Line
 *     Follower, Bowling. It drives the rules page and the scoring system.
 *
 * Everything below is transcribed from the rulebooks named in `source`. Where
 * a rulebook leaves a value open it is `null` and the UI says so, because a
 * guessed weight limit in a rules table is worse than an admitted gap: a team
 * builds to it.
 *
 * Numbers are stored as numbers with fixed units (centimetres, grams, minutes,
 * milliseconds) and formatted at render time — a rules page that says "15 см"
 * in Kazakh is a bug, and storing "15 cm" as a string makes that bug the
 * default.
 */

/* ── Vocabulary ─────────────────────────────────────────────────────────── */

/** Age brackets used by the rulebooks. They do not publish exact ages. */
export type AgeGroup = "junior" | "senior" | "adult";

export type Control = "autonomous" | "remote";

/** Arena surface, as named in the rulebook. Translated at render time. */
export type ArenaMaterial = "wood" | "steel" | "acrylic" | "carpet" | "vinyl" | "fabric";

/**
 * Robot envelope. `null` on any axis means the rulebook sets no limit there —
 * which is common: most sumo classes cap width and length but not height.
 */
export type Envelope = {
  /** Centimetres. */
  width: number | null;
  length: number | null;
  height: number | null;
  /** Grams. */
  weight: number | null;
};

export type Arena =
  | {
      shape: "ring";
      /** Centimetres. */
      diameter: number;
      borderWidth: number;
      material: ArenaMaterial;
    }
  | {
      shape: "rect";
      /** Centimetres. */
      length: number;
      width: number;
      height?: number;
      material?: ArenaMaterial;
    };

export type CategoryClass = {
  id: string;
  /** Proper noun from the rulebook — identical in every language. */
  label: string;
  groups: readonly AgeGroup[];
  control: Control;
  envelope: Envelope;
  arena: Arena | null;
};

/**
 * How results are recorded, and therefore what form the judge sees.
 *
 * `match` — two teams, one sheet, a winner. Sumo, Rugby, Drone Soccer,
 * Ring Master. The group stage is a round robin scored 3 / 1 / 0.
 *
 * `run` — one team against the clock or a score sheet, several attempts.
 * Line Follower, Bowling, Leap.
 */
export type ScoringModel =
  | {
      kind: "match";
      /** What the two numbers on the sheet count. */
      unit: "goals" | "points" | "rounds";
      /** Rounds in one head-to-head, when the format is best-of-N. */
      bestOf?: number;
      /** Whether the judge tracks yellow and red cards for this category. */
      cards: boolean;
      /** Group-stage table points. */
      league: { win: number; draw: number; loss: number };
    }
  | {
      kind: "run";
      metric: "time" | "points";
      /** Attempts every team gets. */
      rounds: number;
      /** How the attempts collapse into one ranking figure. */
      aggregate: "best" | "average";
      /** Result written for an attempt that does not finish, in milliseconds. */
      dnfMs?: number;
      /** Theoretical maximum, shown beside the input as a sanity check. */
      maxPoints?: number;
      /** Remaining time is recorded on every attempt and breaks ties. */
      tracksRemaining: boolean;
    };

export type CategoryId =
  | "sumo"
  | "lineFollower"
  | "rugby"
  | "droneSoccer"
  | "ringMaster"
  | "bowling"
  | "leap";

export type Category = {
  id: CategoryId;
  /** Hue on the shared brand ramp — same mechanism as the discipline cards. */
  hue: number;
  /** Mascot key in src/components/ui/robots.tsx. */
  mascot: string;
  /** Minutes of live play in one match or one attempt. */
  clockMinutes: number;
  /** Robots each team fields at once. */
  robotsPerTeam: number;
  scoring: ScoringModel;
  classes: readonly CategoryClass[];
  /** Rulebook this entry was transcribed from, with its revision date. */
  source: { title: string; revised: string };
};

/* ── Helpers used by the table below ────────────────────────────────────── */

const NO_LIMIT: Envelope = { width: null, length: null, height: null, weight: null };

function ring(
  diameter: number,
  borderWidth: number,
  material: ArenaMaterial,
): Arena {
  return { shape: "ring", diameter, borderWidth, material };
}

/* ── The catalogue ──────────────────────────────────────────────────────── */

export const CATEGORIES: readonly Category[] = [
  /* ───────────────────────────────────────────────────────────────────────
   * SUMO — RobotChallenge – Robo Sumo Rules, revised 15 September 2025.
   *
   * Eight classes on one ring shape. Everything except Humanoid is decided by
   * a push-out: best of three rounds, three minutes each, and the match ends
   * early at two wins. Humanoid is the exception — it accumulates points
   * (knock down 2, slip down 1, push out 3) over a single three-minute bout,
   * which is why `unit` differs per class in the rules copy but the judge's
   * sheet stays the same shape: two numbers and a winner.
   * ─────────────────────────────────────────────────────────────────────── */
  {
    id: "sumo",
    hue: 45,
    mascot: "sumo",
    clockMinutes: 3,
    robotsPerTeam: 1,
    scoring: {
      kind: "match",
      unit: "rounds",
      bestOf: 3,
      cards: false,
      league: { win: 3, draw: 1, loss: 0 },
    },
    source: { title: "RobotChallenge — Robo Sumo Rules", revised: "2025-09-15" },
    classes: [
      {
        id: "lego",
        label: "LEGO Sumo",
        groups: ["junior", "senior"],
        control: "autonomous",
        envelope: { width: 15, length: 15, height: 32, weight: 1000 },
        arena: ring(77, 2.5, "wood"),
      },
      {
        id: "mega",
        label: "Mega Sumo",
        groups: ["adult"],
        control: "autonomous",
        envelope: { width: 20, length: 20, height: null, weight: 3000 },
        arena: ring(154, 5, "steel"),
      },
      {
        id: "mega-rc",
        label: "Remote Mega Sumo",
        groups: ["senior", "adult"],
        control: "remote",
        envelope: { width: 20, length: 20, height: null, weight: 3000 },
        arena: ring(154, 5, "steel"),
      },
      {
        id: "mini",
        label: "Mini Sumo",
        groups: ["senior", "adult"],
        control: "autonomous",
        envelope: { width: 10, length: 10, height: null, weight: 500 },
        arena: ring(77, 2.5, "wood"),
      },
      {
        id: "mini-rc",
        label: "Remote Mini Sumo",
        groups: ["senior", "adult"],
        control: "remote",
        envelope: { width: 10, length: 10, height: null, weight: 500 },
        arena: ring(77, 2.5, "wood"),
      },
      {
        id: "micro",
        label: "Micro Sumo",
        groups: ["adult"],
        control: "autonomous",
        envelope: { width: 5, length: 5, height: 5, weight: 100 },
        arena: ring(38.5, 1.25, "acrylic"),
      },
      {
        id: "nano",
        label: "Nano Sumo",
        groups: ["adult"],
        control: "autonomous",
        envelope: { width: 2.5, length: 2.5, height: 2.5, weight: 25 },
        arena: ring(19.25, 0.625, "acrylic"),
      },
      {
        id: "humanoid",
        label: "Humanoid Sumo",
        groups: ["adult"],
        control: "autonomous",
        envelope: { width: 20, length: 20, height: 50, weight: 3000 },
        arena: ring(154, 5, "steel"),
      },
      {
        id: "humanoid-rc",
        label: "Remote Humanoid Sumo",
        groups: ["adult"],
        control: "remote",
        envelope: { width: 20, length: 20, height: 50, weight: 3000 },
        arena: ring(154, 5, "steel"),
      },
    ],
  },

  /* ───────────────────────────────────────────────────────────────────────
   * LINE FOLLOWER — revised 15 September 2025.
   *
   * Three attempts, best time counts. A robot that does not finish inside
   * three minutes is written down as 3:00.001 rather than as a blank, so it
   * still sorts — behind every finisher, ahead of nothing. That constant is
   * `dnfMs` below and the judge's form uses it rather than asking anyone to
   * type it.
   * ─────────────────────────────────────────────────────────────────────── */
  {
    id: "lineFollower",
    hue: 190,
    mascot: "circuit",
    clockMinutes: 3,
    robotsPerTeam: 1,
    scoring: {
      kind: "run",
      metric: "time",
      rounds: 3,
      aggregate: "best",
      dnfMs: 180_001,
      tracksRemaining: false,
    },
    source: { title: "RobotChallenge — Line Follower", revised: "2025-09-15" },
    classes: [
      {
        id: "lego",
        label: "LEGO Line Follower",
        groups: ["junior", "senior", "adult"],
        control: "autonomous",
        envelope: { width: 30, length: 30, height: null, weight: 3000 },
        arena: { shape: "rect", length: 450, width: 280, material: "carpet" },
      },
      {
        id: "open",
        label: "Line Follower",
        groups: ["junior", "senior", "adult"],
        control: "autonomous",
        envelope: { width: 30, length: 30, height: null, weight: 3000 },
        arena: { shape: "rect", length: 450, width: 280, material: "carpet" },
      },
      {
        id: "enhanced",
        label: "Line Follower Enhanced",
        groups: ["senior", "adult"],
        control: "autonomous",
        envelope: { width: 30, length: 30, height: null, weight: 3000 },
        arena: { shape: "rect", length: 450, width: 280, material: "carpet" },
      },
    ],
  },

  /* ───────────────────────────────────────────────────────────────────────
   * ROBOT RUGBY — revised 15 September 2025.
   *
   * Three remote-controlled robots a side, three minutes, one point a try.
   * The only category where a disciplinary decision can put points on the
   * board directly: a disqualification hands the opponent five, which is why
   * the judge's sheet tracks cards as first-class fields rather than notes.
   * ─────────────────────────────────────────────────────────────────────── */
  {
    id: "rugby",
    hue: 265,
    mascot: "vex",
    clockMinutes: 3,
    robotsPerTeam: 3,
    scoring: {
      kind: "match",
      unit: "goals",
      cards: true,
      league: { win: 3, draw: 1, loss: 0 },
    },
    source: { title: "RobotChallenge — Robot Rugby Rule", revised: "2025-09-15" },
    classes: [
      {
        id: "junior",
        label: "Rugby Junior",
        groups: ["junior"],
        control: "remote",
        envelope: { width: 20, length: 20, height: 20, weight: 1500 },
        arena: { shape: "rect", length: 350, width: 150 },
      },
      {
        id: "senior",
        label: "Rugby Senior",
        groups: ["senior"],
        control: "remote",
        envelope: { width: 20, length: 20, height: 20, weight: 3000 },
        arena: { shape: "rect", length: 350, width: 150, material: "carpet" },
      },
    ],
  },

  /* ───────────────────────────────────────────────────────────────────────
   * DRONE SOCCER — revised 24 March 2026. The newest rulebook of the seven.
   *
   * 3v3 inside a netted cage: one striker, two defenders, roles fixed for the
   * match. A goal is the striker's ball passing fully through the opponent's
   * ring from the front.
   * ─────────────────────────────────────────────────────────────────────── */
  {
    id: "droneSoccer",
    hue: 220,
    mascot: "drone",
    clockMinutes: 3,
    robotsPerTeam: 3,
    scoring: {
      kind: "match",
      unit: "goals",
      cards: true,
      league: { win: 3, draw: 1, loss: 0 },
    },
    source: { title: "RobotChallenge — Drone Soccer", revised: "2026-03-24" },
    classes: [
      {
        id: "junior",
        label: "Drone Soccer Junior",
        groups: ["junior"],
        control: "remote",
        // Drones are measured across the protective cage, not as a box, so
        // width carries the diameter and the other axes stay null.
        envelope: { width: 22, length: null, height: null, weight: 150 },
        arena: { shape: "rect", length: 600, width: 300, height: 300 },
      },
      {
        id: "senior",
        label: "Drone Soccer Senior",
        groups: ["senior"],
        control: "remote",
        envelope: { width: 22, length: null, height: null, weight: 300 },
        arena: { shape: "rect", length: 600, width: 300, height: 300 },
      },
    ],
  },

  /* ───────────────────────────────────────────────────────────────────────
   * RING MASTER CHALLENGE — revised 24 March 2026.
   *
   * Five minutes of stacking foam rings onto scoring poles worth 1, 2, 3 or 5
   * points, with a yellow ring on top doubling that pole. Penalties are
   * subtractive (−10, −30), so a team's match score can legitimately be
   * negative and the judge's input must not clamp at zero.
   * ─────────────────────────────────────────────────────────────────────── */
  {
    id: "ringMaster",
    hue: 340,
    mascot: "ring",
    clockMinutes: 5,
    robotsPerTeam: 1,
    scoring: {
      kind: "match",
      unit: "points",
      cards: true,
      league: { win: 3, draw: 1, loss: 0 },
    },
    source: {
      title: "RobotChallenge — Ring Master Challenge Rules",
      revised: "2026-03-24",
    },
    classes: [
      {
        id: "junior",
        label: "Ring Master Junior",
        groups: ["junior"],
        control: "remote",
        envelope: { width: 25, length: 25, height: 25, weight: 2000 },
        arena: { shape: "rect", length: 200, width: 200, material: "vinyl" },
      },
      {
        id: "senior",
        label: "Ring Master Senior",
        groups: ["senior"],
        control: "remote",
        envelope: { width: 25, length: 25, height: 25, weight: 2000 },
        arena: { shape: "rect", length: 200, width: 200, material: "vinyl" },
      },
    ],
  },

  /* ───────────────────────────────────────────────────────────────────────
   * BOWLING — revised 15 September 2025.
   *
   * Two rounds of five frames, scored with real bowling arithmetic: a strike
   * is worth ten plus the next two balls, a spare ten plus the next one, and
   * a strike in the fifth frame earns two bonus balls on lanes six and seven.
   * Maximum 150. The ranking figure is the AVERAGE of the two rounds, not the
   * better one — the only category of the seven that works that way.
   * ─────────────────────────────────────────────────────────────────────── */
  {
    id: "bowling",
    hue: 160,
    mascot: "pin",
    clockMinutes: 3,
    robotsPerTeam: 1,
    scoring: {
      kind: "run",
      metric: "points",
      rounds: 2,
      aggregate: "average",
      maxPoints: 150,
      tracksRemaining: true,
    },
    source: { title: "RobotChallenge — Robot Bowling Rules", revised: "2025-09-15" },
    classes: [
      {
        id: "junior",
        label: "Bowling Junior",
        groups: ["junior"],
        control: "autonomous",
        // 20 × 20 at inspection; may expand to 30 × 30 once running.
        envelope: { width: 20, length: 20, height: null, weight: null },
        arena: { shape: "rect", length: 120, width: 40 },
      },
      {
        id: "senior",
        label: "Bowling Senior",
        groups: ["senior"],
        control: "autonomous",
        envelope: { width: 20, length: 20, height: null, weight: null },
        arena: { shape: "rect", length: 160, width: 60 },
      },
    ],
  },

  /* ───────────────────────────────────────────────────────────────────────
   * LEAP — revised 15 September 2025.
   *
   * A task board rather than a duel: thirteen scored items on a 0.9 × 2 m
   * stage, 270 points on the table (300 with the championship bonus task),
   * plus a time bonus worth 30. Two rounds, the better one counts.
   *
   * This is the one category whose score sheet is fully enumerated in the
   * rulebook, so the judge's console reproduces it item by item and adds up
   * the total itself — see LEAP_SCORE_SHEET below.
   * ─────────────────────────────────────────────────────────────────────── */
  {
    id: "leap",
    hue: 305,
    mascot: "blocks",
    clockMinutes: 3,
    robotsPerTeam: 1,
    scoring: {
      kind: "run",
      metric: "points",
      rounds: 2,
      aggregate: "best",
      maxPoints: 300,
      tracksRemaining: true,
    },
    source: { title: "RobotChallenge — RC-Leap Rules", revised: "2025-09-15" },
    classes: [
      {
        id: "open",
        label: "Leap",
        groups: ["junior"],
        control: "remote",
        // "Robot size must not exceed the START area" — no absolute figure is
        // published, and no height or weight limit exists.
        envelope: NO_LIMIT,
        arena: { shape: "rect", length: 200, width: 90, material: "fabric" },
      },
    ],
  },
] as const;

/* ── Leap score sheet ───────────────────────────────────────────────────── */

/**
 * The Leap sheet, item for item, from section 6 of the rulebook.
 *
 * `max` is how many times the item can be counted; `value` is what each one is
 * worth. A negative `value` is a penalty (the retry deduction), which is why
 * the total is computed rather than summed from a single input — a judge
 * adding thirteen rows in their head at a noisy venue will make mistakes, and
 * a mis-scored round is the thing an appeals process cannot fix afterwards.
 */
export type LeapItem = {
  id: string;
  value: number;
  max: number;
};

export const LEAP_SCORE_SHEET: readonly LeapItem[] = [
  { id: "circuit", value: 15, max: 2 },
  { id: "micUpright", value: 10, max: 3 },
  { id: "micPlaced", value: 5, max: 3 },
  { id: "micMoved", value: 3, max: 3 },
  { id: "speakers", value: 10, max: 2 },
  { id: "screen", value: 10, max: 1 },
  { id: "bandUpright", value: 10, max: 5 },
  { id: "bandPlaced", value: 5, max: 5 },
  { id: "bandField", value: 3, max: 5 },
  { id: "lighting", value: 25, max: 1 },
  { id: "sound", value: 10, max: 3 },
  { id: "crane", value: 25, max: 1 },
  { id: "fireworks", value: 10, max: 2 },
  { id: "diveOut", value: 25, max: 1 },
  { id: "diveIn", value: 10, max: 1 },
  { id: "bonus", value: 30, max: 1 },
  { id: "intact", value: 5, max: 1 },
  { id: "retry", value: -5, max: 20 },
] as const;

/** Time bonus is 10% of the base sheet: `(remaining / total) × 30`. */
export const LEAP_TIME_BONUS_MAX = 30;

export function leapTimeBonus(remainingMs: number, totalMs: number): number {
  if (totalMs <= 0 || remainingMs <= 0) return 0;
  const ratio = Math.min(1, remainingMs / totalMs);
  return Math.round(ratio * LEAP_TIME_BONUS_MAX);
}

/* ── Derived helpers ────────────────────────────────────────────────────── */

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export function getCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function isCategoryId(id: string): id is CategoryId {
  return CATEGORIES.some((c) => c.id === id);
}

export function getCategoryClass(
  categoryId: string,
  classId: string,
): CategoryClass | undefined {
  return getCategory(categoryId)?.classes.find((c) => c.id === classId);
}

/** Every `categoryId:classId` pair, for validating what a judge submits. */
export function isCategoryClass(categoryId: string, classId: string): boolean {
  return Boolean(getCategoryClass(categoryId, classId));
}

/** Age groups a category runs, in rulebook order, de-duplicated. */
export function categoryGroups(category: Category): AgeGroup[] {
  const order: AgeGroup[] = ["junior", "senior", "adult"];
  const present = new Set(category.classes.flatMap((c) => [...c.groups]));
  return order.filter((group) => present.has(group));
}

/** Total classes across the catalogue — the headline number on the page. */
export const TOTAL_CLASSES = CATEGORIES.reduce((n, c) => n + c.classes.length, 0);
