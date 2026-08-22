"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "./Logo";
import { buttonClasses } from "@/components/ui/Button";
import { Menu, Close } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Sticky header.
 *
 * The nav links are in-page anchors, so they are plain `<a href="#...">` rather
 * than router links — a hash navigation must not trigger a route transition.
 * `scroll-padding-top` in globals.css keeps the header from covering the
 * section a link lands on.
 */

const NAV = [
  { key: "disciplines", href: "#disciplines" },
  { key: "journey", href: "#journey" },
  { key: "prizes", href: "#prizes" },
  { key: "faq", href: "#faq" },
  { key: "contacts", href: "#contacts" },
] as const;

export function Header({ locale }: { locale: string }) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Solid background only once the hero has scrolled behind it — over the hero
  // the header floats.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock the page behind the mobile menu, and close it on Escape.
  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300",
        scrolled
          ? "bg-surface/85 shadow-sm backdrop-blur-lg"
          : "bg-transparent",
      )}
    >
      <div className="container-page flex h-18 items-center justify-between gap-4 py-3">
        <a
          href={`/${locale}`}
          className="inline-flex min-h-11 shrink-0 items-center rounded-sm"
          aria-label={t("home")}
        >
          <Logo className="h-9" priority />
        </a>

        <nav aria-label={tc("menu")} className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-content"
            >
              {t(item.key)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <a
            href="#register"
            className={buttonClasses({ variant: "accent", size: "sm", className: "hidden sm:inline-flex" })}
          >
            {t("register")}
          </a>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={tc("menu")}
            className="inline-flex size-11 items-center justify-center rounded-full border border-line text-xl lg:hidden"
          >
            {menuOpen ? <Close /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile panel. Rendered only when open so its links are not reachable
          by keyboard while hidden. */}
      {menuOpen && (
        <div
          id="mobile-menu"
          className="border-t border-line bg-surface lg:hidden"
        >
          <nav aria-label={tc("menu")} className="container-page flex flex-col py-4">
            {NAV.map((item) => (
              <a
                key={item.key}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="border-b border-line py-4 text-lg font-semibold last:border-b-0"
              >
                {t(item.key)}
              </a>
            ))}

            <div className="mt-5 flex items-center justify-between gap-3">
              <LocaleSwitcher />
              <a
                href="#register"
                onClick={() => setMenuOpen(false)}
                className={buttonClasses({ variant: "accent", size: "sm" })}
              >
                {t("register")}
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
