import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Medal, Certificate, Sparkle, Gift, Trophy } from "@/components/ui/icons";
import { FINAL_MONTH } from "@/config/event";
import { monthName } from "@/lib/utils";
import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { PHOTOS } from "@/config/photos";

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
  const tp = await getTranslations({ locale, namespace: "photos" });

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
        <div className="tile mt-10 overflow-hidden rounded-xl sm:mt-12">
          <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8 sm:p-8 lg:grid-cols-[auto_1fr_minmax(0,22rem)] lg:gap-10 lg:p-10">
            <span
              className="flex size-16 items-center justify-center rounded-xl bg-brand text-3xl text-on-brand ring-4 ring-brand/20 sm:size-20 sm:text-4xl"
              aria-hidden="true"
            >
              <Trophy />
            </span>

            <div className="flex flex-col gap-2.5">
              <h3 className="text-xl sm:text-2xl">{t("internationalTitle", { city })}</h3>
              <p className="label-caps text-brand">
                {t("internationalMonth", {
                  month: monthName(locale, FINAL_MONTH.month),
                  year: FINAL_MONTH.year,
                })}
              </p>
              <p className="max-w-2xl leading-relaxed text-muted">
                {t("internationalBody")}
              </p>
            </div>

            <PhotoFrame
              photo={PHOTOS.armRobot}
              alt={tp("armRobot")}
              quiet
              sizes="22rem"
              className="hidden aspect-[16/9] lg:block"
            />
          </div>
        </div>
      </Reveal>

      {/* Secondary prizes. On a phone each card lays out icon-beside-text, so
          four prizes read as a calm list instead of four tall slabs. */}
      <ul className="mt-5 grid gap-4 sm:mt-6 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {ITEMS.map((item, index) => (
          <Reveal as="li" key={item} index={index}>
            <div className="tile tile-quiet flex h-full items-start gap-4 p-5 sm:flex-col sm:p-6">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-brand/40 bg-brand/15 text-lg text-brand sm:size-12 sm:text-xl"
                aria-hidden="true"
              >
                {ICONS[item]}
              </span>
              <div className="flex flex-col gap-1.5 sm:gap-2">
                <h3 className="text-base sm:text-lg">{t(`items.${item}.title`)}</h3>
                <p className="text-sm leading-relaxed text-muted">
                  {t(`items.${item}.body`)}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
