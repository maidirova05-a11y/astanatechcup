import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo, OrganiserLogo } from "./Logo";
import { BRAND_ASSETS, EVENT, EVENT_YEAR, CONTACTS } from "@/config/event";
import { EXTERNAL_LINK_PROPS } from "@/components/ui/Button";

const NAV = [
  { key: "disciplines", href: "#disciplines" },
  { key: "journey", href: "#journey" },
  { key: "prizes", href: "#prizes" },
  { key: "faq", href: "#faq" },
  { key: "contacts", href: "#contacts" },
] as const;

/** Social links render only for channels the organisers actually supplied. */
const SOCIALS = [
  { key: "instagram", url: CONTACTS.instagram },
  { key: "tiktok", url: CONTACTS.tiktok },
  { key: "youtube", url: CONTACTS.youtube },
  { key: "telegram", url: CONTACTS.telegram },
] as const;

export async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "footer" });
  const tn = await getTranslations({ locale, namespace: "nav" });
  const tc = await getTranslations({ locale, namespace: "contacts" });

  const socials = SOCIALS.filter((social) => social.url);

  return (
    <footer className="on-dark border-t border-line">
      <div className="container-page py-16">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <Logo className="h-11" plate />
            <p className="max-w-sm text-muted">{t("tagline")}</p>
            {/* Both marks are dark-on-transparent, so on this dark surface
                they need the same white plate the championship mark uses. */}
            <div className="flex flex-wrap items-center gap-3">
              <OrganiserLogo asset={BRAND_ASSETS.organizer} className="h-10" plate />
              <OrganiserLogo asset={BRAND_ASSETS.coOrganizer} className="h-10" plate />
            </div>
          </div>

          <nav aria-label={t("sections")} className="flex flex-col gap-3">
            <h2 className="text-2xs font-bold uppercase tracking-[0.18em] text-subtle">
              {t("sections")}
            </h2>
            {NAV.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className="inline-flex min-h-11 items-center text-muted transition-colors duration-200 hover:text-content"
              >
                {tn(item.key)}
              </a>
            ))}
          </nav>

          <nav aria-label={t("legal")} className="flex flex-col gap-3">
            <h2 className="text-2xs font-bold uppercase tracking-[0.18em] text-subtle">
              {t("legal")}
            </h2>
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center text-muted transition-colors duration-200 hover:text-content"
            >
              {t("privacy")}
            </Link>
            <Link
              href="/terms"
              className="inline-flex min-h-11 items-center text-muted transition-colors duration-200 hover:text-content"
            >
              {t("terms")}
            </Link>

            {socials.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {socials.map((social) => (
                  <a
                    key={social.key}
                    href={social.url!}
                    {...EXTERNAL_LINK_PROPS}
                    className="inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 transition-colors duration-200 hover:text-content hover:underline"
                  >
                    {tc(social.key)}
                  </a>
                ))}
              </div>
            )}
          </nav>
        </div>

        <hr className="rule-fade my-10" />

        <div className="flex flex-col items-start justify-between gap-3 text-sm text-subtle sm:flex-row sm:items-center">
          <p>{t("rights", { year: EVENT_YEAR, organizer: EVENT.organizer })}</p>
          <p>{t("madeFor")}</p>
        </div>
      </div>
    </footer>
  );
}
