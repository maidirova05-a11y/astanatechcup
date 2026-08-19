import Link from "next/link";
import { requireSession } from "./auth";
import { getDashboardStats, STATUSES } from "@/lib/admin/queries";
import { countActiveSessions } from "@/lib/admin/session";
import { AdminShell, StatCard, STATUS_LABELS } from "@/components/admin/AdminShell";
import { DISCIPLINES, ENTRY_FEE, REGISTRATION_DEADLINE } from "@/config/event";
import { formatEventDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Discipline and region names in the admin panel's single language. */
const DISCIPLINE_LABELS: Record<string, string> = {
  robosumo: "RoboSumo",
  vex: "VEX",
  lego: "LEGO",
  arduino: "Arduino",
  drones: "Дроны",
  esports: "Киберспорт",
};

export default async function AdminDashboard() {
  await requireSession();

  const [stats, activeSessions] = await Promise.all([
    getDashboardStats(),
    countActiveSessions(),
  ]);

  const paidCount = (stats.byStatus.paid ?? 0) + (stats.byStatus.confirmed ?? 0);

  const maxDiscipline = Math.max(1, ...Object.values(stats.byDiscipline));
  const topRegions = Object.entries(stats.byRegion)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);
  const maxRegion = Math.max(1, ...topRegions.map(([, count]) => count));

  return (
    <AdminShell active="dashboard" title="Сводка">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Всего заявок" value={stats.total} />
        <StatCard
          label="Участников"
          value={stats.participants}
          hint="Сумма по всем командам"
        />
        <StatCard
          label="Оплачено"
          value={paidCount}
          hint={`${paidCount * ENTRY_FEE.amount} ${ENTRY_FEE.currency} собрано`}
        />
        <StatCard
          label="Дней до дедлайна"
          value={stats.daysUntilDeadline}
          hint={formatEventDate(REGISTRATION_DEADLINE, "ru")}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-line bg-surface p-6">
          <h2 className="text-lg">По статусам</h2>
          <dl className="mt-4 flex flex-col gap-3">
            {STATUSES.map((status) => (
              <div key={status} className="flex items-center justify-between gap-4">
                <dt className="text-sm text-muted">{STATUS_LABELS[status]}</dt>
                <dd className="flex items-center gap-3">
                  <span className="tabular font-semibold">
                    {stats.byStatus[status] ?? 0}
                  </span>
                  <Link
                    href={`/admin/applications?status=${status}`}
                    className="text-xs font-medium text-brand underline-offset-4 hover:underline"
                  >
                    показать
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-lg border border-line bg-surface p-6">
          <h2 className="text-lg">По дисциплинам</h2>
          <dl className="mt-4 flex flex-col gap-3">
            {DISCIPLINES.map((discipline) => {
              const count = stats.byDiscipline[discipline.id] ?? 0;
              return (
                <div key={discipline.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-sm text-muted">
                      {DISCIPLINE_LABELS[discipline.id] ?? discipline.id}
                    </dt>
                    <dd className="tabular text-sm font-semibold">{count}</dd>
                  </div>
                  {/* A bar rather than a chart library: one div, no dependency,
                      and it reads correctly at any width. */}
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(count / maxDiscipline) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </dl>
        </section>

        <section className="rounded-lg border border-line bg-surface p-6">
          <h2 className="text-lg">География</h2>
          {topRegions.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Пока нет заявок.</p>
          ) : (
            <dl className="mt-4 flex flex-col gap-3">
              {topRegions.map(([region, count]) => (
                <div key={region} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-sm text-muted">{region}</dt>
                    <dd className="tabular text-sm font-semibold">{count}</dd>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(count / maxRegion) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="rounded-lg border border-line bg-surface p-6">
          <h2 className="text-lg">Активность</h2>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Заявок за 7 дней</dt>
              <dd className="tabular font-semibold">{stats.last7Days}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Активных сессий админов</dt>
              <dd className="tabular font-semibold">{activeSessions}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-subtle">
            Если активных сессий больше, чем людей за экранами, смените пароль —
            это отзовёт все сессии сразу.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}
