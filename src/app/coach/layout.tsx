import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/app/fonts";
import "@/app/globals.css";

/**
 * Coaches' cabinet shell.
 *
 * Outside the `[locale]` segment for now — see the note in src/proxy.ts, which
 * is the honest version: this is the one surface where the single-language
 * argument is weak, because a coach is a member of the public and the rest of
 * the site speaks to them in three languages.
 *
 * `noindex` for the obvious reason: every page behind here is one team's data.
 * The sign-in page is excluded from the sitemap for the same reason.
 *
 * Renders its own `<html>` because the root layout is a pass-through — see the
 * comment in src/app/layout.tsx.
 */

export const metadata: Metadata = {
  title: "Кабинет тренера · AstanaTechCup",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00243c",
};

export default function CoachLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={fontVariables}>
      <body className="min-h-dvh bg-surface-sunken text-content antialiased">
        {children}
      </body>
    </html>
  );
}
