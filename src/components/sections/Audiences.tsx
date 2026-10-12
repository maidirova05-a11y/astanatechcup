import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { ArrowRight, Robot, Users, Certificate, Play, Shield, Sparkle, Chat } from "@/components/ui/icons";
import { AUDIENCE_ROLES, CONTACTS, type AudienceRole } from "@/config/event";
import { PHOTOS, photoSrc } from "@/config/photos";
import Image from "next/image";

/**
 * Role-based entry points (Q6 of the brief: "несколько сценариев в зависимости
 * от роли посетителя").
 *
 * The brief marks all eight audiences as "Да", which is a recipe for a page
 * that speaks to nobody. This section is the resolution: one page, one primary
 * CTA (team registration), and an explicit fork where everyone else finds their
 * own route without diluting the main path.
 *
 * Roles whose destination is an email get a `mailto:` only when a contact
 * address actually exists. With section 9 of the brief blank, they currently
 * fall back to the contacts section rather than rendering a dead link.
 */

const ICONS: Record<AudienceRole, ReactNode> = {
  participant: <Robot />,
  parent: <Users />,
  teacher: <Certificate />,
  spectator: <Play />,
  volunteer: <Shield />,
  sponsor: <Sparkle />,
  media: <Chat />,
};

/** Where each role goes. Anchors stay in-page; the rest need a contact route. */
const TARGETS: Record<AudienceRole, { anchor: string; subject?: string }> = {
  participant: { anchor: "#register" },
  parent: { anchor: "#faq" },
  teacher: { anchor: "#register" },
  spectator: { anchor: "#contacts" },
  volunteer: { anchor: "#contacts", subject: "Volunteer application" },
  sponsor: { anchor: "#contacts", subject: "Partnership enquiry" },
  media: { anchor: "#contacts", subject: "Media accreditation" },
};

function hrefFor(role: AudienceRole): string {
  const target = TARGETS[role];
  if (target.subject && CONTACTS.email) {
    // encodeURIComponent on the subject: an unescaped subject would break the
    // mailto URL and, with a crafted value, could inject extra headers.
    return `mailto:${CONTACTS.email}?subject=${encodeURIComponent(
      `AstanaTechCup — ${target.subject}`,
    )}`;
  }
  return target.anchor;
}

export async function Audiences({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "audiences" });
  const tp = await getTranslations({ locale, namespace: "photos" });

  return (
    <Section id="audiences" labelledBy="audiences-title" tone="muted">
      <SectionHeader
        eyebrow={t("eyebrow")}
        id="audiences-title"
        title={t("title")}
        subtitle={t("subtitle")}
      />

      {/* Seven roles on a four-column grid, with the participant — the primary
          path — spanning two. That fills two full rows (2+1+1, then 1+1+1+1)
          instead of leaving one orphan card under a three-column grid, and
          gives the main route a quiet extra weight without a second colour. */}
      <ul className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
        {AUDIENCE_ROLES.map((role, index) => (
          <Reveal
            as="li"
            key={role}
            index={index}
            className={index === 0 ? "sm:col-span-2" : undefined}
          >
            <a
              href={hrefFor(role)}
              className={
                index === 0
                  ? "group tile tile-quiet tile-interactive relative flex h-full flex-col gap-3 overflow-hidden p-5 sm:p-6 sm:pr-[calc(42%+1.5rem)]"
                  : "group tile tile-quiet tile-interactive flex h-full flex-col gap-3 p-5 sm:p-6"
              }
            >
              {/* The primary route gets a photo in its spare half, from `sm`
                  up where the card spans two columns. */}
              {index === 0 && (
                <span className="absolute inset-y-0 right-0 hidden w-[42%] border-l-2 border-ink sm:block">
                  <Image
                    src={photoSrc(PHOTOS.girlAssembling)}
                    alt={tp("girlAssembling")}
                    fill
                    sizes="(min-width: 1024px) 20vw, 40vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </span>
              )}
              {/* Icon beside the title on a phone, above it from `sm` up. */}
              <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-4">
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-surface-muted text-lg text-brand sm:size-12 sm:text-xl"
                  aria-hidden="true"
                >
                  {ICONS[role]}
                </span>
                <h3 className="text-base sm:text-lg">{t(`roles.${role}.title`)}</h3>
              </div>

              <p className="max-w-md text-sm leading-relaxed text-muted">
                {t(`roles.${role}.body`)}
              </p>

              <span className="mt-auto inline-flex min-h-11 items-center gap-2 pt-1 text-sm font-semibold text-brand">
                {t(`roles.${role}.cta`)}
                <ArrowRight className="text-base transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </a>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
