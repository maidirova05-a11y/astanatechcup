import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { CATEGORY_ROBOTS, type CategoryRobotName } from "@/components/ui/robots";
import { ArrowRight, Info } from "@/components/ui/icons";
import { CATEGORIES, CLASS_CATALOGUE, type CatalogueEntry } from "@/config/categories";
import { RecentMatches, formatStamp } from "./ResultTables";
import type { CategorySnapshot } from "@/lib/scoring/store";
import type { ScoringMatchRow, ScoringTeamRow } from "@/lib/db/schema";

/**
 * The results index: every class of the championship as its own card, the way
 * the international RobotChallenge board lists them.
 *
 * Indexed by CLASS rather than by category because that is the unit everyone
 * at the venue thinks in. Nobody is entered in "sumo"; they are entered in
 * Mini Sumo, they are called to a Mini Sumo ring, and the code on their start
 * list says C13. A card per class is also a card per scoring table, since
 * `(categoryId, classId)` is what the match and run rows are keyed by.
 *
 * Classes that have not started are not hidden. A spectator looking for a
 * class needs to find it and be told it has not begun — a list that silently
 * omits it looks like the class was cancelled.
 */

export type ResultsData = {
  snapshots: Map<string, CategorySnapshot>;
  configured: boolean;
};

export async function ResultsIndex({
  locale,
  data,
}: {
  locale: string;
  data: ResultsData;
}) {
  const t = await getTranslations({ locale, namespace: "results" });
  const tc = await getTranslations({ locale, namespace: "categories" });

  const updatedAt = [...data.snapshots.values()]
    .map((snapshot) => snapshot.updatedAt)
    .filter((value): value is Date => value !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const entries = CLASS_CATALOGUE.map((entry) => ({
    entry,
    state: activityOf(entry, data.snapshots.get(entry.category.id)),
  }));

  const started = entries.filter(({ state }) => state.kind !== "waiting").length;

  return (
    <>
      <Section tone="muted" labelledBy="results-title">
        <SectionHeader
          as="h1"
          eyebrow={t("eyebrow")}
          id="results-title"
          title={t("title")}
          subtitle={t("subtitle")}
        />

        <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span className="tabular font-semibold">
            {updatedAt
              ? t("updated", { time: formatStamp(updatedAt, locale) })
              : t("updatedNever")}
          </span>
          <span>{t("liveNote")}</span>
        </p>

        {!data.configured && (
          <p className="mt-6 flex max-w-2xl items-start gap-3 rounded-lg border border-warning/40 bg-warning-surface p-4 text-sm">
            <Info className="mt-0.5 shrink-0 text-lg" aria-hidden="true" />
            {t("notConfigured")}
          </p>
        )}

        {data.configured && started === 0 && (
          <p className="mt-6 max-w-2xl rounded-lg border border-line bg-surface p-4 text-sm text-muted">
            {t("empty")}
          </p>
        )}
      </Section>

      <Section labelledBy="results-classes">
        <h2 id="results-classes" className="sr-only">
          {t("allClasses")}
        </h2>

        {/* Grouped under their category. Twenty-one cards in one undivided
            grid made a visitor read every title to find "the line follower
            ones"; a heading per category lets the eye jump straight there,
            while the running numbers still match the order of the catalogue. */}
        <div className="flex flex-col gap-10">
          {CATEGORIES.map((category) => {
            const inCategory = entries.filter(({ entry }) => entry.category.id === category.id);
            return (
              <section key={category.id} aria-labelledby={`results-cat-${category.id}`}>
                <h3
                  id={`results-cat-${category.id}`}
                  className="mb-4 flex items-baseline gap-2.5 text-lg"
                >
                  {tc(`items.${category.id}.name`)}
                  <span className="tabular text-sm font-semibold text-muted">
                    {inCategory.length}
                  </span>
                </h3>
                <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                  {inCategory.map(({ entry, state }) => (
                    <li key={`${entry.category.id}:${entry.cls.id}`}>
                      <ClassCard
                        locale={locale}
                        entry={entry}
                        state={state}
                        // The category is already the heading above; the
                        // line under the class name says who may enter it.
                        label={entry.cls.groups.map((group) => tc(`groups.${group}`)).join(" · ")}
                        t={t}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </Section>

      <LatestResults locale={locale} data={data} t={t} />
    </>
  );
}

/* ── One class ──────────────────────────────────────────────────────────── */

function ClassCard({
  locale,
  entry,
  state,
  label,
  t,
}: {
  locale: string;
  entry: CatalogueEntry;
  state: Activity;
  label: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const Mascot = CATEGORY_ROBOTS[entry.category.mascot as CategoryRobotName];

  // Mascot and name side by side rather than stacked. Twenty-one cards with
  // the mascot on a row of its own made the index three screens of tiles on a
  // phone; this is the same card at about half the height. The quiet tile is
  // the one DESIGN.md gives to dense grids.
  return (
    <a
      href={`/${locale}/results/${entry.category.id}?class=${entry.cls.id}`}
      className="tile tile-quiet tile-interactive discipline-accent relative flex h-full flex-col gap-4 p-4"
      style={{ "--discipline-hue": String(entry.category.hue) } as React.CSSProperties}
    >
      {/* The index number, as on the board this mirrors: large, faint, and
          purely an aid to saying "number 14" out loud across a hall. */}
      <span
        aria-hidden="true"
        className="tabular pointer-events-none absolute right-4 top-2 font-display text-4xl font-extrabold text-subtle/25"
      >
        {entry.index}
      </span>

      <span className="flex items-center gap-3 pr-10">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-md bg-(--d-accent-soft) text-2xl"
          aria-hidden="true"
        >
          <Mascot />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-base font-extrabold leading-snug">
            {entry.cls.label}
          </span>
          <span className="text-xs text-muted">{label}</span>
        </span>
      </span>

      <span className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="tabular rounded-full border border-line-strong px-2.5 py-0.5 text-2xs font-bold tracking-wider">
            {entry.cls.code}
          </span>
          <StatusPill state={state} t={t} />
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-(--d-accent-ink)">
          {t("open")}
          <ArrowRight className="text-base" aria-hidden="true" />
        </span>
      </span>
    </a>
  );
}

function StatusPill({
  state,
  t,
}: {
  state: Activity;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (state.kind === "waiting") {
    return (
      <span className="rounded-full border border-line px-2.5 py-0.5 text-2xs text-muted">
        {t("statusWaiting")}
      </span>
    );
  }

  if (state.kind === "finished") {
    return (
      <span className="rounded-full border border-success/40 bg-success-surface px-2.5 py-0.5 text-2xs font-semibold text-success">
        {t("statusFinished")}
      </span>
    );
  }

  return (
    <span className="rounded-full border border-warning/40 bg-warning-surface px-2.5 py-0.5 text-2xs font-semibold text-warning">
      {t("statusRunning", { done: state.done, total: state.total })}
    </span>
  );
}

/* ── Latest results across every class ──────────────────────────────────── */

function LatestResults({
  locale,
  data,
  t,
}: {
  locale: string;
  data: ResultsData;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const teams = new Map<string, ScoringTeamRow>();
  const played: { match: ScoringMatchRow; className: string }[] = [];

  for (const entry of CLASS_CATALOGUE) {
    const snapshot = data.snapshots.get(entry.category.id);
    if (!snapshot) continue;

    for (const team of snapshot.teams) teams.set(team.id, team);
    for (const [id, team] of snapshot.archived) teams.set(id, team);

    for (const match of snapshot.matches) {
      if (match.classId !== entry.cls.id) continue;
      if (match.state !== "completed" || !match.playedAt) continue;
      played.push({ match, className: entry.cls.label });
    }
  }

  if (played.length === 0) return null;

  played.sort((a, b) => b.match.playedAt!.getTime() - a.match.playedAt!.getTime());
  const latest = played.slice(0, 8);
  const classOf = new Map(latest.map((row) => [row.match.id, row.className]));

  return (
    <Section tone="muted" labelledBy="results-latest" tight>
      <h2 id="results-latest" className="text-lg">
        {t("recent")}
      </h2>
      <div className="mt-4">
        <RecentMatches
          matches={latest.map((row) => row.match)}
          teamOf={(id) => (id === null ? undefined : teams.get(id))}
          t={t}
          caption={(match) => classOf.get(match.id) ?? null}
        />
      </div>
      <a
        href={`/${locale}/categories`}
        className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand"
      >
        {t("rulesLink")}
        <ArrowRight className="text-base" aria-hidden="true" />
      </a>
    </Section>
  );
}

/* ── Per-class activity ─────────────────────────────────────────────────── */

type Activity =
  | { kind: "waiting" }
  | { kind: "running"; done: number; total: number }
  | { kind: "finished" };

/**
 * What the card says about a class: not started, in progress with a count, or
 * finished.
 *
 * "Finished" is claimed only when there is nothing left to file — every match
 * closed, or every team's full set of attempts recorded. A class one sheet
 * short of done says "in progress", because a board that declares a winner
 * while a final is still being scored is the one mistake a results page must
 * never make.
 */
function activityOf(entry: CatalogueEntry, snapshot: CategorySnapshot | undefined): Activity {
  if (!snapshot) return { kind: "waiting" };

  const { category, cls } = entry;

  if (category.scoring.kind === "run") {
    const teams = snapshot.teams.filter((team) => team.classId === cls.id);
    const runs = snapshot.runs.filter((run) => run.classId === cls.id);
    if (runs.length === 0) return { kind: "waiting" };

    const total = teams.length * category.scoring.rounds;
    if (total > 0 && runs.length >= total) return { kind: "finished" };
    return { kind: "running", done: runs.length, total };
  }

  const matches = snapshot.matches.filter((match) => match.classId === cls.id);
  const done = matches.filter((match) => match.state === "completed").length;
  if (done === 0) return { kind: "waiting" };
  if (done === matches.length) return { kind: "finished" };
  return { kind: "running", done, total: matches.length };
}
