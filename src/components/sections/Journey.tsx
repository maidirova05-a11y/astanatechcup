import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { JOURNEY_STEPS } from "@/config/event";

/**
 * The participant journey (Q8 of the brief).
 *
 * Q4 lists "страх не пройти отбор" and "волнение перед соревнованием" as real
 * barriers. A visible, finite, seven-step path turns an intimidating unknown
 * into a checklist — that is the entire purpose of this section, and why each
 * step says what actually happens rather than just naming a phase.
 *
 * Layout: a vertical timeline on mobile (thumb-scrollable, one step per screen
 * chunk), a horizontal one from `lg` where there is room for the connector to
 * read as progress.
 */
export async function Journey({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "journey" });

  return (
    <Section id="journey" labelledBy="journey-title">
      <SectionHeader
        eyebrow={t("eyebrow")}
        id="journey-title"
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <ol className="mt-14 grid gap-x-6 gap-y-9 lg:grid-cols-4">
        {JOURNEY_STEPS.map((step, index) => {
          const number = index + 1;
          const isLast = index === JOURNEY_STEPS.length - 1;

          return (
            <Reveal as="li" key={step} index={index} className="relative flex gap-5 lg:flex-col">
              {/* Connector. Vertical on mobile, horizontal on desktop; hidden
                  on the last item so the line does not dangle. */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute left-[1.375rem] top-12 h-[calc(100%+2.25rem)] w-px bg-line lg:left-12 lg:top-[1.375rem] lg:h-px lg:w-[calc(100%-3rem)]"
                />
              )}

              <span
                className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-brand bg-surface font-display text-lg font-extrabold text-brand"
                aria-hidden="true"
              >
                {number}
              </span>

              <div className="flex flex-col gap-1.5 pb-2">
                <p className="text-2xs font-bold uppercase tracking-wider text-subtle">
                  {t("stepLabel", { number })}
                </p>
                <h3 className="text-lg">{t(`steps.${step}.title`)}</h3>
                <p className="text-sm leading-relaxed text-muted">
                  {t(`steps.${step}.body`)}
                </p>
              </div>
            </Reveal>
          );
        })}
      </ol>
    </Section>
  );
}
