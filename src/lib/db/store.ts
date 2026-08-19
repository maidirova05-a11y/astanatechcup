import "server-only";
import { and, eq } from "drizzle-orm";
import { features } from "@/lib/env";
import { logger } from "@/lib/log";
import { getDb } from "./client";
import { toRow, type ApplicationInput } from "./application";
import { applications, webhookEvents, type ApplicationRow } from "./schema";

/**
 * Storage behind a narrow interface, with two implementations:
 *
 *   · PostgresStore — the real one.
 *   · MemoryStore   — used when DATABASE_URL is absent, so the whole site,
 *                     including the registration flow, runs with an empty .env.
 *                     `src/lib/env.ts` refuses to boot in production without a
 *                     database, so this can never silently eat real entries.
 *
 * The interface is deliberately small. Everything the app needs to do with an
 * application is here, which means every query lives in one reviewable file.
 */

/**
 * Note the shape: callers pass PLAINTEXT (`ApplicationInput`) and this module
 * encrypts on the way in. No caller can accidentally write personal data in
 * the clear, because no caller ever constructs the row.
 */
export type CreateApplicationInput = ApplicationInput;

export class DuplicateApplicationError extends Error {
  constructor() {
    super("An application with this email, team name and discipline already exists");
    this.name = "DuplicateApplicationError";
  }
}

export interface ApplicationStore {
  create(input: CreateApplicationInput): Promise<ApplicationRow>;
  findByReference(reference: string): Promise<ApplicationRow | null>;
  markPaid(reference: string, paymentReference: string): Promise<ApplicationRow | null>;
  /** Returns false when this event id has already been handled. */
  recordWebhookEvent(id: string, provider: string, type: string): Promise<boolean>;
  countByDiscipline(): Promise<Record<string, number>>;
}

/* ── Postgres ───────────────────────────────────────────────────────────── */

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}

class PostgresStore implements ApplicationStore {
  async create(input: CreateApplicationInput): Promise<ApplicationRow> {
    try {
      // toRow() is the only place personal fields are serialised for storage,
      // and it encrypts every one of them.
      const [row] = await getDb().insert(applications).values(toRow(input)).returning();
      return row;
    } catch (error) {
      // Translate the database's duplicate guard into a domain error, so the
      // action can show a helpful message instead of a 500.
      if (isUniqueViolation(error)) throw new DuplicateApplicationError();
      throw error;
    }
  }

  async findByReference(reference: string): Promise<ApplicationRow | null> {
    const rows = await getDb()
      .select()
      .from(applications)
      .where(eq(applications.reference, reference))
      .limit(1);
    return rows[0] ?? null;
  }

  async markPaid(reference: string, paymentReference: string): Promise<ApplicationRow | null> {
    const rows = await getDb()
      .update(applications)
      .set({
        status: "paid",
        paymentReference,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      // Only ever advances from pending_payment. A replayed webhook for an
      // already-cancelled application cannot resurrect it.
      .where(
        and(
          eq(applications.reference, reference),
          eq(applications.status, "pending_payment"),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  async recordWebhookEvent(id: string, provider: string, type: string): Promise<boolean> {
    try {
      await getDb().insert(webhookEvents).values({ id, provider, type });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  async countByDiscipline(): Promise<Record<string, number>> {
    const rows = await getDb().select().from(applications);
    return tally(rows);
  }
}

/* ── In-memory (development only) ───────────────────────────────────────── */

class MemoryStore implements ApplicationStore {
  private rows: ApplicationRow[] = [];
  private events = new Set<string>();

  async create(input: CreateApplicationInput): Promise<ApplicationRow> {
    // Encrypt first, so the in-memory store holds exactly what Postgres would.
    // Development that reads plaintext where production reads ciphertext is
    // how encryption bugs reach production undetected.
    const encrypted = toRow(input);

    const duplicate = this.rows.some(
      (row) =>
        row.contactEmailHash === encrypted.contactEmailHash &&
        row.teamName === encrypted.teamName &&
        row.discipline === encrypted.discipline,
    );
    if (duplicate) throw new DuplicateApplicationError();

    const now = new Date();
    const row = {
      id: crypto.randomUUID(),
      status: "pending_payment",
      paymentReference: null,
      paidAt: null,
      consentAt: now,
      createdAt: now,
      updatedAt: now,
      ...encrypted,
    } as ApplicationRow;

    this.rows.push(row);
    logger.warn("store.memory_write", {
      reference: row.reference,
      note: "In-memory store — this application is NOT persisted. Set DATABASE_URL.",
    });
    return row;
  }

  async findByReference(reference: string): Promise<ApplicationRow | null> {
    return this.rows.find((row) => row.reference === reference) ?? null;
  }

  async markPaid(reference: string, paymentReference: string): Promise<ApplicationRow | null> {
    const row = this.rows.find(
      (candidate) => candidate.reference === reference && candidate.status === "pending_payment",
    );
    if (!row) return null;
    row.status = "paid";
    row.paymentReference = paymentReference;
    row.paidAt = new Date();
    row.updatedAt = new Date();
    return row;
  }

  async recordWebhookEvent(id: string): Promise<boolean> {
    if (this.events.has(id)) return false;
    this.events.add(id);
    return true;
  }

  async countByDiscipline(): Promise<Record<string, number>> {
    return tally(this.rows);
  }
}

function tally(rows: Pick<ApplicationRow, "discipline">[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.discipline] = (counts[row.discipline] ?? 0) + 1;
  }
  return counts;
}

/* ── Selection ──────────────────────────────────────────────────────────── */

let store: ApplicationStore | null = null;

export function getApplicationStore(): ApplicationStore {
  if (store) return store;

  if (features.database) {
    store = new PostgresStore();
  } else {
    logger.warn("store.memory_selected", {
      note: "DATABASE_URL is not set — using the in-memory store. Applications are lost on restart. Production boot is blocked by src/lib/env.ts.",
    });
    store = new MemoryStore();
  }

  return store;
}

/** Test seam. */
export function setApplicationStore(next: ApplicationStore): void {
  store = next;
}
