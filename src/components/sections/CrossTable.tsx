import type { Translator } from "./ResultTables";
import type { CrossCell, CrossTable as CrossTableData } from "@/lib/scoring/table";

/**
 * A group as the cross-table every tournament hall has on the wall, drawn the
 * way the international RobotChallenge board draws it: the start list down the
 * side and across the top as solid coloured tiles, each pairing written once in
 * the lower triangle with its match number above its score, and wins / draws /
 * losses / points down the right.
 *
 * Three decisions carried over from that board, all of them about reading a
 * table across a hall rather than across a desk:
 *
 *  · Cells are blocks, not text. A referee glancing at a row sees a run of
 *    green or red before reading a single number.
 *  · The empty half of the matrix is filled in solid grey rather than left
 *    blank, so the diagonal is visible and nobody hunts for a result that was
 *    never going to be there.
 *  · Every cell carries its match number. "M7" is how a result is asked about
 *    over a radio, and a table that only shows scores cannot answer.
 *
 * The triangle is the point. A full square would print every result twice —
 * once as 2:0 and once as 0:2 — and a spectator checking a result would have
 * to work out which half they were reading. One pairing, one cell.
 *
 * The first column is sticky so a team's name stays on screen while the matrix
 * scrolls sideways, which is the only way a group of sixteen is readable on a
 * phone.
 */
export function CrossTable({
  table,
  t,
  title,
  hrefOf,
}: {
  table: CrossTableData;
  t: Translator;
  /** Shown in the table's corner cell — "Группа A". */
  title: string;
  /**
   * Turns every played cell into a link to that match. The console passes the
   * protocol's URL, so a referee corrects a result by pointing at the cell
   * that is wrong rather than by finding the pairing in a list. The public
   * board passes nothing and the cells stay plain.
   */
  hrefOf?: (matchId: string) => string;
}) {
  if (table.teams.length === 0) {
    return <p className="text-sm text-muted">{t("emptyGroup")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="tile overflow-x-auto p-2">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <caption className="sr-only">{title}</caption>

          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 bg-surface-raised px-2 py-2 text-left text-2xs font-bold uppercase tracking-wider text-subtle"
              >
                {title}
              </th>

              {table.teams.map((team) => (
                <th key={team.id} scope="col" className="p-0">
                  <span className="tabular flex min-w-16 items-center justify-center rounded-md bg-brand-strong px-2 py-2 text-2xs font-bold text-on-brand">
                    {team.code}
                  </span>
                </th>
              ))}

              <Corner>{t("colWon")}</Corner>
              <Corner>{t("colDrawn")}</Corner>
              <Corner>{t("colLost")}</Corner>
              <Corner>{t("colPoints")}</Corner>
              <Corner>{t("colPos")}</Corner>
            </tr>
          </thead>

          <tbody>
            {table.rows.map((row) => (
              <tr key={row.team.id}>
                <th scope="row" className="sticky left-0 z-10 bg-surface-raised p-0 text-left">
                  <span className="flex items-center gap-2 rounded-md bg-(--d-accent-soft) px-2 py-2">
                    <span className="tabular shrink-0 font-display text-xs font-extrabold text-(--d-accent)">
                      {row.team.code}
                    </span>
                    <span className="max-w-40 truncate font-semibold">{row.team.name}</span>
                  </span>
                </th>

                {row.cells.map((cell, index) => (
                  <td key={index} className="p-0">
                    <Cell cell={cell} t={t} hrefOf={hrefOf} />
                  </td>
                ))}

                <td className="p-0">
                  <Chip value={row.won} tone="win" />
                </td>
                <td className="p-0">
                  <Chip value={row.drawn} tone="draw" />
                </td>
                <td className="p-0">
                  <Chip value={row.lost} tone="loss" />
                </td>
                <td className="p-0">
                  <span className="tabular flex min-w-11 items-center justify-center rounded-md border-2 border-line-strong px-2 py-2 font-display font-extrabold">
                    {row.points}
                  </span>
                </td>
                <td className="p-0">
                  <span className="tabular flex min-w-11 items-center justify-center px-2 py-2 text-subtle">
                    {row.played > 0 ? row.rank : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.qualified.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-success">{t("qualified")}</span>
          {table.qualified.map((team, index) => (
            <span
              key={team.id}
              className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success-surface px-3 py-1"
            >
              <span className="tabular text-xs font-bold text-success">{index + 1}</span>
              <span className="font-semibold">{team.name}</span>
              <span className="tabular text-xs text-subtle">{team.code}</span>
            </span>
          ))}
        </p>
      )}

      <p className="text-xs text-subtle">{t("crossLegend")}</p>
    </div>
  );
}

function Corner({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-2 py-2 text-center text-2xs font-bold uppercase tracking-wider text-subtle"
    >
      {children}
    </th>
  );
}

/**
 * One cell of the matrix. A played pairing carries its match number above the
 * score, tinted by what the ROW team got out of it, so a row reads as a run of
 * results without cross-referencing the header.
 */
function Cell({
  cell,
  t,
  hrefOf,
}: {
  cell: CrossCell;
  t: Translator;
  hrefOf?: (matchId: string) => string;
}) {
  if (cell.kind === "self") {
    return (
      <span
        aria-hidden="true"
        className="flex min-w-16 items-center justify-center rounded-md bg-surface-sunken py-5"
      />
    );
  }

  if (cell.kind === "none") {
    return (
      <span className="flex min-w-16 items-center justify-center rounded-md bg-surface-muted py-5 text-subtle">
        ·
      </span>
    );
  }

  const tone =
    cell.outcome === "win"
      ? "border-success/40 bg-success-surface"
      : cell.outcome === "loss"
        ? "border-danger/40 bg-danger-surface"
        : cell.outcome === "draw"
          ? "border-warning/40 bg-warning-surface"
          : "border-line bg-surface";

  const body = (
    <>
      <span className="text-2xs font-bold uppercase tracking-wider text-subtle">
        {cell.number}
      </span>
      <span className="tabular whitespace-nowrap font-display text-sm font-extrabold">
        {cell.outcome === "pending" ? t("notPlayed") : `${cell.scored} : ${cell.conceded}`}
      </span>
    </>
  );

  const shape = `flex min-w-16 flex-col items-center gap-0.5 rounded-md border-2 px-1.5 py-1.5 ${tone}`;
  const href = hrefOf?.(cell.matchId);

  return href ? (
    <a href={href} className={shape}>
      {body}
    </a>
  ) : (
    <span className={shape}>{body}</span>
  );
}

/** Wins, draws and losses as three coloured counters, as on the board. */
function Chip({ value, tone }: { value: number; tone: "win" | "draw" | "loss" }) {
  const skin =
    tone === "win"
      ? "bg-success-surface text-success"
      : tone === "draw"
        ? "bg-warning-surface text-warning"
        : "bg-danger-surface text-danger";

  return (
    <span
      className={`tabular flex min-w-9 items-center justify-center rounded-md px-2 py-2 font-bold ${skin}`}
    >
      {value}
    </span>
  );
}
