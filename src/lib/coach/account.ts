import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { applications, coachAccounts, type CoachAccountRow } from "@/lib/db/schema";
import { emailLookupHash } from "@/lib/db/application";
import { encryptField } from "@/lib/crypto/field";
import { hashPassword } from "@/lib/admin/password";
import { normaliseReference } from "@/lib/reference";
import { revokeAllCoachSessions } from "./session";

/**
 * Coach accounts: creation, and the proof of ownership that gates it.
 *
 * ── How a coach gets in, and why it works this way ───────────────────────
 * There is no mail sender in this deployment — no SMTP, nothing in
 * .env.example — so the usual "we e-mailed you a link" is not available, and
 * inventing it would mean adding a delivery dependency to an auth path three
 * weeks before an event.
 *
 * Instead the coach proves they own the entry with two things they already
 * have: the reference printed on their confirmation (ATC-7K3M-92) and the
 * e-mail address that entry was filed with. Both must point at the SAME
 * application row. The reference is 8 characters from a 32-symbol alphabet —
 * 40 bits — which is far past guessing under a five-try lockout, and the
 * address has to match it exactly.
 *
 * ⚠ The consequence, stated plainly: anyone holding both values can set the
 * password on that entry. That is what makes a forgotten password recoverable
 * without a mail server — the coach simply activates again — and it is the
 * same trade the organising committee already makes when it treats the
 * reference as the thing that identifies an entry over the phone. If a mail
 * sender is added later, this is the function to revisit.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type ActivationResult =
  | { ok: true; accountId: string; created: boolean }
  | { ok: false; reason: "not_found" };

/**
 * Find the application matching BOTH a reference and an e-mail, then set that
 * coach's password.
 *
 * The lookup is a single query with both conditions rather than "find by
 * reference, then compare the e-mail", so a wrong address and an unknown
 * reference are indistinguishable to the caller — and so there is no branch
 * whose timing reveals that a reference exists.
 */
export async function activateCoachAccount(input: {
  reference: string;
  email: string;
  password: string;
}): Promise<ActivationResult> {
  const reference = normaliseReference(input.reference);
  if (!reference) return { ok: false, reason: "not_found" };

  const emailHash = emailLookupHash(input.email);
  const db = getDb();

  const rows = await db
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(
        eq(applications.reference, reference),
        eq(applications.contactEmailHash, emailHash),
      ),
    )
    .limit(1);

  if (rows.length === 0) return { ok: false, reason: "not_found" };

  // Hashing is ~150 ms of deliberate work; it happens only after ownership is
  // established, so an attacker cannot use activation as a CPU amplifier.
  const passwordHash = await hashPassword(input.password);

  const existing = await findAccountByEmailHash(emailHash);

  if (existing) {
    await db
      .update(coachAccounts)
      .set({ passwordHash, revokedAt: null })
      .where(eq(coachAccounts.id, existing.id));

    // Whoever just proved ownership gets the only live session. A cookie
    // stolen before the reset must not survive it.
    await revokeAllCoachSessions(existing.id);

    return { ok: true, accountId: existing.id, created: false };
  }

  const [created] = await db
    .insert(coachAccounts)
    .values({
      emailHash,
      email: encryptField(input.email.trim()),
      passwordHash,
    })
    .returning({ id: coachAccounts.id });

  return { ok: true, accountId: created.id, created: true };
}

export async function findAccountByEmailHash(
  emailHash: string,
): Promise<CoachAccountRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(coachAccounts)
    .where(eq(coachAccounts.emailHash, emailHash))
    .limit(1);

  return rows[0] ?? null;
}

export async function findAccountByEmail(email: string): Promise<CoachAccountRow | null> {
  return findAccountByEmailHash(emailLookupHash(email));
}

export async function findAccountById(id: string): Promise<CoachAccountRow | null> {
  const db = getDb();
  const rows = await db.select().from(coachAccounts).where(eq(coachAccounts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function touchLastLogin(accountId: string): Promise<void> {
  const db = getDb();
  await db
    .update(coachAccounts)
    .set({ lastLoginAt: new Date() })
    .where(eq(coachAccounts.id, accountId));
}
