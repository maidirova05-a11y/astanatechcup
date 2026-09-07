"use client";

import { useActionState } from "react";
import { login } from "@/app/admin/actions";
import { initialLoginState } from "@/app/admin/login-state";
import { CSRF_FIELD } from "@/lib/security/constants";
import { Warning } from "@/components/ui/icons";

/**
 * Admin login form.
 *
 * There is no "remember me", no password-strength meter and no client-side
 * validation beyond `required`. Every decision about this password is made on
 * the server, and the form's only job is to transport it there once.
 */
export function LoginForm({ csrfToken }: { csrfToken: string }) {
  const [state, formAction, isPending] = useActionState(login, initialLoginState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name={CSRF_FIELD} value={csrfToken} />

      {state.status === "error" && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-surface p-3 text-sm text-danger"
        >
          <Warning className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-password" className="text-sm font-semibold">
          Пароль
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          // Focus lands here immediately; it is the only field on the page.
          autoFocus
          className="h-12 w-full rounded-md border border-line-strong bg-surface px-4 text-base transition-colors focus:border-brand"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-strong px-6 font-semibold text-on-brand transition-colors hover:bg-brand disabled:opacity-60"
      >
        {isPending ? "Проверяем…" : "Войти"}
      </button>
    </form>
  );
}
