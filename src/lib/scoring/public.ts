import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import type { ScoringMatchRow, ScoringRunRow, ScoringTeamRow } from "@/lib/db/schema";
import { getCategorySnapshot, type CategorySnapshot } from "./store";

/**
 * The public scoreboard's read path: one category snapshot, cached across
 * requests.
 *
 * ── Why the DATA is cached and not the page ──────────────────────────────
 * The results pages must render per request — the CSP nonce, see the note on
 * app/[locale]/results/page.tsx. Uncached, that made every view of /results
 * cost 7 categories × 4 queries, and every view of a board 4, against a pool
 * of five connections per instance: the hall refreshing at the end of a final
 * was a load test against Postgres. The page notes already said what to do
 * about it — "cache the QUERY, not the HTML" — and this is that.
 *
 * ── Freshness ────────────────────────────────────────────────────────────
 *   · Every judge-console and admin write that changes the board marks the
 *     `results` tag stale (`markResultsChanged` / `publishResults` in the
 *     actions). The next view refetches; on Vercel the tag is shared by every
 *     instance through the Data Cache.
 *   · RESULTS_REVALIDATE_SECONDS is the backstop for writes that do not go
 *     through an action — `npm run seed:demo`, a hand-run SQL fix. 30 s is the
 *     longest a board may lag such a write; it is also what the old
 *     `revalidate = 30` on the page promised.
 *
 * The snapshot crosses the cache as JSON, so the Dates and the Map are
 * rebuilt on the way out — callers get exactly what `getCategorySnapshot`
 * returns.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const RESULTS_TAG = "results";
export const RESULTS_REVALIDATE_SECONDS = 30;

type Wire<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };

type WireSnapshot = {
  teams: Wire<ScoringTeamRow>[];
  matches: Wire<ScoringMatchRow>[];
  runs: Wire<ScoringRunRow>[];
  archived: Wire<ScoringTeamRow>[];
  updatedAt: string | null;
};

const date = (value: string): Date => new Date(value);
const maybeDate = (value: string | null): Date | null => (value === null ? null : new Date(value));

function reviveTeam(row: Wire<ScoringTeamRow>): ScoringTeamRow {
  return {
    ...row,
    archivedAt: maybeDate(row.archivedAt),
    createdAt: date(row.createdAt),
    updatedAt: date(row.updatedAt),
  };
}

function reviveMatch(row: Wire<ScoringMatchRow>): ScoringMatchRow {
  return {
    ...row,
    playedAt: maybeDate(row.playedAt),
    createdAt: date(row.createdAt),
    updatedAt: date(row.updatedAt),
  };
}

function reviveRun(row: Wire<ScoringRunRow>): ScoringRunRow {
  return { ...row, createdAt: date(row.createdAt), updatedAt: date(row.updatedAt) };
}

const loadWireSnapshot = unstable_cache(
  async (categoryId: string): Promise<WireSnapshot> => {
    const snapshot = await getCategorySnapshot(categoryId);
    // JSON.stringify turns Dates into ISO strings; the Map needs converting.
    return JSON.parse(
      JSON.stringify({ ...snapshot, archived: [...snapshot.archived.values()] }),
    ) as WireSnapshot;
  },
  // Bump the version when the snapshot's shape changes, so a deploy never
  // revives an entry written by the previous one.
  ["public-category-snapshot", "v1"],
  { tags: [RESULTS_TAG], revalidate: RESULTS_REVALIDATE_SECONDS },
);

/** `getCategorySnapshot`, served from the cache described above. */
export async function getPublicCategorySnapshot(categoryId: string): Promise<CategorySnapshot> {
  const wire = await loadWireSnapshot(categoryId);
  return {
    teams: wire.teams.map(reviveTeam),
    matches: wire.matches.map(reviveMatch),
    runs: wire.runs.map(reviveRun),
    archived: new Map(wire.archived.map((row) => [row.id, reviveTeam(row)])),
    updatedAt: maybeDate(wire.updatedAt),
  };
}

/**
 * Mark the public scoreboard stale after a write, without re-rendering the
 * page the action was called from.
 *
 * Stale-while-revalidate (`"max"`): the next board view starts the refetch and
 * every view after it is current. That is what the console's row saves use —
 * they return a state rather than re-rendering the console, and an
 * `{ expire: 0 }` here would make every save re-render it in the action
 * response. Actions that redirect or revalidate a path anyway use
 * `expireResults` instead.
 */
export function markResultsChanged(): void {
  revalidateTag(RESULTS_TAG, "max");
}

/** Expire the cached scoreboard now: the next view blocks on fresh data. */
export function expireResults(): void {
  revalidateTag(RESULTS_TAG, { expire: 0 });
}
