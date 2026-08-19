import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { EXTERNAL_LINK_PROPS } from "@/components/ui/Button";
import { CONTACTS, ENTRY_FEE, FAQ_KEYS, REGISTRATION_DEADLINE } from "@/config/event";
import { formatEventDate } from "@/lib/utils";

/**
 * FAQ, written as a barrier-removal tool rather than a formality.
 *
 * Q4 of the brief names the things that stop a team registering: cost of
 * preparation and travel, accommodation for out-of-town teams, unclear rules
 * and technical requirements, fear of not qualifying, and competitive anxiety.
 * There is a question here for each of them, answered plainly and without
 * overpromising anything the organisers have not actually confirmed.
 */
export async function Faq({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "faq" });

  // Values interpolated into individual answers.
  const values = {
    amount: ENTRY_FEE.amount,
    currency: ENTRY_FEE.currency,
    date: formatEventDate(REGISTRATION_DEADLINE, locale),
  };

  return (
    <Section id="faq" labelledBy="faq-title">
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
          <SectionHeader
            eyebrow={t("eyebrow")}
            id="faq-title"
            title={t("title")}
            subtitle={t("subtitle")}
          />

          <div className="rounded-lg border border-line bg-surface-muted p-5">
            <p className="font-semibold">{t("stillQuestions")}</p>
            <p className="mt-1 text-sm text-muted">{t("askUs")}</p>
            {CONTACTS.email && (
              <a
                href={`mailto:${CONTACTS.email}`}
                {...EXTERNAL_LINK_PROPS}
                className="mt-3 inline-block text-sm font-semibold text-brand underline underline-offset-4"
              >
                {CONTACTS.email}
              </a>
            )}
          </div>
        </div>

        <Accordion>
          {FAQ_KEYS.map((key, index) => (
            <AccordionItem
              key={key}
              defaultOpen={index === 0}
              question={t(`items.${key}.q`, values)}
              answer={t(`items.${key}.a`, values)}
            />
          ))}
        </Accordion>
      </div>
    </Section>
  );
}
