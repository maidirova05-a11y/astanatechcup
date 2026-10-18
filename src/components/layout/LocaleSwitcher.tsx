"use client";

import { useTransition } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, LOCALE_SHORT, LOCALE_LABELS, type Locale } from "@/i18n/routing";
import { Globe } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Language switcher (Q13 of the brief: an in-page switcher, not separate sites).
 *
 * Three short locales, so this is a segmented toggle rather than a dropdown —
 * one tap instead of two, and every option stays visible, which matters in a
 * multilingual country where the auto-detected language is often the wrong one.
 *
 * It preserves the current path, so switching language from halfway down the
 * privacy policy keeps you on the privacy policy.
 */
export function LocaleSwitcher({
  className,
  size = "sm",
}: {
  className?: string;
  /**
   * `sm` (36px segments) fits the 72px header bar beside the register
   * button. `md` (44px segments) is for the mobile menu, where it is tapped
   * with a thumb and the 44px touch-target minimum applies.
   */
  size?: "sm" | "md";
}) {
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  const current = (params.locale as Locale) ?? routing.defaultLocale;

  function switchTo(locale: Locale) {
    if (locale === current) return;
    startTransition(() => {
      // `pathname` here is already locale-stripped by next-intl's navigation
      // helpers, so this swaps the prefix without duplicating it.
      router.replace(
        // @ts-expect-error — dynamic params are re-applied by the router.
        { pathname, params },
        { locale, scroll: false },
      );
    });
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-raised p-0.5",
        isPending && "opacity-60",
        className,
      )}
      role="group"
      aria-label={t("language")}
    >
      <Globe className="ml-2 mr-0.5 text-sm text-subtle" />
      {routing.locales.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => switchTo(locale)}
            // `aria-current` tells a screen reader which one is active without
            // relying on the visual highlight.
            aria-current={active ? "true" : undefined}
            // The visible label is an abbreviation; the accessible name is the
            // language's own endonym.
            aria-label={LOCALE_LABELS[locale]}
            lang={locale}
            className={cn(
              "inline-flex items-center justify-center rounded-full px-3 label-caps transition-colors duration-200",
              size === "md" ? "min-h-11 min-w-12" : "min-h-9 min-w-10",
              active
                ? "bg-brand text-on-brand"
                : "text-muted hover:bg-surface-muted hover:text-content",
            )}
          >
            {LOCALE_SHORT[locale]}
          </button>
        );
      })}
    </div>
  );
}
