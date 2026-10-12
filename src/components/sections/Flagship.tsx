import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { buttonClasses } from "@/components/ui/Button";
import { ArrowRight, Info } from "@/components/ui/icons";
import { RobotSumo } from "@/components/ui/robots";
import { getDiscipline } from "@/config/event";
import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { PHOTOS } from "@/config/photos";

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
  const tp = await getTranslations({ locale, namespace: "photos" });
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

      {/* Two sumo bots squaring up behind the copy — the section's subject,
          rendered rather than described. Decorative and non-interactive. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-8 hidden gap-2 opacity-90 lg:flex"
      >
        <span className="text-[5.5rem]" style={{ "--r-accent": "var(--magenta-500)" } as React.CSSProperties}>
          <RobotSumo className="animate-float" />
        </span>
        <span className="text-[5.5rem] -scale-x-100" style={{ "--r-accent": "var(--electric-500)" } as React.CSSProperties}>
          <RobotSumo className="animate-float-slow" />
        </span>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
        <div className="flex flex-col items-start gap-6">
          <SectionHeader
            eyebrow={t("eyebrow")}
            id="flagship-title"
            title={<span className="text-gradient-brand">{t("title")}</span>}
          />

          <p className="max-w-xl text-lg font-semibold leading-snug text-content">
            {t("lead")}
          </p>
          <p className="max-w-xl leading-relaxed text-muted">{t("body")}</p>

          <a href="#register" className={buttonClasses({ variant: "accent", size: "md" })}>
            {t("cta")}
            <ArrowRight className="text-base" />
          </a>

          {discipline?.provisional && (
            <p className="flex items-start gap-2.5 rounded-md border-2 border-dashed border-line bg-white/5 p-4 text-sm text-muted">
              <Info className="mt-0.5 shrink-0 text-base" />
              {t("provisionalNote")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {/* A real robot in the arena palette, above the three points: the
              column opens on a picture instead of a third wall of cards. */}
          <PhotoFrame
            photo={PHOTOS.trackedRobot}
            alt={tp("trackedRobot")}
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="aspect-[16/9]"
          />

        <ul className="flex flex-col gap-4">
          {points.map((point, index) => (
            <Reveal as="li" key={point.title} index={index} direction="right">
              <div className="tile tile-quiet flex gap-4 p-5 sm:gap-5 sm:p-6">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-lg border-2 border-brand/40 bg-brand/15 text-3xl"
                  style={{ "--r-accent": "var(--gold-400)" } as React.CSSProperties}
                >
                  <RobotSumo />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg">{point.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{point.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
        </div>
      </div>
    </Section>
  );
}
