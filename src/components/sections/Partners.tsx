import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { buttonClasses, EXTERNAL_LINK_PROPS } from "@/components/ui/Button";
import { ArrowRight } from "@/components/ui/icons";
import { CONTACTS, EVENT, PARTNERS } from "@/config/event";

/**
 * Organisers, partners, and the "become a sponsor" entry point.
 *
 * The brief left the partner list and the sponsor-packages question blank
 * (section 7), while confirming that partner logos exist. So the logo wall
 * renders whatever is listed in `PARTNERS` and simply says so when the list is
 * empty — no fake placeholder logos, which would be worse than an honest gap.
 */
export async function Partners({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "partners" });

  return (
    <Section id="partners" labelledBy="partners-title" tone="muted">
      <SectionHeader
        eyebrow={t("eyebrow")}
        id="partners-title"
        title={t("title")}
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {[
          { label: t("organizer"), name: EVENT.organizer },
          { label: t("coOrganizer"), name: EVENT.coOrganizer },
        ].map((entry, index) => (
          <Reveal key={entry.name} index={index}>
            <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface-raised p-6">
              <p className="text-2xs font-bold uppercase tracking-[0.16em] text-subtle">
                {entry.label}
              </p>
              <p className="font-display text-2xl font-extrabold">{entry.name}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-14">
        <h3 className="text-2xs font-bold uppercase tracking-[0.18em] text-subtle">
          {t("partnersTitle")}
        </h3>

        {PARTNERS.length > 0 ? (
          <ul className="mt-6 grid grid-cols-2 items-center gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {PARTNERS.map((partner) => {
              const logo = (
                <Image
                  src={partner.logo}
                  alt={partner.name}
                  width={180}
                  height={72}
                  // Grayscale until hover keeps a mixed-quality logo wall
                  // visually coherent — a standard trick, and it stops one
                  // bright logo dominating the row.
                  className="h-12 w-auto object-contain opacity-70 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0"
                />
              );

              return (
                <li key={partner.name} className="flex items-center justify-center">
                  {partner.url ? (
                    <a href={partner.url} {...EXTERNAL_LINK_PROPS}>
                      {logo}
                    </a>
                  ) : (
                    logo
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-subtle">{t("empty")}</p>
        )}
      </div>

      <Reveal>
        <div className="mt-14 flex flex-col gap-5 rounded-xl border border-line bg-surface-raised p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <div className="flex max-w-2xl flex-col gap-2.5">
            <h3 className="text-2xl">{t("sponsorTitle")}</h3>
            <p className="text-muted">{t("sponsorBody")}</p>
          </div>

          <a
            href={
              CONTACTS.email
                ? `mailto:${CONTACTS.email}?subject=${encodeURIComponent(
                    "AstanaTechCup — Partnership enquiry",
                  )}`
                : "#contacts"
            }
            className={buttonClasses({ variant: "solid", size: "lg", className: "shrink-0" })}
          >
            {t("sponsorCta")}
            <ArrowRight className="text-lg" />
          </a>
        </div>
      </Reveal>
    </Section>
  );
}
