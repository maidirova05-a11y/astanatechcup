import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { RegistrationForm } from "@/components/forms/RegistrationForm";
import { Check, Warning } from "@/components/ui/icons";
import { CSRF_HEADER, FORM_TS_HEADER } from "@/lib/security/csrf";
import { env } from "@/lib/env";
import {
  ENTRY_FEE,
  EVENT_YEAR,
  REGISTRATION_DEADLINE,
  isRegistrationOpen,
} from "@/config/event";
import { formatEventDate } from "@/lib/utils";

/**
 * Registration section.
 *
 * Server component, for two reasons:
 *  · it reads the CSRF token that `src/proxy.ts` forwarded on the request and
 *    hands it to the form as a prop. That is what lets the CSRF cookie stay
 *    HttpOnly — client JavaScript never has to read it;
 *  · the deadline is evaluated on the server clock, so a visitor cannot open
 *    the form after the deadline by changing their system time.
 */
export async function Registration({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "registration" });

  const headerList = await headers();
  const csrfToken = headerList.get(CSRF_HEADER) ?? "";
  // Both tokens are minted per request in src/proxy.ts and travel to the
  // browser inside the form, never through client JavaScript.
  const formTimestamp = headerList.get(FORM_TS_HEADER) ?? "";

  const open = isRegistrationOpen();
  const deadline = formatEventDate(REGISTRATION_DEADLINE, locale);

  const includes = [t("feeIncludes1"), t("feeIncludes2"), t("feeIncludes3")];

  return (
    <Section id="register" labelledBy="register-title">
      <SectionHeader
        eyebrow={t("eyebrow")}
        id="register-title"
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
        <div className="order-2 lg:order-1">
          {open ? (
            <RegistrationForm
              csrfToken={csrfToken}
              formTimestamp={formTimestamp}
              locale={locale}
              turnstileSiteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            />
          ) : (
            <div className="flex items-start gap-4 rounded-xl border border-line bg-surface-muted p-8">
              <Warning className="mt-0.5 shrink-0 text-xl text-accent" />
              <div className="flex flex-col gap-2">
                <h3 className="text-xl">{t("closed")}</h3>
                <p className="text-muted">{t("closedBody", { year: EVENT_YEAR })}</p>
              </div>
            </div>
          )}
        </div>

        {/* Fee summary. Sticky on desktop so the price and what it buys stay
            visible while the visitor works down a long form — this is the
            single most common reason someone abandons a paid registration. */}
        <aside className="order-1 lg:order-2 lg:sticky lg:top-28 lg:self-start">
          <div className="flex flex-col gap-6 rounded-xl border border-line bg-surface-muted p-7">
            <div className="flex flex-col gap-1">
              <p className="text-2xs font-bold uppercase tracking-[0.16em] text-subtle">
                {t("feeLabel")}
              </p>
              <p className="font-display text-4xl font-extrabold text-brand">
                {t("feeValue", { amount: ENTRY_FEE.amount, currency: ENTRY_FEE.currency })}
              </p>
              <p className="text-sm text-muted">{t("feePer")}</p>
            </div>

            <hr className="rule-fade" />

            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold">{t("feeIncludesTitle")}</p>
              <ul className="flex flex-col gap-2.5">
                {includes.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-muted">
                    <Check className="mt-0.5 shrink-0 text-base text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <p className="rounded-md bg-surface-raised p-3.5 text-sm font-medium">
              {t("deadlineNote", { date: deadline })}
            </p>
          </div>
        </aside>
      </div>
    </Section>
  );
}
