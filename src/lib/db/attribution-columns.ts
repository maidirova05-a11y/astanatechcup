import "server-only";
import { getTableColumns, sql } from "drizzle-orm";
import { logger } from "@/lib/log";
import { getDb } from "./client";
import { applications, type ApplicationRow } from "./schema";

/**
 * Migration 0006 (marketing attribution), applied on first use when it has not
 * been run yet — the same arrangement as 0005 in src/lib/security/rate-limit.ts.
 *
 * Vercel deploys on push and does not run `db:migrate`. Without this, the first
 * deploy after the merge would select and insert seven columns the database
 * does not have yet: every registration, the admin panel and the export would
 * fail with "column does not exist" until someone ran the workflow.
 *
 * The DDL is exactly drizzle/0006_marketing_attribution.sql, and both say
 * ADD COLUMN IF NOT EXISTS, so a later `db:migrate` simply records 0006 as
 * done. Keep the two in step.
 *
 * If it cannot be applied (a role without ALTER on the table, a lock it could
 * not get in time), the failure is logged, not thrown, and every caller falls
 * back to the columns that do exist: registrations are taken without their
 * attribution, the admin panel shows it as empty. The memo is cleared so a
 * request a minute later tries again.
 */
const ATTRIBUTION_DDL = [
  `ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_source" varchar(120)`,
  `ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_medium" varchar(120)`,
  `ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_campaign" varchar(120)`,
  `ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_content" varchar(120)`,
  `ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_term" varchar(120)`,
  `ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "referrer" varchar(500)`,
  `ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "landing_path" varchar(255)`,
] as const;

export const ATTRIBUTION_KEYS = [
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
  "referrer",
  "landingPath",
] as const;

type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];

const ALL_COLUMNS = getTableColumns(applications);

/** Every column of `applications` except the seven that 0006 adds. */
export const CORE_COLUMNS = Object.fromEntries(
  Object.entries(ALL_COLUMNS).filter(
    ([key]) => !(ATTRIBUTION_KEYS as readonly string[]).includes(key),
  ),
) as Omit<typeof ALL_COLUMNS, AttributionKey>;

export type CoreApplicationRow = Omit<ApplicationRow, AttributionKey>;

const NO_ATTRIBUTION = Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, null])) as Record<
  AttributionKey,
  null
>;

let ready: Promise<boolean> | null = null;
/** After a failure, answer "unavailable" for a minute instead of retrying the ALTER on every query. */
let retryAt = 0;
const RETRY_MS = 60_000;

/** True when the attribution columns exist (or were just added). Never throws. */
export function ensureAttributionColumns(): Promise<boolean> {
  if (!ready && Date.now() < retryAt) return Promise.resolve(false);
  ready ??= (async () => {
    const db = getDb();
    // Checked first: ALTER needs ownership of the table, and a role without it
    // must still get the columns once someone else has added them.
    const [row] = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM pg_attribute
          WHERE attrelid = to_regclass('applications')
            AND NOT attisdropped
            AND attname IN ('utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
                            'utm_term', 'referrer', 'landing_path')`,
    );
    if (Number(row?.n) === ATTRIBUTION_DDL.length) return true;

    await db.transaction(async (tx) => {
      // ALTER waits for an ACCESS EXCLUSIVE lock, and every query on the table
      // queues behind a waiting ALTER. Give up quickly instead of stalling them.
      await tx.execute(sql`SET LOCAL lock_timeout = '3s'`);
      for (const statement of ATTRIBUTION_DDL) await tx.execute(sql.raw(statement));
    });
    logger.info("applications.attribution_columns_added");
    return true;
  })().catch((error: unknown) => {
    ready = null;
    retryAt = Date.now() + RETRY_MS;
    // Drizzle wraps the driver's error; the cause is the useful part
    // ("must be owner of table applications", "lock timeout").
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    logger.error("applications.attribution_unavailable", {
      reason: cause instanceof Error ? cause.message : String(cause),
    });
    return false;
  });
  return ready;
}

/**
 * The columns to select (or return) for a full application row: all of them
 * when the attribution columns exist, the core ones otherwise. Typed as the
 * core set either way; pass each row through `withAttribution` to get an
 * `ApplicationRow` back.
 */
export async function applicationColumns(): Promise<typeof CORE_COLUMNS> {
  return (await ensureAttributionColumns()) ? ALL_COLUMNS : CORE_COLUMNS;
}

/** Fill the attribution fields with null where the query could not select them. */
export function withAttribution(row: CoreApplicationRow): ApplicationRow {
  return { ...NO_ATTRIBUTION, ...row };
}
