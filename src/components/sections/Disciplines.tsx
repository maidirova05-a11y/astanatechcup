import { getTranslations } from "next-intl/server";
import { Section, SectionHeader, Pill } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { buttonClasses, EXTERNAL_LINK_PROPS } from "@/components/ui/Button";
import { ArrowRight, Download, Users } from "@/components/ui/icons";
import { DISCIPLINE_ROBOTS } from "@/components/ui/robots";
import { DISCIPLINES, REGULATIONS_PDF } from "@/config/event";

/**
 * The disciplines grid.
 *
 * Directly attacks the barrier the brief names in Q4 — "недостаточная
 * информированность о правилах дисциплин и технических требованиях". Every
 * card states the age range, the team size and the format up front, and links
 * to the regulations, so nobody has to email to find out whether their
 * eleven-year-old is eligible.
 *
 * Colour: each card's accent comes from the `hue` in src/config/event.ts,
 * rotated around one shared saturation and lightness. Six related hues read as
 * a family; six arbitrary brand colours read as a sticker sheet.
 */

export async function Disciplines({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "disciplines" });
  const tc = await getTranslations({ locale, namespace: "common" });

  return (
    <Section id="disciplines" labelledBy="disciplines-title" tone="muted">
      <SectionHeader
        eyebrow={t("eyebrow")}
        id="disciplines-title"
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {DISCIPLINES.map((discipline, index) => {
          const Mascot = DISCIPLINE_ROBOTS[discipline.id];

          return (
          <Reveal as="li" key={discipline.id} index={index}>
            <article
              className="discipline-accent tile tile-interactive group flex h-full flex-col gap-5 p-6"
              style={{ "--discipline-hue": String(discipline.hue) } as React.CSSProperties}
            >
              <div className="flex items-start justify-between gap-3">
                {/* The mascot reads its body colour from --r-accent, which
                    `.discipline-accent` points at this card's hue. */}
                <span
                  className="flex size-20 items-center justify-center rounded-lg bg-(--d-accent-soft) text-5xl"
                  aria-hidden="true"
                >
                  <Mascot className="transition-transform duration-300 ease-spring group-hover:scale-110 group-hover:-rotate-3" />
                </span>

                <div className="flex flex-wrap justify-end gap-1.5">
                  {discipline.flagship && <Pill tone="accent">{t("flagshipTag")}</Pill>}
                  {discipline.provisional && <Pill tone="warning">{t("provisionalTag")}</Pill>}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-xl">{t(`items.${discipline.id}.name`)}</h3>
                <p className="text-sm font-semibold text-(--d-accent)">
                  {t(`items.${discipline.id}.tagline`)}
                </p>
                <p className="text-muted">{t(`items.${discipline.id}.description`)}</p>
              </div>

              {/* Pushed to the bottom so every card's metadata row aligns,
                  regardless of how long the description is. */}
              <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-5 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-2xs font-semibold uppercase tracking-wider text-subtle">
                    {t("labelAge")}
                  </dt>
                  <dd className="font-semibold">
                    {tc("ageRange", { min: discipline.ageMin, max: discipline.ageMax })}
                  </dd>
                </div>

                <div className="flex flex-col gap-0.5">
                  <dt className="text-2xs font-semibold uppercase tracking-wider text-subtle">
                    {t("labelTeam")}
                  </dt>
                  <dd className="flex items-center gap-1.5 font-semibold">
                    <Users className="text-base text-subtle" aria-hidden="true" />
                    {discipline.teamSizeMax === null
                      ? tc("tbd")
                      : tc("upToPeople", { count: discipline.teamSizeMax })}
                  </dd>
                </div>
              </dl>

              <a
                href="#register"
                // min-h-11 keeps the tap target at the 44px minimum without
                // adding visible bulk to the card.
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-(--d-accent) transition-transform duration-200 group-hover:translate-x-0.5"
              >
                {t("cta")}
                <ArrowRight className="text-base" />
              </a>
            </article>
          </Reveal>
          );
        })}
      </ul>

      <div className="mt-12 flex flex-col items-start gap-3">
        {/* The full rulebook set lives on its own page: six cards are what a
            team needs to choose a discipline, and twenty-one classes with
            weight limits are what they need once they have. */}
        <a
          href={`/${locale}/categories`}
          className={buttonClasses({ variant: "solid", size: "md" })}
        >
          {t("catalogueCta")}
          <ArrowRight className="text-base" />
        </a>

        {REGULATIONS_PDF ? (
          <a
            href={REGULATIONS_PDF}
            {...EXTERNAL_LINK_PROPS}
            className={buttonClasses({ variant: "outline", size: "md" })}
          >
            <Download className="text-base" />
            {t("regulationsCta")}
          </a>
        ) : (
          <p className="text-sm text-subtle">{t("regulationsMissing")}</p>
        )}
      </div>
    </Section>
  );
}
