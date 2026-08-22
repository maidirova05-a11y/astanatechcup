import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { CSRF_HEADER } from "@/lib/security/csrf";
import { getSession } from "@/lib/admin/session";
import { assertAdminEnabled } from "../auth";
import { LoginForm } from "@/components/admin/LoginForm";
import { Logo } from "@/components/layout/Logo";

/** Never cache a login page. */
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  // 404 rather than a login page when the panel is not configured — a scanner
  // learns nothing about whether this deployment has an admin area.
  assertAdminEnabled();

  // Already signed in? Skip the form.
  const session = await getSession();
  if (session) redirect("/admin");

  const headerList = await headers();
  const csrfToken = headerList.get(CSRF_HEADER) ?? "";

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo className="h-8" />
        </div>

        <div className="rounded-xl border border-line bg-surface p-7 shadow-lg">
          <h1 className="text-2xl">Админ-панель</h1>
          <p className="mt-2 text-sm text-muted">
            Доступ только для оргкомитета чемпионата.
          </p>

          <LoginForm csrfToken={csrfToken} />
        </div>

        <p className="mt-6 text-center text-xs text-subtle">
          Неудачные попытки входа фиксируются. После пяти подряд доступ с этого
          адреса блокируется на 15 минут.
        </p>
      </div>
    </div>
  );
}
