import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { requireScoringSession } from "../auth";
import { JudgeShell, Card, Flash } from "@/components/judge/JudgeShell";
import { CSRF_FIELD, CSRF_HEADER } from "@/lib/security/csrf";
import { getCategory, type Category, type CategoryClass } from "@/config/categories";
import { getCategorySnapshot } from "@/lib/scoring/store";
import { buildStandings } from "@/lib/scoring/standings";
import { seedFromGroupStandings } from "@/lib/scoring/bracket";
import { BracketSeedEditor, type SeedRow } from "@/components/judge/BracketSeedEditor";
import { MatchGrid } from "@/components/judge/MatchGrid";
import { RunGrid } from "@/components/judge/RunGrid";
import { TeamGrid } from "@/components/judge/TeamGrid";
import { CrossTable } from "@/components/sections/CrossTable";
import type { Translator } from "@/components/sections/ResultTables";
import { buildCrossTable, compareByCreation, numberMatches } from "@/lib/scoring/table";
import {
  createMatchAction,
  createTeamAction,
  createTeamsBulkAction,
  deleteMatchAction,
  generateBracketAction,
  generateRoundRobinAction,
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
  // The console shows the SAME cross-table the public board does, so a referee
  // and a spectator are looking at one artefact rather than two renderings of
  // it. Its column headings come from the public catalogue.
  const tres = await getTranslations({ locale: "ru", namespace: "results" });
  const headerList = await headers();
  const csrfToken = headerList.get(CSRF_HEADER) ?? "";

  const selectedClass =
    category.classes.find((cls) => cls.id === query.class) ?? category.classes[0];

  const snapshot = await getCategorySnapshot(categoryId);
  const teams = snapshot.teams.filter((team) => team.classId === selectedClass.id);
  const matches = snapshot.matches.filter((m) => m.classId === selectedClass.id);
  const runs = snapshot.runs.filter((r) => r.classId === selectedClass.id);

  // Every team a match in this class can name, withdrawn ones included: a
  // played match still has to show who played it after a team goes home.
  const teamsById = new Map(
    [...snapshot.teams, ...snapshot.archived.values()].map((team) => [team.id, team]),
  );

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
            category={category}
            categoryId={categoryId}
            cls={selectedClass}
            teams={teams}
            matches={matches}
            csrfToken={csrfToken}
            teamsById={teamsById}
            t={tres}
          />
        ) : (
          <RunsPanel
            category={category}
            cls={selectedClass}
            teams={teams}
            runs={runs}
            csrfToken={csrfToken}
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
  category,
  categoryId,
  cls,
  teams,
  matches,
  csrfToken,
  teamsById,
  t,
}: {
  category: Category;
  categoryId: string;
  cls: CategoryClass;
  teams: ScoringTeamRow[];
  matches: ScoringMatchRow[];
  csrfToken: string;
  teamsById: Map<string, ScoringTeamRow>;
  t: Translator;
}) {
  const numbers = numberMatches(matches);
  const blocks = splitIntoBlocks(matches);
  const scheduled = matches.filter((match) => match.state === "scheduled");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl">Матчи</h2>
        <span className="text-sm text-subtle">{matches.length}</span>
      </div>

      <BracketGenerators
        category={category}
        categoryId={categoryId}
        cls={cls}
        teams={teams}
        matches={matches}
        csrfToken={csrfToken}
      />

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
        <div className="flex flex-col gap-6">
          {blocks.map((block) => (
            <section key={block.key} className="flex flex-col gap-3">
              <h3 className="text-base font-bold">{block.title}</h3>

              {/* The group's ladder, with every filled cell linking to the
                  protocol behind it: a referee who spots a wrong score points
                  at the cell rather than hunting for the pairing in a list.
                  The rows below it are for entering results; this is for
                  finding the one that needs fixing. */}
              {block.group !== null && (
                <CrossTable
                  table={buildCrossTable(
                    teams.filter((team) => team.groupLabel === block.group!.label),
                    block.matches,
                    category,
                    numbers,
                    block.group.label,
                  )}
                  t={t}
                  title={block.title}
                  hrefOf={(matchId) => `/judge/${categoryId}/match/${matchId}`}
                />
              )}

              <MatchGrid
                categoryId={categoryId}
                classId={cls.id}
                matches={block.matches}
                numbers={numbers}
                teams={teamsById}
                classTeams={teams}
                csrfToken={csrfToken}
              />
            </section>
          ))}

          {/* A filed sheet is corrected, never deleted — only a protocol
              nobody has scored can be removed, and that is exactly what has
              to be possible before a bracket can be rebuilt. Tucked away
              because it is a rare action next to a screen full of common
              ones. */}
          {scheduled.length > 0 && (
            <details className="rounded-lg border border-line bg-surface">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold">
                Удалить незаполненные протоколы ({scheduled.length})
              </summary>
              <ul className="flex flex-col gap-2 border-t border-line p-5">
                {scheduled.map((match) => (
                  <li key={match.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm">
                      <span className="tabular mr-2 font-bold">
                        {numbers.get(match.id) ?? "—"}
                      </span>
                      {teamsById.get(match.redTeamId ?? "")?.name ?? "TBD"}
                      <span className="mx-2 text-subtle">—</span>
                      {teamsById.get(match.blueTeamId ?? "")?.name ?? "TBD"}
                    </span>
                    <form action={deleteMatchAction} className="shrink-0">
                      <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
                      <input type="hidden" name="categoryId" value={categoryId} />
                      <input type="hidden" name="classId" value={cls.id} />
                      <input type="hidden" name="id" value={match.id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-11 items-center text-xs font-medium text-muted hover:text-danger"
                      >
                        Удалить
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Matches, split into the blocks they are numbered in: one per group, then
 * the whole elimination bracket.
 *
 * Same split as lib/scoring/table.ts uses for numbering, and in the same
 * order, so "M7" on this screen is "M7" on the public board.
 */
type Block = {
  key: string;
  title: string;
  matches: ScoringMatchRow[];
  /** Null for the playoff block; a round robin has a ladder, a bracket has not. */
  group: { label: string | null } | null;
};

function splitIntoBlocks(matches: ScoringMatchRow[]): Block[] {
  const groupLabels = [
    ...new Set(matches.filter((m) => m.stage === "group").map((m) => m.groupLabel)),
  ].sort((a, b) => (a ?? "").localeCompare(b ?? ""));

  const blocks: Block[] = groupLabels.map((label) => ({
    key: `group:${label ?? ""}`,
    title: label ? `Группа ${label}` : "Групповой этап",
    matches: matches
      .filter((m) => m.stage === "group" && m.groupLabel === label)
      .sort(compareByCreation),
    group: { label },
  }));

  const bracket = matches.filter((m) => m.stage !== "group").sort(compareByCreation);
  if (bracket.length > 0) {
    blocks.push({ key: "bracket", title: "Плей-офф", matches: bracket, group: null });
  }

  return blocks;
}

/**
 * The two "build it for me" buttons: a round robin per group, and the
 * playoff bracket for the whole class. Both create every match in one
 * action instead of a judge picking red/blue from a dropdown match by match.
 */
function BracketGenerators({
  category,
  categoryId,
  cls,
  teams,
  matches,
  csrfToken,
}: {
  category: Category;
  categoryId: string;
  cls: CategoryClass;
  teams: ScoringTeamRow[];
  matches: ScoringMatchRow[];
  csrfToken: string;
}) {
  const groupLabels = [...new Set(teams.map((t) => t.groupLabel).filter((g): g is string => !!g))].sort();
  const groupsWithMatches = new Set(
    matches.filter((m) => m.stage === "group" && m.groupLabel).map((m) => m.groupLabel),
  );
  const hasPlayoffMatches = matches.some((m) => m.stage === "playoff" || m.stage === "final");

  // Default seed order: standings if the group stage has results, otherwise
  // the roster as entered (already sorted by start number).
  const groupMatches = matches.filter((m) => m.stage === "group");
  const standingsByGroup = groupLabels
    .map((label) =>
      buildStandings(
        teams.filter((t) => t.groupLabel === label),
        groupMatches.filter((m) => m.groupLabel === label),
        category,
      ),
    )
    .filter((rows) => rows.some((r) => r.played > 0));

  // Standings only rank the teams whose group has at least one played match.
  // A team whose group has not started yet — or has no group at all — must
  // still appear in the seed list; it goes to the end, in roster order,
  // rather than vanishing from the bracket entirely.
  const rankedIds = seedFromGroupStandings(
    standingsByGroup.map((rows) => rows.map((r) => ({ teamId: r.team.id, points: r.points }))),
  );
  const rankedSet = new Set(rankedIds);
  const seedOrder = [...rankedIds, ...teams.filter((t) => !rankedSet.has(t.id)).map((t) => t.id)];

  const defaultSeed: SeedRow[] = seedOrder.map((teamId) => {
    const team = teams.find((t) => t.id === teamId)!;
    return { teamId, label: `${team.code} · ${team.name}` };
  });

  return (
    <div className="flex flex-col gap-3">
      {groupLabels.length > 0 && (
        <details className="rounded-lg border border-line bg-surface">
          <summary className="cursor-pointer list-none px-5 py-4 font-semibold">
            Сформировать круговой этап
          </summary>
          <div className="flex flex-col gap-3 border-t border-line p-5">
            <p className="text-sm text-muted">
              Каждая группа играет по кругу: все команды группы встречаются друг
              с другом по одному разу. Матчи создаются сразу все.
            </p>
            <div className="flex flex-wrap gap-2">
              {groupLabels.map((label) => {
                const count = teams.filter((t) => t.groupLabel === label).length;
                const already = groupsWithMatches.has(label);
                return (
                  <form key={label} action={generateRoundRobinAction}>
                    <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
                    <input type="hidden" name="categoryId" value={categoryId} />
                    <input type="hidden" name="classId" value={cls.id} />
                    <input type="hidden" name="groupLabel" value={label} />
                    <button
                      type="submit"
                      disabled={count < 2 || already}
                      className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-4 text-sm font-semibold disabled:opacity-40"
                    >
                      {already
                        ? `Группа ${label} — уже сформирована`
                        : `Группа ${label} · ${count} ${count === 1 ? "команда" : "команды"}`}
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        </details>
      )}

      {teams.length >= 2 && !hasPlayoffMatches && (
        <details className="rounded-lg border border-line bg-surface">
          <summary className="cursor-pointer list-none px-5 py-4 font-semibold">
            Сформировать сетку плей-офф
          </summary>
          <form
            action={generateBracketAction}
            className="flex flex-col gap-4 border-t border-line p-5"
          >
            <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
            <input type="hidden" name="categoryId" value={categoryId} />
            <input type="hidden" name="classId" value={cls.id} />

            <p className="text-sm text-muted">
              Вся сетка создаётся сразу, по стандартной посевной раскладке
              (1-й номер играет с последним, 2-й — с предпоследним и так
              далее), с проходами без пары при нечётном числе команд.{" "}
              {standingsByGroup.length > 0
                ? "Порядок ниже — по итогам групп; поменяйте местами при необходимости."
                : "Порядок ниже — как в списке команд; поменяйте местами при необходимости."}
            </p>

            <BracketSeedEditor initial={defaultSeed} fieldName="seedOrder" />

            <button type="submit" className={PRIMARY_BUTTON}>
              Сформировать сетку
            </button>
          </form>
        </details>
      )}

      {hasPlayoffMatches && (
        <p className="text-xs text-subtle">
          Сетка плей-офф уже сформирована. Чтобы пересобрать её, удалите
          незаполненные протоколы плей-офф ниже.
        </p>
      )}
    </div>
  );
}

/* ── Runs ───────────────────────────────────────────────────────────────── */

function RunsPanel({
  category,
  cls,
  teams,
  runs,
  csrfToken,
}: {
  category: Category;
  cls: CategoryClass;
  teams: ScoringTeamRow[];
  runs: ScoringRunRow[];
  csrfToken: string;
}) {
  const rounds = category.scoring.kind === "run" ? category.scoring.rounds : 0;

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
        <RunGrid
          category={category}
          classId={cls.id}
          teams={teams}
          runs={runs}
          csrfToken={csrfToken}
        />
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

      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer list-none px-5 py-4 font-semibold">
          + Добавить несколько команд сразу
        </summary>
        <form
          action={createTeamsBulkAction}
          className="flex flex-col gap-4 border-t border-line p-5"
        >
          <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
          <input type="hidden" name="categoryId" value={categoryId} />
          <input type="hidden" name="classId" value={cls.id} />

          <Field label="Названия команд" hint="Одно название на строку, до 64 за раз">
            <textarea
              name="namesText"
              required
              rows={6}
              placeholder={"Команда 1\nКоманда 2\nКоманда 3"}
              className={`${INPUT} h-auto py-3 font-normal`}
            />
          </Field>

          <p className="text-xs text-subtle">
            Стартовые номера присваиваются по порядку, следующие свободные.
            Организация, регион и группа ниже — общие для всей группы команд.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Организация" hint="Необязательно">
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
            Добавить всех
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
        <TeamGrid
          categoryId={categoryId}
          classId={cls.id}
          teams={teams}
          csrfToken={csrfToken}
          regionLabel={regionLabel}
        />
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
