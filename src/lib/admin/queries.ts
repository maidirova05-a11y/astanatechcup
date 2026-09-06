import "server-only";
import { and, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { applications, applicationAudit, type ApplicationStatus } from "@/lib/db/schema";
import { DISCIPLINE_IDS, REGISTRATION_DEADLINE } from "@/config/event";
import { REGIONS } from "@/config/regions";
import { logger } from "@/lib/log";
import { blindIndex } from "@/lib/crypto/field";
import { toApplication, toApplications, type Application } from "@/lib/db/application";

/**
 * Every query the admin panel makes, in one reviewable file.
 *
 * All filters are validated against known-good allow-lists before they reach a
 * query — a discipline must be one of the six in the config, a status one of
 * the five in the enum. Combined with Drizzle's parameterised output, there is
 * no path from a URL query string into SQL.
 */

export const STATUSES = [
  "pending_payment",
  "paid",
  "confirmed",
  "cancelled",
  "rejected",
] as const;

export const PAGE_SIZE = 25;

export type ApplicationFilters = {
  search?: string;
  discipline?: string;
  status?: string;
  region?: string;
  page?: number;
};

export type ParsedFilters = {
  search: string;
  discipline: string | null;
  status: ApplicationStatus | null;
  region: string | null;
  page: number;
};

/**
 * Normalise raw search params. Anything unrecognised becomes null rather than
 * an error — a stale bookmark with a removed discipline should show everything,
 * not a 500.
 */
export function parseFilters(raw: ApplicationFilters): ParsedFilters {
  const page = Number(raw.page);

  return {
    // Cap the length so a pathological search term cannot be used to make
    // Postgres do unbounded pattern-matching work.
    search: typeof raw.search === "string" ? raw.search.trim().slice(0, 100) : "",
    discipline:
      raw.discipline && (DISCIPLINE_IDS as string[]).includes(raw.discipline)
        ? raw.discipline
        : null,
    status:
      raw.status && (STATUSES as readonly string[]).includes(raw.status)
        ? (raw.status as ApplicationStatus)
        : null,
    region:
      raw.region && (REGIONS as readonly string[]).includes(raw.region) ? raw.region : null,
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

function buildWhere(filters: ParsedFilters): SQL | undefined {
  const clauses: SQL[] = [];

  if (filters.discipline) clauses.push(eq(applications.discipline, filters.discipline));
  if (filters.status) clauses.push(eq(applications.status, filters.status));
  if (filters.region) clauses.push(eq(applications.region, filters.region));

  if (filters.search) {
    /**
     * Search works on the columns that are still plaintext, plus an exact
     * match on email via its blind index.
     *
     * `contactName` and `contactPhone` are encrypted with a random IV, so
     * there is no partial match to perform against them — the ciphertext of
     * "Айсұлу" shares nothing with the ciphertext of "Айсұлу Серікқызы". That
     * is the deliberate cost of the entries being unreadable in a stolen
     * backup, and the admin UI says so rather than silently returning nothing.
     */
    // `ilike` with escaped wildcards: a search for "100%" must look for the
    // literal string, not "anything starting with 100".
    const term = `%${filters.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

    const conditions = [
      ilike(applications.teamName, term),
      ilike(applications.organization, term),
      ilike(applications.reference, term),
      ilike(applications.city, term),
    ];

    // A search term containing "@" is almost certainly an email; look it up by
    // blind index, which gives exact-match on an encrypted column.
    if (filters.search.includes("@")) {
      conditions.push(eq(applications.contactEmailHash, blindIndex(filters.search)));
    }

    const match = or(...conditions);
    if (match) clauses.push(match);
  }

  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : and(...clauses);
}

export type ApplicationListResult = {
  rows: Application[];
  total: number;
  page: number;
  pageCount: number;
  /** Rows that could not be decrypted — surfaced rather than silently dropped. */
  undecryptable: number;
};

export async function listApplications(
  filters: ParsedFilters,
): Promise<ApplicationListResult> {
  const db = getDb();
  const where = buildWhere(filters);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(applications)
    .where(where);

  const total = countRow?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  const encrypted = await db
    .select()
    .from(applications)
    .where(where)
    .orderBy(desc(applications.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  // Decryption happens here, at the edge of the data layer. One bad row must
  // not take the whole page down three days before the deadline.
  const { applications: rows, failed } = toApplications(encrypted);

  if (failed > 0) {
    logger.error("admin.decrypt_failures", { count: failed, page });
  }

  return { rows, total, page, pageCount, undecryptable: failed };
}

export async function getApplicationById(id: string): Promise<Application | null> {
  // Reject anything that is not a UUID before it reaches the query.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }

  const db = getDb();
  const rows = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
  if (!rows[0]) return null;

  try {
    return toApplication(rows[0]);
  } catch (error) {
    logger.error("admin.decrypt_failed", { id, error });
    return null;
  }
}

export type DashboardStats = {
  total: number;
  byStatus: Record<string, number>;
  byDiscipline: Record<string, number>;
  byRegion: Record<string, number>;
  participants: number;
  last7Days: number;
  /**
   * Computed here rather than in the page. Reading the clock during a render
   * is impure — the same render can produce different output — so anything
   * time-dependent is resolved in the data layer, which is already async and
   * already impure by nature.
   */
  daysUntilDeadline: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getDb();

  // Aggregate in Postgres rather than pulling every row into the app — this
  // has to stay fast at 720+ teams.
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      participants: sql<number>`coalesce(sum(${applications.memberCount}), 0)::int`,
    })
    .from(applications);

  const statusRows = await db
    .select({ key: applications.status, count: sql<number>`count(*)::int` })
    .from(applications)
    .groupBy(applications.status);

  const disciplineRows = await db
    .select({ key: applications.discipline, count: sql<number>`count(*)::int` })
    .from(applications)
    .groupBy(applications.discipline);

  const regionRows = await db
    .select({ key: applications.region, count: sql<number>`count(*)::int` })
    .from(applications)
    .groupBy(applications.region);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [recent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(applications)
    .where(gte(applications.createdAt, weekAgo));

  const toMap = (rows: { key: string; count: number }[]) =>
    Object.fromEntries(rows.map((row) => [row.key, row.count]));

  return {
    total: totals?.total ?? 0,
    participants: totals?.participants ?? 0,
    byStatus: toMap(statusRows),
    byDiscipline: toMap(disciplineRows),
    byRegion: toMap(regionRows),
    last7Days: recent?.count ?? 0,
    daysUntilDeadline: Math.max(
      0,
      Math.ceil((REGISTRATION_DEADLINE.getTime() - Date.now()) / 86_400_000),
    ),
  };
}

/**
 * Change an application's status, and record who did it.
 *
 * The previous status is read inside the same statement that writes the new
 * one (via `returning`), so the audit row records what actually changed rather
 * than what a separate read thought was there a moment earlier.
 */
export async function updateStatus(
  id: string,
  status: ApplicationStatus,
  context: { sessionId: string; ip: string },
): Promise<Application | null> {
  const existing = await getApplicationById(id);
  if (!existing) return null;
  if (existing.status === status) return existing;

  const db = getDb();
  const [updated] = await db
    .update(applications)
    .set({ status, updatedAt: new Date() })
    .where(eq(applications.id, id))
    .returning();

  if (!updated) return null;

  await db.insert(applicationAudit).values({
    applicationId: id,
    action: `status.${status}`,
    fromStatus: existing.status,
    toStatus: status,
    sessionId: context.sessionId,
    ip: context.ip.slice(0, 64),
  });

  logger.info("admin.status_changed", {
    reference: updated.reference,
    from: existing.status,
    to: status,
    sessionId: context.sessionId,
  });

  return toApplication(updated);
}

/** Audit trail for one application, newest first. */
export async function getAuditTrail(applicationId: string, limit = 20) {
  const db = getDb();
  return db
    .select()
    .from(applicationAudit)
    .where(eq(applicationAudit.applicationId, applicationId))
    .orderBy(desc(applicationAudit.at))
    .limit(limit);
}

/** Record a bulk export. Exports move personal data off-system; log every one. */
export async function recordExport(
  context: { sessionId: string; ip: string },
  rowCount: number,
): Promise<void> {
  const db = getDb();
  await db.insert(applicationAudit).values({
    // Not tied to a single application, so the nil UUID stands in as
    // "the collection". Kept in the same table so the trail is one timeline.
    applicationId: "00000000-0000-0000-0000-000000000000",
    action: "export.csv",
    sessionId: context.sessionId,
    ip: context.ip.slice(0, 64),
  });

  logger.warn("admin.export", { sessionId: context.sessionId, rowCount });
}

/**
 * Record that an entry was put on the start list.
 *
 * Goes in the same audit table as status changes so the entry has ONE
 * timeline: "paid, confirmed, seeded into Sumo/LEGO as number 07" reads as a
 * story, whereas the same facts split across two logs has to be reassembled by
 * whoever is answering a complaint on the day.
 */
export async function recordStartListEntry(
  applicationId: string,
  team: { categoryId: string; classId: string; code: string },
  context: { sessionId: string; ip: string },
): Promise<void> {
  const db = getDb();
  await db.insert(applicationAudit).values({
    applicationId,
    action: `startlist.${team.categoryId}.${team.classId}.${team.code}`.slice(0, 64),
    sessionId: context.sessionId,
    ip: context.ip.slice(0, 64),
  });

  logger.info("admin.startlist_added", { applicationId, ...team });
}

/** Every row matching the current filters, for CSV export. */
export async function listAllForExport(filters: ParsedFilters): Promise<Application[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(applications)
    .where(buildWhere(filters))
    .orderBy(desc(applications.createdAt))
    // Hard ceiling: an export is a file a human opens, and an unbounded query
    // is a way to turn the panel into a memory-exhaustion tool.
    .limit(5000);

  const { applications: decrypted, failed } = toApplications(rows);
  if (failed > 0) logger.error("admin.export_decrypt_failures", { count: failed });

  return decrypted;
}
