import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { buttonClasses } from "@/components/ui/Button";
import { ArrowRight, Robot, Info } from "@/components/ui/icons";
import { getDiscipline } from "@/config/event";

/**
 * RoboSumo — the flagship section (Q7 of the brief).
 *
 * This is the page's first dark punctuation block. Everything above it is
 * light; dropping into `.on-dark` here makes the flagship read as "the arena"
 * without a single component needing dark-mode branching.
 *
 * ⚠ RoboSumo is not in the brief's disciplines table, so its age range, team
 * size and weight classes are unknown. The section states what the brief
 * actually says — the format and why it is compelling — and flags the missing
 * numbers as pending rather than inventing them.
 */
export async function Flagship({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "flagship" });
  const discipline = getDiscipline("robosumo");

  const points = [
    { title: t("point1Title"), body: t("point1Body") },
    { title: t("point2Title"), body: t("point2Body") },
    { title: t("point3Title"), body: t("point3Body") },
  ];

  return (
    <Section dark labelledBy="flagship-title" className="overflow-hidden">
      <div
        aria-hidden="true"
        className="grid-texture pointer-events-none absolute inset-0 -z-10"
      />

      <div className="grid gap-14 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20">
        <div className="flex flex-col items-start gap-7">
          <SectionHeader
            eyebrow={t("eyebrow")}
            id="flagship-title"
            title={<span className="text-gradient-brand">{t("title")}</span>}
          />

          <p className="max-w-xl text-xl font-medium leading-snug text-content">
            {t("lead")}
          </p>
          <p className="max-w-xl leading-relaxed text-muted">{t("body")}</p>

          <a href="#register" className={buttonClasses({ variant: "accent", size: "lg" })}>
            {t("cta")}
            <ArrowRight className="text-lg" />
          </a>

          {discipline?.provisional && (
            <p className="flex items-start gap-2.5 rounded-md border border-line bg-white/5 p-4 text-sm text-muted">
              <Info className="mt-0.5 shrink-0 text-base" />
              {t("provisionalNote")}
            </p>
          )}
        </div>

        <ul className="flex flex-col gap-4">
          {points.map((point, index) => (
            <Reveal as="li" key={point.title} index={index} direction="right">
              <div className="flex gap-5 rounded-lg border border-line bg-surface-raised/60 p-6 backdrop-blur-sm">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xl text-brand">
                  <Robot />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-lg">{point.title}</h3>
                  <p className="text-muted">{point.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  );
}
