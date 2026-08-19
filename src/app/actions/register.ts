"use server";

import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";
import { logger, securityLog } from "@/lib/log";
import { getClientIp } from "@/lib/security/client-ip";
import { rateLimitAll } from "@/lib/security/rate-limit";
import { CSRF_COOKIE, CSRF_FIELD, assertCsrf, readTimestampToken } from "@/lib/security/csrf";
import {
  FORM_TIMESTAMP_FIELD,
  HONEYPOT_FIELD,
  checkHoneypot,
  checkTiming,
  verifyTurnstile,
} from "@/lib/security/turnstile";
import {
  collectFieldErrors,
  registrationSchema,
  type RegistrationData,
} from "@/lib/validation/registration";
import { DuplicateApplicationError, getApplicationStore } from "@/lib/db/store";
import { generateReference } from "@/lib/reference";
import { createCheckout } from "@/lib/payments";
import { isRegistrationOpen } from "@/config/event";
import { isLocale, routing } from "@/i18n/routing";
import type { RegisterState } from "./register-state";

/**
 * The registration endpoint. Every check below runs on the server regardless of
 * what the browser did, in cheapest-first order so that a flood of junk is
 * rejected before it can touch the database or a third-party API.
 *
 *   1. CSRF token          — cookie-bound, HMAC-signed
 *   2. Rate limit          — burst + hourly, per IP
 *   3. Honeypot + timing   — free bot filtering, no third party
 *   4. Turnstile           — only if configured; fails closed
 *   5. Deadline            — server clock, never the browser's
 *   6. Zod validation      — same schema the client uses, re-run from scratch
 *   7. Persist             — parameterised insert, DB-level duplicate guard
 *   8. Checkout            — hosted redirect; failure never loses the entry
 *
 * Error messages returned to the client are message *keys*, translated in the
 * component. They are also deliberately coarse: an attacker probing the
 * endpoint learns "rejected", not which control rejected them.
 */

export async function registerTeam(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const headerList = await headers();
  const cookieStore = await cookies();
  const ip = getClientIp(headerList);

  /* ── 1. CSRF ──────────────────────────────────────────────────────────── */

  const submittedToken = asString(formData.get(CSRF_FIELD));
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;

  if (!(await assertCsrf(submittedToken, cookieToken))) {
    securityLog.csrfFailure({ ip, hasCookie: Boolean(cookieToken) });
    return { status: "error", message: "errorGeneric" };
  }

  /* ── 2. Rate limiting ─────────────────────────────────────────────────── */

  const limit = await rateLimitAll(["registrationBurst", "registration"], ip);
  if (!limit.allowed) {
    securityLog.rateLimited({ ip, endpoint: "register", resetAt: limit.resetAt });
    return { status: "error", message: "errorRateLimit" };
  }

  /* ── 3. Honeypot and timing ───────────────────────────────────────────── */

  const honeypot = checkHoneypot(formData.get(HONEYPOT_FIELD));
  if (!honeypot.ok) {
    securityLog.honeypotTripped({ ip, reason: honeypot.reason });
    // Deliberately generic — a bot author should not learn which trap fired.
    return { status: "error", message: "errorGeneric" };
  }

  // The stamp is verified before it is trusted: an unsigned or tampered value
  // resolves to null and fails the check below.
  const renderedAt = await readTimestampToken(asString(formData.get(FORM_TIMESTAMP_FIELD)));
  const timing = checkTiming(renderedAt);
  if (!timing.ok) {
    securityLog.honeypotTripped({ ip, reason: timing.reason });
    return { status: "error", message: "errorGeneric" };
  }

  /* ── 4. Turnstile ─────────────────────────────────────────────────────── */

  const captchaOk = await verifyTurnstile(
    asString(formData.get("cf-turnstile-response")),
    ip,
  );
  if (!captchaOk) {
    return { status: "error", message: "errorCaptcha" };
  }

  /* ── 5. Deadline, on the server clock ─────────────────────────────────── */

  if (!isRegistrationOpen()) {
    securityLog.deadlineRejected({ ip });
    return { status: "error", message: "errorDeadline" };
  }

  /* ── 6. Validation ────────────────────────────────────────────────────── */

  const parsed = registrationSchema.safeParse(formDataToInput(formData));

  if (!parsed.success) {
    securityLog.validationRejected({
      ip,
      // Paths only — never the rejected values, which are personal data.
      paths: parsed.error.issues.map((issue) => issue.path.join(".")),
    });
    return {
      status: "error",
      message: "errorValidation",
      fieldErrors: collectFieldErrors(parsed.error),
      fieldErrorParams: collectIssueParams(parsed.error.issues),
    };
  }

  const data: RegistrationData = parsed.data;
  const locale = resolveLocale(formData.get("locale"));

  /* ── 7. Persist ───────────────────────────────────────────────────────── */

  const reference = generateReference();
  const store = getApplicationStore();

  let saved;
  try {
    // Plaintext in; the store encrypts every personal field before it reaches
    // the database. See src/lib/db/application.ts.
    saved = await store.create({
      reference,
      teamName: data.teamName,
      discipline: data.discipline,
      organization: data.organization,
      region: data.region,
      city: data.city,
      members: data.members,
      contactName: data.contactName,
      contactRole: data.contactRole,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      comment: data.comment ? data.comment : null,
      consentData: data.consentData,
      consentGuardian: data.consentGuardian,
      consentRules: data.consentRules,
      consentMedia: data.consentMedia ?? false,
      locale,
    });
  } catch (error) {
    if (error instanceof DuplicateApplicationError) {
      return { status: "error", message: "errorDuplicate" };
    }
    logger.error("registration.persist_failed", { reference, error });
    return { status: "error", message: "errorGeneric" };
  }

  logger.info("registration.created", {
    reference: saved.reference,
    discipline: saved.discipline,
    region: saved.region,
    memberCount: saved.memberCount,
    locale,
    // Note: no name, email, phone or member data — the logger would redact
    // them anyway, but they are not passed in the first place.
  });

  /* ── 8. Hosted checkout ───────────────────────────────────────────────── */

  const checkout = await createCheckout({
    reference: saved.reference,
    successUrl: `${env.APP_URL}/${locale}/payment/success?ref=${encodeURIComponent(saved.reference)}`,
    cancelUrl: `${env.APP_URL}/${locale}/payment/cancelled?ref=${encodeURIComponent(saved.reference)}`,
    email: data.contactEmail,
    locale,
    teamName: data.teamName,
    discipline: data.discipline,
  });

  return {
    status: "success",
    reference: saved.reference,
    email: data.contactEmail,
    checkoutUrl: checkout.status === "redirect" ? checkout.url : undefined,
    // The application is saved either way. Payment being unavailable is an
    // organiser follow-up, not a failed registration.
    paymentDeferred: checkout.status !== "redirect",
  };
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function asString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function resolveLocale(value: FormDataEntryValue | null): string {
  const candidate = asString(value);
  return candidate && isLocale(candidate) ? candidate : routing.defaultLocale;
}

/**
 * FormData → the shape the schema expects.
 *
 * Members arrive as `members.0.name` / `members.0.age`. Indices are read from
 * the field names, so the parser must not trust them: the index is bounded and
 * the array is rebuilt densely, which stops `members.999999.name` from being
 * used to allocate a huge sparse array.
 */
function formDataToInput(formData: FormData): Record<string, unknown> {
  const MAX_INDEX = 32;
  const members = new Map<number, { name?: string; age?: string }>();

  for (const [key, value] of formData.entries()) {
    const match = /^members\.(\d{1,2})\.(name|age)$/.exec(key);
    if (!match || typeof value !== "string") continue;

    const index = Number(match[1]);
    if (!Number.isInteger(index) || index < 0 || index >= MAX_INDEX) continue;

    const member = members.get(index) ?? {};
    member[match[2] as "name" | "age"] = value;
    members.set(index, member);
  }

  const orderedMembers = [...members.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, member]) => member)
    // Drop rows the user added and left completely blank.
    .filter((member) => (member.name ?? "").trim() !== "" || (member.age ?? "").trim() !== "");

  return {
    teamName: formData.get("teamName") ?? "",
    discipline: formData.get("discipline") ?? "",
    organization: formData.get("organization") ?? "",
    region: formData.get("region") ?? "",
    city: formData.get("city") ?? "",
    members: orderedMembers,
    contactName: formData.get("contactName") ?? "",
    contactRole: formData.get("contactRole") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    contactPhone: formData.get("contactPhone") ?? "",
    comment: formData.get("comment") ?? "",
    consentData: formData.get("consentData") ?? false,
    consentGuardian: formData.get("consentGuardian") ?? false,
    consentRules: formData.get("consentRules") ?? false,
    consentMedia: formData.get("consentMedia") ?? false,
  };
}

/** Carry `{ max: 3 }` style params through so the message can interpolate. */
function collectIssueParams(
  issues: { path: PropertyKey[]; params?: Record<string, unknown> }[],
): Record<string, Record<string, string | number>> {
  const out: Record<string, Record<string, string | number>> = {};
  for (const issue of issues) {
    if (!issue.params) continue;
    const path = issue.path.join(".");
    if (path in out) continue;
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(issue.params)) {
      if (typeof value === "string" || typeof value === "number") params[key] = value;
    }
    if (Object.keys(params).length) out[path] = params;
  }
  return out;
}
