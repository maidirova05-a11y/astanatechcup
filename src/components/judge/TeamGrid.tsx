import { CSRF_FIELD } from "@/lib/security/constants";
import { archiveTeamAction, updateTeamAction } from "@/app/judge/actions";
import { SaveButton } from "./SaveButton";
import { REGIONS } from "@/config/regions";
import type { ScoringTeamRow } from "@/lib/db/schema";

/**
 * The start list, editable in place: every field of every team is an input in
 * its own row, saved with the row's button.
 *
 * This is where a typo is fixed. A misspelt team name, a wrong start number, a
 * team put in the wrong group — correct the cell, press «Записать», and every
 * table that names the team (the cross-table, the bracket, the attempts table,
 * the public board) shows the new value on its next render, because they all
 * read the team by id rather than keeping their own copy of its name.
 *
 * A real `<table>` with row forms joined through the `form` attribute, the same
 * construction as the attempts table: a start list has to scan like a list,
 * and one row saves without touching another.
 */
export function TeamGrid({
  categoryId,
  classId,
  teams,
  csrfToken,
  regionLabel,
}: {
  categoryId: string;
  classId: string;
  teams: ScoringTeamRow[];
  csrfToken: string;
  regionLabel: (region: string) => string;
}) {
  if (teams.length === 0) return null;

  const ordered = [...teams].sort((a, b) =>
    a.code.localeCompare(b.code, "en", { numeric: true }),
  );

  return (
    <div className="flex flex-col gap-2">
      {ordered.map((team) => (
        <form key={team.id} id={`team-${team.id}`} hidden>
          <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
          <input type="hidden" name="categoryId" value={categoryId} />
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="id" value={team.id} />
        </form>
      ))}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-muted text-left text-2xs font-bold uppercase tracking-wider text-subtle">
              <th scope="col" className="px-2 py-3">Номер</th>
              <th scope="col" className="px-2 py-3">Название</th>
              <th scope="col" className="px-2 py-3">Организация</th>
              <th scope="col" className="px-2 py-3">Регион</th>
              <th scope="col" className="px-2 py-3">Группа</th>
              <th scope="col" className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {ordered.map((team) => {
              const form = `team-${team.id}`;
              return (
                <tr key={team.id} className="border-t border-line">
                  <td className="px-2 py-2">
                    <input
                      form={form}
                      name="code"
                      required
                      maxLength={16}
                      defaultValue={team.code}
                      aria-label={`Номер команды ${team.name}`}
                      className={`${CELL} tabular w-24 font-bold`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      form={form}
                      name="name"
                      required
                      minLength={2}
                      maxLength={120}
                      defaultValue={team.name}
                      aria-label={`Название команды ${team.code}`}
                      className={`${CELL} w-48 font-semibold`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      form={form}
                      name="organization"
                      maxLength={200}
                      defaultValue={team.organization ?? ""}
                      aria-label={`Организация команды ${team.code}`}
                      className={`${CELL} w-56`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      form={form}
                      name="region"
                      defaultValue={team.region ?? ""}
                      aria-label={`Регион команды ${team.code}`}
                      className={`${CELL} w-44`}
                    >
                      <option value="">Не указан</option>
                      {REGIONS.map((region) => (
                        <option key={region} value={region}>
                          {regionLabel(region)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      form={form}
                      name="groupLabel"
                      maxLength={8}
                      defaultValue={team.groupLabel ?? ""}
                      aria-label={`Группа команды ${team.code}`}
                      className={`${CELL} tabular w-16 text-center font-bold uppercase`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <span className="flex items-center justify-end gap-3">
                      <SaveButton action={updateTeamAction} form={form} />
                      <form action={archiveTeamAction}>
                        <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
                        <input type="hidden" name="categoryId" value={categoryId} />
                        <input type="hidden" name="classId" value={classId} />
                        <input type="hidden" name="id" value={team.id} />
                        <button
                          type="submit"
                          className="inline-flex h-11 items-center text-xs font-medium text-muted hover:text-danger"
                        >
                          Снять
                        </button>
                      </form>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-subtle">
        Исправьте клетку и нажмите «Записать» — новое название или номер сразу
        появится во всех таблицах и на публичном табло. Смена группы переносит
        команду в другую таблицу группы; уже созданные матчи остаются в прежней.
      </p>
    </div>
  );
}

const CELL = "h-11 rounded-md border border-line-strong bg-surface px-2";
