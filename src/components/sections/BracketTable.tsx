import type { Translator } from "./ResultTables";
import type { BracketRow, BracketSide, SlotSource } from "@/lib/scoring/table";
import type { ScoringTeamRow } from "@/lib/db/schema";

/**
 * The elimination bracket as a table of pairings — one row per match, the red
 * corner on the left, the blue corner on the right, the match number and score
 * between them. The same view the international board offers beside its drawn
 * tree, and for the same reasons a championship runs into:
 *
 *  · A tree needs width. A sixteen-team bracket is five columns of cards, and
 *    on the phone in a spectator's hand it becomes a horizontal scroll with no
 *    way to see a match and its score at once. A table is one column.
 *  · A table says where every slot came from. "Winner of M3", "1st in
 *    Group B" — printed before the match is played, which is exactly when
 *    people want to know who they are waiting for.
 *  · It is the shape a correction is made in. A judge looking for "M7" scans a
 *    numbered list; nobody scans a tree.
 *
 * Rows are spaced into cards with a coloured edge per corner, so which side is
 * red and which is blue is legible before a word is read — the corners are the
 * rulebooks' own names for the two sides and the judge's sheet uses them too.
 *
 * Empty slots are not blanks: they carry their source, so an unplayed
 * quarter-final reads "winner of M1 — winner of M2" rather than "— — —".
 */
export function BracketTable({
  rows,
  teams,
  t,
}: {
  rows: BracketRow[];
  /** Every team the bracket could name, active and withdrawn alike. */
  teams: readonly ScoringTeamRow[];
  t: Translator;
}) {
  if (rows.length === 0) return null;

  const byId = new Map(teams.map((team) => [team.id, team]));
  const sections = groupByRound(rows);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr>
            <Th>{t("colRed")}</Th>
            <Th align="center">{t("colMatch")}</Th>
            <Th align="center">{t("colScore")}</Th>
            <Th align="right">{t("colBlue")}</Th>
          </tr>
        </thead>

        {sections.map((section) => (
          <tbody key={section.label ?? "—"}>
            {section.label && (
              <tr>
                <th
                  scope="colgroup"
                  colSpan={4}
                  className="pt-2 text-left text-2xs font-bold uppercase tracking-wider text-subtle"
                >
                  {section.label}
                </th>
              </tr>
            )}

            {section.rows.map((row) => (
              <tr key={row.id}>
                <td className="rounded-l-lg border-y-2 border-l-4 border-line border-l-danger bg-surface px-3 py-3">
                  <Side side={row.red} byId={byId} t={t} align="left" />
                </td>

                <td className="border-y-2 border-line bg-surface px-2 py-3 text-center">
                  <span className="tabular inline-flex min-w-11 items-center justify-center rounded-md bg-surface-muted px-2 py-1 text-xs font-bold">
                    {row.number}
                  </span>
                </td>

                <td className="border-y-2 border-line bg-surface px-2 py-3 text-center">
                  <span className="tabular inline-flex min-w-20 items-center justify-center whitespace-nowrap rounded-md border-2 border-line-strong px-3 py-1.5 font-display text-lg font-extrabold">
                    {row.state === "completed"
                      ? `${row.red.score} : ${row.blue.score}`
                      : t("notPlayed")}
                  </span>
                </td>

                <td className="rounded-r-lg border-y-2 border-r-4 border-line border-r-brand-strong bg-surface px-3 py-3">
                  <Side side={row.blue} byId={byId} t={t} align="right" />
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      className={`px-3 pb-1 text-2xs font-bold uppercase tracking-wider text-subtle ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

/* ── One side of one pairing ────────────────────────────────────────────── */

function Side({
  side,
  byId,
  t,
  align,
}: {
  side: BracketSide;
  byId: Map<string, ScoringTeamRow>;
  t: Translator;
  align: "left" | "right";
}) {
  const team = side.teamId ? byId.get(side.teamId) : undefined;
  const source = sourceLabel(side.source, t);

  return (
    <span
      className={`flex flex-col gap-0.5 ${align === "right" ? "items-end text-right" : ""}`}
    >
      <span className={side.won ? "font-bold" : "text-muted"}>
        {team ? (
          <>
            <span className="tabular mr-2 text-xs font-bold text-brand">{team.code}</span>
            {team.name}
          </>
        ) : (
          t("tbd")
        )}
      </span>
      {source && <span className="text-2xs text-subtle">{source}</span>}
    </span>
  );
}

/**
 * "Winner of M3" / "1st in Group B" — the sentence that lets a bracket be read
 * before it has been played.
 */
function sourceLabel(source: SlotSource, t: Translator): string | null {
  if (!source) return null;
  if (source.kind === "winner") return t("sourceWinner", { match: source.match });
  return source.group
    ? t("sourceGroup", { place: source.place, group: source.group })
    : t("sourceGroupPlain", { place: source.place });
}

/**
 * Rounds keep the order the generator created them in — first round first —
 * which is also the order they will be played.
 */
function groupByRound(rows: BracketRow[]): { label: string | null; rows: BracketRow[] }[] {
  const sections: { label: string | null; rows: BracketRow[] }[] = [];
  for (const row of rows) {
    const last = sections[sections.length - 1];
    if (last && last.label === row.roundLabel) last.rows.push(row);
    else sections.push({ label: row.roundLabel, rows: [row] });
  }
  return sections;
}
