import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/app/fonts";
import "@/app/globals.css";

/**
 * Judges' console shell.
 *
 * Outside the `[locale]` segment, like the admin panel: the referee crew shares
 * one working language, and translating an internal tool three ways is effort
 * spent on nobody.
 *
 * This layout renders its own `<html>` because the root layout is a
 * pass-through — see the comment in src/app/layout.tsx.
 */

export const metadata: Metadata = {
  title: "Судейская · AstanaTechCup",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The console is used one-handed, on a phone, standing at the edge of a mat.
 * `maximumScale` is deliberately left alone — pinch-zoom is how a referee reads
 * a start number in bad light, and blocking it to stop iOS zooming a focused
 * input is a trade nobody at a venue would take.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00243c",
};

export default function JudgeLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={fontVariables}>
      <body className="min-h-dvh bg-surface-sunken text-content antialiased">
        {children}
      </body>
    </html>
  );
}
