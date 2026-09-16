"use client";

import { startTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { initialScoringFormState, type ScoringFormState } from "@/app/judge/form-state";

/**
 * The «Записать» button of one editable row, and the only piece of the
 * console's tables that runs in the browser.
 *
 * Why it exists: saving a row used to redirect, and a redirect re-renders the
 * whole console — the session, every team, every match and every attempt in
 * the category — before the referee sees anything. From a venue that is
 * seconds per cell. Here the action returns a small state instead, the row
 * shows ✓ the moment the write lands, and the page refreshes BEHIND it in a
 * transition, so the cross-table, B column and bracket catch up without
 * blocking the next entry.
 *
 * The button collects its row's fields itself (`button.form`, which follows
 * the `form` attribute, so the button can sit in a table cell while its form
 * lives outside the table — a `<form>` cannot wrap a `<tr>`) and dispatches the
 * action in a transition. It deliberately does NOT submit the form: React
 * resets a form after a form action completes, which snaps every input back
 * to its old `defaultValue` until the refresh lands — the referee would watch
 * the correction they just saved flicker back to the typo.
 *
 * A refresh never wipes what a referee is typing in another row: the inputs
 * are uncontrolled, and a new `defaultValue` does not overwrite a field that
 * has already been edited.
 */
export function SaveButton({
  action,
  form,
  label = "Записать",
  className = "",
}: {
  action: (state: ScoringFormState, formData: FormData) => Promise<ScoringFormState>;
  /** Id of the row's form, when the button is not inside it. */
  form?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialScoringFormState);

  useEffect(() => {
    if (state.status !== "saved") return;
    startTransition(() => router.refresh());
  }, [state.status, state.savedAt, router]);

  return (
    <span className={`flex items-center justify-end gap-2 ${className}`}>
      {state.status === "error" && !pending && (
        <span role="alert" className="max-w-48 text-right text-xs font-medium text-danger">
          {state.message}
        </span>
      )}
      {state.status === "saved" && !pending && (
        <span role="status" className="text-sm font-bold text-success" aria-label="Сохранено">
          ✓
        </span>
      )}
      <button
        type="button"
        form={form}
        disabled={pending}
        onClick={(event) => {
          const owner = event.currentTarget.form;
          // The browser's own checks (required, length) still apply.
          if (!owner || !owner.reportValidity()) return;
          const data = new FormData(owner);
          startTransition(() => formAction(data));
        }}
        className="inline-flex h-11 min-w-28 items-center justify-center rounded-full bg-brand-strong px-4 text-sm font-semibold text-on-brand disabled:opacity-60"
      >
        {pending ? "Сохраняю…" : label}
      </button>
    </span>
  );
}
