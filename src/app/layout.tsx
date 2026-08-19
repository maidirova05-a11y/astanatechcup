import type { ReactNode } from "react";

/**
 * The real document shell lives in `app/[locale]/layout.tsx`, because `<html
 * lang>` has to be the negotiated locale and this layout runs above the locale
 * segment. So this one is a pass-through.
 *
 * `app/not-found.tsx` renders its own `<html>` for the same reason.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
