/**
 * Checks the scoring maths against the rulebooks.
 *
 *   npm run check:scoring
 *
 * Run with `--conditions=react-server`, because it reaches into the password
 * module and that module carries a `server-only` marker. The condition resolves
 * that marker to its own empty stub rather than the guard that throws.
 *
 * This exists because the tiebreaks are the part of the system most likely to
 * be quietly wrong and most expensive to get wrong: they decide who goes
 * through, they are read by people who will contest them, and several of them
 * are the OPPOSITE of what football-shaped intuition expects — most of these
 * rulebooks lead with the head-to-head result rather than goal difference, and
 * Bowling ranks on the average of its two rounds rather than the better one.
 *
 * Every case below is traceable to a line in a rulebook. If a rule changes,
 * change the expectation here first and then the code.
 */
import assert from "node:assert/strict";
import { buildStandings, buildLeaderboard, positions } from "@/lib/scoring/standings";
import { parseClock, formatClock, parseDuration } from "@/lib/scoring/format";
import { scoreLeapSheet } from "@/lib/validation/scoring";
import { getCategory, leapTimeBonus } from "@/config/categories";
import {
  planElimination,
  roundRobinPairings,
  seedFromGroupStandings,
  standardSeeding,
} from "@/lib/scoring/bracket";
import { hashPassword, verifyPassword } from "@/lib/admin/password";
import type { ScoringMatchRow, ScoringRunRow, ScoringTeamRow } from "@/lib/db/schema";

let checks = 0;
function ok(label: string, fn: () => void) {
  fn();
  checks += 1;
  console.log("  ✓", label);
}

async function okAsync(label: string, fn: () => Promise<void>) {
  await fn();
  checks += 1;
  console.log("  ✓", label);
}

const now = new Date();

function team(id: string, code: string, name: string, classId = "open"): ScoringTeamRow {
  return {
    id,
    categoryId: "x",
    classId,
    code,
    name,
    organization: null,
    region: null,
    groupLabel: null,
    applicationId: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function match(
  red: string,
  blue: string,
  redScore: number,
  blueScore: number,
  winner: string | null,
  isDraw = false,
): ScoringMatchRow {
  return {
    id: `${red}-${blue}`,
    categoryId: "x",
    classId: "open",
    stage: "group",
    groupLabel: null,
    roundLabel: null,
    redTeamId: red,
    blueTeamId: blue,
    redFromMatchId: null,
    blueFromMatchId: null,
    redScore,
    blueScore,
    redYellow: 0,
    redRed: 0,
    blueYellow: 0,
    blueRed: 0,
    state: "completed",
    winnerTeamId: winner,
    isDraw,
    notes: null,
    playedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function run(
  teamId: string,
  roundNumber: number,
  fields: Partial<ScoringRunRow>,
): ScoringRunRow {
  return {
    id: `${teamId}-${roundNumber}`,
    categoryId: "x",
    classId: "open",
    teamId,
    roundNumber,
    state: "ok",
    timeMs: null,
    points: null,
    remainingMs: null,
    breakdown: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

/* ── Clock ──────────────────────────────────────────────────────────────── */

console.log("\nClock");

ok("parses m:ss,mmm and m:ss.mmm identically", () => {
  assert.equal(parseClock("1:23,456"), 83_456);
  assert.equal(parseClock("1:23.456"), 83_456);
});

ok("a short fraction means tenths, not milliseconds", () => {
  assert.equal(parseClock("12.4"), 12_400);
  assert.equal(parseClock("12.04"), 12_040);
});

ok("bare seconds beyond 60 are allowed, but not after a minutes field", () => {
  assert.equal(parseClock("83.456"), 83_456);
  assert.equal(parseClock("1:83"), null);
});

ok("rejects junk instead of returning zero", () => {
  for (const bad of ["", "abc", "-5", "1:2:3", "99:99:99", "1,2,3"]) {
    assert.equal(parseClock(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

ok("formats the rulebook's own DNF constant as 3:00.001", () => {
  assert.equal(formatClock(180_001), "3:00.001");
  assert.equal(parseClock("3:00.001"), 180_001);
});

ok("parses mm:ss remaining time", () => {
  assert.equal(parseDuration("1:05"), 65_000);
  assert.equal(parseDuration("45"), 45_000);
  assert.equal(parseDuration("1:75"), null);
});

/* ── League table ───────────────────────────────────────────────────────── */

console.log("\nStandings");

const rugby = getCategory("rugby")!;
const a = team("a", "1", "Alpha");
const b = team("b", "2", "Bravo");
const c = team("c", "3", "Charlie");

ok("awards 3 / 1 / 0 and totals goals both ways", () => {
  const rows = buildStandings(
    [a, b],
    [match("a", "b", 3, 1, "a"), match("b", "a", 2, 2, null, true)],
    rugby,
  );
  const alpha = rows.find((r) => r.team.id === "a")!;
  const bravo = rows.find((r) => r.team.id === "b")!;
  assert.equal(alpha.points, 4, "win + draw");
  assert.equal(bravo.points, 1);
  assert.equal(alpha.scored, 5);
  assert.equal(alpha.conceded, 3);
  assert.equal(alpha.difference, 2);
  assert.equal(rows[0].team.id, "a");
});

ok("head-to-head outranks goal difference when two teams are level", () => {
  // Alpha and Bravo both finish on 3 points. Bravo has by far the better
  // difference (+8 against +1) but LOST the meeting between them, and the
  // rulebook decides on the head-to-head result. Bravo finishes second.
  const rows = buildStandings(
    [a, b, c],
    [match("a", "b", 1, 0, "a"), match("b", "c", 9, 0, "b")],
    rugby,
  );
  assert.deepEqual(
    rows.map((r) => r.team.id),
    ["a", "b", "c"],
    `got ${rows.map((r) => `${r.team.id}:${r.points}/${r.difference}`).join(" ")}`,
  );
});

ok("a three-way cycle falls through to difference inside the mini-table", () => {
  // Everyone beat someone and lost to someone, so head-to-head points cannot
  // separate them. What decides is the difference across those three meetings
  // only — NOT the overall difference, which is the same set of matches here
  // but would not be once other opponents exist.
  const rows = buildStandings(
    [a, b, c],
    [
      match("a", "b", 1, 0, "a"),
      match("b", "c", 6, 1, "b"),
      match("c", "a", 1, 0, "c"),
    ],
    rugby,
  );
  assert.equal(rows.every((r) => r.points === 3), true);
  assert.deepEqual(rows.map((r) => r.team.id), ["b", "a", "c"]);
});

ok("a live match is not counted until it is completed", () => {
  const live = { ...match("a", "b", 9, 0, "a"), state: "live" as const };
  const rows = buildStandings([a, b], [live], rugby);
  assert.equal(rows.every((r) => r.played === 0), true);
  assert.equal(rows.every((r) => r.points === 0), true);
});

ok("a negative score is carried, not clamped", () => {
  const ringMaster = getCategory("ringMaster")!;
  const rows = buildStandings([a, b], [match("a", "b", -30, 12, "b")], ringMaster);
  assert.equal(rows.find((r) => r.team.id === "a")!.scored, -30);
});

/* ── Leaderboards ───────────────────────────────────────────────────────── */

console.log("\nLeaderboards");

const lineFollower = getCategory("lineFollower")!;

ok("Line Follower ranks on the fastest of three attempts", () => {
  const rows = buildLeaderboard(
    [a, b],
    [
      run("a", 1, { timeMs: 30_000 }),
      run("a", 2, { timeMs: 21_500 }),
      run("b", 1, { timeMs: 22_000 }),
    ],
    lineFollower,
  );
  assert.equal(rows[0].team.id, "a");
  assert.equal(rows[0].ranking, 21_500);
});

ok("a failed attempt takes the rulebook's 3:00.001, not a blank", () => {
  const rows = buildLeaderboard(
    [a, b],
    [run("a", 1, { state: "dnf", timeMs: 180_001 }), run("b", 1, { timeMs: 60_000 })],
    lineFollower,
  );
  // Behind the finisher, but present and sorted.
  assert.equal(rows[0].team.id, "b");
  assert.equal(rows[1].ranking, 180_001);
});

ok("a team with no attempt sits below every team that has competed", () => {
  const rows = buildLeaderboard(
    [a, b],
    [run("b", 1, { state: "dsq", timeMs: 180_001 })],
    lineFollower,
  );
  assert.equal(rows[0].team.id, "b");
  assert.equal(rows[1].ranking, null);
});

const bowling = getCategory("bowling")!;

ok("Bowling ranks on the AVERAGE of its two rounds, not the better one", () => {
  // Alpha: 150 and 50 -> average 100, best 150.
  // Bravo: 110 and 110 -> average 110, best 110.
  // Ranking on the best would put Alpha first; the rulebook says Bravo.
  const rows = buildLeaderboard(
    [a, b],
    [
      run("a", 1, { points: 150 }),
      run("a", 2, { points: 50 }),
      run("b", 1, { points: 110 }),
      run("b", 2, { points: 110 }),
    ],
    bowling,
  );
  assert.equal(rows[0].team.id, "b", "average must decide");
  assert.equal(rows[0].ranking, 110);
  assert.equal(rows[1].ranking, 100);
});

ok("equal averages go to the better round, then to remaining time", () => {
  const rows = buildLeaderboard(
    [a, b],
    [
      run("a", 1, { points: 100, remainingMs: 10_000 }),
      run("a", 2, { points: 100, remainingMs: 10_000 }),
      run("b", 1, { points: 120, remainingMs: 5_000 }),
      run("b", 2, { points: 80, remainingMs: 5_000 }),
    ],
    bowling,
  );
  assert.equal(rows[0].team.id, "b", "better single round breaks the tie");
});

const leap = getCategory("leap")!;

ok("Leap ranks on the better of two rounds, ties on remaining time", () => {
  const rows = buildLeaderboard(
    [a, b],
    [
      run("a", 1, { points: 200, remainingMs: 30_000 }),
      run("a", 2, { points: 240, remainingMs: 20_000 }),
      run("b", 1, { points: 240, remainingMs: 10_000 }),
    ],
    leap,
  );
  assert.equal(rows[0].ranking, 240);
  assert.equal(rows[1].ranking, 240);
  assert.equal(rows[0].team.id, "a", "more time left ranks higher");
});

ok("teams level on the ranking figure share a position", () => {
  assert.deepEqual(positions([10, 10, 8, 8, 5]), [1, 1, 3, 3, 5]);
  assert.deepEqual(positions([10, 8, null]), [1, 2, null]);
});

/* ── Leap's sheet ───────────────────────────────────────────────────────── */

console.log("\nLeap score sheet");

ok("a full clean sheet totals the rulebook's 300", () => {
  const result = scoreLeapSheet({
    circuit: 2,
    micUpright: 3,
    micPlaced: 0,
    micMoved: 0,
    speakers: 2,
    screen: 1,
    bandUpright: 5,
    bandPlaced: 0,
    bandField: 0,
    lighting: 1,
    sound: 3,
    crane: 1,
    fireworks: 2,
    diveOut: 1,
    diveIn: 0,
    bonus: 1,
    intact: 1,
    retry: 0,
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.total, 300);
});

ok("without the bonus task the sheet tops out at the rulebook's 270", () => {
  const result = scoreLeapSheet({
    circuit: 2,
    micUpright: 3,
    speakers: 2,
    screen: 1,
    bandUpright: 5,
    lighting: 1,
    sound: 3,
    crane: 1,
    fireworks: 2,
    diveOut: 1,
    intact: 1,
  });
  assert.equal(result.ok && result.total, 270);
});

ok("the same microphone cannot be scored at two quality levels", () => {
  const result = scoreLeapSheet({ micUpright: 3, micPlaced: 1 });
  assert.equal(result.ok, false);
});

ok("retries subtract, and the round never goes below zero", () => {
  const five = scoreLeapSheet({ screen: 1, retry: 1 });
  assert.equal(five.ok && five.total, 5);
  const floored = scoreLeapSheet({ retry: 4 });
  assert.equal(floored.ok && floored.total, 0);
});

ok("a count above a row's maximum is refused", () => {
  assert.equal(scoreLeapSheet({ speakers: 3 }).ok, false);
  assert.equal(scoreLeapSheet({ screen: -1 }).ok, false);
});

ok("the time bonus is 10% of the sheet, scaled by time left", () => {
  assert.equal(leapTimeBonus(180_000, 180_000), 30);
  assert.equal(leapTimeBonus(90_000, 180_000), 15);
  assert.equal(leapTimeBonus(0, 180_000), 0);
});

/* ── Bracket generation ────────────────────────────────────────────────── */

console.log("\nBracket generation");

ok("standard seeding pairs the top two seeds only in the final", () => {
  assert.deepEqual(standardSeeding(2), [1, 2]);
  assert.deepEqual(standardSeeding(4), [1, 4, 2, 3]);
  // The textbook 8-seed draw: 1v8, 4v5, 2v7, 3v6.
  assert.deepEqual(standardSeeding(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  assert.deepEqual(standardSeeding(16), [
    1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11,
  ]);
});

ok("a power-of-two team count needs no byes and every round is a real match", () => {
  const plans = planElimination(["a", "b", "c", "d", "e", "f", "g", "h"]);
  // 4 quarter-finals + 2 semi-finals + 1 final = 7 matches, none with a TBD
  // slot in round one — every seed has an opponent.
  assert.equal(plans.length, 7);
  const roundOne = plans.filter((p) => p.round === 1);
  assert.equal(roundOne.length, 4);
  for (const p of roundOne) {
    assert.notEqual(p.redTeamId, null);
    assert.notEqual(p.blueTeamId, null);
  }
  assert.equal(plans.find((p) => p.roundLabel === "Финал")?.round, 3);
});

ok("byes go to the top seeds and never meet each other in round one", () => {
  // 5 teams -> bracket of 8, 3 byes. Seed order [1,8,4,5,2,7,3,6] maps seeds
  // 6,7,8 to byes, landing on pairs (1,bye), (4,5), (2,bye), (3,bye) — three
  // round-one pairings vanish, one (4 vs 5) is a real match.
  const plans = planElimination(["s1", "s2", "s3", "s4", "s5"]);
  const roundOne = plans.filter((p) => p.round === 1);
  assert.equal(roundOne.length, 1, "only the 4-vs-5 pairing is a real round-one match");
  assert.equal(roundOne[0].redTeamId, "s4");
  assert.equal(roundOne[0].blueTeamId, "s5");

  // Round two (the semi-finals) must be fully populated: byes advance
  // directly as concrete teams, the round-one winner as a pending reference.
  const roundTwo = plans.filter((p) => p.round === 2);
  assert.equal(roundTwo.length, 2);
  const seed1Match = roundTwo.find((p) => p.redTeamId === "s1" || p.blueTeamId === "s1");
  assert.ok(seed1Match, "the top seed's bye carries it straight into round two");
  const pendingMatch = roundTwo.find((p) => p.redFrom !== null || p.blueFrom !== null);
  assert.ok(pendingMatch, "the 4-vs-5 winner is not known yet, so it is a reference");
});

ok("planElimination is a no-op below two teams", () => {
  assert.deepEqual(planElimination([]), []);
  assert.deepEqual(planElimination(["only"]), []);
});

ok("round robin plays every pair exactly once", () => {
  const teams = ["a", "b", "c", "d", "e"];
  const pairings = roundRobinPairings(teams);
  // C(5,2) = 10 pairings regardless of the bye seat odd counts need.
  assert.equal(pairings.length, 10);

  const seen = new Set<string>();
  for (const { a, b } of pairings) {
    const key = [a, b].sort().join(":");
    assert.equal(seen.has(key), false, `${key} scheduled twice`);
    seen.add(key);
  }

  const allPairs = new Set(
    teams.flatMap((x, i) => teams.slice(i + 1).map((y) => [x, y].sort().join(":"))),
  );
  assert.deepEqual(seen, allPairs);
});

ok("round robin never plays a team twice in the same round", () => {
  const pairings = roundRobinPairings(["a", "b", "c", "d", "e", "f"]);
  const byRound = new Map<number, string[]>();
  for (const { round, a, b } of pairings) {
    const list = byRound.get(round) ?? [];
    list.push(a, b);
    byRound.set(round, list);
  }
  for (const [round, seats] of byRound) {
    assert.equal(new Set(seats).size, seats.length, `round ${round} repeats a team`);
  }
});

ok("group standings seed a crossover playoff group winners first", () => {
  const groupA = [
    { teamId: "a1", points: 9 },
    { teamId: "a2", points: 3 },
  ];
  const groupB = [
    { teamId: "b1", points: 6 },
    { teamId: "b2", points: 0 },
  ];
  assert.deepEqual(seedFromGroupStandings([groupA, groupB]), ["a1", "b1", "a2", "b2"]);
});

/* ── Credential format ──────────────────────────────────────────────────── */

/**
 * Not scoring maths, but the console's front door — and a regression here is
 * invisible rather than loud: a hash in the wrong shape does not throw, it
 * simply never matches any password. The dot separator in particular looks
 * like something worth "tidying" back to the conventional `$`, which a .env
 * loader then eats. See the note in src/lib/admin/password.ts.
 *
 * Async, and therefore last: scrypt at these parameters takes ~150ms a call.
 */
async function credentials(): Promise<void> {
  console.log("\nCredential format");

  await okAsync("a fresh hash round-trips and rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    assert.equal(await verifyPassword("correct horse battery staple", hash), true);
    assert.equal(await verifyPassword("Correct horse battery staple", hash), false);
  });

  await okAsync("a fresh hash contains nothing a .env loader mangles", async () => {
    const hash = await hashPassword("whatever");
    assert.equal(hash.includes("$"), false, "a $ does not survive dotenv-expand");
    assert.equal(hash.startsWith("scrypt."), true);
    assert.equal(hash.split(".").length, 6);
  });

  await okAsync("a hash minted with the old `$` separator still verifies", async () => {
    const modern = await hashPassword("legacy password");
    const legacy = modern.split(".").join("$");
    assert.equal(await verifyPassword("legacy password", legacy), true);
    assert.equal(await verifyPassword("legacy passwore", legacy), false);
  });

  await okAsync("a mangled hash is refused, not treated as a match", async () => {
    const hash = await hashPassword("x");
    // What dotenv-expand actually did to the old format: ate every `$NAME`.
    assert.equal(await verifyPassword("x", hash.replace(/\.\d+/g, "")), false);
    assert.equal(await verifyPassword("x", ""), false);
    assert.equal(await verifyPassword("x", "scrypt.1.1.1.a.b"), false);
  });
}

credentials()
  .then(() => {
    console.log(`\n${checks} checks passed\n`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
