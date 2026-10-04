import type { Translator } from "./ResultTables";
import type { SlotSource } from "@/lib/scoring/table";
import type { ScoringMatchRow, ScoringTeamRow } from "@/lib/db/schema";

/**
 * The elimination bracket drawn the way the international RobotChallenge board
 * draws it: every team a solid card in its corner's colour, its score in a box
 * on the card, and each pairing closed by a curly brace carrying the green
 * match number — the brace pointing at the card of whoever came out of it.
 *
 * The layout is RECURSIVE, not a grid of round columns. A match is drawn as its
 * two incoming slots stacked, a brace, and (in the parent) the card of its
 * winner. A slot fed by an earlier match is that whole earlier match drawn to
 * its left. This is what makes byes come out right with no measuring: a team
 * that skipped round one is simply a leaf one level further right than its
 * opponent's subtree, and every card still sits exactly opposite the brace
 * that produced it.
 *
 * Alignment is arithmetic rather than measurement. Every leaf is the same
 * height, so a subtree is exactly (leaves × leaf height) tall, and the brace's
 * two tips and its nub are drawn at percentages computed from leaf counts — the
 * centres of the two incoming cards, and the point halfway between them. No
 * client JavaScript, no ResizeObserver, nothing to go wrong on a phone.
 */
export function BracketDiagram({
  matches,
  teams,
  numbers,
  placements,
  t,
}: {
  matches: readonly ScoringMatchRow[];
  teams: readonly ScoringTeamRow[];
  numbers: Map<string, string>;
  placements: Map<string, { group: string | null; place: number }>;
  t: Translator;
}) {
  const bracket = matches.filter((m) => m.stage === "playoff" || m.stage === "final");
  if (bracket.length === 0) return null;

  const byId = new Map(bracket.map((m) => [m.id, m]));
  const teamOf = new Map(teams.map((team) => [team.id, team]));

  // The final is the match nothing feeds into. Normally one; more only if the
  // bracket was edited by hand, and then each is drawn as its own tree.
  const feeding = new Set(
    bracket.flatMap((m) => [m.redFromMatchId, m.blueFromMatchId]).filter(Boolean),
  );
  const roots = bracket
    .filter((m) => !feeding.has(m.id))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const feederOf = (m: ScoringMatchRow, side: "red" | "blue") => {
    const id = side === "red" ? m.redFromMatchId : m.blueFromMatchId;
    return id ? byId.get(id) : undefined;
  };

  // Leaves under a slot — the unit the whole layout is measured in.
  const leafMemo = new Map<string, number>();
  const leaves = (m: ScoringMatchRow): number => {
    const cached = leafMemo.get(m.id);
    if (cached !== undefined) return cached;
    const count = slotLeaves(m, "red") + slotLeaves(m, "blue");
    leafMemo.set(m.id, count);
    return count;
  };
  const slotLeaves = (m: ScoringMatchRow, side: "red" | "blue"): number => {
    const feeder = feederOf(m, side);
    return feeder ? leaves(feeder) : 1;
  };

  const sourceText = (source: SlotSource): string | null => {
    if (!source || source.kind !== "group") return null;
    return source.group
      ? t("sourceGroup", { place: source.place, group: source.group })
      : t("sourceGroupPlain", { place: source.place });
  };

  /** One team entering match `m` from `side`. */
  const card = (m: ScoringMatchRow, side: "red" | "blue") => {
    const teamId = side === "red" ? m.redTeamId : m.blueTeamId;
    const team = teamId ? teamOf.get(teamId) : undefined;
    const decided = m.state === "completed";
    const won = decided && m.winnerTeamId !== null && m.winnerTeamId === teamId;
    const lost = decided && !won && !m.isDraw;
    const fed = Boolean(feederOf(m, side));
    const placement = teamId && !fed ? placements.get(teamId) : undefined;
    const source = placement ? sourceText({ kind: "group", ...placement }) : null;

    return (
      <TeamCard
        corner={side}
        code={team?.code ?? null}
        name={team?.name ?? t("tbd")}
        source={source}
        score={decided ? (side === "red" ? m.redScore : m.blueScore) : null}
        won={won}
        lost={lost}
      />
    );
  };

  const renderSlot = (m: ScoringMatchRow, side: "red" | "blue"): React.ReactNode => {
    const feeder = feederOf(m, side);
    // Right-aligned: a team that skipped a round (a bye) sits next to the
    // brace it enters, in the same column as its opponent's card, not out at
    // the far left where the first round is.
    if (!feeder) {
      return <div className="flex justify-end py-1.5">{card(m, side)}</div>;
    }
    return (
      <div className="flex items-center justify-end">
        {renderMatch(feeder)}
        {card(m, side)}
      </div>
    );
  };

  const renderMatch = (m: ScoringMatchRow): React.ReactNode => {
    const top = slotLeaves(m, "red");
    const total = leaves(m);
    const bottom = total - top;
    // Centres of the two incoming cards, as a share of this node's height.
    const y1 = (top / 2 / total) * 100;
    const y2 = ((top + bottom / 2) / total) * 100;

    return (
      <div key={m.id} className="flex items-stretch">
        <div className="flex flex-col items-stretch">
          {renderSlot(m, "red")}
          {renderSlot(m, "blue")}
        </div>
        <Brace y1={y1} y2={y2} label={numbers.get(m.id) ?? "—"} />
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max flex-col gap-10 py-2">
        {roots.map((final) => {
          const decided = final.state === "completed" && final.winnerTeamId !== null;
          const champion = decided ? teamOf.get(final.winnerTeamId!) : undefined;
          return (
            <div key={final.id} className="flex items-center">
              {renderMatch(final)}
              <Champion
                label={t("champion")}
                code={champion?.code ?? null}
                name={champion?.name ?? t("tbd")}
                decided={Boolean(champion)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

/**
 * A team in one corner of one match. Solid colour by corner — red and blue are
 * the rulebooks' own names for the two sides — with the score in a box at the
 * end, as on the board this mirrors. Once a match is decided the loser fades,
 * so the path of every team reads left to right at a glance.
 */
function TeamCard({
  corner,
  code,
  name,
  source,
  score,
  won,
  lost,
}: {
  corner: "red" | "blue";
  code: string | null;
  name: string;
  source: string | null;
  score: number | null;
  won: boolean;
  lost: boolean;
}) {
  const skin =
    code === null
      ? "border-2 border-dashed border-line-strong bg-surface text-muted"
      : corner === "red"
        ? "bg-danger text-white"
        : "bg-brand-strong text-on-brand";

  return (
    <div
      className={`flex h-16 w-64 items-stretch overflow-hidden rounded-lg shadow-sm ${skin} ${
        lost ? "opacity-45" : ""
      } ${won ? "ring-2 ring-success ring-offset-2 ring-offset-surface" : ""}`}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center px-3">
        <span className="flex min-w-0 items-baseline gap-2">
          {code && <span className="tabular shrink-0 text-xs font-extrabold opacity-90">{code}</span>}
          <span className="truncate text-sm font-bold">{name}</span>
        </span>
        {source && <span className="truncate text-2xs opacity-80">{source}</span>}
      </div>
      <span
        className={`tabular flex w-11 shrink-0 items-center justify-center font-display text-lg font-extrabold ${
          code === null ? "" : "bg-white/20"
        }`}
      >
        {score ?? ""}
      </span>
    </div>
  );
}

/**
 * The curly brace that closes a pairing, with the match number on a green
 * badge — the board's own way of saying "these two met in M3, and this is who
 * went on". Drawn in a stretched SVG whose tips sit at the two cards' centres.
 */
function Brace({ y1, y2, label }: { y1: number; y2: number; label: string }) {
  const ym = (y1 + y2) / 2;
  const r = Math.min(3, (y2 - y1) / 6);
  const d = [
    `M 2 ${y1}`,
    `Q 12 ${y1} 12 ${y1 + r}`,
    `L 12 ${ym - r}`,
    `Q 12 ${ym} 22 ${ym}`,
    `Q 12 ${ym} 12 ${ym + r}`,
    `L 12 ${y2 - r}`,
    `Q 12 ${y2} 2 ${y2}`,
  ].join(" ");

  return (
    <div className="relative w-16 shrink-0 self-stretch">
      <svg
        className="absolute inset-y-0 left-0 h-full w-6 overflow-visible"
        viewBox="0 0 24 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={d}
          fill="none"
          className="stroke-line-strong"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />
      </svg>
      <span
        className="tabular absolute left-7 -translate-y-1/2 rounded-md bg-success px-2 py-0.5 text-xs font-extrabold text-white"
        style={{ top: `${ym}%` }}
      >
        {label}
      </span>
    </div>
  );
}

/** Where the bracket ends: the winner of the final, or who it will be. */
function Champion({
  label,
  code,
  name,
  decided,
}: {
  label: string;
  code: string | null;
  name: string;
  decided: boolean;
}) {
  return (
    <div
      className={`flex w-64 flex-col justify-center gap-0.5 rounded-lg border-2 px-4 py-3 ${
        decided
          ? "border-warning bg-warning-surface"
          : "border-dashed border-line-strong bg-surface text-muted"
      }`}
    >
      <span className="text-2xs font-bold uppercase tracking-wider text-subtle">
        🏆 {label}
      </span>
      <span className="flex min-w-0 items-baseline gap-2">
        {code && <span className="tabular shrink-0 text-xs font-extrabold text-brand">{code}</span>}
        <span className="truncate text-base font-extrabold">{name}</span>
      </span>
    </div>
  );
}
