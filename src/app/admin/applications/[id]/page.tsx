import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { requireSession } from "../../auth";
import { changeApplicationStatus } from "../../actions";
import { getApplicationById, getAuditTrail, STATUSES } from "@/lib/admin/queries";
import { AdminShell, StatusBadge, STATUS_LABELS } from "@/components/admin/AdminShell";
import { CSRF_FIELD, CSRF_HEADER } from "@/lib/security/csrf";
import { ENTRY_FEE } from "@/config/event";

export const dynamic = "force-dynamic";

const DISCIPLINE_LABELS: Record<string, string> = {
  robosumo: "RoboSumo",
  vex: "VEX",
  lego: "LEGO",
  arduino: "Arduino",
  drones: "Дроны",
  esports: "Киберспорт",
};

const ROLE_LABELS: Record<string, string> = {
  participant: "Участник команды",
  parent: "Родитель или законный представитель",
  teacher: "Педагог или руководитель кружка",
};

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Almaty",
  dateStyle: "medium",
  timeStyle: "short",
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-3 last:border-b-0 sm:flex-row sm:gap-6">
      <dt className="w-56 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();

  const { id } = await params;
  const application = await getApplicationById(id);
  if (!application) notFound();

  const [audit, headerList] = await Promise.all([getAuditTrail(application.id), headers()]);
  const csrfToken = headerList.get(CSRF_HEADER) ?? "";

  return (
    <AdminShell
      active="applications"
      title={application.teamName}
      actions={
        <Link
          href="/admin/applications"
          className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm hover:border-brand"
        >
          ← К списку
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-line bg-surface p-6">
            <h2 className="mb-2 text-lg">Заявка</h2>
            <dl>
              <Row label="Номер заявки">
                <span className="font-mono">{application.reference}</span>
              </Row>
              <Row label="Статус">
                <StatusBadge status={application.status} />
              </Row>
              <Row label="Дисциплина">
                {DISCIPLINE_LABELS[application.discipline] ?? application.discipline}
              </Row>
              <Row label="Организация">{application.organization}</Row>
              <Row label="Регион и город">
                {application.region} · {application.city}
              </Row>
              <Row label="Язык заявки">{application.locale}</Row>
              <Row label="Подана">{dateFormat.format(application.createdAt)}</Row>
              {application.paidAt && (
                <Row label="Оплачена">{dateFormat.format(application.paidAt)}</Row>
              )}
              {application.paymentReference && (
                <Row label="Платёж">
                  <span className="font-mono text-xs">{application.paymentReference}</span>
                </Row>
              )}
            </dl>
          </section>

          <section className="rounded-lg border border-line bg-surface p-6">
            <h2 className="mb-2 text-lg">
              Состав команды{" "}
              <span className="text-sm font-normal text-muted">
                ({application.memberCount})
              </span>
            </h2>
            <ol className="flex flex-col">
              {application.members.map((member, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0"
                >
                  <span className="text-sm font-medium">
                    {index + 1}. {member.name}
                  </span>
                  <span className="tabular text-sm text-muted">{member.age} лет</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-lg border border-line bg-surface p-6">
            <h2 className="mb-2 text-lg">Контактное лицо</h2>
            <dl>
              <Row label="Имя">{application.contactName}</Row>
              <Row label="Роль">
                {ROLE_LABELS[application.contactRole] ?? application.contactRole}
              </Row>
              <Row label="Email">
                <a
                  href={`mailto:${application.contactEmail}`}
                  className="text-brand underline-offset-4 hover:underline"
                >
                  {application.contactEmail}
                </a>
              </Row>
              <Row label="Телефон">
                <a
                  href={`tel:${application.contactPhone}`}
                  className="text-brand underline-offset-4 hover:underline"
                >
                  {application.contactPhone}
                </a>
              </Row>
              {application.comment && <Row label="Комментарий">{application.comment}</Row>}
            </dl>
          </section>

          <section className="rounded-lg border border-line bg-surface p-6">
            <h2 className="mb-2 text-lg">Согласия</h2>
            <dl>
              <Row label="Обработка персональных данных">
                {application.consentData ? "Да" : "Нет"}
              </Row>
              <Row label="Законный представитель несовершеннолетних">
                {application.consentGuardian ? "Да" : "Нет"}
              </Row>
              <Row label="Ознакомлен с регламентом">
                {application.consentRules ? "Да" : "Нет"}
              </Row>
              <Row label="Фото- и видеосъёмка">
                {application.consentMedia ? "Разрешена" : "Не разрешена"}
              </Row>
              <Row label="Согласие получено">
                {dateFormat.format(application.consentAt)}
              </Row>
            </dl>
            {!application.consentMedia && (
              <p className="mt-4 rounded-md bg-warning-surface p-3 text-xs text-warning">
                Команда не давала согласия на публикацию фото и видео. Учтите это
                при подготовке материалов о чемпионате.
              </p>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-lg border border-line bg-surface p-6">
            <h2 className="text-lg">Изменить статус</h2>
            <p className="mt-1 text-xs text-muted">
              Каждое изменение записывается в журнал.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {STATUSES.filter((status) => status !== application.status).map((status) => (
                <form key={status} action={changeApplicationStatus}>
                  <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
                  <input type="hidden" name="id" value={application.id} />
                  <input type="hidden" name="status" value={status} />
                  <button
                    type="submit"
                    className="w-full rounded-md border border-line px-4 py-2.5 text-left text-sm transition-colors hover:border-brand hover:bg-surface-muted"
                  >
                    {STATUS_LABELS[status]}
                  </button>
                </form>
              ))}
            </div>

            <p className="mt-4 border-t border-line pt-4 text-xs text-subtle">
              Оргвзнос: {ENTRY_FEE.amount} {ENTRY_FEE.currency}. Статус «Оплачена»
              обычно ставится автоматически вебхуком платёжного провайдера —
              меняйте вручную только при оплате в обход сайта.
            </p>
          </section>

          <section className="rounded-lg border border-line bg-surface p-6">
            <h2 className="text-lg">Журнал</h2>
            {audit.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Изменений не было.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-3">
                {audit.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-0.5 text-xs">
                    <span className="font-medium">
                      {entry.fromStatus && entry.toStatus
                        ? `${STATUS_LABELS[entry.fromStatus] ?? entry.fromStatus} → ${
                            STATUS_LABELS[entry.toStatus] ?? entry.toStatus
                          }`
                        : entry.action}
                    </span>
                    <span className="text-subtle">{dateFormat.format(entry.at)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}
