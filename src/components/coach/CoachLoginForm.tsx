"use client";

import { useActionState } from "react";
import { coachLogin } from "@/app/coach/actions";
import { initialCoachFormState } from "@/app/coach/form-state";
import { CSRF_FIELD } from "@/lib/security/csrf";
import { Warning } from "@/components/ui/icons";

const field =
  "h-12 w-full rounded-md border border-line-strong bg-surface px-4 text-base transition-colors focus:border-brand";

export function CoachLoginForm({ csrfToken }: { csrfToken: string }) {
  const [state, formAction, isPending] = useActionState(
    coachLogin,
    initialCoachFormState,
  );

  // React 19 resets the form after an action; put the address back so a
  // mistyped password does not cost the coach their e-mail as well.
  const typed = state.status === "error" ? state.values : undefined;

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
        <label htmlFor="coach-email" className="text-sm font-semibold">
          Почта
        </label>
        <input
          id="coach-email"
          name="email"
          type="email"
          required
          defaultValue={typed?.email ?? ""}
          autoComplete="username"
          autoFocus
          inputMode="email"
          className={field}
        />
        <p className="text-xs text-subtle">Та, с которой подавали заявку.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="coach-password" className="text-sm font-semibold">
          Пароль
        </label>
        <input
          id="coach-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={field}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-13 items-center justify-center rounded-full bg-brand-strong px-6 text-base font-semibold text-on-brand transition-colors hover:bg-brand disabled:opacity-60"
      >
        {isPending ? "Проверяем…" : "Войти"}
      </button>
    </form>
  );
}
