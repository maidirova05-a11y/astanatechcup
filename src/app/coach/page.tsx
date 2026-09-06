import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireCoachSession } from "./auth";
import { CoachShell } from "@/components/coach/CoachShell";
import { StatusBadge } from "@/components/ui/status";
import { getCoachOverview, type CoachEntryView } from "@/lib/coach/data";
import { getDiscipline } from "@/config/event";
import { isRegion } from "@/config/regions";

/** The cabinet shows live state — status and placement both move. */
export const dynamic = "force-dynamic";

export default async function CoachHome() {
  const session = await requireCoachSession();

  // Russian catalogue, as in the judges' console: names come from the same
  // messages the public pages use, never a second hard-coded list.
  const [tCategories, tDisciplines, tRegions] = await Promise.all([
    getTranslations({ locale: "ru", namespace: "categories" }),
    getTranslations({ locale: "ru", namespace: "disciplines" }),
    getTranslations({ locale: "ru", namespace: "regions" }),
  ]);

  const overview = await getCoachOverview(session.accountId, (key) => tCategories(key));

  // The account vanished between the session check and now — treat it as
  // signed out rather than rendering an empty cabinet.
  if (!overview) {
    return (
      <CoachShell title="Кабинет тренера" email="">
        <p className="tile p-6 text-sm text-muted">
          Доступ не найден. Войдите заново.
        </p>
      </CoachShell>
    );
  }

  const disciplineName = (id: string) =>
    getDiscipline(id) ? tDisciplines(`items.${id}.name`) : id;

  // The region column stores the key ("astana"), not the name. Without this the
  // card reads "Астана, astana".
  const regionName = (key: string) => (isRegion(key) ? tRegions(key) : key);

  return (
    <CoachShell
      title="Мои заявки"
      subtitle={
        overview.entries.length === 0
          ? undefined
          : "Статус, состав и результаты команд на площадке."
      }
      email={overview.email}
    >
      {overview.unreadable > 0 && (
        <p
          role="alert"
          className="mb-6 rounded-md border border-danger/30 bg-danger-surface p-4 text-sm text-danger"
        >
          Не удалось прочитать {overview.unreadable}{" "}
          {overview.unreadable === 1 ? "заявку" : "заявки"}. Сообщите
          оргкомитету — это ошибка на нашей стороне, а не в ваших данных.
        </p>
      )}

      {overview.entries.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-6">
          {overview.entries.map((entry) => (
            <li key={entry.application.id}>
              <EntryCard
                entry={entry}
                disciplineName={disciplineName}
                regionName={regionName}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs text-muted">
        Данные состава редактируются только оргкомитетом. Если в составе ошибка,
        напишите на{" "}
        <Link href="/ru#contacts" className="underline">
          контакты
        </Link>{" "}
        и назовите номер заявки.
      </p>
    </CoachShell>
  );
}

function EmptyState() {
  return (
    <div className="tile p-6">
      <h2 className="text-lg">Заявок пока нет</h2>
      <p className="mt-2 text-sm text-muted">
        На эту почту не найдено ни одной заявки. Возможно, заявка подана с
        другого адреса — тогда{" "}
        <Link href="/coach/activate" className="font-semibold text-brand underline">
          создайте доступ по её номеру
        </Link>
        .
      </p>
    </div>
  );
}

function EntryCard({
  entry,
  disciplineName,
  regionName,
}: {
  entry: CoachEntryView;
  disciplineName: (id: string) => string;
  regionName: (key: string) => string;
}) {
  const { application, teams } = entry;
  const placeOf = (a: typeof application) =>
    joinPlace(a.city, regionName(a.region));

  return (
    <article className="tile p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl">{application.teamName}</h2>
          <p className="text-sm text-muted">
            {disciplineName(application.discipline)} · {application.organization}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={application.status} />
          <code className="tabular text-xs text-subtle">{application.reference}</code>
        </div>
      </header>

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <Fact label="Город">{placeOf(application)}</Fact>
        <Fact label="Участников">{application.memberCount}</Fact>
        <Fact label="Подана">
          {application.createdAt.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </Fact>
      </dl>

      <section className="mt-5">
        <h3 className="text-sm font-semibold">Состав</h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {application.members.map((member, index) => (
            <li
              key={`${member.name}-${index}`}
              className="rounded-full border border-line bg-surface-muted px-3 py-1 text-sm"
            >
              {member.name}
              <span className="text-subtle"> · {member.age}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5 border-t border-line pt-5">
        <h3 className="text-sm font-semibold">На площадке</h3>
        {teams.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Команда ещё не заведена в стартовый список. Стартовый номер появится
            здесь, когда судейская бригада внесёт её.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {teams.map((view) => (
              <li
                key={view.team.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-muted px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">
                    {view.categoryName} · {view.className}
                  </span>
                  <span className="text-xs text-muted">
                    Стартовый номер {view.team.code}
                    {view.team.groupLabel ? ` · группа ${view.team.groupLabel}` : ""}
                    {view.team.archivedAt ? " · снята" : ""}
                  </span>
                </div>

                {view.position === null ? (
                  <span className="text-sm text-muted">Ещё не выступала</span>
                ) : (
                  <span className="text-sm">
                    <strong className="tabular text-lg">{view.position}</strong>
                    <span className="text-muted"> из {view.fieldSize}</span>
                    <span className="text-subtle">
                      {" · "}
                      {view.events}{" "}
                      {view.events === 1 ? "выступление" : "выступлений"}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

/**
 * "Астана, Акмолинская область" reads well; "Астана, город Астана" does not. The three
 * cities of republican significance are their own region, so the region label
 * repeats the city — drop it when it adds nothing.
 */
function joinPlace(city: string, region: string): string {
  const a = city.trim().toLowerCase();
  const b = region.trim().toLowerCase();
  return b.includes(a) || a.includes(b) ? city : `${city}, ${region}`;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
