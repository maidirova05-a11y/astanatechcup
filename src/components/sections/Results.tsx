import { getTranslations } from "next-intl/server";
import { Section, SectionHeader, Pill } from "@/components/ui/Section";
import { CATEGORY_ROBOTS, type CategoryRobotName } from "@/components/ui/robots";
import { ArrowRight, Info } from "@/components/ui/icons";
import { CATEGORIES, type Category } from "@/config/categories";
import { formatClock } from "@/lib/scoring/format";
import {
  buildLeaderboard,
  buildStandings,
  positions,
  type LeaderboardRow,
  type StandingRow,
} from "@/lib/scoring/standings";
import type { ScoringMatchRow, ScoringTeamRow } from "@/lib/db/schema";
import type { CategorySnapshot } from "@/lib/scoring/store";

/**
 * The public scoreboard.
 *
 * Everything here is derived — nothing is stored as a standing. The judges file
 * sheets; the tables are computed from them on every render, with the same
 * functions the console uses. That is what makes "the table is wrong" a
 * question about one sheet rather than about a synchronisation bug.
 *
 * A category with no results is not shown as an empty table. It is listed at
 * the bottom as not yet started, because an empty table looks like a failure
 * and "hasn't played yet" looks like what it is.
 */

type Translator = Awaited<ReturnType<typeof getTranslations>>;

export type ResultsData = {
  snapshots: Map<string, CategorySnapshot>;
  configured: boolean;
};

export async function Results({
  locale,
  data,
}: {
  locale: string;
  data: ResultsData;
}) {
  const t = await getTranslations({ locale, namespace: "results" });
  const tc = await getTranslations({ locale, namespace: "categories" });

  const live = CATEGORIES.filter((category) => {
    const snapshot = data.snapshots.get(category.id);
    if (!snapshot) return false;
    return snapshot.matches.some((m) => m.state === "completed") || snapshot.runs.length > 0;
  });

  const pending = CATEGORIES.filter((category) => !live.includes(category));

  const updatedAt = [...data.snapshots.values()]
    .map((snapshot) => snapshot.updatedAt)
    .filter((value): value is Date => value !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

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

        {data.configured && live.length === 0 && (
          <p className="mt-6 max-w-2xl rounded-lg border border-line bg-surface p-5 text-muted">
            {t("empty")}
          </p>
        )}
      </Section>

      {live.map((category, index) => (
        <CategoryResults
          key={category.id}
          locale={locale}
          category={category}
          snapshot={data.snapshots.get(category.id)!}
          tone={index % 2 === 0 ? "default" : "muted"}
          t={t}
          tc={tc}
        />
      ))}

      {pending.length > 0 && (
        <Section tight tone={live.length % 2 === 0 ? "default" : "muted"}>
          <h2 className="text-xl">{t("notStarted")}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {pending.map((category) => (
              <li key={category.id}>
                <a
                  href={`/${locale}/categories#${category.id}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-muted"
                >
                  {tc(`items.${category.id}.name`)}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

/* ── One category ───────────────────────────────────────────────────────── */

async function CategoryResults({
  locale,
  category,
  snapshot,
  tone,
  t,
  tc,
}: {
  locale: string;
  category: Category;
  snapshot: CategorySnapshot;
  tone: "default" | "muted";
  t: Translator;
  tc: Translator;
}) {
  const Mascot = CATEGORY_ROBOTS[category.mascot as CategoryRobotName];
  const headingId = `results-${category.id}`;

  // Only the classes that have actually produced something get a table.
  const classes = category.classes.filter((cls) => {
    const hasMatches = snapshot.matches.some(
      (m) => m.classId === cls.id && m.state === "completed",
    );
    const hasRuns = snapshot.runs.some((r) => r.classId === cls.id);
    return hasMatches || hasRuns;
  });

  if (classes.length === 0) return null;

  const nameOf = (id: string | null): ScoringTeamRow | undefined =>
    id === null
      ? undefined
      : (snapshot.teams.find((team) => team.id === id) ?? snapshot.archived.get(id));

  return (
    <Section id={`results-${category.id}`} labelledBy={headingId} tone={tone}>
      <div
        className="discipline-accent flex flex-col gap-8"
        style={{ "--discipline-hue": String(category.hue) } as React.CSSProperties}
      >
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-(--d-accent-soft) text-3xl"
              aria-hidden="true"
            >
              <Mascot />
            </span>
            <h2 id={headingId} className="text-2xl">
              {tc(`items.${category.id}.name`)}
            </h2>
          </div>

          <a
            href={`/${locale}/categories#${category.id}`}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-(--d-accent)"
          >
            {t("rulesLink")}
            <ArrowRight className="text-base" aria-hidden="true" />
          </a>
        </header>

        {classes.map((cls) => {
          const teams = snapshot.teams.filter((team) => team.classId === cls.id);
          const matches = snapshot.matches.filter((m) => m.classId === cls.id);
          const runs = snapshot.runs.filter((r) => r.classId === cls.id);

          return (
            <section key={cls.id} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg">{cls.label}</h3>
                <Pill>
                  {category.scoring.kind === "match" ? t("standings") : t("leaderboard")}
                </Pill>
              </div>

              {category.scoring.kind === "match" ? (
                <>
                  <StandingsTable
                    rows={buildStandings(teams, matches, category)}
                    t={t}
                  />
                  <RecentMatches
                    matches={matches.filter((m) => m.state === "completed").slice(0, 8)}
                    teamOf={nameOf}
                    t={t}
                  />
                </>
              ) : (
                <Leaderboard
                  rows={buildLeaderboard(teams, runs, category)}
                  category={category}
                  t={t}
                />
              )}
            </section>
          );
        })}
      </div>
    </Section>
  );
}

/* ── League table ───────────────────────────────────────────────────────── */

function StandingsTable({ rows, t }: { rows: StandingRow[]; t: Translator }) {
  const played = rows.filter((row) => row.played > 0);
  if (played.length === 0) {
    return <p className="text-sm text-muted">{t("emptyCategory")}</p>;
  }

  const ranks = positions(played.map((row) => row.points));

  return (
    <div className="flex flex-col gap-2">
      <div className="tile overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <Th align="right">{t("colPos")}</Th>
              <Th>{t("colTeam")}</Th>
              <Th align="right">{t("colPlayed")}</Th>
              <Th align="right">{t("colWon")}</Th>
              <Th align="right">{t("colDrawn")}</Th>
              <Th align="right">{t("colLost")}</Th>
              <Th align="right">{t("colFor")}</Th>
              <Th align="right">{t("colAgainst")}</Th>
              <Th align="right">{t("colDiff")}</Th>
              <Th align="right">{t("colPoints")}</Th>
            </tr>
          </thead>
          <tbody>
            {played.map((row, index) => (
              <tr key={row.team.id} className="border-b border-line last:border-b-0">
                <Td align="right" className="text-subtle">
                  {ranks[index]}
                </Td>
                <td className="px-3 py-3">
                  <span className="font-semibold">{row.team.name}</span>
                  <span className="ml-2 text-xs text-subtle">{row.team.code}</span>
                  {row.team.groupLabel && (
                    <span className="ml-2 text-xs text-subtle">
                      {t("groupLabel", { label: row.team.groupLabel })}
                    </span>
                  )}
                </td>
                <Td align="right">{row.played}</Td>
                <Td align="right">{row.won}</Td>
                <Td align="right">{row.drawn}</Td>
                <Td align="right">{row.lost}</Td>
                <Td align="right">{row.scored}</Td>
                <Td align="right">{row.conceded}</Td>
                <Td align="right">
                  {row.difference > 0 ? `+${row.difference}` : row.difference}
                </Td>
                <Td align="right" className="font-bold">
                  {row.points}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-subtle">{t("legendPlayed")}</p>
    </div>
  );
}

function RecentMatches({
  matches,
  teamOf,
  t,
}: {
  matches: ScoringMatchRow[];
  teamOf: (id: string | null) => ScoringTeamRow | undefined;
  t: Translator;
}) {
  if (matches.length === 0) return null;

  const stageLabel: Record<string, string> = {
    group: t("stageGroup"),
    playoff: t("stagePlayoff"),
    final: t("stageFinal"),
  };

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-bold uppercase tracking-wider text-subtle">
        {t("recent")}
      </h4>
      <ul className="grid gap-2 sm:grid-cols-2">
        {matches.map((match) => {
          const red = teamOf(match.redTeamId);
          const blue = teamOf(match.blueTeamId);
          return (
            <li
              key={match.id}
              className="tile tile-quiet flex items-center justify-between gap-3 p-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm">
                  <span
                    className={
                      match.winnerTeamId === match.redTeamId ? "font-bold" : undefined
                    }
                  >
                    {red?.name ?? "—"}
                  </span>
                  <span className="mx-2 text-subtle">—</span>
                  <span
                    className={
                      match.winnerTeamId === match.blueTeamId ? "font-bold" : undefined
                    }
                  >
                    {blue?.name ?? "—"}
                  </span>
                </span>
                <span className="text-2xs text-subtle">
                  {[stageLabel[match.stage], match.roundLabel].filter(Boolean).join(" · ")}
                </span>
              </div>
              <span className="tabular shrink-0 font-display text-lg font-extrabold">
                {match.redScore}:{match.blueScore}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Leaderboard ────────────────────────────────────────────────────────── */

function Leaderboard({
  rows,
  category,
  t,
}: {
  rows: LeaderboardRow[];
  category: Category;
  t: Translator;
}) {
  if (category.scoring.kind !== "run") return null;
  const competed = rows.filter((row) => row.ranking !== null);
  if (competed.length === 0) {
    return <p className="text-sm text-muted">{t("emptyCategory")}</p>;
  }

  const isTime = category.scoring.metric === "time";
  const ranks = positions(competed.map((row) => row.ranking));

  const show = (value: number | null) =>
    value === null ? t("noRun") : isTime ? formatClock(value) : String(value);

  return (
    <div className="tile overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <Th align="right">{t("colPos")}</Th>
            <Th>{t("colTeam")}</Th>
            {Array.from({ length: category.scoring.rounds }, (_, i) => (
              <Th key={i} align="right">
                {t("attemptShort", { number: i + 1 })}
              </Th>
            ))}
            <Th align="right">
              {category.scoring.aggregate === "average"
                ? t("colAverage")
                : isTime
                  ? t("colBestTime")
                  : t("colBest")}
            </Th>
          </tr>
        </thead>
        <tbody>
          {competed.map((row, index) => (
            <tr key={row.team.id} className="border-b border-line last:border-b-0">
              <Td align="right" className="text-subtle">
                {ranks[index]}
              </Td>
              <td className="px-3 py-3">
                <span className="font-semibold">{row.team.name}</span>
                <span className="ml-2 text-xs text-subtle">{row.team.code}</span>
              </td>
              {row.attempts.map((attempt, i) => (
                <Td key={i} align="right" className="text-muted">
                  {!attempt
                    ? t("noRun")
                    : attempt.state === "dsq"
                      ? t("dsq")
                      : attempt.state === "foul"
                        ? t("foul")
                        : attempt.state === "dnf"
                          ? t("dnf")
                          : isTime
                            ? formatClock(attempt.timeMs ?? 0)
                            : String(attempt.points ?? 0)}
                </Td>
              ))}
              <Td align="right" className="font-bold">
                {show(row.ranking)}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Table primitives ───────────────────────────────────────────────────── */

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-3 text-2xs font-bold uppercase tracking-wider text-subtle ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`tabular px-3 py-3 ${align === "right" ? "text-right" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

/**
 * `YYYY-MM-DD HH:MM` in Astana time, formatted identically on both sides of the
 * render. `toLocaleString` without an explicit timezone would produce the
 * server's clock on first paint and the visitor's afterwards — a hydration
 * mismatch that only appears for people in another timezone.
 */
function formatStamp(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ru-RU", {
    timeZone: "Asia/Almaty",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
