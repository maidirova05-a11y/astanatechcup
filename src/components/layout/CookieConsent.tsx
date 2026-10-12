"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Analytics } from "./Analytics";
import { YandexMetrika } from "./YandexMetrika";
import { GoogleAnalytics } from "./GoogleAnalytics";

/**
 * Cookie consent.
 *
 * Deliberate choices, because the audience includes children and parents:
 *  · "Only necessary" is a real, equally prominent button — not a link hidden
 *    in a submenu. A reject that costs more clicks than an accept is not
 *    consent.
 *  · Nothing analytic loads before an explicit choice. The banner does not
 *    "assume consent on continued browsing".
 *  · The choice is stored in localStorage, not a cookie, so declining does not
 *    itself require setting the thing the user just refused.
 *
 * Strictly necessary cookies (CSRF, locale) are not gated — they carry no
 * tracking and the site cannot function without them, which is exactly the
 * exemption they exist for.
 *
 * localStorage is an external store, so it is read through
 * `useSyncExternalStore` rather than an effect. That is what makes the server
 * snapshot ("undecided") and the client snapshot agree on the first render
 * with no flash and no cascading re-render.
 */

const STORAGE_KEY = "atc.consent.analytics";

type Choice = "granted" | "denied" | "undecided";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab deciding should dismiss the banner here too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): Choice {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : "undecided";
  } catch {
    // Private mode or storage disabled. Treat as undecided and never load
    // analytics — failing closed is the correct direction for consent.
    return "undecided";
  }
}

/**
 * On the server there is no storage, so the banner is not rendered at all.
 * A distinct value from "undecided" avoids server-rendering a banner that
 * would then vanish for anyone who has already chosen.
 */
function getServerSnapshot(): Choice {
  return "denied";
}

function decide(next: Exclude<Choice, "undecided">) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Non-fatal: the banner reappears next visit, which is the safe failure.
  }
  for (const listener of listeners) listener();
}

export function CookieConsent() {
  const t = useTranslations("consent");
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <>
      {choice === "granted" && (
        <>
          <Analytics />
          <YandexMetrika />
          <GoogleAnalytics />
        </>
      )}

      {choice === "undecided" && (
        <div
          // `role="dialog"` without `aria-modal`: it must not trap focus or
          // block the page. A visitor who ignores it can still read everything.
          role="dialog"
          aria-labelledby="consent-title"
          aria-describedby="consent-body"
          className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
        >
          {/* The same 2px-outline tile as the rest of the page, with the quiet
              edge: a banner drawn in a different language from every card
              around it reads as a third-party widget, and people dismiss
              those without reading. Side by side from `md`, so on a laptop it
              covers one short strip of the page rather than a block. */}
          <div className="container-page">
            <div className="tile tile-quiet mx-auto flex max-w-4xl flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:gap-6">
              <div className="flex flex-col gap-1.5 md:flex-1">
                <h2 id="consent-title" className="text-base font-bold">
                  {t("title")}
                </h2>
                <p id="consent-body" className="text-sm leading-relaxed text-muted">
                  {t("body")}{" "}
                  <Link
                    href="/privacy"
                    className="font-medium text-brand underline underline-offset-4"
                  >
                    {t("more")}
                  </Link>
                </p>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row md:shrink-0">
                {/* Reject is listed first and styled with equal weight. */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => decide("denied")}
                  className="sm:flex-1"
                >
                  {t("reject")}
                </Button>
                <Button
                  variant="solid"
                  size="sm"
                  onClick={() => decide("granted")}
                  className="sm:flex-1"
                >
                  {t("accept")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
