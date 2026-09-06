import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { coachAccounts, coachSessions } from "@/lib/db/schema";
import { adminLoginAttempts } from "@/lib/db/schema";
import { isProduction } from "@/lib/env";

/**
 * Coach session lifecycle.
 *
 * A deliberate near-copy of src/lib/admin/session.ts rather than a shared
 * generic. The two are the same shape today and must be free to diverge: the
 * operator session guards a table of children's names and wants a short leash,
 * a coach session guards that coach's own entry and wants to survive a day.
 * Folding them into one parameterised helper would make every future change to
 * one a change to the other, on an auth path, which is exactly where accidental
 * coupling costs the most.
 *
 * What is NOT copied is the table. See the comment on `coachSessions` in
 * schema.ts: a coach cookie must not be able to resolve to an operator session
 * under any call site's mistake.
 */

/**
 * `__Host-` in production: the browser refuses the cookie unless it is Secure,
 * `Path=/` and carries no `Domain`, so no subdomain — a stray preview
 * deployment included — can plant a coach session on the main site.
 */
export const COACH_SESSION_COOKIE = isProduction ? "__Host-atc.coach" : "atc.coach";

/**
 * Longer than the operator sessions' 12 hours, and deliberately so. A coach
 * opens this to check whether their entry is confirmed and how their team is
 * placed; making them sign in again on every visit would push them towards a
 * weak, memorable password, which costs more than the extra days cost. Still
 * bounded — this is not a "remember me forever" cookie.
 */
const ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Idle timeout. A shared or borrowed device stops being a way in. */
const IDLE_TTL_MS = 48 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const coachCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProduction,
  path: "/",
  maxAge: ABSOLUTE_TTL_MS / 1000,
};

/* ── Lockout ────────────────────────────────────────────────────────────── */

/**
 * Two counters, both in Postgres because Vercel runs many instances and an
 * in-process counter would throttle nothing.
 *
 * `coach-ip:<address>` stops one machine working through many accounts.
 * `coach-acct:<emailHash>` stops many machines working through one account —
 * which per-account passwords make worth defending separately, since an
 * attacker who rotates addresses would otherwise face no limit at all on a
 * single target. The admin form's counter is untouched by both: a coach
 * fumbling their password must not lock the organisers out of the panel.
 */
export const COACH_IP_SCOPE = "coach-ip:";
export const COACH_ACCOUNT_SCOPE = "coach-acct:";

const MAX_FAILURES = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

export type CoachLockout = { locked: boolean; retryAfterMs: number };

export async function checkCoachLockout(identifier: string): Promise<CoachLockout> {
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

  if (rows.length < MAX_FAILURES) return { locked: false, retryAfterMs: 0 };

  const oldest = rows[0].attemptedAt.getTime();
  return {
    locked: true,
    retryAfterMs: Math.max(0, oldest + LOCKOUT_WINDOW_MS - Date.now()),
  };
}

export async function recordCoachAttempt(
  identifier: string,
  succeeded: boolean,
): Promise<void> {
  const db = getDb();
  await db.insert(adminLoginAttempts).values({ identifier, succeeded });

  if (succeeded) {
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

export type CoachSession = { id: string; accountId: string };

export async function createCoachSession(
  accountId: string,
  ip: string,
  userAgent: string | null,
): Promise<{ token: string; sessionId: string }> {
  const db = getDb();
  const token = randomBytes(32).toString("base64url");

  const [row] = await db
    .insert(coachSessions)
    .values({
      tokenHash: hashToken(token),
      coachAccountId: accountId,
      expiresAt: new Date(Date.now() + ABSOLUTE_TTL_MS),
      ip: ip.slice(0, 64),
      userAgent: userAgent?.slice(0, 255) ?? null,
    })
    .returning({ id: coachSessions.id });

  // Opportunistic cleanup, so the table does not need a cron job.
  await db.delete(coachSessions).where(lt(coachSessions.expiresAt, new Date()));

  return { token, sessionId: row.id };
}

/**
 * Resolve the signed-in coach, or null.
 *
 * The account is joined in and re-checked on every request rather than trusted
 * from the session row, so revoking an account takes effect on that coach's
 * next page view instead of whenever their cookie happens to expire.
 */
export async function getCoachSession(): Promise<CoachSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COACH_SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const now = new Date();
  const idleCutoff = new Date(now.getTime() - IDLE_TTL_MS);

  const rows = await db
    .select({
      id: coachSessions.id,
      accountId: coachSessions.coachAccountId,
      tokenHash: coachSessions.tokenHash,
      lastSeenAt: coachSessions.lastSeenAt,
      accountRevokedAt: coachAccounts.revokedAt,
    })
    .from(coachSessions)
    .innerJoin(coachAccounts, eq(coachAccounts.id, coachSessions.coachAccountId))
    .where(
      and(
        eq(coachSessions.tokenHash, hashToken(token)),
        gt(coachSessions.expiresAt, now),
        gt(coachSessions.lastSeenAt, idleCutoff),
        isNull(coachSessions.revokedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.accountRevokedAt) return null;

  // The SQL already matched on hash equality; compare again in constant time
  // so nothing about the stored value can leak through timing.
  const expected = Buffer.from(row.tokenHash, "utf8");
  const actual = Buffer.from(hashToken(token), "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  // Only write when it moves the needle, so a page view is not a write.
  if (now.getTime() - row.lastSeenAt.getTime() > 60_000) {
    await db
      .update(coachSessions)
      .set({ lastSeenAt: now })
      .where(eq(coachSessions.id, row.id));
  }

  return { id: row.id, accountId: row.accountId };
}

export async function revokeCoachSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(coachSessions)
    .set({ revokedAt: new Date() })
    .where(eq(coachSessions.id, sessionId));
}

/**
 * Cut every session for one account.
 *
 * Called when a password is set again through activation: whoever proved
 * ownership of the entry just now gets the only live session, so a stolen
 * cookie does not outlive the reset that was meant to end it.
 */
export async function revokeAllCoachSessions(accountId: string): Promise<void> {
  const db = getDb();
  await db
    .update(coachSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(coachSessions.coachAccountId, accountId),
        isNull(coachSessions.revokedAt),
      ),
    );
}
