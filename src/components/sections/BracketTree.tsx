"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ScoringMatchRow, ScoringTeamRow } from "@/lib/db/schema";

/**
 * The elimination bracket, drawn as a connected tree — round columns left to
 * right, a line from each match to the one it feeds.
 *
 * Byes mean the tree is not a clean power-of-two shape: a team that drew a
 * bye reaches round two without a round-one match existing for it at all (see
 * the doc comment on planElimination in lib/scoring/bracket.ts). A layout
 * that assumed a symmetric tree — nested flexbox halving its gaps every
 * round, the usual pure-CSS bracket trick — would misalign the moment a
 * branch skips a round. So this measures the REAL rendered position of every
 * card after mount and draws each connector from that, following
 * `redFromMatchId`/`blueFromMatchId` — the same edges the database uses to
 * decide who advances where. It is layout-correct for whatever shape the
 * bracket actually has, not the shape it would have without byes.
 */

type Team = Pick<ScoringTeamRow, "id" | "code" | "name">;

export function BracketTree({
  matches,
  teams,
  tbdLabel,
}: {
  matches: ScoringMatchRow[];
  /**
   * Plain data, not a lookup function — this is a client component, and a
   * server parent cannot hand a function across that boundary. The parent
   * passes every team the bracket could reference (active and archived
   * alike); the map is built once here.
   */
  teams: readonly Team[];
  tbdLabel: string;
}) {
  const rounds = groupIntoRounds(matches);
  const containerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<Edge[]>([]);

  const byId = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const teamOf = (id: string | null) => (id === null ? undefined : byId.get(id));

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function measure() {
      const containerRect = container!.getBoundingClientRect();
      const next: Edge[] = [];

      for (const match of matches) {
        const childEl = container!.querySelector<HTMLElement>(`[data-match="${match.id}"]`);
        if (!childEl) continue;
        const childRect = childEl.getBoundingClientRect();
        const childY = childRect.top + childRect.height / 2 - containerRect.top;
        const childX = childRect.left - containerRect.left;

        for (const feederId of [match.redFromMatchId, match.blueFromMatchId]) {
          if (!feederId) continue;
          const feederEl = container!.querySelector<HTMLElement>(`[data-match="${feederId}"]`);
          if (!feederEl) continue;
          const feederRect = feederEl.getBoundingClientRect();
          next.push({
            x1: feederRect.right - containerRect.left,
            y1: feederRect.top + feederRect.height / 2 - containerRect.top,
            x2: childX,
            y2: childY,
          });
        }
      }

      setEdges(next);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
    // Re-measure whenever the set of matches changes shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.length]);

  if (rounds.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <div ref={containerRef} className="relative flex min-w-max gap-16 py-2">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {edges.map((edge, index) => (
            <ElbowConnector key={index} edge={edge} />
          ))}
        </svg>

        {rounds.map(({ label, list }) => (
          <div key={label} className="flex w-56 shrink-0 flex-col justify-around gap-6">
            <h4 className="text-center text-xs font-bold uppercase tracking-wider text-subtle">
              {label}
            </h4>
            {list.map((match) => (
              <MatchCard key={match.id} match={match} teamOf={teamOf} tbdLabel={tbdLabel} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

type Edge = { x1: number; y1: number; x2: number; y2: number };

/** A right-angle "elbow" from one card's edge to another's, in the usual bracket style. */
function ElbowConnector({ edge }: { edge: Edge }) {
  const midX = (edge.x1 + edge.x2) / 2;
  const d = `M ${edge.x1} ${edge.y1} H ${midX} V ${edge.y2} H ${edge.x2}`;
  return (
    <path
      d={d}
      fill="none"
      className="stroke-line-strong"
      strokeWidth={2}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function MatchCard({
  match,
  teamOf,
  tbdLabel,
}: {
  match: ScoringMatchRow;
  teamOf: (id: string | null) => Team | undefined;
  tbdLabel: string;
}) {
  const red = teamOf(match.redTeamId);
  const blue = teamOf(match.blueTeamId);
  const decided = match.state === "completed";

  return (
    <div data-match={match.id} className="tile tile-quiet relative z-10 flex flex-col gap-1 p-3">
      <Slot
        name={red?.name ?? tbdLabel}
        score={decided ? match.redScore : null}
        winner={decided && match.winnerTeamId === match.redTeamId}
      />
      <div className="h-px bg-line" />
      <Slot
        name={blue?.name ?? tbdLabel}
        score={decided ? match.blueScore : null}
        winner={decided && match.winnerTeamId === match.blueTeamId}
      />
    </div>
  );
}

function Slot({
  name,
  score,
  winner,
}: {
  name: string;
  score: number | null;
  winner: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={
          winner
            ? "truncate text-sm font-bold"
            : "truncate text-sm text-muted"
        }
      >
        {name}
      </span>
      {score !== null && (
        <span className={winner ? "tabular text-sm font-bold" : "tabular text-sm text-subtle"}>
          {score}
        </span>
      )}
    </div>
  );
}

/** "Финал" → 1 team remains, "1/N" → N — the site's existing round-label convention. */
function teamsRemaining(label: string): number {
  if (label === "Финал") return 1;
  const n = Number(label.split("/")[1]);
  return Number.isFinite(n) ? n : 0;
}

function groupIntoRounds(
  matches: ScoringMatchRow[],
): { label: string; list: ScoringMatchRow[] }[] {
  const byLabel = new Map<string, ScoringMatchRow[]>();
  for (const match of matches) {
    const label = match.roundLabel ?? "?";
    const list = byLabel.get(label);
    if (list) list.push(match);
    else byLabel.set(label, [match]);
  }

  for (const list of byLabel.values()) {
    // Insertion order from the generator IS slot order — see the comment on
    // generateEliminationBracket in lib/scoring/store.ts.
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  return [...byLabel.entries()]
    .map(([label, list]) => ({ label, list }))
    .sort((a, b) => teamsRemaining(b.label) - teamsRemaining(a.label));
}
