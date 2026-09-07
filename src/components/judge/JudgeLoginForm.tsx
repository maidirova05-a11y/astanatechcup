"use client";

import { useActionState } from "react";
import { judgeLogin } from "@/app/judge/actions";
import { initialJudgeLoginState } from "@/app/judge/form-state";
import { CSRF_FIELD } from "@/lib/security/constants";
import { Warning } from "@/components/ui/icons";

/**
 * Judges' sign-in.
 *
 * One field, as on the admin form. The input is 48px tall and the button 52px
 * because this is typed on a phone, outdoors, by someone wearing a lanyard and
 * holding a stopwatch.
 */
export function JudgeLoginForm({ csrfToken }: { csrfToken: string }) {
  const [state, formAction, isPending] = useActionState(
    judgeLogin,
    initialJudgeLoginState,
  );

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
        <label htmlFor="judge-password" className="text-sm font-semibold">
          Пароль судьи
        </label>
        <input
          id="judge-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          autoFocus
          className="h-12 w-full rounded-md border border-line-strong bg-surface px-4 text-base transition-colors focus:border-brand"
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
