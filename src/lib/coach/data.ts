import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { applications, type ScoringTeamRow } from "@/lib/db/schema";
import { toApplications, type Application } from "@/lib/db/application";
import { decryptField } from "@/lib/crypto/field";
import { getCategory, getCategoryClass, type Category } from "@/config/categories";
import { getCategorySnapshot, listTeamsByApplicationIds } from "@/lib/scoring/store";
import { buildLeaderboard, buildStandings, positions } from "@/lib/scoring/standings";
import { findAccountById } from "./account";

/**
 * The read model behind the coaches' cabinet.
 *
 * Everything here is scoped by the signed-in account's e-mail hash. There is
 * no parameter anywhere in this file that a request could use to widen that
 * scope — no application id, no team id, no "for" argument. A coach cannot ask
 * for someone else's entry because there is nothing to ask with, which is a
 * stronger guarantee than checking ownership at each call site.
 *
 * Placements are computed with the same functions the public results page
 * uses, on the same per-class slices. A cabinet that ranked teams by its own
 * arithmetic would eventually disagree with the table on the wall, and the
 * coach would be right to trust neither.
 */

export type CoachTeamView = {
  team: ScoringTeamRow;
  categoryName: string;
  className: string;
  /** Dense rank among teams that have actually competed. Null before that. */
  position: number | null;
  /** How many teams the position is out of. */
  fieldSize: number;
  /** Matches played, or attempts filed. */
  events: number;
};

export type CoachEntryView = {
  application: Application;
  teams: CoachTeamView[];
};

export type CoachOverview = {
  /** The address this account signs in with, decrypted for display. */
  email: string;
  entries: CoachEntryView[];
  /** Entries whose encrypted fields could not be read. Surfaced, not hidden. */
  unreadable: number;
};

/** Category display names live in the Russian catalog, as in the console. */
type NameLookup = (key: string) => string;

export async function getCoachOverview(
  accountId: string,
  categoryName: NameLookup,
): Promise<CoachOverview | null> {
  const account = await findAccountById(accountId);
  if (!account) return null;

  const db = getDb();
  const rows = await db
    .select()
    .from(applications)
    .where(eq(applications.contactEmailHash, account.emailHash))
    .orderBy(applications.createdAt);

  // A single corrupt row must not blank the whole cabinet; the count is
  // reported so the coach sees that something is missing rather than
  // silently getting a short list.
  const { applications: decrypted, failed } = toApplications(rows);

  const teams = await listTeamsByApplicationIds(decrypted.map((a) => a.id));
  const views = await buildTeamViews(teams, categoryName);

  const byApplication = new Map<string, CoachTeamView[]>();
  for (const view of views) {
    const key = view.team.applicationId;
    if (!key) continue;
    const list = byApplication.get(key);
    if (list) list.push(view);
    else byApplication.set(key, [view]);
  }

  return {
    email: decryptField(account.email),
    entries: decrypted.map((application) => ({
      application,
      teams: byApplication.get(application.id) ?? [],
    })),
    unreadable: failed,
  };
}

/**
 * Turn the coach's start-list rows into placements.
 *
 * One snapshot per category, not per team: a coach with three teams in Sumo
 * should cost three lookups in a map, not three round trips to Postgres.
 */
async function buildTeamViews(
  teams: ScoringTeamRow[],
  categoryName: NameLookup,
): Promise<CoachTeamView[]> {
  const categoryIds = [...new Set(teams.map((team) => team.categoryId))];

  const snapshots = new Map(
    await Promise.all(
      categoryIds.map(
        async (id) => [id, await getCategorySnapshot(id)] as const,
      ),
    ),
  );

  const views: CoachTeamView[] = [];

  for (const team of teams) {
    const category = getCategory(team.categoryId);
    const snapshot = snapshots.get(team.categoryId);

    // A team filed against a category the catalogue no longer knows is still
    // the coach's team; show it plainly rather than dropping the row.
    if (!category || !snapshot) {
      views.push({
        team,
        categoryName: team.categoryId,
        className: team.classId,
        position: null,
        fieldSize: 0,
        events: 0,
      });
      continue;
    }

    const placement = placeTeam(team, category, snapshot);

    views.push({
      team,
      categoryName: categoryName(`items.${category.id}.name`),
      className: getCategoryClass(category.id, team.classId)?.label ?? team.classId,
      ...placement,
    });
  }

  return views;
}

function placeTeam(
  team: ScoringTeamRow,
  category: Category,
  snapshot: Awaited<ReturnType<typeof getCategorySnapshot>>,
): { position: number | null; fieldSize: number; events: number } {
  // The same per-class slice the public page builds its tables from.
  const classTeams = snapshot.teams.filter((t) => t.classId === team.classId);

  if (category.scoring.kind === "match") {
    const classMatches = snapshot.matches.filter((m) => m.classId === team.classId);
    const rows = buildStandings(classTeams, classMatches, category);
    // Only teams that have played are ranked — mirrors StandingsTable.
    const played = rows.filter((row) => row.played > 0);
    const ranks = positions(played.map((row) => row.points));
    const index = played.findIndex((row) => row.team.id === team.id);

    return {
      position: index === -1 ? null : ranks[index],
      fieldSize: played.length,
      events: index === -1 ? 0 : played[index].played,
    };
  }

  const classRuns = snapshot.runs.filter((r) => r.classId === team.classId);
  const rows = buildLeaderboard(classTeams, classRuns, category);
  const competed = rows.filter((row) => row.ranking !== null);
  const ranks = positions(competed.map((row) => row.ranking));
  const index = competed.findIndex((row) => row.team.id === team.id);

  return {
    position: index === -1 ? null : ranks[index],
    fieldSize: competed.length,
    events:
      index === -1
        ? 0
        : competed[index].attempts.filter((attempt) => attempt !== null).length,
  };
}
