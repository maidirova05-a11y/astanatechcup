import type { Category } from "@/config/categories";
import type { ScoringMatchRow, ScoringTeamRow } from "@/lib/db/schema";
import { buildStandings } from "./standings";

/**
 * The results board, expressed as TABLES.
 *
 * Everything here is derivation, not storage: the same match rows the judges
 * file, arranged the way the international RobotChallenge board arranges them
 * — a group as a cross-table, a bracket as a numbered list of pairings — so a
 * team that has read one board can read this one.
 *
 * Two ideas carry the whole file:
 *
 *  · A BLOCK is a set of matches numbered together. One group is a block
 *    ("M1…M21" inside Group A); the whole elimination bracket of a class is
 *    another ("M1…M8"). Numbers are per block, so a referee can say "M7" and
 *    everyone in that group knows which sheet is meant.
 *
 *  · A SOURCE says where a slot's team CAME from, and it is what makes a
 *    bracket printable before it is played: "winner of M3", "2nd in Group B".
 *    It reads straight off `redFromMatchId`/`blueFromMatchId` — the same
 *    wiring the database uses to advance a winner — so the label can never
 *    disagree with where the team actually goes.
 *
 * Match numbers are derived from insertion order rather than stored in a
 * column. The generators insert round by round, slot by slot (see
 * planElimination and roundRobinPairings), `createdAt` never changes, and a
 * derived number cannot drift out of sync with the row it names. The cost is
 * that a match added by hand later takes the next free number instead of
 * slotting into the middle — which is also what a paper schedule does.
 */

/* ── Blocks and numbering ──────────────────────────────────────────────── */

/**
 * Which numbering block a match belongs to. Playoff and final share one — a
 * final is the last match of the bracket, not a separate competition.
 */
export function blockOf(match: ScoringMatchRow): string {
  return match.stage === "group" ? `group:${match.groupLabel ?? ""}` : "bracket";
}

/**
 * Stable order inside a block: as generated, with the id as a tiebreak.
 *
 * Exported because anything that prints match numbers has to list the matches
 * in the same order those numbers were assigned in — a console showing M1
 * under M3 is a console that gets a result filed against the wrong pairing.
 */
export function compareByCreation(a: ScoringMatchRow, b: ScoringMatchRow): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
}

/** `matchId` → `M3`. Numbered per block, in the order the block was built. */
export function numberMatches(matches: readonly ScoringMatchRow[]): Map<string, string> {
  const blocks = new Map<string, ScoringMatchRow[]>();
  for (const match of matches) {
    const key = blockOf(match);
    const list = blocks.get(key);
    if (list) list.push(match);
    else blocks.set(key, [match]);
  }

  const numbers = new Map<string, string>();
  for (const list of blocks.values()) {
    [...list].sort(compareByCreation).forEach((match, i) => numbers.set(match.id, `M${i + 1}`));
  }
  return numbers;
}

/* ── Where a slot's team comes from ────────────────────────────────────── */

export type SlotSource =
  /** Filled by the winner of an earlier match — `redFromMatchId` in the row. */
  | { kind: "winner"; match: string }
  /** Seeded out of the group stage: 1st in Group A, 2nd in Group B. */
  | { kind: "group"; group: string | null; place: number }
  | null;

/**
 * Where each team finished its group — the input for a "1st in Group A"
 * label on a bracket slot.
 *
 * Only a group that has actually finished produces a placement. A team
 * sitting second with two matches left has not earned the label, and a
 * bracket that prints one anyway states a result that has not happened.
 */
export function groupPlacements(
  teams: readonly ScoringTeamRow[],
  matches: readonly ScoringMatchRow[],
  category: Category,
): Map<string, { group: string | null; place: number }> {
  const placements = new Map<string, { group: string | null; place: number }>();
  if (category.scoring.kind !== "match") return placements;

  const groupMatches = matches.filter((m) => m.stage === "group");

  for (const label of new Set(teams.map((team) => team.groupLabel))) {
    const inGroup = teams.filter((team) => team.groupLabel === label);
    const played = groupMatches.filter((m) => m.groupLabel === label);
    if (!groupIsDecided(inGroup, played)) continue;

    buildStandings(inGroup, played, category).forEach((row, i) => {
      placements.set(row.team.id, { group: label, place: i + 1 });
    });
  }

  return placements;
}

/**
 * Has this group actually finished?
 *
 * Not "is every match that exists closed" — that is true of a group with one
 * sheet filed and five pairings never scheduled, and it would let the board
 * announce qualifiers on the strength of a single result. A round robin is
 * over when every pair in it has met and every one of those sheets is closed,
 * so that is what this counts.
 *
 * Distinct PAIRS rather than a match count, because a replayed pairing is two
 * rows for one fixture and must not read as progress.
 */
function groupIsDecided(
  teams: readonly ScoringTeamRow[],
  matches: readonly ScoringMatchRow[],
): boolean {
  if (teams.length < 2 || matches.length === 0) return false;
  if (matches.some((match) => match.state !== "completed")) return false;

  const ids = new Set(teams.map((team) => team.id));
  const met = new Set<string>();
  for (const match of matches) {
    if (!match.redTeamId || !match.blueTeamId) continue;
    if (!ids.has(match.redTeamId) || !ids.has(match.blueTeamId)) continue;
    met.add(pairKey(match.redTeamId, match.blueTeamId));
  }

  return met.size >= (teams.length * (teams.length - 1)) / 2;
}

/* ── The bracket, as a table ───────────────────────────────────────────── */

export type BracketSide = {
  teamId: string | null;
  source: SlotSource;
  score: number;
  /** Set once the sheet is closed; a scheduled match has no winner yet. */
  won: boolean;
};

export type BracketRow = {
  id: string;
  /** `M5`. */
  number: string;
  roundLabel: string | null;
  red: BracketSide;
  blue: BracketSide;
  state: ScoringMatchRow["state"];
  isDraw: boolean;
};

/**
 * One row per pairing — the bracket in the form that is easiest to read on a
 * phone and easiest to correct at a desk, which is why the board this mirrors
 * offers it beside the drawn tree rather than instead of it.
 */
export function buildBracketTable(
  matches: readonly ScoringMatchRow[],
  placements: Map<string, { group: string | null; place: number }>,
  numbers: Map<string, string>,
): BracketRow[] {
  const bracket = matches
    .filter((m) => m.stage === "playoff" || m.stage === "final")
    .sort(compareByCreation);

  const side = (match: ScoringMatchRow, which: "red" | "blue"): BracketSide => {
    const teamId = which === "red" ? match.redTeamId : match.blueTeamId;
    const fromId = which === "red" ? match.redFromMatchId : match.blueFromMatchId;

    let source: SlotSource = null;
    if (fromId) {
      const number = numbers.get(fromId);
      if (number) source = { kind: "winner", match: number };
    } else if (teamId) {
      const placement = placements.get(teamId);
      if (placement) source = { kind: "group", ...placement };
    }

    return {
      teamId,
      source,
      score: which === "red" ? match.redScore : match.blueScore,
      won:
        match.state === "completed" &&
        match.winnerTeamId !== null &&
        match.winnerTeamId === teamId,
    };
  };

  return bracket.map((match) => ({
    id: match.id,
    number: numbers.get(match.id) ?? "—",
    roundLabel: match.roundLabel,
    red: side(match, "red"),
    blue: side(match, "blue"),
    state: match.state,
    isDraw: match.isDraw,
  }));
}

/* ── A group, as a cross-table ─────────────────────────────────────────── */

export type CrossCell =
  /** The diagonal: a team does not play itself. */
  | { kind: "self" }
  /** These two never met — an unfinished draw, or a group edited by hand. */
  | { kind: "none" }
  | {
      kind: "match";
      matchId: string;
      number: string;
      /** From the ROW team's point of view. */
      scored: number;
      conceded: number;
      outcome: "win" | "draw" | "loss" | "pending";
    };

export type CrossRow = {
  team: ScoringTeamRow;
  /** One cell per team in the table, in the same order as `teams`. */
  cells: CrossCell[];
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  /** Standing inside the group; teams level on points share a rank. */
  rank: number;
};

export type CrossTable = {
  label: string | null;
  teams: ScoringTeamRow[];
  rows: CrossRow[];
  /** Every pairing has been filed — the group is decided, not in progress. */
  complete: boolean;
  /** Top finishers, once `complete`. Empty while the group is still running. */
  qualified: ScoringTeamRow[];
};

/**
 * How many teams go through from a group. Two, as at RobotChallenge itself.
 *
 * A named constant rather than an inlined 2 because it is a tournament
 * decision, not a fact about the software — if the committee takes one or
 * three from each group, this is the line that changes.
 */
export const QUALIFY_PER_GROUP = 2;

/**
 * The classic round-robin ladder: teams down the side and across the top,
 * each pairing written once in the lower triangle with its match number and
 * score, W/D/L and points down the right.
 *
 * Reading order is the start list, not the standings, so the table keeps its
 * shape all day while the right-hand columns move — a spectator looking for
 * one team finds it in the same row after every match.
 */
export function buildCrossTable(
  teams: readonly ScoringTeamRow[],
  matches: readonly ScoringMatchRow[],
  category: Category,
  numbers: Map<string, string>,
  label: string | null,
): CrossTable {
  const ordered = [...teams].sort((a, b) =>
    a.code.localeCompare(b.code, "en", { numeric: true }),
  );
  const index = new Map(ordered.map((team, i) => [team.id, i]));

  // Pairing → match. A pairing played twice keeps the LATEST sheet, which is
  // what a replayed match means; the earlier one stays in the audit trail.
  const pairs = new Map<string, ScoringMatchRow>();
  for (const match of [...matches].sort(compareByCreation)) {
    if (!match.redTeamId || !match.blueTeamId) continue;
    if (!index.has(match.redTeamId) || !index.has(match.blueTeamId)) continue;
    pairs.set(pairKey(match.redTeamId, match.blueTeamId), match);
  }

  const standings = buildStandings(ordered, [...matches], category);
  const statsOf = new Map(standings.map((row) => [row.team.id, row]));
  const rankOf = new Map<string, number>();
  standings.forEach((row, i) => {
    const previous = standings[i - 1];
    rankOf.set(
      row.team.id,
      previous && previous.points === row.points ? rankOf.get(previous.team.id)! : i + 1,
    );
  });

  const rows: CrossRow[] = ordered.map((team, rowIndex) => {
    const cells: CrossCell[] = ordered.map((other, colIndex) => {
      if (rowIndex === colIndex) return { kind: "self" };
      // Lower triangle only: a pairing belongs in exactly one cell, and a
      // mirrored copy above the diagonal is the same result written twice.
      if (colIndex > rowIndex) return { kind: "none" };

      const match = pairs.get(pairKey(team.id, other.id));
      if (!match) return { kind: "none" };

      const asRed = match.redTeamId === team.id;

      return {
        kind: "match",
        matchId: match.id,
        number: numbers.get(match.id) ?? "—",
        scored: asRed ? match.redScore : match.blueScore,
        conceded: asRed ? match.blueScore : match.redScore,
        outcome:
          match.state !== "completed"
            ? "pending"
            : match.isDraw
              ? "draw"
              : match.winnerTeamId === team.id
                ? "win"
                : "loss",
      };
    });

    const stats = statsOf.get(team.id);
    return {
      team,
      cells,
      played: stats?.played ?? 0,
      won: stats?.won ?? 0,
      drawn: stats?.drawn ?? 0,
      lost: stats?.lost ?? 0,
      points: stats?.points ?? 0,
      rank: rankOf.get(team.id) ?? 0,
    };
  });

  const complete = groupIsDecided(ordered, matches);

  return {
    label,
    teams: ordered,
    rows,
    complete,
    qualified: complete
      ? standings.slice(0, QUALIFY_PER_GROUP).map((row) => row.team)
      : [],
  };
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/* ── Splitting a class into its groups ─────────────────────────────────── */

/**
 * Group letters present in a class, in reading order, with the ungrouped
 * teams (if any) last under a null label — a class whose draw has not been
 * made yet is one big ungrouped list, and it must still be shown.
 */
export function groupLabelsOf(teams: readonly ScoringTeamRow[]): (string | null)[] {
  const labels = [...new Set(teams.map((team) => team.groupLabel))];
  const named = labels.filter((label): label is string => label !== null).sort();
  return labels.includes(null) ? [...named, null] : named;
}
