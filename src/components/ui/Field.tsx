"use client";

import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { Warning } from "./icons";

/**
 * Form field primitives.
 *
 * Accessibility rules baked in so no call site can forget them:
 *  · every control has a real `<label>` bound by id — never a placeholder
 *    doing duty as a label, which vanishes the moment you start typing;
 *  · hints and errors are wired through `aria-describedby`;
 *  · errors set `aria-invalid` and are announced via `role="alert"`;
 *  · the error is never conveyed by colour alone — there is an icon and text.
 *
 * The audience includes children and parents on phones, so controls are 48px
 * tall: comfortably above the 44px minimum touch target.
 */

const CONTROL = [
  "w-full rounded-md border bg-surface-raised px-4 text-base",
  "transition-[border-color,box-shadow] duration-200",
  "placeholder:text-subtle",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ");

function controlClasses(invalid: boolean, extra?: string) {
  return cn(
    CONTROL,
    invalid
      ? "border-danger focus:border-danger"
      : "border-line-strong hover:border-brand/60 focus:border-brand",
    extra,
  );
}

type BaseProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  optionalLabel?: string;
};

function FieldShell({
  label,
  hint,
  error,
  required,
  optionalLabel,
  id,
  hintId,
  errorId,
  className,
  children,
}: BaseProps & {
  id: string;
  hintId: string;
  errorId: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {required ? (
          <span className="ml-1 text-accent" aria-hidden="true">
            *
          </span>
        ) : optionalLabel ? (
          <span className="ml-2 text-2xs font-normal uppercase tracking-wider text-subtle">
            {optionalLabel}
          </span>
        ) : null}
      </label>

      {children}

      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-xs font-medium text-danger"
        >
          <Warning className="shrink-0 text-sm" />
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  required,
  optionalLabel,
  className,
  ...props
}: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const uid = useId();
  const id = props.id ?? uid;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={optionalLabel}
      id={id}
      hintId={hintId}
      errorId={errorId}
      className={className}
    >
      <input
        {...props}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={controlClasses(Boolean(error), "h-12")}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  optionalLabel,
  className,
  children,
  ...props
}: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const uid = useId();
  const id = props.id ?? uid;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={optionalLabel}
      id={id}
      hintId={hintId}
      errorId={errorId}
      className={className}
    >
      <select
        {...props}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={controlClasses(Boolean(error), "h-12 appearance-none pr-10 bg-no-repeat")}
        style={{
          // Inline SVG chevron as a data URI: no extra request, and no CSP
          // exception since `data:` is already allowed for img-src.
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236f7b8d' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundPosition: "right 0.875rem center",
          backgroundSize: "1.15rem",
        }}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  required,
  optionalLabel,
  className,
  ...props
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const uid = useId();
  const id = props.id ?? uid;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={optionalLabel}
      id={id}
      hintId={hintId}
      errorId={errorId}
      className={className}
    >
      <textarea
        {...props}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={controlClasses(Boolean(error), "min-h-28 resize-y py-3 leading-relaxed")}
      />
    </FieldShell>
  );
}

export function CheckboxField({
  label,
  hint,
  error,
  required,
  className,
  children,
  ...props
}: Omit<BaseProps, "label"> & {
  label?: ReactNode;
  children?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const uid = useId();
  const id = props.id ?? uid;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-start gap-3">
        <input
          {...props}
          type="checkbox"
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            "mt-0.5 size-5 shrink-0 cursor-pointer rounded-xs border-2 accent-[var(--accent)]",
            error ? "border-danger" : "border-line-strong",
          )}
        />
        <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed">
          {children ?? label}
          {required && (
            <span className="ml-1 text-accent" aria-hidden="true">
              *
            </span>
          )}
        </label>
      </div>

      {hint && !error && (
        <p id={hintId} className="pl-8 text-xs text-muted">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 pl-8 text-xs font-medium text-danger"
        >
          <Warning className="shrink-0 text-sm" />
          {error}
        </p>
      )}
    </div>
  );
}

export function FieldGroup({
  legend,
  children,
  className,
}: {
  legend: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("flex flex-col gap-5", className)}>
      <legend className="mb-1 text-2xs font-bold uppercase tracking-[0.16em] text-brand">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}
