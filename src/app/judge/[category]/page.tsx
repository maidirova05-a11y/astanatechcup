import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { requireScoringSession } from "../auth";
import {
  JudgeShell,
  Card,
  Flash,
  StateBadge,
  STATE_LABELS,
} from "@/components/judge/JudgeShell";
import { CSRF_FIELD, CSRF_HEADER } from "@/lib/security/csrf";
import { getCategory, type CategoryClass } from "@/config/categories";
import { getCategorySnapshot } from "@/lib/scoring/store";
import { formatClock } from "@/lib/scoring/format";
import {
  archiveTeamAction,
  createMatchAction,
  createTeamAction,
  deleteMatchAction,
} from "../actions";
import { REGIONS } from "@/config/regions";
import type { ScoringMatchRow, ScoringRunRow, ScoringTeamRow } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * One category, one class at a time.
 *
 * The class filter is a query parameter rather than a client-side toggle
 * because that is how the day actually runs — a referee is assigned to Mini
 * Sumo for the morning, not to "sumo in general" — and because a URL you can
 * bookmark survives a phone locking itself between bouts.
 */
export default async function JudgeCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ class?: string; saved?: string; error?: string }>;
}) {
  const session = await requireScoringSession();
  const { category: categoryId } = await params;
  const query = await searchParams;

  const category = getCategory(categoryId);
  if (!category) notFound();

  const t = await getTranslations({ locale: "ru", namespace: "categories" });
  // Region names are already translated for the public form; the console reads
  // the Russian column rather than keeping a second list of oblasts.
  const tr = await getTranslations({ locale: "ru", namespace: "regions" });
  const headerList = await headers();
  const csrfToken = headerList.get(CSRF_HEADER) ?? "";

  const selectedClass =
    category.classes.find((cls) => cls.id === query.class) ?? category.classes[0];

  const snapshot = await getCategorySnapshot(categoryId);
  const teams = snapshot.teams.filter((team) => team.classId === selectedClass.id);
  const matches = snapshot.matches.filter((m) => m.classId === selectedClass.id);
  const runs = snapshot.runs.filter((r) => r.classId === selectedClass.id);

  const nameOf = (id: string) =>
    snapshot.teams.find((team) => team.id === id)?.name ??
    snapshot.archived.get(id)?.name ??
    "—";
  const codeOf = (id: string) =>
    snapshot.teams.find((team) => team.id === id)?.code ??
    snapshot.archived.get(id)?.code ??
    "?";

  return (
    <JudgeShell
      role={session.role}
      title={t(`items.${categoryId}.name`)}
      subtitle={`${selectedClass.label} · ${plural(teams.length, "команда", "команды", "команд")}`}
      back={{ href: "/judge", label: "Все категории" }}
    >
      <Flash saved={query.saved} error={query.error} />

      {category.classes.length > 1 && (
        <nav aria-label="Классы" className="mb-6">
          <ul className="flex flex-wrap gap-2">
            {category.classes.map((cls) => (
              <li key={cls.id}>
                <Link
                  href={`/judge/${categoryId}?class=${cls.id}`}
                  aria-current={cls.id === selectedClass.id ? "page" : undefined}
                  className={
                    cls.id === selectedClass.id
                      ? "inline-flex min-h-11 items-center rounded-full bg-brand-strong px-4 text-sm font-semibold text-on-brand"
                      : "inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-muted"
                  }
                >
                  {cls.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="flex flex-col gap-6">
        {category.scoring.kind === "match" ? (
          <MatchesPanel
            categoryId={categoryId}
            cls={selectedClass}
            teams={teams}
            matches={matches}
            csrfToken={csrfToken}
            nameOf={nameOf}
            codeOf={codeOf}
          />
        ) : (
          <RunsPanel
            categoryId={categoryId}
            cls={selectedClass}
            teams={teams}
            runs={runs}
            rounds={category.scoring.rounds}
            metric={category.scoring.metric}
          />
        )}

        <TeamsPanel
          categoryId={categoryId}
          cls={selectedClass}
          teams={teams}
          csrfToken={csrfToken}
          regionLabel={(region) => tr(region)}
        />
      </div>
    </JudgeShell>
  );
}

/* ── Matches ────────────────────────────────────────────────────────────── */

function MatchesPanel({
  categoryId,
  cls,
  teams,
  matches,
  csrfToken,
  nameOf,
  codeOf,
}: {
  categoryId: string;
  cls: CategoryClass;
  teams: ScoringTeamRow[];
  matches: ScoringMatchRow[];
  csrfToken: string;
  nameOf: (id: string) => string;
  codeOf: (id: string) => string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl">Матчи</h2>
        <span className="text-sm text-subtle">{matches.length}</span>
      </div>

      {teams.length < 2 ? (
        <Card>
          <p className="text-sm text-muted">
            Чтобы создать матч, заведите как минимум две команды в классе{" "}
            {cls.label}.
          </p>
        </Card>
      ) : (
        <details className="rounded-lg border border-line bg-surface">
          <summary className="cursor-pointer list-none px-5 py-4 font-semibold">
            + Новый матч
          </summary>
          <form
            action={createMatchAction}
            className="flex flex-col gap-4 border-t border-line p-5"
          >
            <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
            <input type="hidden" name="categoryId" value={categoryId} />
            <input type="hidden" name="classId" value={cls.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Красный угол">
                <select name="redTeamId" required className={SELECT}>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.code} · {team.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Синий угол">
                <select name="blueTeamId" required className={SELECT}>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.code} · {team.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Этап">
                <select name="stage" className={SELECT} defaultValue="group">
                  <option value="group">Групповой</option>
                  <option value="playoff">Плей-офф</option>
                  <option value="final">Финал</option>
                </select>
              </Field>

              <Field label="Группа" hint="Буква, если есть">
                <input name="groupLabel" maxLength={8} className={INPUT} />
              </Field>

              <Field label="Тур или стадия" hint="Например «Тур 3» или «1/4»">
                <input name="roundLabel" maxLength={40} className={INPUT} />
              </Field>
            </div>

            <button type="submit" className={PRIMARY_BUTTON}>
              Создать протокол
            </button>
          </form>
        </details>
      )}

      {matches.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Матчей в этом классе пока нет.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {matches.map((match) => (
            <li key={match.id}>
              <div className="rounded-lg border border-line bg-surface">
                <Link
                  href={`/judge/${categoryId}/match/${match.id}`}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate font-semibold">
                      {codeOf(match.redTeamId)} {nameOf(match.redTeamId)}
                      <span className="mx-2 text-subtle">—</span>
                      {codeOf(match.blueTeamId)} {nameOf(match.blueTeamId)}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-subtle">
                      <StateBadge state={match.state} />
                      {match.roundLabel && <span>{match.roundLabel}</span>}
                      {match.groupLabel && <span>Группа {match.groupLabel}</span>}
                    </span>
                  </div>
                  <span className="tabular shrink-0 font-display text-2xl font-extrabold">
                    {match.redScore}:{match.blueScore}
                  </span>
                </Link>

                {/* Only a match nobody has scored yet can be removed; a filed
                    sheet is corrected, never deleted. */}
                {match.state === "scheduled" && (
                  <form
                    action={deleteMatchAction}
                    className="border-t border-line px-4 py-2"
                  >
                    <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
                    <input type="hidden" name="categoryId" value={categoryId} />
                    <input type="hidden" name="id" value={match.id} />
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center text-xs font-medium text-muted hover:text-danger"
                    >
                      Удалить незаполненный протокол
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── Runs ───────────────────────────────────────────────────────────────── */

function RunsPanel({
  categoryId,
  cls,
  teams,
  runs,
  rounds,
  metric,
}: {
  categoryId: string;
  cls: CategoryClass;
  teams: ScoringTeamRow[];
  runs: ScoringRunRow[];
  rounds: number;
  metric: "time" | "points";
}) {
  const byTeam = new Map<string, ScoringRunRow[]>();
  for (const run of runs) {
    const list = byTeam.get(run.teamId);
    if (list) list.push(run);
    else byTeam.set(run.teamId, [run]);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl">Заезды</h2>
        <span className="text-sm text-subtle">
          {runs.length} из {teams.length * rounds}
        </span>
      </div>

      {teams.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Заведите команды класса {cls.label}, чтобы вносить попытки.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {teams.map((team) => {
            const teamRuns = byTeam.get(team.id) ?? [];
            return (
              <li key={team.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="tabular font-display text-lg font-extrabold text-brand">
                    {team.code}
                  </span>
                  <span className="font-semibold">{team.name}</span>
                  {team.organization && (
                    <span className="text-xs text-subtle">{team.organization}</span>
                  )}
                </div>

                {/* One tap per attempt. Big targets, because this is the
                    control a referee uses most and they are wearing gloves. */}
                <ul className="mt-3 flex flex-wrap gap-2">
                  {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => {
                    const run = teamRuns.find((r) => r.roundNumber === round);
                    return (
                      <li key={round}>
                        <Link
                          href={`/judge/${categoryId}/run/${team.id}/${round}`}
                          className={
                            run
                              ? "inline-flex min-h-11 flex-col justify-center rounded-md border border-line-strong bg-surface-muted px-3 py-1.5"
                              : "inline-flex min-h-11 items-center rounded-md border border-dashed border-line-strong px-3 py-1.5 text-sm text-muted"
                          }
                        >
                          <span className="text-2xs uppercase tracking-wider text-subtle">
                            Попытка {round}
                          </span>
                          {run ? (
                            <span className="tabular text-sm font-bold">
                              {run.state !== "ok"
                                ? STATE_LABELS[run.state]
                                : metric === "time"
                                  ? formatClock(run.timeMs ?? 0)
                                  : `${run.points ?? 0} очк.`}
                            </span>
                          ) : (
                            <span className="text-sm">внести</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ── Teams ──────────────────────────────────────────────────────────────── */

function TeamsPanel({
  categoryId,
  cls,
  teams,
  csrfToken,
  regionLabel,
}: {
  categoryId: string;
  cls: CategoryClass;
  teams: ScoringTeamRow[];
  csrfToken: string;
  regionLabel: (region: string) => string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl">Команды</h2>
        <span className="text-sm text-subtle">{teams.length}</span>
      </div>

      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer list-none px-5 py-4 font-semibold">
          + Добавить команду
        </summary>
        <form
          action={createTeamAction}
          className="flex flex-col gap-4 border-t border-line p-5"
        >
          <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
          <input type="hidden" name="categoryId" value={categoryId} />
          <input type="hidden" name="classId" value={cls.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Стартовый номер" hint="Как объявляют на площадке">
              <input
                name="code"
                required
                maxLength={16}
                inputMode="numeric"
                className={INPUT}
              />
            </Field>

            <Field label="Название команды">
              <input name="name" required minLength={2} maxLength={120} className={INPUT} />
            </Field>

            <Field label="Организация" hint="Школа, клуб, вуз">
              <input name="organization" maxLength={200} className={INPUT} />
            </Field>

            <Field label="Регион">
              <select name="region" className={SELECT} defaultValue="">
                <option value="">Не указан</option>
                {REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {regionLabel(region)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Группа" hint="Буква для кругового этапа">
              <input name="groupLabel" maxLength={8} className={INPUT} />
            </Field>
          </div>

          <button type="submit" className={PRIMARY_BUTTON}>
            Добавить
          </button>
        </form>
      </details>

      {teams.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            В классе {cls.label} ещё нет команд.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {teams.map((team) => (
            <li
              key={team.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3"
            >
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
                <span className="tabular font-display font-extrabold text-brand">
                  {team.code}
                </span>
                <span className="truncate font-semibold">{team.name}</span>
                {team.groupLabel && (
                  <span className="text-xs text-subtle">гр. {team.groupLabel}</span>
                )}
              </div>

              <form action={archiveTeamAction}>
                <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
                <input type="hidden" name="categoryId" value={categoryId} />
                <input type="hidden" name="id" value={team.id} />
                <button
                  type="submit"
                  className="inline-flex min-h-11 shrink-0 items-center text-xs font-medium text-muted hover:text-danger"
                >
                  Снять
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Russian plural agreement.
 *
 * Hard-coded rather than pulled through next-intl: this screen is Russian-only
 * by design, and "1 команд" on the header of a referee's screen looks like the
 * work of people who did not check.
 */
function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${n} ${many}`;
  if (mod10 === 1) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

/* ── Form primitives ────────────────────────────────────────────────────── */

const INPUT =
  "h-12 w-full rounded-md border border-line-strong bg-surface px-3 text-base focus:border-brand";
const SELECT = INPUT;
const PRIMARY_BUTTON =
  "inline-flex min-h-13 items-center justify-center rounded-full bg-brand-strong px-6 text-base font-semibold text-on-brand hover:bg-brand";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="text-xs text-subtle">{hint}</span>}
    </label>
  );
}
