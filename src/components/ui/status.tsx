import { cn } from "@/lib/utils";

/**
 * The application status vocabulary, in one place.
 *
 * It used to live in AdminShell.tsx, which also imports the admin sign-out
 * action. The coaches' cabinet needs the same words — a coach and an organiser
 * must not be told different things about the same entry — but must not pull
 * admin server actions into its module graph to get them. Hence this file;
 * AdminShell re-exports from here so existing imports keep working.
 */

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
