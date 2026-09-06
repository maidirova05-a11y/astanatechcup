"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { features } from "@/lib/env";
import { logger, securityLog } from "@/lib/log";
import { getClientIp } from "@/lib/security/client-ip";
import { CSRF_COOKIE, CSRF_FIELD, assertCsrf } from "@/lib/security/csrf";
import { hashPassword, verifyPassword } from "@/lib/admin/password";
import { emailLookupHash } from "@/lib/db/application";
import {
  activateCoachAccount,
  findAccountByEmailHash,
  touchLastLogin,
} from "@/lib/coach/account";
import {
  COACH_ACCOUNT_SCOPE,
  COACH_IP_SCOPE,
  COACH_SESSION_COOKIE,
  checkCoachLockout,
  coachCookieOptions,
  createCoachSession,
  getCoachSession,
  recordCoachAttempt,
  revokeCoachSession,
} from "@/lib/coach/session";
import type { CoachFormState } from "./form-state";

/**
 * Server actions for the coaches' cabinet.
 *
 * Each one re-checks everything itself. A server action is a public endpoint;
 * that the page rendering the form was guarded means nothing to a request
 * someone builds by hand.
 */

/** Slows credential stuffing and flattens the timing difference on failure. */
const FAILURE_DELAY_MS = 700;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A real hash to verify against when no account matched.
 *
 * Without this, a sign-in for an unknown address returns in a millisecond
 * while a known one takes the ~150 ms scrypt costs — which turns the form into
 * an oracle for "is this coach registered". Hashing a random string once at
 * module load gives the miss the same shape as the hit.
 */
const decoyHash = hashPassword(
  Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64"),
);

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 512;

const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

const GENERIC_SIGN_IN_ERROR = "Неверная почта или пароль.";
const GENERIC_ACTIVATION_ERROR =
  "Заявка с таким номером и почтой не найдена. Проверьте, что почта та же, с которой подавали заявку.";

/** Shared preamble: feature gate, CSRF, and the per-address lockout. */
async function guard(
  formData: FormData,
  endpoint: string,
): Promise<{ ok: true; ip: string } | { ok: false; state: CoachFormState }> {
  if (!features.coach) {
    return {
      ok: false,
      state: { status: "error", message: "Кабинет недоступен на этом развёртывании." },
    };
  }

  const headerList = await headers();
  const cookieStore = await cookies();
  const ip = getClientIp(headerList);

  const submitted = formData.get(CSRF_FIELD);
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  if (!(await assertCsrf(typeof submitted === "string" ? submitted : undefined, cookieToken))) {
    securityLog.csrfFailure({ ip, endpoint });
    return {
      ok: false,
      state: {
        status: "error",
        message: "Сессия устарела. Обновите страницу и попробуйте снова.",
      },
    };
  }

  const lockout = await checkCoachLockout(COACH_IP_SCOPE + ip);
  if (lockout.locked) {
    securityLog.rateLimited({ ip, endpoint });
    const minutes = Math.ceil(lockout.retryAfterMs / 60_000);
    return {
      ok: false,
      state: {
        status: "error",
        message: `Слишком много неудачных попыток. Повторите через ${minutes} мин.`,
      },
    };
  }

  return { ok: true, ip };
}

/* ── Sign in ────────────────────────────────────────────────────────────── */

export async function coachLogin(
  _prevState: CoachFormState,
  formData: FormData,
): Promise<CoachFormState> {
  const gate = await guard(formData, "coach.login");
  if (!gate.ok) return gate.state;
  const { ip } = gate;

  const typedEmail = formData.get("email");
  const echo = {
    email: typeof typedEmail === "string" ? typedEmail.slice(0, 254) : undefined,
  };

  const email = emailSchema.safeParse(typedEmail);
  const password = z
    .string()
    .min(1)
    .max(PASSWORD_MAX)
    .safeParse(formData.get("password"));

  if (!email.success || !password.success) {
    await recordCoachAttempt(COACH_IP_SCOPE + ip, false);
    await delay(FAILURE_DELAY_MS);
    return { status: "error", message: GENERIC_SIGN_IN_ERROR, values: echo };
  }

  const emailHash = emailLookupHash(email.data);

  // Per-account counter as well as per-address: with a password per coach, an
  // attacker rotating IPs would otherwise get unlimited tries at one target.
  const accountLock = await checkCoachLockout(COACH_ACCOUNT_SCOPE + emailHash);
  if (accountLock.locked) {
    securityLog.rateLimited({ ip, endpoint: "coach.login", scope: "account" });
    const minutes = Math.ceil(accountLock.retryAfterMs / 60_000);
    return {
      status: "error",
      message: `Слишком много неудачных попыток для этой почты. Повторите через ${minutes} мин.`,
      values: echo,
    };
  }

  const account = await findAccountByEmailHash(emailHash);

  // Always verify against something, so a missing account and a wrong password
  // take the same time. See decoyHash above.
  const matched = account
    ? await verifyPassword(password.data, account.passwordHash)
    : await verifyPassword(password.data, await decoyHash).then(() => false);

  const ok = matched && account !== null && account.revokedAt === null;

  await Promise.all([
    recordCoachAttempt(COACH_IP_SCOPE + ip, ok),
    recordCoachAttempt(COACH_ACCOUNT_SCOPE + emailHash, ok),
  ]);

  if (!ok || !account) {
    logger.info("coach.login_failed", { ip });
    await delay(FAILURE_DELAY_MS);
    return { status: "error", message: GENERIC_SIGN_IN_ERROR, values: echo };
  }

  const headerList = await headers();
  const cookieStore = await cookies();
  const { token } = await createCoachSession(
    account.id,
    ip,
    headerList.get("user-agent"),
  );
  cookieStore.set(COACH_SESSION_COOKIE, token, coachCookieOptions);
  await touchLastLogin(account.id);

  logger.info("coach.login_success", { ip, accountId: account.id });

  redirect("/coach");
}

/* ── Activation ─────────────────────────────────────────────────────────── */

/**
 * Set (or reset) the password on an entry, proving ownership with the
 * reference and the e-mail it was filed with.
 *
 * This doubles as the password reset. There is no mail sender in this
 * deployment, so "forgot my password" is "activate again with the same two
 * values" — see the note on activateCoachAccount for what that trades away.
 */
export async function coachActivate(
  _prevState: CoachFormState,
  formData: FormData,
): Promise<CoachFormState> {
  const gate = await guard(formData, "coach.activate");
  if (!gate.ok) return gate.state;
  const { ip } = gate;

  const typedReference = formData.get("reference");
  const typedEmail = formData.get("email");
  const echo = {
    reference: typeof typedReference === "string" ? typedReference.slice(0, 32) : undefined,
    email: typeof typedEmail === "string" ? typedEmail.slice(0, 254) : undefined,
  };

  const reference = z.string().trim().min(1).max(32).safeParse(typedReference);
  const email = emailSchema.safeParse(typedEmail);
  const password = passwordSchema.safeParse(formData.get("password"));

  if (!password.success) {
    return {
      status: "error",
      field: "password",
      message: `Пароль должен быть не короче ${PASSWORD_MIN} символов.`,
      values: echo,
    };
  }

  if (!reference.success || !email.success) {
    await recordCoachAttempt(COACH_IP_SCOPE + ip, false);
    await delay(FAILURE_DELAY_MS);
    return { status: "error", message: GENERIC_ACTIVATION_ERROR, values: echo };
  }

  const result = await activateCoachAccount({
    reference: reference.data,
    email: email.data,
    password: password.data,
  });

  await recordCoachAttempt(COACH_IP_SCOPE + ip, result.ok);

  if (!result.ok) {
    logger.info("coach.activate_failed", { ip });
    await delay(FAILURE_DELAY_MS);
    return { status: "error", message: GENERIC_ACTIVATION_ERROR, values: echo };
  }

  const headerList = await headers();
  const cookieStore = await cookies();
  const { token } = await createCoachSession(
    result.accountId,
    ip,
    headerList.get("user-agent"),
  );
  cookieStore.set(COACH_SESSION_COOKIE, token, coachCookieOptions);
  await touchLastLogin(result.accountId);

  logger.info("coach.activated", {
    ip,
    accountId: result.accountId,
    created: result.created,
  });

  redirect("/coach");
}

/* ── Sign out ───────────────────────────────────────────────────────────── */

export async function coachLogout(): Promise<void> {
  const cookieStore = await cookies();
  const session = await getCoachSession();

  if (session) {
    await revokeCoachSession(session.id);
    logger.info("coach.logout", { sessionId: session.id });
  }

  cookieStore.delete(COACH_SESSION_COOKIE);
  redirect("/coach/login");
}
