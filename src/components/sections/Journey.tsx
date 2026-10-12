import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { JOURNEY_STEPS } from "@/config/event";
import { cn } from "@/lib/utils";
import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { PHOTOS } from "@/config/photos";

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
  const tp = await getTranslations({ locale, namespace: "photos" });

  return (
    <Section id="journey" labelledBy="journey-title">
      {/* The header shares its row with a photo on desktop; on smaller
          screens the photo is dropped so the steps start sooner. */}
      <div className="grid items-end gap-8 lg:grid-cols-[1fr_20rem] xl:grid-cols-[1fr_24rem]">
        <SectionHeader
          eyebrow={t("eyebrow")}
          id="journey-title"
          title={t("title")}
          subtitle={t("subtitle")}
        />
        <PhotoFrame
          photo={PHOTOS.lineFollower}
          alt={tp("lineFollower")}
          quiet
          sizes="24rem"
          className="hidden aspect-[4/3] rotate-2 lg:block"
        />
      </div>

      <ol className="mt-10 grid gap-x-6 gap-y-9 sm:mt-12 lg:grid-cols-4 lg:gap-y-10">
        {JOURNEY_STEPS.map((step, index) => {
          const number = index + 1;
          const isLast = index === JOURNEY_STEPS.length - 1;
          // Last cell of a four-column row on desktop: the next step starts a
          // new row, so a horizontal connector here would point at nothing.
          const endsRow = number % 4 === 0;

          return (
            <Reveal as="li" key={step} index={index} className="relative flex gap-5 lg:flex-col">
              {/* Connector. Vertical on mobile, horizontal on desktop; hidden
                  on the last item (and, on desktop, at the end of each row)
                  so the line does not dangle. The mobile height is the
                  circle's offset plus the list's 2.25rem row gap. */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-[calc(1.375rem-1.5px)] top-12 h-[calc(100%+2.25rem)] w-[3px] rounded-full bg-line-strong lg:left-12 lg:top-[calc(1.375rem-1.5px)] lg:h-[3px] lg:w-[calc(100%-3rem)]",
                    endsRow && "lg:hidden",
                  )}
                />
              )}

              <span
                className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-surface font-display text-lg font-extrabold text-brand shadow-[0_3px_0_0_var(--ink)]"
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
