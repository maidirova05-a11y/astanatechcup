import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Medal, Certificate, Sparkle, Gift, Trophy } from "@/components/ui/icons";
import { FINAL_MONTH } from "@/config/event";
import { monthName } from "@/lib/utils";

/**
 * Prizes — the emotional peak of the page.
 *
 * The brief is unambiguous (Q9): the headline prize is not a cup, it is the
 * RobotChallenge slot in Beijing. So the international block is the hero of
 * this section and the medals-and-diplomas grid is secondary, rather than the
 * other way round.
 *
 * Second dark punctuation block, matching the flagship section.
 */

const ICONS: Record<string, ReactNode> = {
  medals: <Medal />,
  diplomas: <Certificate />,
  special: <Sparkle />,
  valuable: <Gift />,
};

const ITEMS = ["medals", "diplomas", "special", "valuable"] as const;

export async function Prizes({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "prizes" });

  // The city name lives in the catalogs, not in config: "Beijing" is Пекин in
  // Russian and Бейжің in Kazakh, so it is copy, not data.
  const city = t("city");

  return (
    <Section id="prizes" dark labelledBy="prizes-title" className="overflow-hidden">
      <div
        aria-hidden="true"
        className="grid-texture pointer-events-none absolute inset-0 -z-10"
      />

      <SectionHeader
        eyebrow={t("eyebrow")}
        id="prizes-title"
        title={t("title")}
        subtitle={t("lead")}
      />

      {/* The international slot, given the visual weight the brief gives it. */}
      <Reveal>
        <div className="tile mt-12 overflow-hidden rounded-xl">
          <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-12">
            <span
              className="flex size-20 items-center justify-center rounded-xl border-2 border-accent-edge bg-accent text-4xl text-on-accent shadow-signal"
              aria-hidden="true"
            >
              <Trophy />
            </span>

            <div className="flex flex-col gap-3">
              <h3 className="text-2xl">{t("internationalTitle", { city })}</h3>
              <p className="text-2xs font-bold uppercase tracking-[0.16em] text-brand">
                {t("internationalMonth", {
                  month: monthName(locale, FINAL_MONTH.month),
                  year: FINAL_MONTH.year,
                })}
              </p>
              <p className="max-w-2xl leading-relaxed text-muted">
                {t("internationalBody")}
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((item, index) => (
          <Reveal as="li" key={item} index={index}>
            <div className="tile tile-quiet flex h-full flex-col gap-4 p-6">
              <span
                className="flex size-12 items-center justify-center rounded-full border-2 border-brand/40 bg-brand/15 text-xl text-brand"
                aria-hidden="true"
              >
                {ICONS[item]}
              </span>
              <h3 className="text-lg">{t(`items.${item}.title`)}</h3>
              <p className="text-sm leading-relaxed text-muted">
                {t(`items.${item}.body`)}
              </p>
            </div>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
