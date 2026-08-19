"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { env, features } from "@/lib/env";
import { logger, securityLog } from "@/lib/log";
import { getClientIp } from "@/lib/security/client-ip";
import { CSRF_COOKIE, CSRF_FIELD, assertCsrf } from "@/lib/security/csrf";
import { verifyPassword } from "@/lib/admin/password";
import {
  ADMIN_SESSION_COOKIE,
  adminCookieOptions,
  checkLockout,
  createSession,
  getSession,
  recordLoginAttempt,
  revokeSession,
} from "@/lib/admin/session";
import { STATUSES, updateStatus } from "@/lib/admin/queries";
import { getActionContext } from "./auth";
import type { LoginState } from "./login-state";
import type { ApplicationStatus } from "@/lib/db/schema";

/**
 * Admin server actions.
 *
 * The login action is the most attacked endpoint in the application, so it is
 * the most defended: CSRF, persistent per-IP lockout, constant-time password
 * comparison, a deliberate delay on failure, and a single generic error
 * message that never reveals which part was wrong.
 */

/** Slows credential stuffing and flattens the timing difference on failure. */
const FAILURE_DELAY_MS = 700;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!features.admin) {
    return { status: "error", message: "Админ-панель не настроена." };
  }

  const headerList = await headers();
  const cookieStore = await cookies();
  const ip = getClientIp(headerList);

  // 1. CSRF — the token is minted per request in src/proxy.ts.
  const submitted = formData.get(CSRF_FIELD);
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  if (!(await assertCsrf(typeof submitted === "string" ? submitted : undefined, cookieToken))) {
    securityLog.csrfFailure({ ip, endpoint: "admin.login" });
    return { status: "error", message: "Сессия устарела. Обновите страницу и попробуйте снова." };
  }

  // 2. Lockout, counted in Postgres so it survives across serverless instances.
  const lockout = await checkLockout(ip);
  if (lockout.locked) {
    securityLog.rateLimited({ ip, endpoint: "admin.login", failures: lockout.failures });
    const minutes = Math.ceil(lockout.retryAfterMs / 60_000);
    return {
      status: "error",
      message: `Слишком много неудачных попыток. Повторите через ${minutes} мин.`,
    };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0 || password.length > 512) {
    await recordLoginAttempt(ip, false);
    await delay(FAILURE_DELAY_MS);
    return { status: "error", message: "Неверный пароль." };
  }

  // 3. Constant-time verification against the scrypt hash.
  const ok = await verifyPassword(password, env.ADMIN_PASSWORD_HASH!);
  await recordLoginAttempt(ip, ok);

  if (!ok) {
    securityLog.csrfFailure({ ip, endpoint: "admin.login", reason: "bad_password" });
    await delay(FAILURE_DELAY_MS);
    // Deliberately identical to every other failure message.
    return { status: "error", message: "Неверный пароль." };
  }

  const { token } = await createSession(ip, headerList.get("user-agent"));
  cookieStore.set(ADMIN_SESSION_COOKIE, token, adminCookieOptions);

  logger.info("admin.login_success", { ip });

  redirect("/admin");
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const session = await getSession();

  if (session) {
    // Revoked server-side, not merely forgotten by the browser — a copied
    // cookie stops working the moment someone signs out.
    await revokeSession(session.id);
    logger.info("admin.logout", { sessionId: session.id });
  }

  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}

export async function changeApplicationStatus(formData: FormData): Promise<void> {
  // Re-checks the session itself. A server action is a public endpoint; the
  // fact that the page rendering it was guarded means nothing.
  const context = await getActionContext();

  const cookieStore = await cookies();
  const submitted = formData.get(CSRF_FIELD);
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  if (!(await assertCsrf(typeof submitted === "string" ? submitted : undefined, cookieToken))) {
    securityLog.csrfFailure({ endpoint: "admin.status" });
    return;
  }

  const id = formData.get("id");
  const status = formData.get("status");

  if (typeof id !== "string" || typeof status !== "string") return;
  // Allow-list, not a cast: an arbitrary string must never reach the enum column.
  if (!(STATUSES as readonly string[]).includes(status)) return;

  await updateStatus(id, status as ApplicationStatus, context);

  redirect(`/admin/applications/${id}`);
}
