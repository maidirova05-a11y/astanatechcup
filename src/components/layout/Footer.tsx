import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
// The locale-aware Link above prefixes every href. The cabinet lives outside
// the [locale] segment, so it needs the plain one.
import NextLink from "next/link";
import { Logo, OrganiserLogo } from "./Logo";
import { BRAND_ASSETS, EVENT, EVENT_YEAR, CONTACTS } from "@/config/event";
import { PHOTOS, photoPage } from "@/config/photos";
import { EXTERNAL_LINK_PROPS } from "@/components/ui/Button";

const NAV = [
  { key: "disciplines", href: "#disciplines" },
  { key: "categories", href: "/categories", page: true },
  { key: "results", href: "/results", page: true },
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

/** One credit per photographer; a repeat author links to their first photo. */
const CREDITS = Object.values(PHOTOS).filter(
  (photo, index, all) => all.findIndex((other) => other.author === photo.author) === index,
);

export async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "footer" });
  const tn = await getTranslations({ locale, namespace: "nav" });
  const tc = await getTranslations({ locale, namespace: "contacts" });
  const tp = await getTranslations({ locale, namespace: "photos" });

  const socials = SOCIALS.filter((social) => social.url);

  return (
    <footer className="on-dark border-t border-line">
      <div className="container-page py-12 md:py-16">
        {/* The two link columns sit side by side even on a phone: stacked,
            they made a footer more than a screen tall of nothing but links. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.5fr_1fr_1fr] md:gap-12">
          <div className="flex flex-col gap-4 col-span-2 md:col-span-1">
            <Logo className="h-10 self-start" plate />
            <p className="max-w-sm text-sm leading-relaxed text-muted">{t("tagline")}</p>
            {/* Both marks are dark-on-transparent, so on this dark surface
                they need the same white plate the championship mark uses. */}
            <div className="flex flex-wrap items-center gap-3">
              <OrganiserLogo asset={BRAND_ASSETS.organizer} className="h-10" plate />
              <OrganiserLogo asset={BRAND_ASSETS.coOrganizer} className="h-10" plate />
            </div>
          </div>

          <nav aria-label={t("sections")} className="flex flex-col">
            <h2 className="mb-2 text-2xs font-bold uppercase tracking-[0.18em] text-subtle">
              {t("sections")}
            </h2>
            {NAV.map((item) => (
              <a
                key={item.key}
                href={"page" in item ? `/${locale}${item.href}` : item.href}
                className="inline-flex min-h-11 items-center self-start text-sm text-muted transition-colors duration-200 hover:text-content"
              >
                {tn(item.key)}
              </a>
            ))}
          </nav>

          <nav aria-label={t("legal")} className="flex flex-col">
            <h2 className="mb-2 text-2xs font-bold uppercase tracking-[0.18em] text-subtle">
              {t("legal")}
            </h2>
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center self-start text-sm text-muted transition-colors duration-200 hover:text-content"
            >
              {t("privacy")}
            </Link>
            <Link
              href="/terms"
              className="inline-flex min-h-11 items-center self-start text-sm text-muted transition-colors duration-200 hover:text-content"
            >
              {t("terms")}
            </Link>
            <Link
              href="/oferta"
              className="inline-flex min-h-11 items-center self-start text-sm text-muted transition-colors duration-200 hover:text-content"
            >
              {t("oferta")}
            </Link>
            <NextLink
              href="/coach"
              className="inline-flex min-h-11 items-center self-start text-sm text-muted transition-colors duration-200 hover:text-content"
            >
              {t("coachCabinet")}
            </NextLink>

            {socials.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4">
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

        <hr className="rule-fade my-8 md:my-10" />

        <div className="flex flex-col items-start justify-between gap-2 text-xs text-subtle sm:flex-row sm:items-center sm:gap-6">
          <p>{t("rights", { year: EVENT_YEAR, organizer: EVENT.organizer })}</p>
          <p>{t("madeFor")}</p>
        </div>

        {/* Photo credits. Unsplash does not require them, but the photos are
            illustrative stock, and saying so plainly is what keeps them from
            being read as pictures of the championship. */}
        <p className="mt-4 max-w-4xl text-2xs leading-relaxed text-subtle">
          {tp("creditNote")}{" "}
          {CREDITS.map((photo, index, all) => (
            <span key={photo.id}>
              <a
                href={photoPage(photo)}
                {...EXTERNAL_LINK_PROPS}
                className="underline decoration-line-strong underline-offset-2 hover:text-muted"
              >
                {photo.author}
              </a>
              {index < all.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
      </div>
    </footer>
  );
}
