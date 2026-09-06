import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { coachLogout } from "@/app/coach/actions";

/**
 * Chrome for the signed-in cabinet.
 *
 * Sign-out is a `<form>` posting to a server action rather than a link: it is
 * a state change, and a GET that mutates state can be fired by a link
 * prefetch — which would sign a coach out simply for hovering.
 */
export function CoachShell({
  children,
  title,
  subtitle,
  email,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  email: string;
}) {
  return (
    <div className="min-h-dvh pb-16">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="container-wide flex h-16 items-center justify-between gap-3">
          <Link href="/coach" className="inline-flex min-h-11 items-center gap-3">
            <Logo className="h-6" />
            <span className="hidden text-sm font-bold uppercase tracking-wider text-subtle sm:inline">
              Кабинет тренера
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden max-w-[16rem] truncate text-sm text-muted md:inline">
              {email}
            </span>
            <form action={coachLogout}>
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
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>

        {children}
      </main>
    </div>
  );
}

/** A sign-in / activation card, shared by both unauthenticated screens. */
export function CoachGate({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo className="h-8" />
        </div>

        <div className="rounded-xl border border-line bg-surface p-7 shadow-lg">
          <h1 className="text-2xl">{title}</h1>
          <p className="mt-2 text-sm text-muted">{intro}</p>
          {children}
        </div>

        {footer}

        <p className="mt-6 text-center text-xs text-subtle">
          Неудачные попытки фиксируются. После пяти подряд вход с этого адреса
          блокируется на 15 минут.
        </p>
      </div>
    </div>
  );
}
