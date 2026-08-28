import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { judgeLogout } from "@/app/judge/actions";
import { ArrowRight } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { SessionRole } from "@/lib/db/schema";

/**
 * Chrome for every screen inside the console.
 *
 * Built for a phone held in one hand at the edge of a mat: a short header, a
 * back link that is a real 44px target, and no navigation drawer to open with
 * a thumb that is also holding a clipboard.
 *
 * Sign-out is a `<form>` posting to a server action, not a link. Signing out is
 * a state change, and a GET that mutates state can be fired by a prefetch.
 */
export function JudgeShell({
  children,
  title,
  subtitle,
  role,
  back,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  role: SessionRole;
  /** Where the back chevron goes. Omit on the console's own home screen. */
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="min-h-dvh pb-16">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="container-wide flex h-16 items-center justify-between gap-3">
          <Link href="/judge" className="inline-flex min-h-11 items-center gap-3">
            <Logo className="h-6" />
            <span className="hidden text-sm font-bold uppercase tracking-wider text-subtle sm:inline">
              Судейская
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {role === "admin" && (
              <Link
                href="/admin"
                className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-content"
              >
                Админ-панель
              </Link>
            )}
            <form action={judgeLogout}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-medium text-muted transition-colors hover:border-danger hover:text-danger"
              >
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="container-wide py-6">
        {back && (
          <Link
            href={back.href}
            className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand"
          >
            <ArrowRight className="rotate-180 text-base" aria-hidden="true" />
            {back.label}
          </Link>
        )}

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl">{title}</h1>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          {actions}
        </div>

        {children}
      </main>

      <footer className="container-wide">
        <p className="rounded-md border border-line bg-surface p-4 text-xs text-muted">
          Каждый внесённый и исправленный результат записывается в журнал вместе
          с сессией, временем и предыдущим значением. Протоколы публикуются на
          сайте — не пишите в комментариях персональные данные участников.
        </p>
      </footer>
    </div>
  );
}

/* ── Small shared pieces ────────────────────────────────────────────────── */

/**
 * Feedback after a redirect.
 *
 * The mutating actions redirect with `?saved=` or `?error=` rather than
 * returning state, because a redirect after a write is what stops a refresh
 * from re-submitting the form. This turns that query string back into a line
 * the judge can read.
 */
export function Flash({ saved, error }: { saved?: string; error?: string }) {
  const message = error ? ERRORS[error] : saved ? SAVED[saved] : undefined;
  if (!message) return null;

  return (
    <p
      role="status"
      className={cn(
        "mb-5 rounded-md border p-3.5 text-sm",
        error
          ? "border-danger/30 bg-danger-surface text-danger"
          : "border-success/30 bg-success-surface text-success",
      )}
    >
      {message}
    </p>
  );
}

const SAVED: Record<string, string> = {
  team: "Команда добавлена.",
  archived: "Команда снята с соревнования.",
  match: "Протокол матча сохранён.",
  run: "Результат попытки сохранён.",
};

const ERRORS: Record<string, string> = {
  team: "Проверьте поля: нужны стартовый номер и название команды.",
  code: "Этот стартовый номер в классе уже занят.",
  match: "Проверьте пару команд: они должны быть разными и из этого класса.",
};

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface p-5", className)}>
      {children}
    </div>
  );
}

const STATE_STYLES: Record<string, string> = {
  scheduled: "bg-surface-muted text-muted",
  live: "bg-warning-surface text-warning",
  completed: "bg-success-surface text-success",
  ok: "bg-success-surface text-success",
  dnf: "bg-warning-surface text-warning",
  foul: "bg-warning-surface text-warning",
  dsq: "bg-danger-surface text-danger",
};

export const STATE_LABELS: Record<string, string> = {
  scheduled: "Запланирован",
  live: "Идёт",
  completed: "Завершён",
  ok: "Зачтено",
  dnf: "Не финишировал",
  foul: "Фол",
  dsq: "Дисквалификация",
};

export function StateBadge({ state }: { state: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-2xs font-semibold",
        STATE_STYLES[state] ?? "bg-surface-muted text-muted",
      )}
    >
      {STATE_LABELS[state] ?? state}
    </span>
  );
}
