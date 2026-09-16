import Link from "next/link";
import { CSRF_FIELD } from "@/lib/security/constants";
import { saveMatchRowAction } from "@/app/judge/actions";
import { StateBadge } from "./JudgeShell";
import type { ScoringMatchRow, ScoringTeamRow } from "@/lib/db/schema";

/**
 * The match table, editable in place.
 *
 * This is the console's main working surface: the same numbered rows the
 * public board shows — M1, M2, M3 — with the two scores and the outcome as
 * fields on the row itself. A referee working a group of sixteen files
 * twenty-one results down a list instead of opening and closing twenty-one
 * protocols, which is the difference between keeping up with a ring and
 * falling behind it.
 *
 * Every row is its own `<form>` posting to its own server action, so:
 *
 *  · Saving one row cannot touch another. Two referees on the same class,
 *    each filing a different pairing, never overwrite each other — the only
 *    fields that move are the three in the row that was submitted.
 *  · It works without JavaScript. A form post is a form post, which matters
 *    on a venue network shared by several hundred phones.
 *
 * Rows are a list rather than a `<table>` on purpose: a form cannot span
 * table cells without the `form=""` attribute trick, and the columns here
 * have to collapse into a stack on a phone anyway. The header row is decoration
 * for wide screens; every field carries its own label for a screen reader.
 *
 * Cards, notes and the live/scheduled state stay on the full protocol, one tap
 * away. This row deliberately does not show them — see saveMatchRowAction for
 * why a form must never silently rewrite the fields it does not display.
 */
export function MatchGrid({
  categoryId,
  classId,
  matches,
  numbers,
  teams,
  classTeams,
  csrfToken,
}: {
  categoryId: string;
  classId: string;
  /** The class's active roster — the choices when a corner is reassigned. */
  classTeams: ScoringTeamRow[];
  matches: ScoringMatchRow[];
  /** `matchId` → `M3`, from lib/scoring/table.ts. */
  numbers: Map<string, string>;
  /** Every team the block can name, archived ones included. */
  teams: Map<string, ScoringTeamRow>;
  csrfToken: string;
}) {
  if (matches.length === 0) {
    return <p className="text-sm text-muted">Матчей в этом блоке пока нет.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      <li
        aria-hidden="true"
        className="hidden items-center gap-3 px-4 text-2xs font-bold uppercase tracking-wider text-subtle sm:grid sm:grid-cols-[3.5rem_1fr_7rem_1fr_9rem_5rem]"
      >
        <span>Матч</span>
        <span>Красный</span>
        <span className="text-center">Счёт</span>
        <span>Синий</span>
        <span>Итог</span>
        <span />
      </li>

      {matches.map((match) => (
        <li key={match.id}>
          <Row
            match={match}
            number={numbers.get(match.id) ?? "—"}
            source={(id: string | null) =>
              id === null ? null : (numbers.get(id) ?? null)
            }
            teams={teams}
            classTeams={classTeams}
            categoryId={categoryId}
            classId={classId}
            csrfToken={csrfToken}
          />
        </li>
      ))}
    </ul>
  );
}

function Row({
  match,
  number,
  source,
  teams,
  classTeams,
  categoryId,
  classId,
  csrfToken,
}: {
  match: ScoringMatchRow;
  number: string;
  source: (id: string | null) => string | null;
  teams: Map<string, ScoringTeamRow>;
  classTeams: ScoringTeamRow[];
  categoryId: string;
  classId: string;
  csrfToken: string;
}) {
  const red = match.redTeamId ? teams.get(match.redTeamId) : undefined;
  const blue = match.blueTeamId ? teams.get(match.blueTeamId) : undefined;

  const outcome = !match.winnerTeamId
    ? match.isDraw
      ? "draw"
      : "open"
    : match.winnerTeamId === match.redTeamId
      ? "red"
      : "blue";

  return (
    <form
      action={saveMatchRowAction}
      className="grid items-center gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-[3.5rem_1fr_7rem_1fr_9rem_5rem] sm:px-4 sm:py-3"
    >
      <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="id" value={match.id} />

      <div className="flex items-center gap-2">
        <span className="tabular inline-flex min-w-11 items-center justify-center rounded-md border border-line-strong bg-surface-muted px-2 py-1 text-xs font-bold">
          {number}
        </span>
        <span className="sm:hidden">
          <StateBadge state={match.state} />
        </span>
      </div>

      {/* A corner the judge filled by hand can be reassigned right here; a
          corner fed by an earlier match belongs to that match's winner and
          stays read-only. */}
      {match.redFromMatchId ? (
        <Slot
          team={red}
          source={source(match.redFromMatchId)}
          winner={match.winnerTeamId !== null && match.winnerTeamId === match.redTeamId}
        />
      ) : (
        <TeamSelect
          name="redTeamId"
          current={match.redTeamId}
          roster={classTeams}
          teams={teams}
          label={`Красный угол, матч ${number}`}
        />
      )}

      <div className="flex items-center justify-center gap-2">
        <input
          type="number"
          name="redScore"
          defaultValue={match.redScore}
          aria-label={`Счёт: ${red?.name ?? "красный угол"}`}
          className={SCORE}
        />
        <span aria-hidden="true" className="text-subtle">
          :
        </span>
        <input
          type="number"
          name="blueScore"
          defaultValue={match.blueScore}
          aria-label={`Счёт: ${blue?.name ?? "синий угол"}`}
          className={SCORE}
        />
      </div>

      {match.blueFromMatchId ? (
        <Slot
          team={blue}
          source={source(match.blueFromMatchId)}
          winner={match.winnerTeamId !== null && match.winnerTeamId === match.blueTeamId}
        />
      ) : (
        <TeamSelect
          name="blueTeamId"
          current={match.blueTeamId}
          roster={classTeams}
          teams={teams}
          label={`Синий угол, матч ${number}`}
        />
      )}

      <select
        name="outcome"
        defaultValue={outcome}
        aria-label={`Итог матча ${number}`}
        className="h-11 w-full rounded-md border border-line-strong bg-surface px-2 text-sm"
      >
        <option value="open">Не завершён</option>
        <option value="red" disabled={!red}>
          Победа: красный
        </option>
        <option value="blue" disabled={!blue}>
          Победа: синий
        </option>
        <option value="draw">Ничья</option>
      </select>

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-brand-strong px-4 text-sm font-semibold text-on-brand sm:flex-none"
        >
          Записать
        </button>
        <Link
          href={`/judge/${categoryId}/match/${match.id}`}
          className="shrink-0 text-xs font-medium text-muted underline underline-offset-2"
        >
          Протокол
        </Link>
      </div>
    </form>
  );
}

/**
 * A corner as a choice of team. The current team is always offered, even if it
 * has since been withdrawn — otherwise opening the row would silently swap a
 * played match onto whoever happens to be first in the list.
 */
function TeamSelect({
  name,
  current,
  roster,
  teams,
  label,
}: {
  name: string;
  current: string | null;
  roster: ScoringTeamRow[];
  teams: Map<string, ScoringTeamRow>;
  label: string;
}) {
  const options = [...roster];
  const currentTeam = current ? teams.get(current) : undefined;
  if (currentTeam && !options.some((team) => team.id === currentTeam.id)) {
    options.unshift(currentTeam);
  }

  return (
    <select
      name={name}
      defaultValue={current ?? ""}
      aria-label={label}
      className="h-11 w-full min-w-0 rounded-md border border-line-strong bg-surface px-2 text-sm font-semibold"
    >
      {!current && <option value="">TBD</option>}
      {options.map((team) => (
        <option key={team.id} value={team.id}>
          {team.code} · {team.name}
        </option>
      ))}
    </select>
  );
}

/**
 * One corner of a pairing. An empty bracket slot shows where its team will
 * come from rather than a dash, so a referee reading ahead knows which match
 * has to finish before this one can be called.
 */
function Slot({
  team,
  source,
  winner,
}: {
  team: ScoringTeamRow | undefined;
  source: string | null;
  winner: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className={winner ? "truncate font-bold" : "truncate"}>
        {team ? (
          <>
            <span className="tabular mr-2 text-xs font-bold text-brand">{team.code}</span>
            {team.name}
          </>
        ) : (
          <span className="text-subtle">TBD</span>
        )}
      </span>
      {source && (
        <span className="text-2xs text-subtle">победитель {source}</span>
      )}
    </div>
  );
}

const SCORE =
  "tabular h-11 w-14 rounded-md border border-line-strong bg-surface text-center text-base font-bold";
