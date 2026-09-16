import { getTranslations } from "next-intl/server";
import { Section } from "@/components/ui/Section";
import { CATEGORY_ROBOTS, type CategoryRobotName } from "@/components/ui/robots";
import { ArrowLeft, ArrowRight } from "@/components/ui/icons";
import type { CatalogueEntry } from "@/config/categories";
import { buildLeaderboard, buildStandings } from "@/lib/scoring/standings";
import {
  buildBracketTable,
  buildCrossTable,
  groupLabelsOf,
  groupPlacements,
  numberMatches,
} from "@/lib/scoring/table";
import type { CategorySnapshot } from "@/lib/scoring/store";
import { BracketTable } from "./BracketTable";
import { BracketTree } from "./BracketTree";
import { CrossTable } from "./CrossTable";
import { Leaderboard, StandingsTable, formatStamp } from "./ResultTables";
import type { ScoringTeamRow } from "@/lib/db/schema";

/**
 * One class, the whole day of it: the group stage as cross-tables and the
 * playoffs as a bracket — the same two-stage shape the international board
 * uses, because it is the shape the competition itself has.
 *
 * Every switch on this page — class, stage, group, bracket view — is a LINK
 * carrying a query parameter, not client state. Three reasons, all of them
 * about the venue rather than about taste:
 *
 *  · The page is rendered per request and refreshed constantly. Client state
 *    would be thrown away on every refresh, dropping a referee back to Group A
 *    each time the scoreboard updated.
 *  · A URL that names what is on screen can be sent to someone. "Group C of
 *    Mini Sumo" is a link, not an instruction to click three things.
 *  · No JavaScript is required to read a result, which matters in a hall
 *    where several hundred phones share one access point.
 */

/**
 * A class whose draw has not been made yet has teams with no group letter at
 * all, and they still need a tab of their own. `null` in the data means "no
 * letter"; in a URL that has to be a character, and an empty `?group=` is
 * indistinguishable from an absent one — hence an explicit marker.
 */
const UNGROUPED = "-";

type View = {
  /** Which of the category's classes is open. */
  classId: string;
  stage: "group" | "playoff";
  /** A group letter, `UNGROUPED`, or null for "whatever comes first". */
  group: string | null;
  bracket: "table" | "tree";
};

export async function ClassBoard({
  locale,
  entry,
  snapshot,
  view,
  configured,
}: {
  locale: string;
  entry: CatalogueEntry;
  snapshot: CategorySnapshot | null;
  view: View;
  configured: boolean;
}) {
  const { category, cls } = entry;
  const t = await getTranslations({ locale, namespace: "results" });
  const tc = await getTranslations({ locale, namespace: "categories" });

  const teams = snapshot?.teams.filter((team) => team.classId === cls.id) ?? [];
  const matches = snapshot?.matches.filter((m) => m.classId === cls.id) ?? [];
  const runs = snapshot?.runs.filter((r) => r.classId === cls.id) ?? [];

  const known: ScoringTeamRow[] = snapshot
    ? [...snapshot.teams, ...snapshot.archived.values()]
    : [];

  const Mascot = CATEGORY_ROBOTS[category.mascot as CategoryRobotName];
  const href = (params: Partial<View>) => classHref(locale, entry, { ...view, ...params });

  return (
    <Section labelledBy="class-title">
      {/* The accent hue is the category's, so a referee moving between two
          classes of the same category has one colour follow them. */}
      <div
        className="discipline-accent flex flex-col gap-8"
        style={{ "--discipline-hue": String(category.hue) } as React.CSSProperties}
      >
        <a
          href={`/${locale}/results`}
          className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-muted"
        >
          <ArrowLeft className="text-base" aria-hidden="true" />
          {t("backToAll")}
        </a>

        {/* ── Who is playing ─────────────────────────────────────────────── */}
        <header className="tile flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-(--d-accent-soft) text-3xl"
              aria-hidden="true"
            >
              <Mascot />
            </span>
            <div className="flex flex-col gap-1">
              <h1 id="class-title" className="text-2xl">
                {cls.label}
              </h1>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span>{tc(`items.${category.id}.name`)}</span>
                <span className="tabular rounded-full border border-line-strong px-2.5 py-0.5 text-2xs font-bold tracking-wider">
                  {cls.code}
                </span>
                <span>{cls.groups.map((group) => tc(`groups.${group}`)).join(" · ")}</span>
              </p>
            </div>
          </div>

          <a
            href={`/${locale}/categories#${category.id}`}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-(--d-accent)"
          >
            {t("rulesLink")}
            <ArrowRight className="text-base" aria-hidden="true" />
          </a>
        </header>

        {category.classes.length > 1 && (
          <Tabs
            label={tc("classesLabel")}
            items={category.classes.map((other) => ({
              key: other.id,
              label: other.label,
              href: classHref(locale, entry, {
                ...view,
                classId: other.id,
                // A class switch starts over: another class's group letters
                // are not this one's.
                group: null,
                stage: "group",
              }),
              current: other.id === cls.id,
            }))}
          />
        )}

        {!configured ? (
          <p className="rounded-lg border border-warning/40 bg-warning-surface p-4 text-sm">
            {t("notConfigured")}
          </p>
        ) : category.scoring.kind === "run" ? (
          /* ── Attempts, no stages ──────────────────────────────────────── */
          <section className="flex flex-col gap-4">
            <h2 className="text-xl">{t("leaderboard")}</h2>
            <Leaderboard
              rows={buildLeaderboard(teams, runs, category)}
              category={category}
              t={t}
            />
          </section>
        ) : (
          <MatchStages
            entry={entry}
            teams={teams}
            known={known}
            matches={matches}
            view={view}
            href={href}
            t={t}
          />
        )}

        <p className="flex flex-wrap items-center justify-between gap-3 text-xs text-subtle">
          <span className="tabular">
            {snapshot?.updatedAt
              ? t("updated", { time: formatStamp(snapshot.updatedAt, locale) })
              : null}
          </span>
          {/* Straight to this class in the judges' console, where every table on
              this page is editable. Harmless for a spectator: the console asks
              for a password before it shows anything. */}
          <a
            href={`/judge/${category.id}?class=${cls.id}`}
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
          >
            {t("editLink")}
          </a>
        </p>
      </div>
    </Section>
  );
}

/* ── Group stage and playoffs ───────────────────────────────────────────── */

function MatchStages({
  entry,
  teams,
  known,
  matches,
  view,
  href,
  t,
}: {
  entry: CatalogueEntry;
  teams: ScoringTeamRow[];
  known: ScoringTeamRow[];
  matches: CategorySnapshot["matches"];
  view: View;
  href: (params: Partial<View>) => string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const { category } = entry;
  const numbers = numberMatches(matches);
  const groupMatches = matches.filter((m) => m.stage === "group");
  const bracketMatches = matches.filter(
    (m) => m.stage === "playoff" || m.stage === "final",
  );

  const labels = groupLabelsOf(teams);

  // `view.group` is what the URL asked for: a letter, the ungrouped marker, or
  // null for "nothing asked". Only the first two can select a tab; anything
  // else falls back to the first group the class actually has.
  const asked: string | null | undefined =
    view.group === null ? undefined : view.group === UNGROUPED ? null : view.group;
  const group =
    asked !== undefined && labels.includes(asked) ? asked : (labels[0] ?? null);

  // Every link out of here keeps the group that is currently open, so moving
  // between the stages does not silently reset a referee to Group A.
  const link = (params: Partial<View>) =>
    href({ group: group ?? UNGROUPED, ...params });

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        label={t("stages")}
        items={[
          {
            key: "group",
            label: t("stageGroup"),
            href: link({ stage: "group" }),
            current: view.stage === "group",
          },
          {
            key: "playoff",
            label: t("stagePlayoff"),
            href: link({ stage: "playoff" }),
            current: view.stage === "playoff",
          },
        ]}
      />

      {view.stage === "group" ? (
        teams.length === 0 ? (
          <p className="text-sm text-muted">{t("emptyCategory")}</p>
        ) : (
          <div className="flex flex-col gap-5">
            {labels.length > 1 && (
              <Tabs
                small
                label={t("groups")}
                items={labels.map((label) => ({
                  key: label ?? "—",
                  label: label ? t("groupLabel", { label }) : t("groupNone"),
                  href: link({ group: label ?? UNGROUPED }),
                  current: label === group,
                }))}
              />
            )}

            {(() => {
              const inGroup = teams.filter((team) => team.groupLabel === group);
              const played = groupMatches.filter((m) => m.groupLabel === group);
              const title = group ? t("groupLabel", { label: group }) : t("groupNone");

              return (
                <>
                  <CrossTable
                    table={buildCrossTable(inGroup, played, category, numbers, group)}
                    t={t}
                    title={title}
                  />

                  {/* The ladder above carries wins, draws, losses and points —
                      the four columns the board this mirrors prints. Goals for
                      and against decide our ties (see buildStandings), so the
                      full table stays one click away rather than being lost. */}
                  <details className="rounded-lg border border-line bg-surface">
                    <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold">
                      {t("fullTable")}
                    </summary>
                    <div className="border-t border-line p-5">
                      <StandingsTable
                        rows={buildStandings(inGroup, played, category)}
                        t={t}
                      />
                    </div>
                  </details>
                </>
              );
            })()}
          </div>
        )
      ) : bracketMatches.length === 0 ? (
        <p className="text-sm text-muted">{t("noBracket")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Tabs
            small
            label={t("bracketView")}
            items={[
              {
                key: "table",
                label: t("viewTable"),
                href: link({ bracket: "table" }),
                current: view.bracket === "table",
              },
              {
                key: "tree",
                label: t("viewTree"),
                href: link({ bracket: "tree" }),
                current: view.bracket === "tree",
              },
            ]}
          />

          {view.bracket === "table" ? (
            <BracketTable
              rows={buildBracketTable(
                matches,
                groupPlacements(teams, matches, category),
                numbers,
              )}
              teams={known}
              t={t}
            />
          ) : (
            <BracketTree
              matches={bracketMatches}
              teams={known}
              tbdLabel={t("tbd")}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── A row of links that behaves like tabs ──────────────────────────────── */

function Tabs({
  label,
  items,
  small = false,
}: {
  label: string;
  items: { key: string; label: string; href: string; current: boolean }[];
  small?: boolean;
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <a
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={
                item.current
                  ? `inline-flex min-h-11 items-center rounded-full bg-brand-strong px-4 font-semibold text-on-brand ${
                      small ? "text-sm" : "text-base"
                    }`
                  : `inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 font-medium text-muted ${
                      small ? "text-sm" : "text-base"
                    }`
              }
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The board's whole state as one URL. Defaults are omitted so the common case
 * — first class, group stage, first group, bracket as a table — is a clean
 * `/ru/results/sumo`.
 */
function classHref(locale: string, entry: CatalogueEntry, view: View): string {
  const query = new URLSearchParams();
  if (view.classId !== entry.category.classes[0].id) query.set("class", view.classId);
  if (view.stage !== "group") query.set("stage", view.stage);
  if (view.group !== null) query.set("group", view.group);
  if (view.bracket !== "table") query.set("view", view.bracket);

  const suffix = query.size > 0 ? `?${query}` : "";
  return `/${locale}/results/${entry.category.id}${suffix}`;
}
