"use client";

import { useActionState } from "react";
import { coachActivate } from "@/app/coach/actions";
import { initialCoachFormState } from "@/app/coach/form-state";
import { CSRF_FIELD } from "@/lib/security/csrf";
import { Warning } from "@/components/ui/icons";

const field =
  "h-12 w-full rounded-md border border-line-strong bg-surface px-4 text-base transition-colors focus:border-brand";

/**
 * Activation, which is also the password reset.
 *
 * The reference field is deliberately not masked and not `type="password"`:
 * it is copied off a confirmation, people mistype it, and hiding it while
 * they check would guarantee more failed attempts against a lockout.
 */
export function CoachActivateForm({ csrfToken }: { csrfToken: string }) {
  const [state, formAction, isPending] = useActionState(
    coachActivate,
    initialCoachFormState,
  );

  // As on the sign-in form: React 19 clears the fields after an action, and
  // retyping a reference character by character is how a lockout gets spent.
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
        <label htmlFor="coach-reference" className="text-sm font-semibold">
          Номер заявки
        </label>
        <input
          id="coach-reference"
          name="reference"
          type="text"
          required
          defaultValue={typed?.reference ?? ""}
          autoFocus
          spellCheck={false}
          autoCapitalize="characters"
          placeholder="ATC-7K3M-92"
          className={`${field} font-mono uppercase tracking-wider`}
        />
        <p className="text-xs text-subtle">
          Из письма-подтверждения. Регистр и похожие символы (O/0, I/1) можно не
          различать.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="coach-activate-email" className="text-sm font-semibold">
          Почта
        </label>
        <input
          id="coach-activate-email"
          name="email"
          type="email"
          required
          defaultValue={typed?.email ?? ""}
          autoComplete="username"
          inputMode="email"
          className={field}
        />
        <p className="text-xs text-subtle">
          Ровно та, что указана в этой заявке.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="coach-new-password" className="text-sm font-semibold">
          Новый пароль
        </label>
        <input
          id="coach-new-password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className={field}
        />
        <p className="text-xs text-subtle">
          Не короче 10 символов. Длинная фраза надёжнее короткой мешанины знаков.
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-13 items-center justify-center rounded-full bg-brand-strong px-6 text-base font-semibold text-on-brand transition-colors hover:bg-brand disabled:opacity-60"
      >
        {isPending ? "Проверяем…" : "Создать доступ"}
      </button>
    </form>
  );
}
