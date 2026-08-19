import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { EXTERNAL_LINK_PROPS } from "@/components/ui/Button";
import { Mail, Phone, Chat, MapPin, Globe, ArrowRight } from "@/components/ui/icons";
import { CONTACTS } from "@/config/event";

/**
 * Contacts.
 *
 * Section 9 of the brief was left entirely blank, so every field in
 * `CONTACTS` is currently null. This component renders only the channels that
 * have a value and shows an honest note when there are none — a footer full of
 * "+7 (___) ___-__-__" placeholders is worse than an acknowledged gap, and it
 * is the kind of thing that ships to production by accident.
 *
 * Fill in src/config/event.ts and the cards appear with no further changes.
 */

type Channel = {
  key: string;
  value: string | null;
  href: (value: string) => string;
  icon: ReactNode;
  external?: boolean;
};

export async function Contacts({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "contacts" });

  const channels: Channel[] = [
    {
      key: "phone",
      value: CONTACTS.phone,
      // Strip formatting: `tel:` needs digits, not "+7 (700) 123-45-67".
      href: (v) => `tel:${v.replace(/[^\d+]/g, "")}`,
      icon: <Phone />,
    },
    {
      key: "whatsapp",
      value: CONTACTS.whatsapp,
      href: (v) => `https://wa.me/${v.replace(/[^\d]/g, "")}`,
      icon: <Chat />,
      external: true,
    },
    {
      key: "telegram",
      value: CONTACTS.telegram,
      href: (v) => (v.startsWith("http") ? v : `https://t.me/${v.replace(/^@/, "")}`),
      icon: <Chat />,
      external: true,
    },
    {
      key: "email",
      value: CONTACTS.email,
      href: (v) => `mailto:${v}`,
      icon: <Mail />,
    },
    {
      key: "website",
      value: CONTACTS.website,
      href: (v) => v,
      icon: <Globe />,
      external: true,
    },
  ];

  const available = channels.filter((channel) => channel.value);
  const hasAnything = available.length > 0 || CONTACTS.address;

  return (
    <Section id="contacts" labelledBy="contacts-title" tone="muted">
      <SectionHeader
        eyebrow={t("eyebrow")}
        id="contacts-title"
        title={t("title")}
        subtitle={t("subtitle")}
      />

      {hasAnything ? (
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((channel, index) => (
            <Reveal key={channel.key} index={index}>
              <a
                href={channel.href(channel.value!)}
                {...(channel.external ? EXTERNAL_LINK_PROPS : {})}
                className="group flex h-full items-start gap-4 rounded-lg border border-line bg-surface-raised p-6 transition-[border-color,transform] duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-brand"
              >
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xl text-brand"
                  aria-hidden="true"
                >
                  {channel.icon}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-2xs font-bold uppercase tracking-wider text-subtle">
                    {t(channel.key)}
                  </span>
                  <span className="font-semibold break-words">{channel.value}</span>
                </span>
              </a>
            </Reveal>
          ))}

          {CONTACTS.address && (
            <Reveal index={available.length} className="sm:col-span-2 lg:col-span-3">
              <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xl text-brand"
                    aria-hidden="true"
                  >
                    <MapPin />
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-2xs font-bold uppercase tracking-wider text-subtle">
                      {t("address")}
                    </span>
                    <span className="font-semibold">{CONTACTS.address}</span>
                  </div>
                </div>

                {CONTACTS.mapsUrl && (
                  <a
                    href={CONTACTS.mapsUrl}
                    {...EXTERNAL_LINK_PROPS}
                    className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-brand"
                  >
                    {t("openMap")}
                    <ArrowRight className="text-base" />
                  </a>
                )}
              </div>
            </Reveal>
          )}
        </div>
      ) : (
        <p className="mt-10 rounded-lg border border-dashed border-line-strong bg-surface-raised p-6 text-muted">
          {t("empty")}
        </p>
      )}
    </Section>
  );
}
