import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { CATEGORY_ROBOTS, type CategoryRobotName } from "@/components/ui/robots";
import { ArrowRight, Info } from "@/components/ui/icons";
import { CLASS_CATALOGUE, type CatalogueEntry } from "@/config/categories";
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

        <p className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-subtle">
          <span className="tabular">
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
          <p className="mt-6 max-w-2xl rounded-lg border border-line bg-surface p-5 text-muted">
            {t("empty")}
          </p>
        )}
      </Section>

      <Section labelledBy="results-classes">
        <h2 id="results-classes" className="sr-only">
          {t("allClasses")}
        </h2>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(({ entry, state }) => (
            <li key={`${entry.category.id}:${entry.cls.id}`}>
              <ClassCard
                locale={locale}
                entry={entry}
                state={state}
                label={tc(`items.${entry.category.id}.name`)}
                t={t}
              />
            </li>
          ))}
        </ul>
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

  return (
    <a
      href={`/${locale}/results/${entry.category.id}?class=${entry.cls.id}`}
      className="tile tile-interactive discipline-accent relative flex h-full flex-col gap-4 p-5"
      style={{ "--discipline-hue": String(entry.category.hue) } as React.CSSProperties}
    >
      {/* The index number, as on the board this mirrors: large, faint, and
          purely an aid to saying "number 14" out loud across a hall. */}
      <span
        aria-hidden="true"
        className="tabular pointer-events-none absolute right-4 top-2 font-display text-5xl font-extrabold text-subtle/20"
      >
        {entry.index}
      </span>

      <span
        className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-(--d-accent-soft) text-2xl"
        aria-hidden="true"
      >
        <Mascot />
      </span>

      <span className="flex flex-col gap-1">
        <span className="text-lg font-bold">{entry.cls.label}</span>
        <span className="text-sm text-muted">{label}</span>
      </span>

      <span className="mt-auto flex flex-wrap items-center gap-2">
        <span className="tabular rounded-full border border-line-strong px-2.5 py-1 text-2xs font-bold tracking-wider">
          {entry.cls.code}
        </span>
        <StatusPill state={state} t={t} />
      </span>

      <span className="flex items-center gap-2 text-sm font-semibold text-(--d-accent)">
        {t("open")}
        <ArrowRight className="text-base" aria-hidden="true" />
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
      <span className="rounded-full border border-line px-2.5 py-1 text-2xs text-subtle">
        {t("statusWaiting")}
      </span>
    );
  }

  if (state.kind === "finished") {
    return (
      <span className="rounded-full border border-success/40 bg-success-surface px-2.5 py-1 text-2xs font-semibold text-success">
        {t("statusFinished")}
      </span>
    );
  }

  return (
    <span className="rounded-full border border-warning/40 bg-warning-surface px-2.5 py-1 text-2xs font-semibold text-warning">
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
      <h2 id="results-latest" className="text-xl">
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
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand"
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
