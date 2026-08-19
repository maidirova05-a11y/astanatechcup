import type { ReactNode } from "react";
import type { Metadata } from "next";
import { fontVariables } from "@/app/fonts";
import "@/app/globals.css";

/**
 * Admin shell.
 *
 * Lives outside the `[locale]` segment on purpose: the panel is for the
 * organising committee, who share one working language, and translating an
 * internal tool three ways would be effort spent on nobody. The public site
 * stays fully trilingual.
 *
 * This layout renders its own `<html>` because the root layout is a
 * pass-through — see the comment in `src/app/layout.tsx`.
 */

export const metadata: Metadata = {
  title: "Админ-панель · AstanaTechCup",
  // Never indexed, never followed, never previewed by a link unfurler.
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={fontVariables}>
      <body className="min-h-dvh bg-surface-sunken text-content antialiased">
        {children}
      </body>
    </html>
  );
}
