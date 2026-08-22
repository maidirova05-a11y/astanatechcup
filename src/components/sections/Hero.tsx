import { getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { ArrowRight, ArrowDown, Calendar, MapPin, Play } from "@/components/ui/icons";
import { RobotHero, RobotDrone } from "@/components/ui/robots";
import { OrganiserLogo } from "@/components/layout/Logo";
import {
  BRAND_ASSETS,
  COUNTDOWN_TARGET,
  EVENT_YEAR,
  QUALIFIER_START,
  QUALIFIER_END,
  REGISTRATION_DEADLINE,
  TRAILER_URL,
  isRegistrationOpen,
} from "@/config/event";
import { eventDay, eventMonth, formatEventDate, monthGenitive } from "@/lib/utils";
import { EXTERNAL_LINK_PROPS } from "@/components/ui/Button";

/**
 * Hero.
 *
 * Carries the four things a visitor needs in the first screenful: what this is,
 * when and where, what to do next, and how long they have to do it. The
 * countdown sits above the fold on purpose — the brief names the deadline as a
 * hard constraint and "количество мест ограничено" is the strongest honest
 * motivator available.
 */
export async function Hero({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "hero" });

  const open = isRegistrationOpen();

  const dates = t("dates", {
    start: eventDay(QUALIFIER_START),
    end: eventDay(QUALIFIER_END),
    month: monthGenitive(locale, eventMonth(QUALIFIER_START)),
  });

  return (
    <section className="relative overflow-hidden bg-surface-muted">
      {/* Decorative background. aria-hidden and pointer-events-none so it can
          never intercept a tap or be announced. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="aurora absolute inset-x-0 -top-32 h-[46rem] opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface" />
      </div>

      <div className="container-page relative pb-20 pt-14 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div className="flex flex-col items-start gap-7">
            <p className="inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-surface-raised/70 px-4 py-2 text-2xs font-bold uppercase tracking-[0.14em] text-brand backdrop-blur-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              {t("badge", { year: EVENT_YEAR })}
            </p>

            <h1 className="text-4xl sm:text-5xl">
              <span className="block">{t("titleLine1")}</span>
              <span className="block">{t("titleLine2")}</span>
              <span className="block text-brand">{t("titleLine3")}</span>
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-muted">
              {t("subtitle")}
            </p>

            <dl className="flex flex-wrap items-center gap-x-7 gap-y-3 text-sm font-medium">
              <div className="flex items-center gap-2.5">
                {/* The icon is decorative, so each term carries the real,
                    screen-reader-only label. A <dd> without a <dt> would be
                    invalid markup and read as an orphan value. */}
                <dt className="sr-only">{t("datesLabel")}</dt>
                <Calendar className="text-lg text-brand" aria-hidden="true" />
                <dd>{dates}</dd>
              </div>
              <div className="flex items-center gap-2.5">
                <dt className="sr-only">{t("venueLabel")}</dt>
                <MapPin className="text-lg text-brand" aria-hidden="true" />
                <dd>{t("venue")}</dd>
              </div>
            </dl>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#register"
                className={buttonClasses({ variant: "accent", size: "lg" })}
              >
                {open ? t("ctaPrimary") : t("closed")}
                <ArrowRight className="text-lg" />
              </a>

              {TRAILER_URL ? (
                <a
                  href={TRAILER_URL}
                  {...EXTERNAL_LINK_PROPS}
                  className={buttonClasses({ variant: "outline", size: "lg" })}
                >
                  <Play className="text-base" />
                  {t("ctaTrailer")}
                </a>
              ) : (
                <a
                  href="#disciplines"
                  className={buttonClasses({ variant: "outline", size: "lg" })}
                >
                  {t("ctaSecondary")}
                  <ArrowDown className="text-lg" />
                </a>
              )}
            </div>

            {/* Credits carried by the marks themselves. Each logo's alt text is
                the organisation's name, and the visible label says which role
                it plays, so nothing is lost without images. */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-2xs font-bold uppercase tracking-[0.14em] text-subtle">
                  {t("organizedBy")}
                </span>
                <OrganiserLogo asset={BRAND_ASSETS.organizer} className="h-9" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-2xs font-bold uppercase tracking-[0.14em] text-subtle">
                  {t("coOrganizedBy")}
                </span>
                <OrganiserLogo asset={BRAND_ASSETS.coOrganizer} className="h-6" />
              </div>
            </div>
          </div>

          {/* Deadline card, with the championship mascot leaning on it. The
              robots are decorative: aria-hidden, and pointer-events-none so
              they can never intercept a tap meant for the CTA. */}
          <div className="relative w-full">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 -right-2 z-10 hidden text-[7rem] sm:block lg:-top-20 lg:text-[8.5rem]"
              style={{ "--r-accent": "var(--electric-500)" } as React.CSSProperties}
            >
              <RobotHero className="animate-float drop-shadow-[0_6px_0_rgba(20,23,42,0.12)]" />
            </div>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-10 -left-8 z-10 hidden text-6xl lg:block"
              style={{ "--r-accent": "var(--magenta-500)" } as React.CSSProperties}
            >
              <RobotDrone className="animate-float-slow" />
            </div>

          <aside className="relative w-full tile bg-surface-raised p-6 sm:p-8">
            {open ? (
              <>
                <p className="text-2xs font-bold uppercase tracking-[0.16em] text-accent">
                  {t("deadlineLabel")}
                </p>
                <Countdown targetMs={COUNTDOWN_TARGET.getTime()} className="mt-5" />
                <p className="mt-5 border-t border-line pt-5 text-sm text-muted">
                  {t("deadlineDate", {
                    date: formatEventDate(REGISTRATION_DEADLINE, locale),
                  })}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xs font-bold uppercase tracking-[0.16em] text-accent">
                  {t("closed")}
                </p>
                <p className="mt-4 text-muted">{t("closedNote", { year: EVENT_YEAR })}</p>
              </>
            )}
          </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
