import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  scoringAudit,
  scoringMatches,
  scoringRuns,
  scoringTeams,
  type MatchState,
  type RunState,
  type ScoringMatchRow,
  type ScoringRunRow,
  type ScoringStage,
  type ScoringTeamRow,
  type SessionRole,
} from "@/lib/db/schema";
import { logger } from "@/lib/log";

/**
 * Data access for the scoring system.
 *
 * Two rules hold throughout this file:
 *
 *  1. EVERY WRITE IS AUDITED, with the session that made it and the value it
 *     replaced. A championship placing is contestable, and "the system says so"
 *     is not an answer a team has to accept. `before`/`after` snapshots are what
 *     turn a protest into a five-minute lookup.
 *
 *  2. NOTHING HERE READS `applications`. The scoring tables carry team names and
 *     start numbers; the application table carries children's names, ages and
 *     contact details. Keeping the judge's console on this side of that line is
 *     the point of having two tables.
 */

export type ScoringContext = {
  sessionId: string;
  role: SessionRole;
  ip: string;
};

/* ── Audit ──────────────────────────────────────────────────────────────── */

type AuditEntity = "team" | "match" | "run";
type AuditAction = "created" | "updated" | "archived" | "deleted";

async function audit(
  entity: AuditEntity,
  entityId: string,
  action: AuditAction,
  before: unknown,
  after: unknown,
  context: ScoringContext,
): Promise<void> {
  const db = getDb();
  await db.insert(scoringAudit).values({
    entity,
    entityId,
    action,
    before: before === null || before === undefined ? null : JSON.stringify(before),
    after: after === null || after === undefined ? null : JSON.stringify(after),
    sessionId: context.sessionId,
    role: context.role,
    ip: context.ip.slice(0, 64),
  });

  logger.info("scoring.write", {
    entity,
    entityId,
    action,
    role: context.role,
    sessionId: context.sessionId,
  });
}

/* ── Teams ──────────────────────────────────────────────────────────────── */

export type TeamInput = {
  categoryId: string;
  classId: string;
  code: string;
  name: string;
  organization: string | null;
  region: string | null;
  groupLabel: string | null;
  /**
   * The paid entry this team was seeded from, when the organisers added it
   * through the admin panel. Optional because the judges' console creates
   * teams that turn up on the day with no entry behind them, and a start-list
   * row must never be blocked because paperwork is late.
   *
   * This is the only writer of `scoring_teams.application_id`, and it is what
   * lets the coaches' cabinet answer "which of the start list is mine".
   */
  applicationId?: string | null;
};

/** Active teams in a category, ordered the way a start list is read. */
export async function listTeams(
  categoryId: string,
  classId?: string,
): Promise<ScoringTeamRow[]> {
  const db = getDb();
  const filters = [eq(scoringTeams.categoryId, categoryId), isNull(scoringTeams.archivedAt)];
  if (classId) filters.push(eq(scoringTeams.classId, classId));

  return db
    .select()
    .from(scoringTeams)
    .where(and(...filters))
    .orderBy(asc(scoringTeams.classId), asc(scoringTeams.code));
}

/**
 * Every team a set of matches or runs refers to, archived ones included.
 *
 * A standings table must be able to name a team that withdrew after playing;
 * looking those up separately is what keeps `listTeams` free to hide them from
 * the start list.
 */
export async function loadTeamsById(ids: string[]): Promise<Map<string, ScoringTeamRow>> {
  if (ids.length === 0) return new Map();
  const db = getDb();
  const rows = await db.select().from(scoringTeams).where(inArray(scoringTeams.id, ids));
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Teams seeded from a given set of paid entries.
 *
 * Used by the coaches' cabinet to answer "which of the start list is mine".
 * Archived teams are included: a coach whose team withdrew after playing still
 * has results, and hiding the team would leave those results unexplained.
 */
export async function listTeamsByApplicationIds(
  applicationIds: string[],
): Promise<ScoringTeamRow[]> {
  if (applicationIds.length === 0) return [];
  const db = getDb();
  return db
    .select()
    .from(scoringTeams)
    .where(inArray(scoringTeams.applicationId, applicationIds))
    .orderBy(asc(scoringTeams.categoryId), asc(scoringTeams.classId), asc(scoringTeams.code));
}

export async function getTeam(id: string): Promise<ScoringTeamRow | null> {
  const db = getDb();
  const rows = await db.select().from(scoringTeams).where(eq(scoringTeams.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * The next free start number in a class.
 *
 * Numbers are free text — a venue may use "A1" or "12b" — so this only counts
 * the purely numeric ones and offers the next integer. It is a SUGGESTION for
 * the form, never a reservation: two organisers seeding at the same moment can
 * still collide, and the unique index on (category, class, code) is what
 * actually decides. Zero-padded to two digits so a start list sorts readably
 * as text.
 */
export async function suggestTeamCode(
  categoryId: string,
  classId: string,
): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({ code: scoringTeams.code })
    .from(scoringTeams)
    .where(and(eq(scoringTeams.categoryId, categoryId), eq(scoringTeams.classId, classId)));

  let highest = 0;
  for (const row of rows) {
    const numeric = /^\d+$/.test(row.code.trim()) ? Number(row.code.trim()) : null;
    if (numeric !== null && numeric > highest) highest = numeric;
  }

  return String(highest + 1).padStart(2, "0");
}

export async function createTeam(
  input: TeamInput,
  context: ScoringContext,
): Promise<ScoringTeamRow> {
  const db = getDb();
  const [row] = await db.insert(scoringTeams).values(input).returning();
  await audit("team", row.id, "created", null, input, context);
  return row;
}

export async function updateTeam(
  id: string,
  patch: Partial<TeamInput>,
  context: ScoringContext,
): Promise<ScoringTeamRow | null> {
  const db = getDb();
  const before = await getTeam(id);
  if (!before) return null;

  const [row] = await db
    .update(scoringTeams)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(scoringTeams.id, id))
    .returning();

  await audit("team", id, "updated", before, patch, context);
  return row;
}

/** Withdrawal. The row stays so played matches keep a team to name. */
export async function archiveTeam(
  id: string,
  context: ScoringContext,
): Promise<void> {
  const db = getDb();
  const before = await getTeam(id);
  if (!before || before.archivedAt) return;

  await db
    .update(scoringTeams)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(scoringTeams.id, id));

  await audit("team", id, "archived", { archivedAt: null }, { archivedAt: new Date() }, context);
}

/* ── Matches ────────────────────────────────────────────────────────────── */

export type MatchInput = {
  categoryId: string;
  classId: string;
  stage: ScoringStage;
  groupLabel: string | null;
  roundLabel: string | null;
  redTeamId: string;
  blueTeamId: string;
};

export type MatchResult = {
  redScore: number;
  blueScore: number;
  redYellow: number;
  redRed: number;
  blueYellow: number;
  blueRed: number;
  state: MatchState;
  winnerTeamId: string | null;
  isDraw: boolean;
  notes: string | null;
};

export async function listMatches(
  categoryId: string,
  classId?: string,
): Promise<ScoringMatchRow[]> {
  const db = getDb();
  const filters = [eq(scoringMatches.categoryId, categoryId)];
  if (classId) filters.push(eq(scoringMatches.classId, classId));

  return db
    .select()
    .from(scoringMatches)
    .where(and(...filters))
    // Scheduled first, then most recently played — which is the order the
    // judge's screen wants: what is next, then what just happened.
    .orderBy(asc(scoringMatches.state), desc(scoringMatches.playedAt), desc(scoringMatches.createdAt));
}

export async function getMatch(id: string): Promise<ScoringMatchRow | null> {
  const db = getDb();
  const rows = await db.select().from(scoringMatches).where(eq(scoringMatches.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createMatch(
  input: MatchInput,
  context: ScoringContext,
): Promise<ScoringMatchRow> {
  const db = getDb();
  const [row] = await db.insert(scoringMatches).values(input).returning();
  await audit("match", row.id, "created", null, input, context);
  return row;
}

export async function saveMatchResult(
  id: string,
  result: MatchResult,
  context: ScoringContext,
): Promise<ScoringMatchRow | null> {
  const db = getDb();
  const before = await getMatch(id);
  if (!before) return null;

  const [row] = await db
    .update(scoringMatches)
    .set({
      ...result,
      // Stamped the first time a sheet is completed, and kept afterwards so a
      // later correction does not reorder the "latest results" list.
      playedAt: result.state === "completed" ? (before.playedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(scoringMatches.id, id))
    .returning();

  await audit(
    "match",
    id,
    "updated",
    {
      redScore: before.redScore,
      blueScore: before.blueScore,
      state: before.state,
      winnerTeamId: before.winnerTeamId,
      isDraw: before.isDraw,
    },
    result,
    context,
  );

  return row;
}

/**
 * Deleting a match is allowed only while it is still scheduled.
 *
 * Once a sheet has been filed it is part of the record, and a table that can
 * lose a played match silently is a table nobody can audit. A mistake in a
 * completed match is corrected by editing it, which leaves both values in the
 * audit trail.
 */
export async function deleteScheduledMatch(
  id: string,
  context: ScoringContext,
): Promise<boolean> {
  const db = getDb();
  const before = await getMatch(id);
  if (!before || before.state !== "scheduled") return false;

  await db.delete(scoringMatches).where(eq(scoringMatches.id, id));
  await audit("match", id, "deleted", before, null, context);
  return true;
}

/* ── Runs ───────────────────────────────────────────────────────────────── */

export type RunInput = {
  categoryId: string;
  classId: string;
  teamId: string;
  roundNumber: number;
  state: RunState;
  timeMs: number | null;
  points: number | null;
  remainingMs: number | null;
  breakdown: string | null;
  notes: string | null;
};

export async function listRuns(
  categoryId: string,
  classId?: string,
): Promise<ScoringRunRow[]> {
  const db = getDb();
  const filters = [eq(scoringRuns.categoryId, categoryId)];
  if (classId) filters.push(eq(scoringRuns.classId, classId));

  return db
    .select()
    .from(scoringRuns)
    .where(and(...filters))
    .orderBy(desc(scoringRuns.updatedAt));
}

export async function getRun(
  teamId: string,
  roundNumber: number,
): Promise<ScoringRunRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(scoringRuns)
    .where(and(eq(scoringRuns.teamId, teamId), eq(scoringRuns.roundNumber, roundNumber)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * File an attempt, or correct one already filed.
 *
 * The upsert targets the `(team, round)` unique index rather than checking
 * first and then writing: two judges at two lanes filing the same team's round
 * 2 within the same second would otherwise produce two rows, and the table
 * would show an attempt that never happened.
 */
export async function saveRun(
  input: RunInput,
  context: ScoringContext,
): Promise<ScoringRunRow> {
  const db = getDb();
  const before = await getRun(input.teamId, input.roundNumber);

  const [row] = await db
    .insert(scoringRuns)
    .values(input)
    .onConflictDoUpdate({
      target: [scoringRuns.teamId, scoringRuns.roundNumber],
      set: {
        state: input.state,
        timeMs: input.timeMs,
        points: input.points,
        remainingMs: input.remainingMs,
        breakdown: input.breakdown,
        notes: input.notes,
        updatedAt: new Date(),
      },
    })
    .returning();

  await audit(
    "run",
    row.id,
    before ? "updated" : "created",
    before
      ? {
          state: before.state,
          timeMs: before.timeMs,
          points: before.points,
          remainingMs: before.remainingMs,
        }
      : null,
    {
      state: input.state,
      timeMs: input.timeMs,
      points: input.points,
      remainingMs: input.remainingMs,
    },
    context,
  );

  return row;
}

/* ── Snapshots ──────────────────────────────────────────────────────────── */

export type CategorySnapshot = {
  teams: ScoringTeamRow[];
  matches: ScoringMatchRow[];
  runs: ScoringRunRow[];
  /** Teams referenced by a match or run but no longer in the start list. */
  archived: Map<string, ScoringTeamRow>;
  updatedAt: Date | null;
};

/** Everything one category needs, in one round trip per table. */
export async function getCategorySnapshot(categoryId: string): Promise<CategorySnapshot> {
  const [teams, matches, runs] = await Promise.all([
    listTeams(categoryId),
    listMatches(categoryId),
    listRuns(categoryId),
  ]);

  const known = new Set(teams.map((team) => team.id));
  const missing = new Set<string>();
  for (const match of matches) {
    if (!known.has(match.redTeamId)) missing.add(match.redTeamId);
    if (!known.has(match.blueTeamId)) missing.add(match.blueTeamId);
  }
  for (const run of runs) {
    if (!known.has(run.teamId)) missing.add(run.teamId);
  }

  const archived = await loadTeamsById([...missing]);

  const stamps = [
    ...matches.map((m) => m.updatedAt),
    ...runs.map((r) => r.updatedAt),
  ];
  const updatedAt = stamps.length
    ? new Date(Math.max(...stamps.map((d) => d.getTime())))
    : null;

  return { teams, matches, runs, archived, updatedAt };
}

export type CategoryActivity = {
  categoryId: string;
  teams: number;
  completedMatches: number;
  runs: number;
};

/**
 * Counts per category, for the console's landing screen and for deciding which
 * categories the public results page has anything to say about.
 */
export async function getScoringActivity(): Promise<Map<string, CategoryActivity>> {
  const db = getDb();

  const [teamCounts, matchCounts, runCounts] = await Promise.all([
    db
      .select({
        categoryId: scoringTeams.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(scoringTeams)
      .where(isNull(scoringTeams.archivedAt))
      .groupBy(scoringTeams.categoryId),
    db
      .select({
        categoryId: scoringMatches.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(scoringMatches)
      .where(eq(scoringMatches.state, "completed"))
      .groupBy(scoringMatches.categoryId),
    db
      .select({
        categoryId: scoringRuns.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(scoringRuns)
      .groupBy(scoringRuns.categoryId),
  ]);

  const out = new Map<string, CategoryActivity>();
  const ensure = (categoryId: string) => {
    let entry = out.get(categoryId);
    if (!entry) {
      entry = { categoryId, teams: 0, completedMatches: 0, runs: 0 };
      out.set(categoryId, entry);
    }
    return entry;
  };

  for (const row of teamCounts) ensure(row.categoryId).teams = row.count;
  for (const row of matchCounts) ensure(row.categoryId).completedMatches = row.count;
  for (const row of runCounts) ensure(row.categoryId).runs = row.count;

  return out;
}
