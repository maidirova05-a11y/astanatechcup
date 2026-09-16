/**
 * Demo roster and schedule for the scoring system.
 *
 *   npm run seed:demo           — wipe the scoring tables, seed rosters,
 *                                 schedules and a mid-championship set of
 *                                 results
 *   npm run seed:demo -- --empty  — same rosters and schedules, no results
 *   npm run seed:demo -- --clear  — wipe only, seed nothing
 *
 * ── Read this before running it ──────────────────────────────────────────
 * It DELETES every row in scoring_teams, scoring_matches and scoring_runs
 * first. There is no per-category flag and no undo. The audit trail is left
 * alone on purpose: an audit log you can delete is not an audit log.
 *
 * It also writes to whatever DATABASE_URL points at, and in this project
 * `.env.local` points at the same Neon database production uses. That is fine
 * for demo rosters — teams, start numbers and scores are public information
 * and contain nothing personal — and it is the reason the script is loud
 * about what it is doing and refuses to touch `applications`, which do hold
 * children's data.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Everything is deterministic: one fixed PRNG seed, explicit `createdAt`
 * stamps, so two runs produce the same board and a screenshot taken today
 * still matches the data tomorrow. Explicit stamps matter for a second reason
 * — match numbers (M1, M2 …) are derived from insertion order, so a bulk
 * insert that let every row share one `now()` would shuffle them.
 */
import { randomUUID } from "node:crypto";
import { getDb, closeDb } from "@/lib/db/client";
import { scoringMatches, scoringRuns, scoringTeams } from "@/lib/db/schema";
import { getCategory, type Category } from "@/config/categories";
import { planElimination, roundRobinPairings, seedFromGroupStandings } from "@/lib/scoring/bracket";
import { buildStandings } from "@/lib/scoring/standings";
import type { ScoringMatchRow, ScoringTeamRow } from "@/lib/db/schema";

/* ── Deterministic randomness ──────────────────────────────────────────── */

/** mulberry32 — small, fast, and identical on every machine. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(20270515);
const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));

/* ── Who is competing ──────────────────────────────────────────────────── */

const TEAM_NAMES = [
  "Qyran", "Alatau Bots", "Tulpar", "Sunkar", "Bars Robotics", "Nomad Lab",
  "Astana Circuits", "Baiterek", "Zhalyn", "Arlan", "Kok-Tobe Makers",
  "Turan Dynamics", "Aibyn", "Shanyraq Tech", "Zhiger", "Samruk",
  "Ertis Robotics", "Qazaq Motors", "Beskaragai", "Altyn Adam",
  "Syrdarya Steel", "Mangystau Circuit", "Zhetysu Spark", "Saryarqa Drive",
  "Ulytau Engine", "Abai Logic", "Kaspi Wave", "Talgar Gear",
  "Oskemen Volt", "Taraz Byte", "Aktobe Axis", "Semey Servo",
  "Burabay Bots", "Kyzylorda Kinetics", "Petropavl Pulse", "Kostanay Core",
  "Atyrau Titans", "Aksu Automata", "Balkhash Bytes", "Ekibastuz Electrons",
  "Zhezkazgan Gears", "Temirtau Torque", "Kentau Code", "Rudny Robotics",
] as const;

const ORGS = [
  "НИШ ФМН Астана", "Лицей №66, Астана", "Школа-лицей №8, Алматы",
  "Технопарк «Астана Хаб»", "IT-школа Tumo Almaty", "Гимназия №38, Караганда",
  "КТЛ Шымкент", "Робоклуб «Тулпар», Актобе", "Колледж НУ, Астана",
  "Школа №25, Атырау", "Кружок робототехники, Павлодар", "Дворец школьников, Тараз",
] as const;

const REGIONS = [
  "astana", "almaty_city", "shymkent", "karaganda", "aktobe", "atyrau",
  "pavlodar", "zhambyl", "east_kazakhstan", "kostanay", "turkistan", "akmola",
] as const;

/* ── What to seed ──────────────────────────────────────────────────────── */

type ClassPlan = {
  categoryId: string;
  classId: string;
  teams: number;
  /** Group letters to spread the roster across. Empty means one flat list. */
  groups: string[];
  /**
   * How much of the schedule has been played, 0–1. The board is most useful
   * as a demo when it shows every state at once: a class that is finished, one
   * mid-way, and one that has not started.
   */
  played: number;
  /** Generate the elimination bracket from the group results. */
  playoff?: boolean;
  /** Of the bracket's rounds, how many are already decided. */
  playoffRoundsPlayed?: number;
};

const PLAN: ClassPlan[] = [
  /* ── Robo Sumo: all nine classes ─────────────────────────────────────── */
  // The showcase class: four full groups, a finished group stage, and a
  // bracket played to the final.
  { categoryId: "sumo", classId: "lego", teams: 16, groups: ["A", "B", "C", "D"], played: 1, playoff: true, playoffRoundsPlayed: 2 },
  { categoryId: "sumo", classId: "mega", teams: 6, groups: ["A"], played: 0.34 },
  { categoryId: "sumo", classId: "mega-rc", teams: 8, groups: ["A", "B"], played: 1, playoff: true, playoffRoundsPlayed: 1 },
  { categoryId: "sumo", classId: "mini", teams: 8, groups: ["A", "B"], played: 0.6 },
  { categoryId: "sumo", classId: "mini-rc", teams: 6, groups: ["A"], played: 1 },
  { categoryId: "sumo", classId: "micro", teams: 5, groups: ["A"], played: 0.5 },
  { categoryId: "sumo", classId: "nano", teams: 4, groups: ["A"], played: 0 },
  { categoryId: "sumo", classId: "humanoid", teams: 4, groups: ["A"], played: 1, playoff: true, playoffRoundsPlayed: 2 },
  { categoryId: "sumo", classId: "humanoid-rc", teams: 4, groups: ["A"], played: 0.5 },

  /* ── Line Follower: three classes ────────────────────────────────────── */
  { categoryId: "lineFollower", classId: "lego", teams: 12, groups: [], played: 1 },
  { categoryId: "lineFollower", classId: "open", teams: 10, groups: [], played: 0.67 },
  { categoryId: "lineFollower", classId: "enhanced", teams: 8, groups: [], played: 0.34 },

  /* ── Robot Rugby ─────────────────────────────────────────────────────── */
  { categoryId: "rugby", classId: "junior", teams: 8, groups: ["A", "B"], played: 1, playoff: true, playoffRoundsPlayed: 1 },
  { categoryId: "rugby", classId: "senior", teams: 6, groups: ["A"], played: 0.6 },

  /* ── Drone Soccer ────────────────────────────────────────────────────── */
  { categoryId: "droneSoccer", classId: "junior", teams: 6, groups: ["A"], played: 0.5 },
  { categoryId: "droneSoccer", classId: "senior", teams: 8, groups: ["A", "B"], played: 1, playoff: true, playoffRoundsPlayed: 0 },

  /* ── Ring Master ─────────────────────────────────────────────────────── */
  // Scheduled and untouched — this is what a referee sees before the first
  // bout, and the state the console's table exists to fill in.
  { categoryId: "ringMaster", classId: "junior", teams: 6, groups: ["A"], played: 0 },
  { categoryId: "ringMaster", classId: "senior", teams: 6, groups: ["A"], played: 0.4 },

  /* ── Robot Bowling ───────────────────────────────────────────────────── */
  { categoryId: "bowling", classId: "junior", teams: 8, groups: [], played: 1 },
  { categoryId: "bowling", classId: "senior", teams: 8, groups: [], played: 0.5 },

  /* ── Leap ────────────────────────────────────────────────────────────── */
  { categoryId: "leap", classId: "open", teams: 6, groups: [], played: 0.5 },
];

/* ── Rows ──────────────────────────────────────────────────────────────── */

type TeamInsert = typeof scoringTeams.$inferInsert;
type MatchInsert = typeof scoringMatches.$inferInsert;
type RunInsert = typeof scoringRuns.$inferInsert;

/** Stamps march forward one second at a time, so insertion order is explicit. */
let clock = new Date("2027-05-15T08:00:00.000Z").getTime();
const nextStamp = () => new Date((clock += 1000));

function buildTeams(plan: ClassPlan, category: Category, offset: number): TeamInsert[] {
  const cls = category.classes.find((c) => c.id === plan.classId)!;

  return Array.from({ length: plan.teams }, (_, i) => {
    const stamp = nextStamp();
    return {
      id: randomUUID(),
      categoryId: plan.categoryId,
      classId: plan.classId,
      // The start number as it is announced and written on tape: the class
      // code plus a position, exactly as the international board numbers them.
      code: `${cls.code}-${String(i + 1).padStart(2, "0")}`,
      name: TEAM_NAMES[(offset + i) % TEAM_NAMES.length],
      organization: pick(ORGS),
      region: pick(REGIONS),
      groupLabel: plan.groups.length > 0 ? plan.groups[i % plan.groups.length] : null,
      archivedAt: null,
      createdAt: stamp,
      updatedAt: stamp,
    };
  });
}

/** A plausible scoreline for the category's unit, and who it hands the match to. */
function scoreFor(category: Category): { red: number; blue: number; draw: boolean } {
  if (category.scoring.kind !== "match") return { red: 0, blue: 0, draw: false };

  switch (category.scoring.unit) {
    case "rounds": {
      // Best of three, so the match stops at two wins: 2:0 or 2:1, never level.
      const redWins = random() < 0.5;
      const loser = random() < 0.45 ? 1 : 0;
      return redWins ? { red: 2, blue: loser, draw: false } : { red: loser, blue: 2, draw: false };
    }
    case "goals": {
      const red = between(0, 5);
      const blue = between(0, 5);
      return { red, blue, draw: red === blue };
    }
    case "points": {
      const red = between(10, 90);
      const blue = between(10, 90);
      return { red, blue, draw: red === blue };
    }
  }
}

function buildGroupMatches(
  plan: ClassPlan,
  category: Category,
  teams: TeamInsert[],
): MatchInsert[] {
  const labels = plan.groups.length > 0 ? plan.groups : [null];
  const matches: MatchInsert[] = [];

  for (const label of labels) {
    const inGroup = teams.filter((team) => team.groupLabel === label);
    if (inGroup.length < 2) continue;

    const pairings = roundRobinPairings(inGroup.map((team) => team.id!));
    const cutoff = Math.round(pairings.length * plan.played);

    pairings.forEach((pairing, index) => {
      const stamp = nextStamp();
      const done = index < cutoff;
      const score = done ? scoreFor(category) : { red: 0, blue: 0, draw: false };

      matches.push({
        id: randomUUID(),
        categoryId: plan.categoryId,
        classId: plan.classId,
        stage: "group",
        groupLabel: label,
        roundLabel: `Раунд ${pairing.round}`,
        redTeamId: pairing.a,
        blueTeamId: pairing.b,
        redScore: score.red,
        blueScore: score.blue,
        state: done ? "completed" : "scheduled",
        isDraw: done && score.draw,
        winnerTeamId: !done || score.draw ? null : score.red > score.blue ? pairing.a : pairing.b,
        playedAt: done ? stamp : null,
        createdAt: stamp,
        updatedAt: stamp,
      });
    });
  }

  return matches;
}

/**
 * The bracket, seeded from the group results the same way the console seeds
 * it — group winners first, then runners-up — so the demo shows the real
 * pipeline rather than an unrelated draw.
 */
function buildBracket(
  plan: ClassPlan,
  category: Category,
  teams: TeamInsert[],
  groupMatches: MatchInsert[],
): MatchInsert[] {
  const asRows = teams as unknown as ScoringTeamRow[];
  const asMatches = groupMatches as unknown as ScoringMatchRow[];

  const standings = plan.groups
    .map((label) =>
      buildStandings(
        asRows.filter((team) => team.groupLabel === label),
        asMatches.filter((match) => match.groupLabel === label),
        category,
      ),
    )
    .filter((rows) => rows.some((row) => row.played > 0));

  // Two through from each group, as at RobotChallenge itself.
  const seeded = seedFromGroupStandings(
    standings.map((rows) =>
      rows.slice(0, 2).map((row) => ({ teamId: row.team.id, points: row.points })),
    ),
  );
  if (seeded.length < 2) return [];

  const plans = planElimination(seeded);
  const idByRoundSlot = new Map<string, string>();
  const rounds = Math.max(...plans.map((p) => p.round));
  const playedThrough = plan.playoffRoundsPlayed ?? 0;
  const out: MatchInsert[] = [];

  for (const step of plans) {
    const stamp = nextStamp();
    const id = randomUUID();
    idByRoundSlot.set(`${step.round}:${step.slot}`, id);

    const redFromMatchId = step.redFrom
      ? (idByRoundSlot.get(`${step.redFrom.round}:${step.redFrom.slot}`) ?? null)
      : null;
    const blueFromMatchId = step.blueFrom
      ? (idByRoundSlot.get(`${step.blueFrom.round}:${step.blueFrom.slot}`) ?? null)
      : null;

    // A slot fed by an earlier match only has a team once that match has been
    // decided — which is what `advance` below fills in, in order.
    const done = step.round <= playedThrough;
    const score = done ? scoreFor(category) : { red: 0, blue: 0, draw: false };

    out.push({
      id,
      categoryId: plan.categoryId,
      classId: plan.classId,
      stage: step.round === rounds ? "final" : "playoff",
      groupLabel: null,
      roundLabel: step.roundLabel,
      redTeamId: step.redTeamId,
      blueTeamId: step.blueTeamId,
      redFromMatchId,
      blueFromMatchId,
      redScore: score.red,
      blueScore: score.blue,
      state: done ? "completed" : "scheduled",
      isDraw: false,
      winnerTeamId: null,
      playedAt: done ? stamp : null,
      createdAt: stamp,
      updatedAt: stamp,
    });
  }

  advance(out);
  return out;
}

/**
 * Walk the decided rounds in order, name a winner, and push it into the slot
 * it feeds — the same propagation `saveMatchResult` performs when a judge
 * closes a sheet. Doing it here rather than assigning winners at random is
 * what keeps "winner of M3" in the next round pointing at the team that
 * actually won M3.
 */
function advance(matches: MatchInsert[]): void {
  for (const match of matches) {
    if (match.state !== "completed") continue;

    const red = match.redTeamId ?? null;
    const blue = match.blueTeamId ?? null;
    // A bye leaves one side empty; the other side simply advances.
    const winner =
      red && blue ? ((match.redScore ?? 0) > (match.blueScore ?? 0) ? red : blue) : (red ?? blue);
    if (!winner) continue;
    match.winnerTeamId = winner;

    for (const next of matches) {
      if (next.redFromMatchId === match.id) next.redTeamId = winner;
      if (next.blueFromMatchId === match.id) next.blueTeamId = winner;
    }
  }

  // Anything past the last decided round keeps its slots but not its score.
  for (const match of matches) {
    if (match.state === "completed") continue;
    match.redScore = 0;
    match.blueScore = 0;
    match.winnerTeamId = null;
  }
}

function buildRuns(plan: ClassPlan, category: Category, teams: TeamInsert[]): RunInsert[] {
  if (category.scoring.kind !== "run") return [];

  const { rounds, metric } = category.scoring;
  const attempts = Math.max(1, Math.round(rounds * plan.played));
  const out: RunInsert[] = [];

  for (const team of teams) {
    for (let round = 1; round <= attempts; round++) {
      const stamp = nextStamp();
      // One run in twelve does not finish — a board where nothing ever fails
      // hides exactly the row a referee most needs to be able to read.
      const failed = random() < 0.08;

      out.push({
        id: randomUUID(),
        categoryId: plan.categoryId,
        classId: plan.classId,
        teamId: team.id!,
        roundNumber: round,
        state: failed ? "dnf" : "ok",
        timeMs:
          metric === "time"
            ? failed
              ? (category.scoring.dnfMs ?? 180_001)
              : between(9_000, 48_000)
            : null,
        points:
          metric === "points"
            ? failed
              ? 0
              : between(
                  Math.round((category.scoring.maxPoints ?? 100) * 0.25),
                  category.scoring.maxPoints ?? 100,
                )
            : null,
        remainingMs: category.scoring.tracksRemaining && !failed ? between(5_000, 90_000) : null,
        breakdown: null,
        notes: null,
        createdAt: stamp,
        updatedAt: stamp,
      });
    }
  }

  return out;
}

/* ── Run it ────────────────────────────────────────────────────────────── */

async function main() {
  const flags = new Set(process.argv.slice(2));
  const clearOnly = flags.has("--clear");
  const withoutResults = flags.has("--empty");

  const db = getDb();

  // Order matters: runs and matches reference teams.
  const wiped = {
    runs: await db.delete(scoringRuns).returning({ id: scoringRuns.id }),
    matches: await db.delete(scoringMatches).returning({ id: scoringMatches.id }),
    teams: await db.delete(scoringTeams).returning({ id: scoringTeams.id }),
  };
  console.log(
    `wiped: ${wiped.teams.length} teams, ${wiped.matches.length} matches, ${wiped.runs.length} runs`,
  );

  if (clearOnly) {
    console.log("--clear: nothing seeded.");
    return;
  }

  let offset = 0;
  let teamCount = 0;
  let matchCount = 0;
  let runCount = 0;

  for (const plan of PLAN) {
    const category = getCategory(plan.categoryId);
    if (!category) throw new Error(`unknown category ${plan.categoryId}`);
    if (!category.classes.some((cls) => cls.id === plan.classId)) {
      throw new Error(`unknown class ${plan.categoryId}/${plan.classId}`);
    }

    const effective: ClassPlan = withoutResults
      ? { ...plan, played: 0, playoff: false }
      : plan;

    const teams = buildTeams(effective, category, offset);
    offset += teams.length;
    await db.insert(scoringTeams).values(teams);
    teamCount += teams.length;

    if (category.scoring.kind === "run") {
      const runs = buildRuns(effective, category, teams);
      if (runs.length > 0) await db.insert(scoringRuns).values(runs);
      runCount += runs.length;
      console.log(`  ${plan.categoryId}/${plan.classId}: ${teams.length} teams, ${runs.length} runs`);
      continue;
    }

    const groupMatches = buildGroupMatches(effective, category, teams);
    const bracket = effective.playoff
      ? buildBracket(effective, category, teams, groupMatches)
      : [];

    const all = [...groupMatches, ...bracket];
    if (all.length > 0) await db.insert(scoringMatches).values(all);
    matchCount += all.length;

    console.log(
      `  ${plan.categoryId}/${plan.classId}: ${teams.length} teams, ` +
        `${groupMatches.length} group matches, ${bracket.length} bracket matches`,
    );
  }

  console.log(`\nseeded: ${teamCount} teams, ${matchCount} matches, ${runCount} runs`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
