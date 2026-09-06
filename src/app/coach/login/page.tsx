import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { CSRF_HEADER } from "@/lib/security/csrf";
import { getCoachSession } from "@/lib/coach/session";
import { assertCoachEnabled } from "../auth";
import { CoachGate } from "@/components/coach/CoachShell";
import { CoachLoginForm } from "@/components/coach/CoachLoginForm";

/** Never cache a sign-in page. */
export const dynamic = "force-dynamic";

export default async function CoachLoginPage() {
  assertCoachEnabled();

  const session = await getCoachSession();
  if (session) redirect("/coach");

  const headerList = await headers();
  const csrfToken = headerList.get(CSRF_HEADER) ?? "";

  return (
    <CoachGate
      title="Кабинет тренера"
      intro="Статус заявки, состав команды и результаты ваших команд на площадке."
      footer={
        <p className="mt-6 text-center text-sm text-muted">
          Первый вход или забыли пароль?{" "}
          <Link href="/coach/activate" className="font-semibold text-brand underline">
            Создайте доступ по номеру заявки
          </Link>
        </p>
      }
    >
      <CoachLoginForm csrfToken={csrfToken} />
    </CoachGate>
  );
}
