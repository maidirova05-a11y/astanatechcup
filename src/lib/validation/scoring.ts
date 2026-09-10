import { z } from "zod";
import {
  getCategory,
  isCategoryClass,
  leapTimeBonus,
  LEAP_SCORE_SHEET,
} from "@/config/categories";
import { parseClock, parseDuration } from "@/lib/scoring/format";

/**
 * Server-side validation for everything the judges' console submits.
 *
 * A server action is a public endpoint. The console's inputs are `type=number`
 * with `min` and `max`, and none of that reaches the server — it is a hint to
 * the phone's keyboard, not a constraint. Everything below re-derives the
 * limits from src/config/categories.ts, which is the same file the rules page
 * renders, so a category cannot mean one thing to a reader and another to the
 * form that scores it.
 */

/* ── Shared field shapes ────────────────────────────────────────────────── */

const trimmed = z.string().trim();

/** Optional free text: an empty field means "not given", never "". */
function optionalText(max: number) {
  return trimmed
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null);
}

const categoryRef = z.object({
  categoryId: trimmed.min(1).max(32),
  classId: trimmed.min(1).max(48),
});

/** Attached to every schema below: the pair must exist in the catalogue. */
const KNOWN_CLASS = {
  message: "Неизвестная категория или класс",
  path: ["classId"],
};

function knownClass(value: { categoryId: string; classId: string }): boolean {
  return isCategoryClass(value.categoryId, value.classId);
}

/* ── Teams ──────────────────────────────────────────────────────────────── */

export const teamSchema = categoryRef
  .extend({
    /** Start number. Short because it is announced out loud and written on tape. */
    code: trimmed.min(1).max(16),
    name: trimmed.min(2).max(120),
    organization: optionalText(200),
    region: optionalText(40),
    /** Round-robin group letter. */
    groupLabel: trimmed
      .max(8)
      .transform((value) => (value === "" ? null : value.toUpperCase()))
      .nullable()
      .default(null),
  })
  .refine(knownClass, KNOWN_CLASS);

export type TeamFields = z.infer<typeof teamSchema>;

/**
 * Bulk roster entry: one name per line from a single textarea, instead of a
 * form per team. Everything else the single-team form asks for — group,
 * organisation, region — is shared across the whole batch.
 */
export const bulkTeamSchema = categoryRef
  .extend({
    namesText: trimmed.min(1).max(8000),
    organization: optionalText(200),
    region: optionalText(40),
    groupLabel: trimmed
      .max(8)
      .transform((value) => (value === "" ? null : value.toUpperCase()))
      .nullable()
      .default(null),
  })
  .refine(knownClass, KNOWN_CLASS)
  .transform((value) => ({
    ...value,
    names: value.namesText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length >= 2)
      .map((line) => line.slice(0, 120)),
  }))
  .refine((value) => value.names.length > 0, {
    message: "Введите хотя бы одно название команды",
    path: ["namesText"],
  })
  .refine((value) => value.names.length <= 64, {
    message: "За один раз можно добавить не больше 64 команд",
    path: ["namesText"],
  });

export type BulkTeamFields = z.infer<typeof bulkTeamSchema>;

/* ── Bracket generation ────────────────────────────────────────────────── */

export const generateRoundRobinSchema = categoryRef
  .extend({
    groupLabel: trimmed.min(1).max(8).transform((value) => value.toUpperCase()),
  })
  .refine(knownClass, KNOWN_CLASS);

export type GenerateRoundRobinFields = z.infer<typeof generateRoundRobinSchema>;

/**
 * Playoff seeding is a newline-separated list of team ids in seed order —
 * the console renders them as a re-orderable list, not free text a judge
 * types, but the wire format is the same either way.
 */
export const generateBracketSchema = categoryRef
  .extend({
    seedOrder: trimmed.min(1).max(4000),
  })
  .refine(knownClass, KNOWN_CLASS)
  .transform((value) => ({
    ...value,
    teamIds: value.seedOrder
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  }))
  .refine((value) => value.teamIds.length >= 2, {
    message: "Нужно минимум две команды",
    path: ["seedOrder"],
  })
  .refine((value) => value.teamIds.every((id) => z.string().uuid().safeParse(id).success), {
    message: "Список мест засорён — обновите страницу и попробуйте снова",
    path: ["seedOrder"],
  })
  .refine((value) => new Set(value.teamIds).size === value.teamIds.length, {
    message: "Одна команда указана в сетке дважды",
    path: ["seedOrder"],
  });

export type GenerateBracketFields = z.infer<typeof generateBracketSchema>;

/**
 * Seeding a team onto the start list FROM a paid entry, in the admin panel.
 *
 * Separate from `teamSchema` because the two forms are filled in by different
 * people from different sources. The console's form asks for a name and an
 * organisation, because a team that turns up on the day has neither on file.
 * This one takes them from the entry, so the only things a human supplies are
 * the ones no entry can answer: which category and class the team is actually
 * competing in, its start number, and its group.
 *
 * The discipline on an entry cannot answer that. Registration collects six
 * disciplines and the rulebooks define seven categories with twenty-one
 * classes between them; "lego" is a discipline on the form and a CLASS inside
 * two different categories in the rulebook. Guessing that mapping would put
 * teams in the wrong bracket, so a person chooses.
 */
export const startListSchema = categoryRef
  .extend({
    applicationId: trimmed.uuid(),
    /**
     * Optional: an empty field means "give it the next free number". The class
     * is not known until this form is submitted, so the server cannot suggest
     * one while it is being filled in without shipping JavaScript to do it.
     */
    code: trimmed.max(16).default(""),
    groupLabel: trimmed
      .max(8)
      .transform((value) => (value === "" ? null : value.toUpperCase()))
      .nullable()
      .default(null),
  })
  .refine(knownClass, KNOWN_CLASS);

export type StartListFields = z.infer<typeof startListSchema>;


/* ── Matches ────────────────────────────────────────────────────────────── */

export const matchCreateSchema = categoryRef
  .extend({
    stage: z.enum(["group", "playoff", "final"]).default("group"),
    groupLabel: trimmed
      .max(8)
      .transform((value) => (value === "" ? null : value.toUpperCase()))
      .nullable()
      .default(null),
    roundLabel: optionalText(40),
    redTeamId: z.string().uuid(),
    blueTeamId: z.string().uuid(),
  })
  .refine(knownClass, KNOWN_CLASS)
  .refine((value) => value.redTeamId !== value.blueTeamId, {
    message: "Команда не может играть сама с собой",
    path: ["blueTeamId"],
  });

/**
 * Scores are signed. Ring Master's penalties are −10 and −30, so a match can
 * genuinely end below zero and a `min(0)` here would force a judge to file a
 * number they know is wrong.
 */
const matchScore = z.coerce.number().int().min(-500).max(999);
const cardCount = z.coerce.number().int().min(0).max(20);

export const matchResultSchema = z.object({
  redScore: matchScore,
  blueScore: matchScore,
  redYellow: cardCount,
  redRed: cardCount,
  blueYellow: cardCount,
  blueRed: cardCount,
  /**
   * The judge states the outcome; it is not inferred from the scores. Every
   * rulebook here has at least one way for the referee to award a match against
   * the score — a disqualification, a card count, a golden goal, Ring Master's
   * Endgame — and a system that overrides the referee is a system the referee
   * will stop using.
   */
  outcome: z.enum(["red", "blue", "draw", "open"]),
  state: z.enum(["scheduled", "live", "completed"]),
  notes: optionalText(500),
});

export type MatchResultFields = z.infer<typeof matchResultSchema>;

/* ── Runs ───────────────────────────────────────────────────────────────── */

const runStateSchema = z.enum(["ok", "dnf", "foul", "dsq"]);

/**
 * Parse one attempt against the category that owns it.
 *
 * Returns a discriminated result rather than throwing, because the caller is a
 * server action whose job is to hand a message back to a form, and because the
 * per-category rules here (a time category has no points field; Leap's total is
 * computed, not typed) do not fit a static schema.
 */
export type RunParseResult =
  | { ok: true; value: ParsedRun }
  | { ok: false; error: string };

export type ParsedRun = {
  categoryId: string;
  classId: string;
  teamId: string;
  roundNumber: number;
  state: z.infer<typeof runStateSchema>;
  timeMs: number | null;
  points: number | null;
  remainingMs: number | null;
  breakdown: string | null;
  notes: string | null;
};

const runBaseSchema = categoryRef
  .extend({
    teamId: z.string().uuid(),
    roundNumber: z.coerce.number().int().min(1).max(10),
    state: runStateSchema,
    /** Raw strings — parsed below, because their meaning is category-specific. */
    time: trimmed.max(16).default(""),
    points: trimmed.max(8).default(""),
    remaining: trimmed.max(16).default(""),
    notes: optionalText(500),
  })
  .refine(knownClass, KNOWN_CLASS);

export function parseRun(
  raw: Record<string, unknown>,
  breakdownCounts: Record<string, number> | null,
): RunParseResult {
  const parsed = runBaseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля формы" };
  }

  const fields = parsed.data;
  const category = getCategory(fields.categoryId);
  if (!category || category.scoring.kind !== "run") {
    return { ok: false, error: "В этой категории результаты вносятся как матчи" };
  }

  if (fields.roundNumber > category.scoring.rounds) {
    return {
      ok: false,
      error: `В этой категории попыток всего ${category.scoring.rounds}`,
    };
  }

  const failed = fields.state !== "ok";

  /* Remaining time is optional everywhere and only used as a tiebreak. */
  let remainingMs: number | null = null;
  if (category.scoring.tracksRemaining && fields.remaining !== "") {
    remainingMs = parseDuration(fields.remaining);
    if (remainingMs === null) {
      return { ok: false, error: "Остаток времени: используйте формат мм:сс" };
    }
    if (remainingMs > category.clockMinutes * 60_000) {
      return { ok: false, error: "Остаток больше, чем длится попытка" };
    }
  }

  if (category.scoring.metric === "time") {
    // A failed attempt takes the rulebook's own constant rather than a blank,
    // so it still sorts — behind every finisher, ahead of nothing.
    if (failed) {
      return {
        ok: true,
        value: {
          ...toParsed(fields),
          timeMs: category.scoring.dnfMs ?? null,
          points: null,
          remainingMs,
          breakdown: null,
        },
      };
    }

    const timeMs = parseClock(fields.time);
    if (timeMs === null) {
      return { ok: false, error: "Время: используйте формат м:сс,ммм" };
    }

    return {
      ok: true,
      value: { ...toParsed(fields), timeMs, points: null, remainingMs, breakdown: null },
    };
  }

  /* Points categories. */

  if (breakdownCounts) {
    const sheet = scoreLeapSheet(breakdownCounts);
    if (!sheet.ok) return sheet;

    return {
      ok: true,
      value: {
        ...toParsed(fields),
        timeMs: null,
        points: failed
          ? 0
          : sheet.total +
            leapTimeBonus(remainingMs ?? 0, category.clockMinutes * 60_000),
        remainingMs,
        breakdown: JSON.stringify(sheet.counts),
      },
    };
  }

  if (failed) {
    return {
      ok: true,
      value: { ...toParsed(fields), timeMs: null, points: 0, remainingMs, breakdown: null },
    };
  }

  const points = Number(fields.points);
  if (fields.points === "" || !Number.isInteger(points)) {
    return { ok: false, error: "Введите количество очков" };
  }

  const ceiling = category.scoring.maxPoints ?? 9999;
  if (points < 0 || points > ceiling) {
    return { ok: false, error: `Очки должны быть в диапазоне 0…${ceiling}` };
  }

  return {
    ok: true,
    value: { ...toParsed(fields), timeMs: null, points, remainingMs, breakdown: null },
  };
}

function toParsed(fields: z.infer<typeof runBaseSchema>) {
  return {
    categoryId: fields.categoryId,
    classId: fields.classId,
    teamId: fields.teamId,
    roundNumber: fields.roundNumber,
    state: fields.state,
    notes: fields.notes,
  };
}

/* ── Leap's score sheet ─────────────────────────────────────────────────── */

/**
 * Total the Leap sheet from the counts the judge ticked.
 *
 * Doing the arithmetic here rather than asking for a total is the whole point
 * of reproducing the sheet: eighteen rows, some of them negative, added up in
 * someone's head beside a noisy stage is exactly where a mis-scored round comes
 * from, and a mis-scored round is what an appeals process cannot fix afterwards.
 */
/**
 * Rows that describe the SAME prop at different quality levels.
 *
 * Three microphones cannot each be worth ten points and five points at once.
 * The rulebook says so by counting props rather than rows; without this check a
 * sheet totals to more than the task is worth, and nothing downstream would
 * notice.
 */
const EXCLUSIVE_GROUPS: { ids: string[]; max: number; label: string }[] = [
  { ids: ["micUpright", "micPlaced", "micMoved"], max: 3, label: "микрофоны" },
  { ids: ["bandUpright", "bandPlaced", "bandField"], max: 5, label: "музыканты" },
  { ids: ["diveOut", "diveIn"], max: 1, label: "stage dive" },
];

export function scoreLeapSheet(
  counts: Record<string, number>,
): { ok: true; total: number; counts: Record<string, number> } | { ok: false; error: string } {
  const clean: Record<string, number> = {};
  let total = 0;

  for (const item of LEAP_SCORE_SHEET) {
    const raw = counts[item.id] ?? 0;
    if (!Number.isInteger(raw) || raw < 0 || raw > item.max) {
      return { ok: false, error: `Строка «${item.id}»: допустимо от 0 до ${item.max}` };
    }
    clean[item.id] = raw;
    total += raw * item.value;
  }

  for (const group of EXCLUSIVE_GROUPS) {
    const sum = group.ids.reduce((n, id) => n + (clean[id] ?? 0), 0);
    if (sum > group.max) {
      return {
        ok: false,
        error: `Строки «${group.label}»: в сумме не больше ${group.max}`,
      };
    }
  }

  // The sheet's own penalties can outweigh the tasks completed. A round is
  // never worth less than nothing.
  return { ok: true, total: Math.max(0, total), counts: clean };
}
