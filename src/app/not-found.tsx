import { routing } from "@/i18n/routing";
import { fontVariables } from "@/app/fonts";
import "@/app/globals.css";

/**
 * Root 404, for paths that never reached a locale segment.
 *
 * It renders its own `<html>` because the root layout is a pass-through — see
 * the comment in `src/app/layout.tsx`. Copy is hardcoded in the default locale
 * rather than translated: there is no locale context this far up, and guessing
 * one to render a 404 is not worth a request-time lookup.
 */
export default function RootNotFound() {
  return (
    <html lang="ru-KZ" className={fontVariables}>
      <body className="min-h-dvh bg-surface text-content antialiased">
        <div className="section">
          <div className="container-prose flex flex-col items-start gap-6">
            <p className="font-display text-6xl font-extrabold text-brand">404</p>
            <h1 className="text-4xl">Страница не найдена</h1>
            <p className="text-lg text-muted">
              Похоже, такой страницы нет. Вернитесь на главную — там всё о чемпионате.
            </p>
            <a
              href={`/${routing.defaultLocale}`}
              className="inline-flex h-14 items-center justify-center rounded-full bg-brand-strong px-8 text-lg font-semibold text-on-brand"
            >
              На главную
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
