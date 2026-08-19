import Link from "next/link";
import { requireSession } from "../auth";
import { listApplications, parseFilters, PAGE_SIZE, STATUSES } from "@/lib/admin/queries";
import { AdminShell, StatusBadge, STATUS_LABELS } from "@/components/admin/AdminShell";
import { DISCIPLINES } from "@/config/event";
import { REGIONS } from "@/config/regions";

export const dynamic = "force-dynamic";

const DISCIPLINE_LABELS: Record<string, string> = {
  robosumo: "RoboSumo",
  vex: "VEX",
  lego: "LEGO",
  arduino: "Arduino",
  drones: "Дроны",
  esports: "Киберспорт",
};

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Almaty",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();

  const raw = await searchParams;
  const one = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };

  // Every filter is validated against an allow-list before it reaches SQL.
  const filters = parseFilters({
    search: one("search"),
    discipline: one("discipline"),
    status: one("status"),
    region: one("region"),
    page: Number(one("page")) || 1,
  });

  const { rows, total, page, pageCount, undecryptable } = await listApplications(filters);

  // Preserve the active filters when building the export and pagination links.
  const query = new URLSearchParams();
  if (filters.search) query.set("search", filters.search);
  if (filters.discipline) query.set("discipline", filters.discipline);
  if (filters.status) query.set("status", filters.status);
  if (filters.region) query.set("region", filters.region);
  const filterQuery = query.toString();

  const pageLink = (target: number) => {
    const params = new URLSearchParams(filterQuery);
    params.set("page", String(target));
    return `/admin/applications?${params.toString()}`;
  };

  return (
    <AdminShell
      active="applications"
      title="Заявки"
      actions={
        <a
          href={`/admin/export${filterQuery ? `?${filterQuery}` : ""}`}
          className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 text-sm font-semibold transition-colors hover:border-brand hover:text-brand"
        >
          Выгрузить CSV
        </a>
      }
    >
      {/* GET form: filters belong in the URL so a view can be bookmarked,
          shared with a colleague and reloaded without re-submitting anything. */}
      <form
        method="get"
        className="mb-6 grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <label htmlFor="f-search" className="text-2xs font-bold uppercase tracking-wider text-subtle">
            Поиск
          </label>
          <input
            id="f-search"
            name="search"
            defaultValue={filters.search}
            placeholder="Команда, школа, город, номер заявки"
            maxLength={100}
            className="h-11 rounded-md border border-line-strong bg-surface px-3 text-sm"
          />
          {/* Names and phones are encrypted at rest, so there is no substring
              to match against. Saying so beats letting someone conclude the
              search is broken. */}
          <p className="text-xs text-subtle">
            Email ищется целиком. Имена и телефоны зашифрованы — по ним поиск
            невозможен.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-discipline" className="text-2xs font-bold uppercase tracking-wider text-subtle">
            Дисциплина
          </label>
          <select
            id="f-discipline"
            name="discipline"
            defaultValue={filters.discipline ?? ""}
            className="h-11 rounded-md border border-line-strong bg-surface px-3 text-sm"
          >
            <option value="">Все</option>
            {DISCIPLINES.map((d) => (
              <option key={d.id} value={d.id}>
                {DISCIPLINE_LABELS[d.id] ?? d.id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-status" className="text-2xs font-bold uppercase tracking-wider text-subtle">
            Статус
          </label>
          <select
            id="f-status"
            name="status"
            defaultValue={filters.status ?? ""}
            className="h-11 rounded-md border border-line-strong bg-surface px-3 text-sm"
          >
            <option value="">Все</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-region" className="text-2xs font-bold uppercase tracking-wider text-subtle">
            Регион
          </label>
          <select
            id="f-region"
            name="region"
            defaultValue={filters.region ?? ""}
            className="h-11 rounded-md border border-line-strong bg-surface px-3 text-sm"
          >
            <option value="">Все</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-full bg-brand-strong px-5 text-sm font-semibold text-on-brand"
          >
            Применить
          </button>
          <Link
            href="/admin/applications"
            className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-muted hover:text-content"
          >
            Сбросить
          </Link>
          <p className="ml-auto self-center text-sm text-muted">
            Найдено: <span className="tabular font-semibold">{total}</span>
          </p>
        </div>
      </form>

      {undecryptable > 0 && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-danger/40 bg-danger-surface p-4 text-sm text-danger"
        >
          <strong>{undecryptable}</strong> заявк(и) на этой странице не удалось
          расшифровать и они скрыты. Скорее всего, ENCRYPTION_KEY отличается от
          того, которым их записали. Не меняйте ключ — обратитесь к
          разработчику: данные не потеряны, пока цел прежний ключ.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface p-10 text-center text-muted">
          Заявок по этим условиям нет.
        </p>
      ) : (
        <>
          {/* The table scrolls inside its own container so the page body never
              scrolls sideways on a narrow screen. */}
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <caption className="sr-only">
                Список заявок команд с фильтрами и постраничной навигацией
              </caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="px-4 py-3 font-semibold">Номер</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Команда</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Дисциплина</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Регион</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Чел.</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Статус</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Подана</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-line last:border-b-0 hover:bg-surface-muted"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/applications/${row.id}`}
                        className="font-mono text-xs font-semibold text-brand underline-offset-4 hover:underline"
                      >
                        {row.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{row.teamName}</span>
                      <span className="block text-xs text-muted">{row.organization}</span>
                    </td>
                    <td className="px-4 py-3">
                      {DISCIPLINE_LABELS[row.discipline] ?? row.discipline}
                    </td>
                    <td className="px-4 py-3 text-muted">{row.region}</td>
                    <td className="tabular px-4 py-3 text-right">{row.memberCount}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {dateFormat.format(row.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <nav
              aria-label="Постраничная навигация"
              className="mt-5 flex items-center justify-between gap-4"
            >
              <p className="text-sm text-muted">
                Страница {page} из {pageCount} · по {PAGE_SIZE} на странице
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={pageLink(page - 1)}
                    rel="prev"
                    className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm hover:border-brand"
                  >
                    Назад
                  </Link>
                )}
                {page < pageCount && (
                  <Link
                    href={pageLink(page + 1)}
                    rel="next"
                    className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm hover:border-brand"
                  >
                    Далее
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </AdminShell>
  );
}
