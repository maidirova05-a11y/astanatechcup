/**
 * Bracket and schedule planning — pure functions, no database.
 *
 * Two shapes a category's matches can take, and international convention has
 * a standard answer for both:
 *
 *  · Round robin (group stage): every team meets every other team once. The
 *    "circle method" below is the standard way to turn N teams into N-1 (or
 *    N, with one bye per round for odd N) rounds where no team plays twice in
 *    the same round.
 *
 *  · Single elimination (playoffs): teams are seeded 1..N and paired so the
 *    strongest seeds cannot meet until the final possible round — 1 plays the
 *    weakest remaining seed, 2 the next-weakest, and so on. `standardSeeding`
 *    is the same recursive-halving construction every bracket generator uses
 *    (Challonge, tennis draws, this event's own reference system); check it
 *    against a known bracket rather than re-deriving it by eye.
 *
 * store.ts turns these plans into rows; this file only decides the shape.
 */

/* ── Round robin ───────────────────────────────────────────────────────── */

export type RoundRobinPairing = {
  round: number;
  /** Arbitrary — round robin has no "home side" — but stable across a run. */
  a: string;
  b: string;
};

/**
 * Circle method. Team 0 stays fixed; every other team rotates one position
 * each round. An odd team count gets a bye seat added and removed again, so
 * every real team sits out exactly one round rather than the schedule being
 * lopsided.
 */
export function roundRobinPairings(teamIds: readonly string[]): RoundRobinPairing[] {
  if (teamIds.length < 2) return [];

  const BYE = Symbol("bye");
  const seats: (string | typeof BYE)[] = [...teamIds];
  if (seats.length % 2 === 1) seats.push(BYE);

  const seatCount = seats.length;
  const roundCount = seatCount - 1;
  const pairings: RoundRobinPairing[] = [];

  for (let round = 0; round < roundCount; round++) {
    for (let i = 0; i < seatCount / 2; i++) {
      const left = seats[i];
      const right = seats[seatCount - 1 - i];
      if (left !== BYE && right !== BYE) {
        pairings.push(
          round % 2 === 0
            ? { round: round + 1, a: left, b: right }
            : { round: round + 1, a: right, b: left },
        );
      }
    }
    // Rotate everyone except seat 0.
    const fixed = seats[0];
    const rest = seats.slice(1);
    rest.unshift(rest.pop()!);
    seats.splice(0, seats.length, fixed, ...rest);
  }

  return pairings;
}

/* ── Single elimination ───────────────────────────────────────────────── */

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/**
 * The standard seed order for a bracket of the given size (a power of two):
 * `standardSeeding(8)` → `[1, 8, 4, 5, 2, 7, 3, 6]`, meaning round one pairs
 * seed 1 with seed 8, seed 4 with seed 5, seed 2 with seed 7, seed 3 with
 * seed 6 — the pairing used in every standard elimination draw, chosen so
 * the top two seeds can only meet in the final.
 *
 * Built by recursive halving rather than a lookup table, so it is correct
 * for any bracket size without enumerating them.
 */
export function standardSeeding(size: number): number[] {
  if (size < 1 || (size & (size - 1)) !== 0) {
    throw new Error(`standardSeeding: size must be a power of two, got ${size}`);
  }
  let seeds = [1];
  while (seeds.length < size) {
    const ceiling = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const seed of seeds) {
      next.push(seed, ceiling - seed);
    }
    seeds = next;
  }
  return seeds;
}

/** One planned match in an elimination bracket, before any DB ids exist. */
export type BracketMatchPlan = {
  /** 1-indexed; round 1 is the first round played. */
  round: number;
  /** Position within the round, 0-indexed — stable, used to wire rounds together. */
  slot: number;
  /** Round label in the site's existing convention: "1/8", "1/4", "1/2", "Финал". */
  roundLabel: string;
  /** A concrete team, when known at generation time (a real seed, or a bye's opponent). */
  redTeamId: string | null;
  blueTeamId: string | null;
  /** Which EARLIER planned match (by round+slot) feeds this slot, when not yet known. */
  redFrom: { round: number; slot: number } | null;
  blueFrom: { round: number; slot: number } | null;
};

/**
 * Plans every round of a single-elimination bracket up front, including
 * rounds that cannot be played yet — a quarter-final match exists as a row
 * with two empty ("TBD") slots before either semi-final feeding it has been
 * played, exactly as a printed bracket sheet shows the whole tree from day
 * one.
 *
 * `seededTeamIds[0]` is seed 1 (the top seed), `[1]` seed 2, and so on —
 * ordering is the caller's decision (see buildPlayoffSeeding in store.ts for
 * how standings feed into it). A team count that is not a power of two gets
 * byes distributed by `standardSeeding`, which is exactly why that ordering
 * exists rather than a naive top/bottom split: bye seats always land on the
 * best remaining seeds, and at most one bye can fall in any single round-one
 * pairing — proven by size being the SMALLEST power of two at least
 * teamCount, so byes (size − teamCount) is always under size / 2.
 */
export function planElimination(seededTeamIds: readonly string[]): BracketMatchPlan[] {
  const teamCount = seededTeamIds.length;
  if (teamCount < 2) return [];

  const size = nextPowerOfTwo(teamCount);
  const totalRounds = Math.log2(size);
  const seedPositions = standardSeeding(size);

  // seedPositions[i] is a seed NUMBER (1-indexed); map it to a team, or null
  // past the real team count — a permanent bye seat.
  const leaves: (string | null)[] = seedPositions.map((seed) =>
    seed <= teamCount ? seededTeamIds[seed - 1] : null,
  );

  const plans: BracketMatchPlan[] = [];
  const roundLabel = (teamsRemainingAfter: number): string => {
    if (teamsRemainingAfter === 1) return "Финал";
    if (teamsRemainingAfter === 2) return "1/2";
    if (teamsRemainingAfter === 4) return "1/4";
    return `1/${teamsRemainingAfter}`;
  };

  // `advancing[slot]` is what reaches the NEXT round from this round's slot:
  // a concrete team id, a permanent empty bye seat (null — only possible at
  // round one), or a reference to the plan that will decide it.
  type Advancing = string | null | { round: number; slot: number };
  let advancing: Advancing[] = leaves;

  for (let round = 1; round <= totalRounds; round++) {
    const width = advancing.length / 2;
    const next: Advancing[] = [];

    for (let slot = 0; slot < width; slot++) {
      const left = advancing[slot * 2];
      const right = advancing[slot * 2 + 1];

      const leftIsTeam = typeof left === "string" || left === null;
      const rightIsTeam = typeof right === "string" || right === null;

      // Round one only: a genuine permanent bye needs no match at all — the
      // other side simply advances. From round two on this cannot happen
      // (see the doc comment above), so every later round is a real match.
      if (round === 1 && leftIsTeam && rightIsTeam && (left === null || right === null)) {
        next.push(left ?? right);
        continue;
      }

      plans.push({
        round,
        slot,
        roundLabel: roundLabel(width),
        redTeamId: leftIsTeam ? (left as string | null) : null,
        blueTeamId: rightIsTeam ? (right as string | null) : null,
        redFrom: leftIsTeam ? null : (left as { round: number; slot: number }),
        blueFrom: rightIsTeam ? null : (right as { round: number; slot: number }),
      });
      next.push({ round, slot });
    }

    advancing = next;
  }

  return plans;
}

/* ── Seeding playoffs from group results ──────────────────────────────── */

/**
 * A default playoff seed order computed from finished group standings,
 * rather than a judge retyping the whole roster in rank order.
 *
 * Cross-group seeding for a crossover playoff has no single "correct"
 * formula the way round-robin scheduling or bracket pairing does — this
 * uses the common tournament convention: every group's 1st place, ranked
 * against each other by points; then every 2nd place; and so on. It is a
 * starting order, not a verdict — the console lets a judge reorder it before
 * generating the bracket, for the cases (a wildcard, an uneven group size)
 * this formula does not resolve on its own.
 */
export function seedFromGroupStandings(
  groups: readonly { teamId: string; points: number }[][],
): string[] {
  const seeded: string[] = [];
  const maxTier = Math.max(0, ...groups.map((g) => g.length));

  for (let tier = 0; tier < maxTier; tier++) {
    const atThisTier = groups
      .map((group) => group[tier])
      .filter((row): row is { teamId: string; points: number } => row !== undefined)
      .sort((a, b) => b.points - a.points);

    for (const row of atThisTier) seeded.push(row.teamId);
  }

  return seeded;
}
