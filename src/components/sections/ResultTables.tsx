import { getTranslations } from "next-intl/server";
import { formatClock } from "@/lib/scoring/format";
import { positions, type LeaderboardRow, type StandingRow } from "@/lib/scoring/standings";
import type { Category } from "@/config/categories";
import type { ScoringMatchRow, ScoringTeamRow } from "@/lib/db/schema";

/**
 * The plain tables the results section shares — the league standings, the
 * attempts leaderboard, the latest-results feed, and the two cells every
 * table in this section is built out of.
 *
 * They live apart from the pages that arrange them because the index and the
 * per-class board both need them, and because a table whose markup is defined
 * once cannot drift into two slightly different tables.
 */

export type Translator = Awaited<ReturnType<typeof getTranslations>>;

/* ── League table ───────────────────────────────────────────────────────── */

export function StandingsTable({ rows, t }: { rows: StandingRow[]; t: Translator }) {
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

/* ── Latest results ─────────────────────────────────────────────────────── */

export function RecentMatches({
  matches,
  teamOf,
  t,
  caption,
}: {
  matches: ScoringMatchRow[];
  teamOf: (id: string | null) => ScoringTeamRow | undefined;
  t: Translator;
  /** Extra line under each pairing — the class it was played in, on the index. */
  caption?: (match: ScoringMatchRow) => string | null;
}) {
  if (matches.length === 0) return null;

  const stageLabel: Record<string, string> = {
    group: t("stageGroup"),
    playoff: t("stagePlayoff"),
    final: t("stageFinal"),
  };

  return (
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
                  className={match.winnerTeamId === match.redTeamId ? "font-bold" : undefined}
                >
                  {red?.name ?? "—"}
                </span>
                <span className="mx-2 text-subtle">—</span>
                <span
                  className={match.winnerTeamId === match.blueTeamId ? "font-bold" : undefined}
                >
                  {blue?.name ?? "—"}
                </span>
              </span>
              <span className="text-2xs text-subtle">
                {[caption?.(match), stageLabel[match.stage], match.roundLabel]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <span className="tabular shrink-0 font-display text-lg font-extrabold">
              {match.redScore}:{match.blueScore}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Leaderboard ────────────────────────────────────────────────────────── */

export function Leaderboard({
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

  const aggregateLabel =
    category.scoring.aggregate === "average"
      ? t("colAverage")
      : isTime
        ? t("colBestTime")
        : t("colBest");

  const show = (value: number | null) =>
    value === null ? t("noRun") : isTime ? formatClock(value) : String(value);

  return (
    <div className="flex flex-col gap-2">
      <div className="tile overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          {/* The attempt columns are numbered and the result column is "B",
              exactly as on the board this mirrors: a number needs no
              translating, and a referee reading two boards at once should not
              have to re-learn the header. What B stands for differs by
              category — best run here, the average of two rounds in Bowling —
              so the legend under the table says which. */}
          <thead>
            <tr className="bg-surface-muted text-left">
              <Th align="right">{t("colPos")}</Th>
              <Th>{t("colTeam")}</Th>
              {Array.from({ length: category.scoring.rounds }, (_, i) => (
                <Th key={i} align="center">
                  {i + 1}
                </Th>
              ))}
              <Th align="center">B</Th>
            </tr>
          </thead>
          <tbody>
            {competed.map((row, index) => (
              <tr key={row.team.id} className="border-b border-line last:border-b-0">
                <Td align="right" className="text-subtle">
                  {ranks[index]}
                </Td>
                <td className="px-3 py-3">
                  <span className="tabular mr-2 font-display text-xs font-extrabold text-brand">
                    {row.team.code}
                  </span>
                  <span className="font-semibold">{row.team.name}</span>
                </td>
                {row.attempts.map((attempt, i) => (
                  <Td key={i} align="center" className="text-muted">
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
                <Td align="center" className="font-bold">
                  {show(row.ranking)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-subtle">
        {t("legendAttempts", { best: aggregateLabel })}
      </p>
    </div>
  );
}

/* ── Table primitives ───────────────────────────────────────────────────── */

export function Th({
  children,
  align = "left",
  className = "",
  scope = "col",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  scope?: "col" | "row";
}) {
  return (
    <th
      scope={scope}
      className={`px-3 py-3 text-2xs font-bold uppercase tracking-wider text-subtle ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : ""
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <td
      className={`tabular px-3 py-3 ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

/**
 * `DD.MM HH:MM` in Astana time, formatted identically on both sides of the
 * render. `toLocaleString` without an explicit timezone would produce the
 * server's clock on first paint and the visitor's afterwards — a hydration
 * mismatch that only appears for people in another timezone.
 */
export function formatStamp(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ru-RU", {
    timeZone: "Asia/Almaty",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
