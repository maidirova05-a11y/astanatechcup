import { getTranslations } from "next-intl/server";
import { Section, SectionHeader, Pill, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { buttonClasses } from "@/components/ui/Button";
import { Check, Trophy, Users, Info } from "@/components/ui/icons";
import { CATEGORY_ROBOTS, type CategoryRobotName } from "@/components/ui/robots";
import {
  CATEGORIES,
  TOTAL_CLASSES,
  categoryGroups,
  type Arena,
  type Category,
  type CategoryClass,
  type Envelope,
} from "@/config/categories";
import { formatClock } from "@/lib/scoring/format";

/**
 * The category catalogue — the whole rulebook set on one page.
 *
 * This exists because "недостаточная информированность о правилах дисциплин и
 * технических требованиях" is the barrier the brief names, and the discipline
 * cards on the landing page deliberately do not carry this much detail: a team
 * choosing what to enter needs six cards, and a team building a robot needs
 * the weight limit to three significant figures. Two audiences, two pages.
 *
 * Everything here is rendered from src/config/categories.ts. Nothing on this
 * page is a hand-written measurement, which is what keeps it from drifting out
 * of step with the scoring system, which reads the same file.
 */

type Translator = Awaited<ReturnType<typeof getTranslations>>;

/* ── Measurement formatting ─────────────────────────────────────────────── */

/**
 * Numbers are formatted for the locale (38.5 → "38,5" in Russian), not
 * template-literalled. A rules table that prints a decimal point to a Russian
 * reader looks like a copy-paste from somewhere else, which is exactly the
 * impression a regulations page cannot afford.
 */
function makeNumberFormatter(locale: string) {
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
  return (value: number) => format.format(value);
}

function formatWeight(
  grams: number,
  num: (n: number) => string,
  tc: Translator,
): string {
  return grams < 1000
    ? `${num(grams)} ${tc("g")}`
    : `${num(grams / 1000)} ${tc("kg")}`;
}

/**
 * The robot envelope, collapsed to the axes the rulebook actually constrains.
 *
 * Most sumo classes cap width and length but leave height open, and a drone is
 * measured across its guard rather than as a box. Printing "20 × 20 × —" for
 * the first and a fake box for the second would both be wrong, so the shape of
 * the sentence follows the shape of the limit.
 */
function formatEnvelope(
  envelope: Envelope,
  t: Translator,
  tc: Translator,
  num: (n: number) => string,
): string {
  const u = tc("cm");
  const parts: string[] = [];

  const { width, length, height, weight } = envelope;

  if (width !== null && length === null && height === null) {
    parts.push(t("envelopeDiameter", { width: num(width), u }));
  } else if (width !== null && length !== null && height !== null) {
    parts.push(
      t("envelopeBox", {
        width: num(width),
        length: num(length),
        height: num(height),
        u,
      }),
    );
  } else if (width !== null && length !== null) {
    parts.push(t("envelopeFootprint", { width: num(width), length: num(length), u }));
  }

  if (weight !== null) {
    parts.push(t("envelopeWeight", { weight: formatWeight(weight, num, tc) }));
  }

  return parts.length > 0 ? parts.join(" · ") : tc("noLimit");
}

function formatArena(
  arena: Arena | null,
  t: Translator,
  tc: Translator,
  num: (n: number) => string,
): string {
  if (!arena) return tc("noLimit");

  if (arena.shape === "ring") {
    return t("arenaRing", {
      diameter: num(arena.diameter),
      border: num(arena.borderWidth),
      u: tc("cm"),
      material: t(`materials.${arena.material}`),
    });
  }

  const base =
    arena.height === undefined
      ? t("arenaRect", {
          length: num(arena.length),
          width: num(arena.width),
          u: tc("cm"),
        })
      : t("arenaRectHeight", {
          length: num(arena.length),
          width: num(arena.width),
          height: num(arena.height),
          u: tc("cm"),
        });

  return arena.material
    ? base + t("arenaMaterialSuffix", { material: t(`materials.${arena.material}`) })
    : base;
}

/* ── Format strip ───────────────────────────────────────────────────────── */

/**
 * The four or five facts a team checks before reading anything else: how long
 * the clock runs, how many robots go out, how many attempts they get, and what
 * turns those attempts into a placing.
 */
function formatFacts(category: Category, t: Translator, tc: Translator): string[] {
  const facts: string[] = [];

  facts.push(
    category.scoring.kind === "match"
      ? t("clockMatch", { minutes: category.clockMinutes })
      : t("clockRun", { minutes: category.clockMinutes }),
  );

  facts.push(t("robotsPerTeam", { count: category.robotsPerTeam }));

  if (category.scoring.kind === "match") {
    if (category.scoring.bestOf) facts.push(t("bestOf"));
    facts.push(
      t("leagueNote", {
        win: category.scoring.league.win,
        draw: category.scoring.league.draw,
        loss: category.scoring.league.loss,
      }),
    );
  } else {
    const { rounds, aggregate, metric, maxPoints, dnfMs } = category.scoring;
    facts.push(t("roundsRun", { count: rounds }));
    facts.push(aggregate === "best" ? t("aggregateBest") : t("aggregateAverage"));
    facts.push(metric === "time" ? t("metricTime") : t("metricPoints"));
    if (maxPoints) facts.push(t("maxPoints", { points: maxPoints }));
    if (dnfMs) facts.push(t("dnfNote", { value: formatClock(dnfMs) }));
  }

  // `tc` is threaded through for symmetry with the other formatters; the unit
  // strings live there and future facts will need them.
  void tc;
  return facts;
}

/* ── The page ───────────────────────────────────────────────────────────── */

export async function CategoryCatalogue({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "categories" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const num = makeNumberFormatter(locale);

  return (
    <>
      <Section tone="muted" labelledBy="categories-title">
        <SectionHeader
          as="h1"
          eyebrow={t("eyebrow")}
          id="categories-title"
          title={t("title")}
          subtitle={t("subtitle")}
        />

        <dl className="mt-12 flex flex-wrap items-end gap-x-10 gap-y-6">
          <div className="flex flex-col gap-1">
            <dd className="tabular font-display text-4xl font-extrabold text-brand">
              {CATEGORIES.length}
            </dd>
            <dt className="text-sm font-semibold text-muted">{t("statCategories")}</dt>
          </div>
          <div className="flex flex-col gap-1">
            <dd className="tabular font-display text-4xl font-extrabold text-accent">
              {TOTAL_CLASSES}
            </dd>
            <dt className="text-sm font-semibold text-muted">{t("statClasses")}</dt>
          </div>
          <p className="max-w-md text-sm text-muted">{t("statNote")}</p>
        </dl>

        {/* Jump list. Twenty-one classes over seven sections is a long page,
            and a reader who came for one set of numbers should not have to
            scroll past six others to reach them. */}
        <nav aria-label={t("tocTitle")} className="mt-10">
          <p className="text-2xs font-bold uppercase tracking-wider text-subtle">
            {t("tocTitle")}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <li key={category.id}>
                <a
                  href={`#${category.id}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold transition-colors hover:border-line-strong hover:bg-surface-raised"
                >
                  {t(`items.${category.id}.name`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </Section>

      {CATEGORIES.map((category, index) => (
        <CategoryBlock
          key={category.id}
          category={category}
          index={index}
          t={t}
          tc={tc}
          num={num}
        />
      ))}

      <Section tight tone="muted">
        <div className="flex flex-col items-start gap-5">
          <p className="flex max-w-2xl items-start gap-3 text-sm text-muted">
            <Info className="mt-0.5 shrink-0 text-lg text-subtle" aria-hidden="true" />
            {t("sourceNote")}
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={`/${locale}#register`} className={buttonClasses({ variant: "accent" })}>
              {t("cta")}
            </a>
            <a
              href={`/${locale}/results`}
              className={buttonClasses({ variant: "outline" })}
            >
              {t("resultsCta")}
            </a>
          </div>
        </div>
      </Section>
    </>
  );
}

/* ── One category ───────────────────────────────────────────────────────── */

async function CategoryBlock({
  category,
  index,
  t,
  tc,
  num,
}: {
  category: Category;
  index: number;
  t: Translator;
  tc: Translator;
  num: (n: number) => string;
}) {
  const Mascot = CATEGORY_ROBOTS[category.mascot as CategoryRobotName];
  const headingId = `${category.id}-title`;
  const groups = categoryGroups(category);
  const facts = formatFacts(category, t, tc);

  const rules = t.raw(`items.${category.id}.rules`) as string[];
  const scoring = t.raw(`items.${category.id}.scoring`) as string[];

  return (
    <Section
      id={category.id}
      labelledBy={headingId}
      // Alternating tone gives seven long blocks a rhythm, so a reader can see
      // at a glance where one category ends and the next begins.
      tone={index % 2 === 0 ? "default" : "muted"}
    >
      <div
        className="discipline-accent flex flex-col gap-10"
        style={{ "--discipline-hue": String(category.hue) } as React.CSSProperties}
      >
        <Reveal>
          <header className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-5">
              <span
                className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-(--d-accent-soft) text-5xl"
                aria-hidden="true"
              >
                <Mascot />
              </span>
              <div className="flex flex-col gap-1.5">
                <h2 id={headingId} className="text-3xl">
                  {t(`items.${category.id}.name`)}
                </h2>
                <p className="font-semibold text-(--d-accent)">
                  {t(`items.${category.id}.tagline`)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {groups.map((group) => (
                <Pill key={group}>{t(`groups.${group}`)}</Pill>
              ))}
            </div>

            <p className="max-w-3xl text-lg leading-relaxed text-muted">
              {t(`items.${category.id}.summary`)}
            </p>
          </header>
        </Reveal>

        {/* Format strip — the numbers a team checks first. */}
        <Reveal index={1}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map((fact) => (
              <li
                key={fact}
                className="tile tile-quiet flex items-center gap-3 px-4 py-3 text-sm font-medium"
              >
                <Trophy className="shrink-0 text-base text-(--d-accent)" aria-hidden="true" />
                {fact}
              </li>
            ))}
          </ul>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal index={2}>
            <article className="tile flex h-full flex-col gap-4 p-6">
              <Eyebrow className="text-(--d-accent)">{t("rulesLabel")}</Eyebrow>
              <ul className="flex flex-col gap-3">
                {rules.map((rule) => (
                  <li key={rule} className="flex items-start gap-3 text-sm leading-relaxed">
                    <Check
                      className="mt-0.5 shrink-0 text-base text-(--d-accent)"
                      aria-hidden="true"
                    />
                    <span className="text-muted">{rule}</span>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>

          <Reveal index={3}>
            <article className="tile flex h-full flex-col gap-4 p-6">
              <Eyebrow className="text-(--d-accent)">{t("scoringLabel")}</Eyebrow>
              <ul className="flex flex-col gap-3">
                {scoring.map((line) => (
                  <li key={line} className="flex items-start gap-3 text-sm leading-relaxed">
                    <Trophy
                      className="mt-0.5 shrink-0 text-base text-(--d-accent)"
                      aria-hidden="true"
                    />
                    <span className="text-muted">{line}</span>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        </div>

        <Reveal index={4}>
          <ClassTable
            category={category}
            t={t}
            tc={tc}
            num={num}
            headingId={`${category.id}-classes`}
          />
        </Reveal>

        <p className="text-xs text-subtle">
          {t("sourceLabel")}:{" "}
          {t("sourceValue", {
            title: category.source.title,
            date: category.source.revised,
          })}
        </p>
      </div>
    </Section>
  );
}

/* ── The class table ────────────────────────────────────────────────────── */

/**
 * Rendered as a real `<table>` rather than a card grid.
 *
 * Nine sumo classes differ from each other by three numbers each; the only way
 * to answer "which class does my 400 g robot fit?" is to scan one column, and
 * a grid of cards makes that scan impossible. The table scrolls sideways
 * inside its own container so the page body never does.
 */
function ClassTable({
  category,
  t,
  tc,
  num,
  headingId,
}: {
  category: Category;
  t: Translator;
  tc: Translator;
  num: (n: number) => string;
  headingId: string;
}) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h3 id={headingId} className="flex items-center gap-2 text-xl">
        <Users className="text-lg text-subtle" aria-hidden="true" />
        {t("classesLabel")}
      </h3>

      <div className="tile overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <Th>{t("colClass")}</Th>
              <Th>{t("colGroups")}</Th>
              <Th>{t("colControl")}</Th>
              <Th>{t("colRobot")}</Th>
              <Th>{t("colArena")}</Th>
            </tr>
          </thead>
          <tbody>
            {category.classes.map((cls: CategoryClass) => (
              <tr key={cls.id} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3.5 font-semibold">{cls.label}</td>
                <td className="px-4 py-3.5 text-muted">
                  {cls.groups.map((group) => t(`groups.${group}`)).join(" · ")}
                </td>
                <td className="px-4 py-3.5 text-muted">{t(`control.${cls.control}`)}</td>
                <td className="tabular px-4 py-3.5 text-muted">
                  {formatEnvelope(cls.envelope, t, tc, num)}
                </td>
                <td className="tabular px-4 py-3.5 text-muted">
                  {formatArena(cls.arena, t, tc, num)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-subtle"
    >
      {children}
    </th>
  );
}
