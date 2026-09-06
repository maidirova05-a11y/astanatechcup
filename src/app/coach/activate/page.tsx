import Link from "next/link";
import { headers } from "next/headers";
import { CSRF_HEADER } from "@/lib/security/csrf";
import { assertCoachEnabled } from "../auth";
import { CoachGate } from "@/components/coach/CoachShell";
import { CoachActivateForm } from "@/components/coach/CoachActivateForm";

export const dynamic = "force-dynamic";

/**
 * Activation is reachable while signed in as well as signed out — it is the
 * only way to change a password, and a coach who wants to change theirs should
 * not have to sign out first to find the form.
 */
export default async function CoachActivatePage() {
  assertCoachEnabled();

  const headerList = await headers();
  const csrfToken = headerList.get(CSRF_HEADER) ?? "";

  return (
    <CoachGate
      title="Создать доступ"
      intro="Подтвердите, что заявка ваша: номер и почта должны совпадать с теми, что в ней указаны. Тем же способом задаётся новый пароль, если старый забыт."
      footer={
        <p className="mt-6 text-center text-sm text-muted">
          Уже есть пароль?{" "}
          <Link href="/coach/login" className="font-semibold text-brand underline">
            Войти
          </Link>
        </p>
      }
    >
      <CoachActivateForm csrfToken={csrfToken} />
    </CoachGate>
  );
}
