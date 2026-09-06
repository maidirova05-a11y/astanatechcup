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
import {
  STATUSES,
  getApplicationById,
  recordStartListEntry,
  updateStatus,
} from "@/lib/admin/queries";
import { createTeam, suggestTeamCode } from "@/lib/scoring/store";
import { startListSchema } from "@/lib/validation/scoring";
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

  const { token } = await createSession(ip, headerList.get("user-agent"), "admin");
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

/* ── Start list ─────────────────────────────────────────────────────────── */

/**
 * Put a paid entry on the start list.
 *
 * This is the ONLY writer of `scoring_teams.application_id`. Without it the
 * column is never populated and the coaches' cabinet has nothing to show under
 * "На площадке" — the link has to be made by someone who can see both sides,
 * and that is the organising committee, not the referee crew. Judges must not
 * be handed a list of entries to pick from: those rows carry children's names,
 * and keeping them away from the console is the point of the whole separation.
 *
 * The team's name, organisation and region come from the entry rather than
 * from the form, so the start list cannot drift from what was registered.
 */
export async function addToStartList(formData: FormData): Promise<void> {
  // Re-checks the session itself, and `requireSession` inside it rejects a
  // judge — a server action is a public endpoint.
  const context = await getActionContext();

  const cookieStore = await cookies();
  const submitted = formData.get(CSRF_FIELD);
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  if (!(await assertCsrf(typeof submitted === "string" ? submitted : undefined, cookieToken))) {
    securityLog.csrfFailure({ endpoint: "admin.startlist" });
    return;
  }

  // One <select> carries both halves as "categoryId:classId", which keeps the
  // class list dependent on the category without shipping a client component
  // to this page for the sake of one field.
  const slot = formData.get("slot");
  const [categoryId = "", classId = ""] =
    typeof slot === "string" ? slot.split(":") : [];

  const parsed = startListSchema.safeParse({
    applicationId: formData.get("applicationId"),
    categoryId,
    classId,
    code: formData.get("code") ?? "",
    groupLabel: formData.get("groupLabel") ?? "",
  });

  if (!parsed.success) {
    redirect(
      `/admin/applications/${formData.get("applicationId")}?startlist=invalid`,
    );
  }

  const entry = await getApplicationById(parsed.data.applicationId);
  if (!entry) redirect("/admin/applications?startlist=missing");

  // Empty means "next free". A suggestion, not a reservation — the unique
  // index below is what actually decides a collision.
  const code =
    parsed.data.code !== ""
      ? parsed.data.code
      : await suggestTeamCode(parsed.data.categoryId, parsed.data.classId);

  try {
    await createTeam(
      {
        categoryId: parsed.data.categoryId,
        classId: parsed.data.classId,
        code,
        // From the entry, never from the form: the start list must say what
        // was registered.
        name: entry.teamName,
        organization: entry.organization,
        region: entry.region,
        groupLabel: parsed.data.groupLabel,
        applicationId: entry.id,
      },
      // The console's audit trail wants a scoring context; an admin session is
      // one, and `role` is what the trail records.
      { sessionId: context.sessionId, role: "admin", ip: context.ip },
    );
  } catch (error) {
    // The unique index on (category, class, code) is the real arbiter of a
    // duplicate start number — two organisers can seed the same class at the
    // same moment, and a check-then-insert would lose that race.
    logger.warn("admin.startlist_failed", {
      reference: entry.reference,
      reason: error instanceof Error ? error.message : "unknown",
    });
    redirect(`/admin/applications/${entry.id}?startlist=duplicate`);
  }

  await recordStartListEntry(entry.id, { ...parsed.data, code }, context);

  redirect(`/admin/applications/${entry.id}?startlist=added`);
}
