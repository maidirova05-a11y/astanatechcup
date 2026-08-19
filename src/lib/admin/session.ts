import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { adminSessions, adminLoginAttempts } from "@/lib/db/schema";
import { isProduction } from "@/lib/env";
import { securityLog } from "@/lib/log";

/**
 * Admin session lifecycle.
 *
 * The cookie holds a 32-byte random token. The database stores only its
 * SHA-256, so a leaked database dump cannot be replayed as a login — the same
 * reasoning that applies to passwords applies to bearer tokens.
 *
 * Sessions are server-side rows rather than self-contained signed cookies,
 * which is what makes "log out" and "log out everywhere" immediate rather than
 * a wait for a token to age out. For a panel holding children's data, being
 * able to cut access instantly matters more than saving a database round trip.
 */

/**
 * `__Host-` prefix in production: the browser refuses the cookie unless it is
 * Secure, `Path=/` and has no `Domain`, which stops any subdomain — including
 * a stray preview deployment — from setting an admin session for the main
 * site. Requires HTTPS, hence the localhost fallback.
 */
export const ADMIN_SESSION_COOKIE = isProduction ? "__Host-atc.admin" : "atc.admin";

/** Absolute lifetime — a session dies at this point regardless of activity. */
const ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;
/** Idle timeout — an unattended laptop stops being a way in. */
const IDLE_TTL_MS = 60 * 60 * 1000;

/** Lockout: this many failures from one IP within the window blocks logins. */
const MAX_FAILURES = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const adminCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProduction,
  path: "/",
  maxAge: ABSOLUTE_TTL_MS / 1000,
};

/* ── Lockout ────────────────────────────────────────────────────────────── */

export type LockoutState = { locked: boolean; failures: number; retryAfterMs: number };

/**
 * Failure counting lives in Postgres, not memory. On Vercel each request may
 * land on a different instance, so an in-process counter would let an attacker
 * brute-force the shared password essentially unthrottled.
 */
export async function checkLockout(identifier: string): Promise<LockoutState> {
  const db = getDb();
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);

  const rows = await db
    .select({ attemptedAt: adminLoginAttempts.attemptedAt })
    .from(adminLoginAttempts)
    .where(
      and(
        eq(adminLoginAttempts.identifier, identifier),
        eq(adminLoginAttempts.succeeded, false),
        gt(adminLoginAttempts.attemptedAt, since),
      ),
    )
    .orderBy(adminLoginAttempts.attemptedAt);

  if (rows.length < MAX_FAILURES) {
    return { locked: false, failures: rows.length, retryAfterMs: 0 };
  }

  // The window slides from the oldest failure still counted.
  const oldest = rows[0].attemptedAt.getTime();
  return {
    locked: true,
    failures: rows.length,
    retryAfterMs: Math.max(0, oldest + LOCKOUT_WINDOW_MS - Date.now()),
  };
}

export async function recordLoginAttempt(
  identifier: string,
  succeeded: boolean,
): Promise<void> {
  const db = getDb();
  await db.insert(adminLoginAttempts).values({ identifier, succeeded });

  if (succeeded) {
    // A success clears the slate for this IP, so a legitimate admin who
    // fumbled their password four times is not locked out afterwards.
    await db
      .delete(adminLoginAttempts)
      .where(
        and(
          eq(adminLoginAttempts.identifier, identifier),
          eq(adminLoginAttempts.succeeded, false),
        ),
      );
  }
}

/* ── Sessions ───────────────────────────────────────────────────────────── */

export type AdminSession = { id: string; expiresAt: Date };

export async function createSession(
  ip: string,
  userAgent: string | null,
): Promise<{ token: string; session: AdminSession }> {
  const db = getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ABSOLUTE_TTL_MS);

  const [row] = await db
    .insert(adminSessions)
    .values({
      tokenHash: hashToken(token),
      expiresAt,
      ip: ip.slice(0, 64),
      userAgent: userAgent?.slice(0, 255) ?? null,
    })
    .returning({ id: adminSessions.id, expiresAt: adminSessions.expiresAt });

  // Opportunistic cleanup; keeps the table from growing without a cron job.
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));

  return { token, session: row };
}

/**
 * Resolve the current session from the cookie, or null.
 *
 * Also refreshes `lastSeenAt`, which is what implements the idle timeout.
 */
export async function getSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const now = new Date();
  const idleCutoff = new Date(now.getTime() - IDLE_TTL_MS);

  const rows = await db
    .select({
      id: adminSessions.id,
      expiresAt: adminSessions.expiresAt,
      lastSeenAt: adminSessions.lastSeenAt,
      tokenHash: adminSessions.tokenHash,
    })
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.tokenHash, hashToken(token)),
        gt(adminSessions.expiresAt, now),
        gt(adminSessions.lastSeenAt, idleCutoff),
        isNull(adminSessions.revokedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Belt and braces: the lookup was by hash equality in SQL, but compare the
  // hash again in constant time so nothing about it can leak through timing.
  const expected = Buffer.from(row.tokenHash, "utf8");
  const actual = Buffer.from(hashToken(token), "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  // Only write when it actually moves the needle — otherwise every page view
  // is a write, which is wasteful and noisy in the database logs.
  if (now.getTime() - row.lastSeenAt.getTime() > 60_000) {
    await db
      .update(adminSessions)
      .set({ lastSeenAt: now })
      .where(eq(adminSessions.id, row.id));
  }

  return { id: row.id, expiresAt: row.expiresAt };
}

export async function revokeSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.id, sessionId));
}

/** "Sign out everywhere" — used after a password change. */
export async function revokeAllSessions(): Promise<number> {
  const db = getDb();
  const result = await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(isNull(adminSessions.revokedAt))
    .returning({ id: adminSessions.id });
  securityLog.rateLimited({ event: "admin.sessions_revoked_all", count: result.length });
  return result.length;
}

export async function countActiveSessions(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adminSessions)
    .where(and(gt(adminSessions.expiresAt, new Date()), isNull(adminSessions.revokedAt)));
  return rows[0]?.count ?? 0;
}
