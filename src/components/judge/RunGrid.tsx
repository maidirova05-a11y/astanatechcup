import Link from "next/link";
import { CSRF_FIELD } from "@/lib/security/constants";
import { saveRunRowAction } from "@/app/judge/actions";
import { SaveButton } from "./SaveButton";
import { formatClock } from "@/lib/scoring/format";
import { buildLeaderboard } from "@/lib/scoring/standings";
import type { Category } from "@/config/categories";
import type { ScoringRunRow, ScoringTeamRow } from "@/lib/db/schema";

/**
 * The attempts table, editable in place — the same `КОМАНДА | 1 | 2 | 3 | B`
 * shape as the public board, with every attempt cell an input.
 *
 * A referee types what is on the sheet: `31.075`, `1:02.340`, a points total,
 * or `DNF` / `DSQ` / `FOUL`. Clearing a cell deletes that attempt, which is how
 * a result typed into the wrong team's row is undone. B is computed, never
 * typed — it is the same ranking function the public board uses, so the two
 * cannot disagree.
 *
 * It is a real `<table>`, because a results sheet is a table and has to scan
 * like one. A `<form>` cannot wrap a table row, so each row's form lives
 * outside the table and its inputs join it through the `form` attribute —
 * standard HTML, no JavaScript, one row saved at a time so two referees on
 * different teams never overwrite each other.
 *
 * Leap is the exception: its total is the output of an itemised sheet, so its
 * cells are links to that sheet rather than inputs.
 */
export function RunGrid({
  category,
  classId,
  teams,
  runs,
  csrfToken,
}: {
  category: Category;
  classId: string;
  teams: ScoringTeamRow[];
  runs: ScoringRunRow[];
  csrfToken: string;
}) {
  if (category.scoring.kind !== "run") return null;
  const { rounds, metric } = category.scoring;
  const isTime = metric === "time";
  const itemised = category.id === "leap";

  const ordered = [...teams].sort((a, b) =>
    a.code.localeCompare(b.code, "en", { numeric: true }),
  );
  const ranking = new Map(
    buildLeaderboard(ordered, runs, category).map((row) => [row.team.id, row.ranking]),
  );
  const runOf = (teamId: string, round: number) =>
    runs.find((run) => run.teamId === teamId && run.roundNumber === round);

  const shown = (run: ScoringRunRow | undefined) =>
    !run
      ? ""
      : run.state !== "ok"
        ? run.state.toUpperCase()
        : isTime
          ? formatClock(run.timeMs ?? 0)
          : String(run.points ?? 0);

  return (
    <div className="flex flex-col gap-2">
      {/* The row forms. Empty on purpose: their fields live in the table. */}
      {!itemised &&
        ordered.map((team) => (
          <form key={team.id} id={`run-${team.id}`} hidden>
            <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
            <input type="hidden" name="categoryId" value={category.id} />
            <input type="hidden" name="classId" value={classId} />
            <input type="hidden" name="teamId" value={team.id} />
          </form>
        ))}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-muted text-left text-2xs font-bold uppercase tracking-wider text-subtle">
              <th scope="col" className="px-3 py-3">Команда</th>
              {Array.from({ length: rounds }, (_, i) => (
                <th key={i} scope="col" className="px-2 py-3 text-center">
                  {i + 1}
                </th>
              ))}
              <th scope="col" className="px-2 py-3 text-center">B</th>
              <th scope="col" className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {ordered.map((team) => {
              const best = ranking.get(team.id) ?? null;
              return (
                <tr key={team.id} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <span className="tabular mr-2 text-xs font-bold text-brand">{team.code}</span>
                    <span className="font-semibold">{team.name}</span>
                  </th>

                  {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => {
                    const run = runOf(team.id, round);
                    return (
                      <td key={round} className="px-1.5 py-2 text-center">
                        {itemised ? (
                          <Link
                            href={`/judge/${category.id}/run/${team.id}/${round}`}
                            className="tabular inline-flex h-11 min-w-20 items-center justify-center rounded-md border border-dashed border-line-strong px-2 font-bold"
                          >
                            {shown(run) || "внести"}
                          </Link>
                        ) : (
                          <input
                            form={`run-${team.id}`}
                            name={`attempt_${round}`}
                            defaultValue={shown(run)}
                            inputMode={isTime ? "decimal" : "numeric"}
                            autoComplete="off"
                            placeholder="—"
                            aria-label={`${team.name}, попытка ${round}`}
                            className="tabular h-11 w-24 rounded-md border border-line-strong bg-surface text-center font-bold"
                          />
                        )}
                      </td>
                    );
                  })}

                  <td className="tabular px-2 py-2 text-center font-display font-extrabold">
                    {best === null ? "—" : isTime ? formatClock(best) : best}
                  </td>

                  <td className="px-3 py-2 text-right">
                    {!itemised && (
                      <SaveButton action={saveRunRowAction} form={`run-${team.id}`} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-subtle">
        {itemised
          ? "Leap считается по листу заданий — нажмите на попытку, чтобы открыть лист."
          : isTime
            ? "Время: 31.075 или 1:02.340. Не финишировал — DNF, дисквалификация — DSQ, нарушение — FOUL. Очистите клетку, чтобы удалить попытку. B считается сам."
            : "Очки — целым числом. DNF / DSQ / FOUL — для неудачной попытки. Очистите клетку, чтобы удалить попытку. B считается сам."}
      </p>
    </div>
  );
}
