import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { buttonClasses, EXTERNAL_LINK_PROPS } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Rise } from "@/components/ui/Rise";
import { ArrowRight, ArrowDown, Calendar, MapPin, Play } from "@/components/ui/icons";
import { HeroRobot } from "./HeroRobot";
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

/**
 * Hero.
 *
 * Carries the four things a visitor needs in the first screenful: what this is,
 * when and where, what to do next, and how long they have to do it.
 *
 * ── Composition ─────────────────────────────────────────────────────────
 * The mascot holding the championship logo is the anchor — it states the brand
 * and the tone in one image, before a word is read. The headline sits beside
 * it, and the deadline card sits beneath the robot rather than opposite it, so
 * the eye travels: robot → headline → CTA → deadline.
 *
 * Everything enters on mount through `Rise`, ordered by `step` rather than by
 * DOM position, so the choreography can be retuned without moving markup.
 * `Rise` animates on mount and not on intersection: the hero is on screen
 * immediately, and making the most important content wait for an observer that
 * might never fire is not a risk worth taking.
 * ─────────────────────────────────────────────────────────────────────────
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
        <div className="aurora absolute inset-x-0 -top-32 h-[46rem] opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface" />
      </div>

      <div className="container-page relative pb-20 pt-10 sm:pb-24 sm:pt-14 lg:pb-28 lg:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          {/* ── Copy column ── */}
          <div className="flex flex-col items-start gap-6 lg:order-1">
            <Rise step={0} as="p" className="inline-flex items-center gap-2.5 rounded-full border-2 border-ink bg-surface-raised px-4 py-2 text-2xs font-bold uppercase tracking-[0.14em] text-brand shadow-[0_3px_0_0_var(--ink)]">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              {t("badge", { year: EVENT_YEAR })}
            </Rise>

            {/* The three lines the brief asked to keep, entering one after the
                other so the promise builds rather than lands all at once. */}
            <h1 className="text-4xl sm:text-5xl">
              <Rise step={1} as="span" className="block">
                {t("titleLine1")}
              </Rise>
              <Rise step={2} as="span" className="block">
                {t("titleLine2")}
              </Rise>
              <Rise step={3} as="span" className="block text-brand">
                {t("titleLine3")}
              </Rise>
            </h1>

            <Rise step={4} as="p" className="max-w-xl text-lg leading-relaxed text-muted">
              {t("subtitle")}
            </Rise>

            <Rise step={5}>
              <dl className="flex flex-wrap items-center gap-x-7 gap-y-3 text-sm font-semibold">
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
            </Rise>

            <Rise step={6}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <a href="#register" className={buttonClasses({ variant: "accent", size: "lg" })}>
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
            </Rise>

            {/* Credits carried by the marks themselves. Each logo's alt text is
                the organisation's name and the visible label says which role it
                plays, so nothing is lost with images off. */}
            <Rise step={7}>
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
            </Rise>
          </div>

          {/* ── Mascot column ── */}
          <div className="flex flex-col items-center gap-8 lg:order-2">
            <HeroRobot
              className="w-full max-w-md lg:max-w-lg"
              // The mascot wears the structural blue so the magenta stays
              // exclusively the colour of the call to action.
              style={{ "--r-accent": "var(--electric-500)" } as CSSProperties}
            />

            <Rise step={8} distance={26} className="w-full">
              <aside className="tile w-full bg-surface-raised p-6 sm:p-7">
                {open ? (
                  <>
                    <p className="text-2xs font-bold uppercase tracking-[0.16em] text-accent">
                      {t("deadlineLabel")}
                    </p>
                    <Countdown targetMs={COUNTDOWN_TARGET.getTime()} className="mt-4" />
                    <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
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
            </Rise>
          </div>
        </div>
      </div>
    </section>
  );
}
