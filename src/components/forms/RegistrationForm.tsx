"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  CheckboxField,
  FieldGroup,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ArrowRight, Check, Close, Warning } from "@/components/ui/icons";
import { registerTeam } from "@/app/actions/register";
import { initialRegisterState } from "@/app/actions/register-state";
// Import from `constants` and nowhere else: the other security modules import
// `@/lib/env`, which must never reach the browser bundle.
import {
  CSRF_FIELD,
  FORM_TIMESTAMP_FIELD,
  HONEYPOT_FIELD,
  TURNSTILE_ORIGIN,
} from "@/lib/security/constants";
import { DISCIPLINES, getDiscipline } from "@/config/event";
import { REGIONS } from "@/config/regions";
import { LIMITS } from "@/lib/validation/registration";

/**
 * Team registration form.
 *
 * Built on `useActionState` over a server action, so it works as a plain HTML
 * form before hydration: a visitor on a slow connection in a regional school
 * can still submit. Client-side checks are HTML constraint validation only —
 * instant feedback, zero extra JavaScript, and no possibility of the client and
 * server rules drifting apart, because the server's Zod schema is the only
 * authority that decides anything.
 *
 * Three anti-bot measures are wired in here:
 *   · a honeypot input that is off-screen but not `display:none`;
 *   · a render timestamp, checked server-side against a minimum fill time;
 *   · Turnstile, when configured.
 */

type Props = {
  csrfToken: string;
  /** Signed "form served at" stamp, minted per request in src/proxy.ts. */
  formTimestamp: string;
  locale: string;
  turnstileSiteKey?: string;
};

type Member = { id: number; name: string; age: string };

let memberIdCounter = 0;
const newMember = (): Member => ({ id: ++memberIdCounter, name: "", age: "" });

export function RegistrationForm({
  csrfToken,
  formTimestamp,
  locale,
  turnstileSiteKey,
}: Props) {
  const t = useTranslations("registration");
  const tv = useTranslations("registration.validation");
  const tc = useTranslations("common");
  const td = useTranslations("disciplines");
  const tr = useTranslations("regions");

  const [state, formAction, isPending] = useActionState(registerTeam, initialRegisterState);
  const [disciplineId, setDisciplineId] = useState("");
  const [roster, setRoster] = useState<Member[]>(() => [newMember()]);
  const statusRef = useRef<HTMLDivElement>(null);

  // Move focus to the result banner so a screen-reader user is told what
  // happened instead of being left at the submit button.
  useEffect(() => {
    if (state.status !== "idle") statusRef.current?.focus();
  }, [state]);

  const discipline = useMemo(() => getDiscipline(disciplineId), [disciplineId]);
  const maxMembers = discipline?.teamSizeMax ?? null;

  /**
   * Derived, not synchronised. Switching to a discipline with smaller teams
   * hides the surplus rows immediately, and switching back restores what the
   * user had typed — which an effect that truncated the state array would
   * have thrown away.
   */
  const members = useMemo(
    () => (maxMembers === null ? roster : roster.slice(0, maxMembers)),
    [roster, maxMembers],
  );

  const canAddMember = maxMembers === null || members.length < maxMembers;

  /** Server error keys → translated strings, with interpolation params. */
  function fieldError(path: string): string | undefined {
    const key = state.fieldErrors?.[path];
    if (!key) return undefined;
    const params = state.fieldErrorParams?.[path] ?? {};
    // The catalog is the allow-list: an unexpected key renders the generic
    // message rather than echoing anything the server sent back.
    try {
      return tv(key as never, params as never);
    } catch {
      return tv("teamNameRequired");
    }
  }

  if (state.status === "success") {
    return (
      <div
        ref={statusRef}
        tabIndex={-1}
        className="flex flex-col gap-6 rounded-xl border border-success/30 bg-success-surface p-8 focus:outline-none sm:p-10"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-success text-2xl text-white">
          <Check />
        </span>

        <div className="flex flex-col gap-3">
          <h3 className="text-2xl">{t("successTitle")}</h3>
          <p className="text-muted">
            {t("successBody", { email: state.email ?? "", reference: state.reference ?? "" })}
          </p>
          <p className="text-muted">
            {state.paymentDeferred ? t("paymentDeferredBody") : t("successPayment")}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {state.checkoutUrl && (
            <a
              href={state.checkoutUrl}
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-accent px-6 font-semibold text-on-accent shadow-signal transition-colors hover:bg-accent-hover"
            >
              {t("successPaymentCta")}
              <ArrowRight className="text-lg" />
            </a>
          )}
          <Button variant="outline" size="md" onClick={() => window.location.reload()}>
            {t("successAnother")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {turnstileSiteKey && (
        <Script
          src={`${TURNSTILE_ORIGIN}/turnstile/v0/api.js`}
          strategy="lazyOnload"
        />
      )}

      <form
        action={formAction}
        // Server-side validation is authoritative; this only stops the browser
        // duplicating error messages we render ourselves.
        noValidate={false}
        className="flex flex-col gap-9"
      >
        {/* Security fields. Not user-visible, all verified server-side. */}
        <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name={FORM_TIMESTAMP_FIELD} value={formTimestamp} readOnly />

        {/* Honeypot. aria-hidden + tabIndex -1 + autoComplete off means no
            human or screen reader ever encounters it. */}
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="website-url-field">Website</label>
          <input
            id="website-url-field"
            type="text"
            name={HONEYPOT_FIELD}
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>

        {state.status === "error" && (
          <div
            ref={statusRef}
            tabIndex={-1}
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-surface p-5 focus:outline-none"
          >
            <Warning className="mt-0.5 shrink-0 text-lg text-danger" />
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-danger">{t("errorTitle")}</p>
              <p className="text-sm text-muted">
                {state.message ? t(state.message as never) : t("errorGeneric")}
              </p>
            </div>
          </div>
        )}

        <FieldGroup legend={t("sectionTeam")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label={t("fieldTeamName")}
              hint={t("fieldTeamNameHint")}
              name="teamName"
              required
              minLength={LIMITS.teamName.min}
              maxLength={LIMITS.teamName.max}
              autoComplete="off"
              error={fieldError("teamName")}
            />

            <SelectField
              label={t("fieldDiscipline")}
              name="discipline"
              required
              value={disciplineId}
              onChange={(event) => setDisciplineId(event.target.value)}
              error={fieldError("discipline")}
              hint={
                discipline
                  ? maxMembers === null
                    ? t("teamSizeHintUnknown")
                    : t("teamSizeHint", { max: maxMembers })
                  : undefined
              }
            >
              <option value="" disabled>
                {t("fieldDisciplinePlaceholder")}
              </option>
              {DISCIPLINES.map((item) => (
                <option key={item.id} value={item.id}>
                  {td(`items.${item.id}.name`)}
                </option>
              ))}
            </SelectField>

            <TextField
              label={t("fieldOrganization")}
              hint={t("fieldOrganizationHint")}
              name="organization"
              required
              minLength={LIMITS.organization.min}
              maxLength={LIMITS.organization.max}
              autoComplete="organization"
              error={fieldError("organization")}
            />

            <SelectField
              label={t("fieldRegion")}
              name="region"
              required
              defaultValue=""
              error={fieldError("region")}
            >
              <option value="" disabled>
                {t("fieldRegionPlaceholder")}
              </option>
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {tr(region)}
                </option>
              ))}
            </SelectField>

            <TextField
              label={t("fieldCity")}
              name="city"
              required
              minLength={LIMITS.city.min}
              maxLength={LIMITS.city.max}
              autoComplete="address-level2"
              error={fieldError("city")}
              className="sm:col-span-2"
            />
          </div>
        </FieldGroup>

        <FieldGroup legend={t("sectionMembers")}>
          {discipline && (
            <p className="-mt-2 text-sm text-muted">
              {t("ageHint", { min: discipline.ageMin, max: discipline.ageMax })}
            </p>
          )}

          {fieldError("members") && (
            <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-danger">
              <Warning className="shrink-0 text-sm" />
              {fieldError("members")}
            </p>
          )}

          <ul className="flex flex-col gap-4">
            {members.map((member, index) => (
              <li
                key={member.id}
                className="grid gap-4 rounded-lg border border-line bg-surface-muted p-4 sm:grid-cols-[1fr_7rem_auto] sm:items-end"
              >
                <TextField
                  label={`${t("memberLabel", { number: index + 1 })} — ${t("fieldMemberName")}`}
                  name={`members.${index}.name`}
                  required
                  minLength={LIMITS.memberName.min}
                  maxLength={LIMITS.memberName.max}
                  autoComplete="off"
                  error={fieldError(`members.${index}.name`)}
                />

                <TextField
                  label={t("fieldMemberAge")}
                  name={`members.${index}.age`}
                  required
                  type="number"
                  inputMode="numeric"
                  min={discipline?.ageMin ?? 4}
                  max={discipline?.ageMax ?? 30}
                  error={fieldError(`members.${index}.age`)}
                />

                {members.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t("removeMember", { number: index + 1 })}
                    onClick={() =>
                      setRoster((current) => current.filter((m) => m.id !== member.id))
                    }
                    className="mb-1 size-11 px-0 text-muted hover:text-danger"
                  >
                    <Close className="text-lg" />
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {canAddMember && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRoster((current) => [...current, newMember()])}
              className="self-start"
            >
              {t("addMember")}
            </Button>
          )}
        </FieldGroup>

        <FieldGroup legend={t("sectionContact")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label={t("fieldContactName")}
              name="contactName"
              required
              minLength={LIMITS.contactName.min}
              maxLength={LIMITS.contactName.max}
              autoComplete="name"
              error={fieldError("contactName")}
            />

            <SelectField
              label={t("fieldContactRole")}
              name="contactRole"
              required
              defaultValue=""
              error={fieldError("contactRole")}
            >
              <option value="" disabled>
                {t("fieldContactRolePlaceholder")}
              </option>
              <option value="participant">{t("roleParticipant")}</option>
              <option value="parent">{t("roleParent")}</option>
              <option value="teacher">{t("roleTeacher")}</option>
            </SelectField>

            <TextField
              label={t("fieldContactEmail")}
              hint={t("fieldContactEmailHint")}
              name="contactEmail"
              type="email"
              required
              maxLength={LIMITS.email.max}
              autoComplete="email"
              inputMode="email"
              error={fieldError("contactEmail")}
            />

            <TextField
              label={t("fieldContactPhone")}
              hint={t("fieldContactPhoneHint")}
              name="contactPhone"
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              error={fieldError("contactPhone")}
            />

            <TextAreaField
              label={t("fieldComment")}
              name="comment"
              maxLength={LIMITS.comment.max}
              optionalLabel={tc("optional")}
              error={fieldError("comment")}
              className="sm:col-span-2"
            />
          </div>
        </FieldGroup>

        <FieldGroup legend={t("sectionConsent")}>
          {/* Each consent is a separate, unticked checkbox. Bundling them into
              one "I agree to everything" box would not be valid consent, and
              the photo permission below must be refusable at no cost. */}
          <CheckboxField name="consentData" value="on" required error={fieldError("consentData")}>
            {t("consentData")}{" "}
            <Link
              href="/privacy"
              className="font-medium text-brand underline underline-offset-4"
            >
              {t("consentDataLink")}
            </Link>
          </CheckboxField>

          <CheckboxField
            name="consentGuardian"
            value="on"
            required
            error={fieldError("consentGuardian")}
          >
            {t("consentGuardian")}
          </CheckboxField>

          <CheckboxField name="consentRules" value="on" required error={fieldError("consentRules")}>
            {t("consentRules")}
          </CheckboxField>

          <CheckboxField
            name="consentMedia"
            value="on"
            hint={t("consentMediaOptional")}
            error={fieldError("consentMedia")}
          >
            {t("consentMedia")}
          </CheckboxField>
        </FieldGroup>

        {turnstileSiteKey && (
          <div
            className="cf-turnstile"
            data-sitekey={turnstileSiteKey}
            // Turnstile supports all three of our locales directly.
            data-language={locale}
            data-theme="light"
          />
        )}

        <div className="flex flex-col gap-4 border-t border-line pt-7">
          <Button
            type="submit"
            variant="accent"
            size="lg"
            disabled={isPending}
            className="self-start"
          >
            {isPending ? t("submitting") : t("submit")}
            {!isPending && <ArrowRight className="text-lg" />}
          </Button>
        </div>
      </form>
    </>
  );
}
