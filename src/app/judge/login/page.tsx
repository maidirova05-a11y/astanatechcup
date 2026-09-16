import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { CSRF_HEADER } from "@/lib/security/csrf";
import { getSession } from "@/lib/admin/session";
import { assertScoringEnabled } from "../auth";
import { JudgeLoginForm } from "@/components/judge/JudgeLoginForm";
import { Logo } from "@/components/layout/Logo";
import { features } from "@/lib/env";

/** Never cache a sign-in page. */
export const dynamic = "force-dynamic";

export default async function JudgeLoginPage() {
  // 404 rather than a form when the console is not configured — a scanner
  // learns nothing about whether this deployment has one.
  assertScoringEnabled();

  const session = await getSession();
  if (session) redirect("/judge");

  const headerList = await headers();
  const csrfToken = headerList.get(CSRF_HEADER) ?? "";

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo className="h-8" />
        </div>

        <div className="rounded-xl border border-line bg-surface p-7 shadow-lg">
          <h1 className="text-2xl">Судейская</h1>
          <p className="mt-2 text-sm text-muted">
            Внесение результатов матчей и заездов. Доступ только для судейской
            бригады и оргкомитета.
          </p>

          <JudgeLoginForm csrfToken={csrfToken} />

          {!features.judgeLogin && (
            <p className="mt-5 rounded-md border border-warning/40 bg-warning-surface p-3 text-xs">
              Отдельный судейский пароль на этом развёртывании не задан — войдите
              паролем оргкомитета.
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-subtle">
          Неудачные попытки входа фиксируются. После пяти подряд доступ с этого
          адреса блокируется на 15 минут.
        </p>
      </div>
    </div>
  );
}
