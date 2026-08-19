import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { ArrowRight, Robot, Users, Certificate, Play, Shield, Sparkle, Chat } from "@/components/ui/icons";
import { AUDIENCE_ROLES, CONTACTS, type AudienceRole } from "@/config/event";

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

  return (
    <Section id="audiences" labelledBy="audiences-title" tone="muted">
      <SectionHeader
        eyebrow={t("eyebrow")}
        id="audiences-title"
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AUDIENCE_ROLES.map((role, index) => (
          <Reveal as="li" key={role} index={index}>
            <a
              href={hrefFor(role)}
              className="group flex h-full flex-col gap-4 rounded-lg border border-line bg-surface-raised p-6 transition-[border-color,box-shadow,transform] duration-300 ease-out-expo hover:-translate-y-1 hover:border-brand hover:shadow-md"
            >
              <span
                className="flex size-11 items-center justify-center rounded-full bg-surface-muted text-xl text-brand"
                aria-hidden="true"
              >
                {ICONS[role]}
              </span>

              <h3 className="text-lg">{t(`roles.${role}.title`)}</h3>
              <p className="text-sm leading-relaxed text-muted">{t(`roles.${role}.body`)}</p>

              <span className="mt-auto inline-flex items-center gap-2 pt-2 text-sm font-semibold text-brand">
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
