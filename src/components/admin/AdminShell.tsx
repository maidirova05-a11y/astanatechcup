import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { logout } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

/**
 * Chrome for every authenticated admin page: header, nav, sign-out.
 *
 * The sign-out control is a real `<form>` posting to a server action rather
 * than a link. Logging out is a state change, and a GET that mutates state can
 * be triggered by a prefetch, an image tag or an over-eager link scanner.
 */

const NAV = [
  { href: "/admin", label: "Сводка" },
  { href: "/admin/applications", label: "Заявки" },
] as const;

export function AdminShell({
  children,
  active,
  title,
  actions,
}: {
  children: ReactNode;
  active: "dashboard" | "applications";
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="container-wide flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="inline-flex min-h-11 items-center">
              <Logo className="h-7 w-auto" />
            </Link>

            <nav aria-label="Разделы админ-панели" className="flex items-center gap-1">
              {NAV.map((item) => {
                const isActive =
                  (active === "dashboard" && item.href === "/admin") ||
                  (active === "applications" && item.href === "/admin/applications");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-surface-muted text-content"
                        : "text-muted hover:bg-surface-muted hover:text-content",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-medium text-muted transition-colors hover:border-danger hover:text-danger"
            >
              Выйти
            </button>
          </form>
        </div>
      </header>

      <main className="container-wide py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl">{title}</h1>
          {actions}
        </div>
        {children}
      </main>

      <footer className="container-wide pb-10">
        <p className="rounded-md border border-warning/40 bg-warning-surface p-4 text-sm">
          <strong>Персональные данные несовершеннолетних.</strong> Не выгружайте
          и не пересылайте эти данные без необходимости. Каждая выгрузка
          записывается в журнал.
        </p>
      </footer>
    </div>
  );
}

/** Small labelled statistic used across the dashboard. */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-5">
      <p className="text-2xs font-bold uppercase tracking-wider text-subtle">{label}</p>
      <p className="tabular font-display text-3xl font-extrabold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending_payment: "bg-warning-surface text-warning",
  paid: "bg-surface-muted text-brand",
  confirmed: "bg-success-surface text-success",
  cancelled: "bg-surface-muted text-muted",
  rejected: "bg-danger-surface text-danger",
};

export const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Ожидает оплаты",
  paid: "Оплачена",
  confirmed: "Подтверждена",
  cancelled: "Отменена",
  rejected: "Отклонена",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-2xs font-semibold",
        STATUS_STYLES[status] ?? "bg-surface-muted text-muted",
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
