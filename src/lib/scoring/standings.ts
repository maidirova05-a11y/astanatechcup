import type { Category } from "@/config/categories";
import type { ScoringMatchRow, ScoringRunRow, ScoringTeamRow } from "@/lib/db/schema";

/**
 * Turning filed sheets into a table.
 *
 * Pure functions over plain rows — no database, no React, no translation. That
 * is deliberate: the same computation renders the public results page, the
 * judge's own category screen and (eventually) the export, and three
 * implementations of a tiebreak is three chances to publish a different order
 * for the same results.
 *
 * The tiebreaks below come from the rulebooks, not from convention. Several of
 * them lead with the head-to-head result rather than goal difference, which is
 * the opposite of what football-shaped intuition expects.
 */

/* ── League tables (match categories) ───────────────────────────────────── */

export type StandingRow = {
  team: ScoringTeamRow;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scored: number;
  conceded: number;
  difference: number;
  points: number;
  yellow: number;
  red: number;
};

/**
 * A match counts towards the table only once a judge marks it completed.
 *
 * A live match has a running score, and a table that moves while a bout is in
 * progress tells spectators a team is out when it is still playing.
 */
function isCounted(match: ScoringMatchRow): boolean {
  return match.state === "completed";
}

/** Which side, if any, this team was on. */
function sideOf(match: ScoringMatchRow, teamId: string): "red" | "blue" | null {
  if (match.redTeamId === teamId) return "red";
  if (match.blueTeamId === teamId) return "blue";
  return null;
}

function blank(team: ScoringTeamRow): StandingRow {
  return {
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    scored: 0,
    conceded: 0,
    difference: 0,
    points: 0,
    yellow: 0,
    red: 0,
  };
}

function accumulate(
  rows: Map<string, StandingRow>,
  matches: ScoringMatchRow[],
  league: { win: number; draw: number; loss: number },
): void {
  for (const match of matches) {
    if (!isCounted(match)) continue;

    for (const teamId of [match.redTeamId, match.blueTeamId]) {
      const row = rows.get(teamId);
      if (!row) continue; // a team archived after playing; skip, don't crash

      const side = sideOf(match, teamId)!;
      const own = side === "red" ? match.redScore : match.blueScore;
      const other = side === "red" ? match.blueScore : match.redScore;

      row.played += 1;
      row.scored += own;
      row.conceded += other;
      row.difference = row.scored - row.conceded;
      row.yellow += side === "red" ? match.redYellow : match.blueYellow;
      row.red += side === "red" ? match.redRed : match.blueRed;

      if (match.isDraw) {
        row.drawn += 1;
        row.points += league.draw;
      } else if (match.winnerTeamId === teamId) {
        row.won += 1;
        row.points += league.win;
      } else if (match.winnerTeamId) {
        row.lost += 1;
        row.points += league.loss;
      } else {
        // Completed with no winner and not flagged a draw — the judge filed an
        // incomplete sheet. Count the appearance and the scores so the row is
        // not silently wrong, but award nothing.
        row.drawn += 0;
      }
    }
  }
}

/**
 * Head-to-head between exactly the teams that are level on points.
 *
 * "Если несколько команд имеют одинаковое количество очков… выше в турнирной
 * таблице занимает команда, одержавшая победу в личном поединке между этими
 * командами." Matches against anybody else are excluded, which is what makes
 * this a different ordering from overall difference.
 */
function headToHead(
  tied: StandingRow[],
  matches: ScoringMatchRow[],
  league: { win: number; draw: number; loss: number },
): Map<string, { points: number; difference: number }> {
  const ids = new Set(tied.map((row) => row.team.id));
  const mini = new Map<string, { points: number; difference: number }>();
  for (const id of ids) mini.set(id, { points: 0, difference: 0 });

  for (const match of matches) {
    if (!isCounted(match)) continue;
    if (!ids.has(match.redTeamId) || !ids.has(match.blueTeamId)) continue;

    const red = mini.get(match.redTeamId)!;
    const blue = mini.get(match.blueTeamId)!;

    red.difference += match.redScore - match.blueScore;
    blue.difference += match.blueScore - match.redScore;

    if (match.isDraw) {
      red.points += league.draw;
      blue.points += league.draw;
    } else if (match.winnerTeamId === match.redTeamId) {
      red.points += league.win;
      blue.points += league.loss;
    } else if (match.winnerTeamId === match.blueTeamId) {
      blue.points += league.win;
      red.points += league.loss;
    }
  }

  return mini;
}

export function buildStandings(
  teams: ScoringTeamRow[],
  matches: ScoringMatchRow[],
  category: Category,
): StandingRow[] {
  if (category.scoring.kind !== "match") return [];
  const league = category.scoring.league;

  const rows = new Map<string, StandingRow>();
  for (const team of teams) rows.set(team.id, blank(team));

  accumulate(rows, matches, league);

  const all = [...rows.values()];

  // First pass: points, then the rulebook's tiebreaks. Head-to-head is applied
  // inside each group of teams that are level, which is why it cannot simply be
  // another comparator term.
  all.sort((a, b) => b.points - a.points);

  const ordered: StandingRow[] = [];
  let i = 0;
  while (i < all.length) {
    let j = i;
    while (j + 1 < all.length && all[j + 1].points === all[i].points) j += 1;

    const group = all.slice(i, j + 1);
    if (group.length > 1) {
      const mini = headToHead(group, matches, league);
      group.sort((a, b) => {
        const ma = mini.get(a.team.id)!;
        const mb = mini.get(b.team.id)!;
        return (
          mb.points - ma.points ||
          mb.difference - ma.difference ||
          b.difference - a.difference ||
          b.scored - a.scored ||
          // Fewer cards ranks higher — Rugby says so explicitly, and it is a
          // harmless tiebreak everywhere else.
          a.red + a.yellow - (b.red + b.yellow) ||
          a.team.code.localeCompare(b.team.code, undefined, { numeric: true })
        );
      });
    }

    ordered.push(...group);
    i = j + 1;
  }

  return ordered;
}

/* ── Leaderboards (run categories) ──────────────────────────────────────── */

export type LeaderboardRow = {
  team: ScoringTeamRow;
  /** Attempts in round order; a gap is an attempt not yet filed. */
  attempts: (ScoringRunRow | null)[];
  /** The single figure this category ranks on. Null until an attempt exists. */
  ranking: number | null;
  /** The best single attempt, for display and as a tiebreak. */
  best: number | null;
  /** Most time left on the clock across the attempts, in ms. */
  remainingMs: number | null;
  /** True when every attempt filed so far failed. */
  allFailed: boolean;
};

/**
 * What one attempt is worth for ranking.
 *
 * A failed attempt is not a missing attempt. Line Follower writes the
 * rulebook's own 03:00.001 so the row still sorts — behind every finisher and
 * ahead of nothing — and the points categories write zero for the same reason.
 */
function attemptValue(run: ScoringRunRow, category: Category): number | null {
  if (category.scoring.kind !== "run") return null;

  const failed = run.state !== "ok";

  if (category.scoring.metric === "time") {
    const dnf = category.scoring.dnfMs ?? Number.MAX_SAFE_INTEGER;
    if (failed) return dnf;
    return run.timeMs ?? dnf;
  }

  if (failed) return 0;
  return run.points ?? 0;
}

export function buildLeaderboard(
  teams: ScoringTeamRow[],
  runs: ScoringRunRow[],
  category: Category,
): LeaderboardRow[] {
  if (category.scoring.kind !== "run") return [];
  const { rounds, aggregate, metric } = category.scoring;
  const lowerIsBetter = metric === "time";

  const byTeam = new Map<string, ScoringRunRow[]>();
  for (const run of runs) {
    const list = byTeam.get(run.teamId);
    if (list) list.push(run);
    else byTeam.set(run.teamId, [run]);
  }

  const rowsOut: LeaderboardRow[] = teams.map((team) => {
    const teamRuns = byTeam.get(team.id) ?? [];

    const attempts: (ScoringRunRow | null)[] = Array.from({ length: rounds }, (_, i) => {
      return teamRuns.find((run) => run.roundNumber === i + 1) ?? null;
    });

    const values = teamRuns
      .map((run) => attemptValue(run, category))
      .filter((value): value is number => value !== null);

    const best =
      values.length === 0
        ? null
        : lowerIsBetter
          ? Math.min(...values)
          : Math.max(...values);

    /**
     * Bowling ranks on the AVERAGE of its two rounds, not the better one — it
     * is the only category of the seven that does. Averaging over the attempts
     * FILED rather than over the full round count is the honest reading while
     * a competition is still running: a team one round in should be shown the
     * standing it currently has, not one halved by a round nobody has played.
     */
    const ranking =
      values.length === 0
        ? null
        : aggregate === "average"
          ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
          : best;

    const remainingValues = teamRuns
      .map((run) => run.remainingMs)
      .filter((value): value is number => value !== null);

    return {
      team,
      attempts,
      ranking,
      best,
      remainingMs: remainingValues.length ? Math.max(...remainingValues) : null,
      allFailed: teamRuns.length > 0 && teamRuns.every((run) => run.state !== "ok"),
    };
  });

  rowsOut.sort((a, b) => {
    // A team with no attempt yet always sits below one that has competed.
    if (a.ranking === null && b.ranking === null) {
      return a.team.code.localeCompare(b.team.code, undefined, { numeric: true });
    }
    if (a.ranking === null) return 1;
    if (b.ranking === null) return -1;

    const primary = lowerIsBetter ? a.ranking - b.ranking : b.ranking - a.ranking;
    if (primary !== 0) return primary;

    // Bowling: equal averages go to the better single round, then to the time
    // left on the clock in that round. Leap: equal bests go to remaining time.
    if (a.best !== null && b.best !== null && a.best !== b.best) {
      return lowerIsBetter ? a.best - b.best : b.best - a.best;
    }

    const remainingA = a.remainingMs ?? -1;
    const remainingB = b.remainingMs ?? -1;
    if (remainingA !== remainingB) return remainingB - remainingA;

    return a.team.code.localeCompare(b.team.code, undefined, { numeric: true });
  });

  return rowsOut;
}

/* ── Shared ─────────────────────────────────────────────────────────────── */

/**
 * Dense ranking: teams with an identical ranking figure share a position.
 *
 * Printing 1, 2, 3 down a column where rows two and three are level is a claim
 * the results do not support, and it is the kind of claim a team notices.
 */
export function positions(values: (number | null)[]): (number | null)[] {
  const out: (number | null)[] = [];
  let position = 0;
  let previous: number | null | undefined;

  values.forEach((value, index) => {
    if (value === null) {
      out.push(null);
      return;
    }
    if (value !== previous) position = index + 1;
    previous = value;
    out.push(position);
  });

  return out;
}
