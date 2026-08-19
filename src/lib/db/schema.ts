import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

/**
 * Database schema.
 *
 * Everything goes through Drizzle, which emits parameterised queries. There is
 * no string-concatenated SQL anywhere in this codebase, which is what takes
 * SQL injection off the table structurally rather than by discipline.
 */

export const applicationStatus = pgEnum("application_status", [
  "pending_payment",
  "paid",
  "confirmed",
  "cancelled",
  "rejected",
]);

export const contactRole = pgEnum("contact_role", ["participant", "parent", "teacher"]);

export const applications = pgTable(
  "applications",
  {
    /**
     * Random UUID, never a sequence. The public-facing identifier must not be
     * guessable — /application/1234 with an incrementing id is an IDOR waiting
     * to happen against a database full of children's data.
     */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Short human-quotable code shown to the user, e.g. ATC-7K3M-92. */
    reference: varchar("reference", { length: 32 }).notNull(),

    /* ── Not encrypted ──────────────────────────────────────────────────
     * These identify a TEAM or an INSTITUTION, not a person. They stay in
     * the clear because the admin panel has to search and aggregate on
     * them, and because a school's name is not personal data. Encrypting
     * them would reduce the panel's search to reference numbers only.
     *
     * If you decide a team name is identifying enough to protect, move it
     * below and accept the loss of search — it is a one-line change.
     */
    teamName: varchar("team_name", { length: 120 }).notNull(),
    discipline: varchar("discipline", { length: 32 }).notNull(),
    organization: varchar("organization", { length: 200 }).notNull(),
    region: varchar("region", { length: 40 }).notNull(),
    city: varchar("city", { length: 120 }).notNull(),

    /* ── Encrypted (AES-256-GCM, see src/lib/crypto/field.ts) ───────────
     * Everything below identifies a PERSON, mostly a child. It is written
     * as a `v1.<iv>.<tag>.<ciphertext>` envelope and is unreadable without
     * ENCRYPTION_KEY. `text` rather than `varchar(n)` because ciphertext is
     * longer than plaintext and a length cap would truncate it.
     */

    /**
     * Encrypted JSON: `[{ name, age }]`. Members have no independent
     * lifecycle — they are only ever read and written with their
     * application — so one column beats a child table, and it keeps every
     * piece of a minor's data in a single row that one DELETE erases for a
     * data-subject request.
     */
    members: text("members").notNull(),
    /** Kept in the clear: a count is not personal, and the dashboard sums it. */
    memberCount: integer("member_count").notNull(),

    contactName: text("contact_name").notNull(),
    /** Role is a category, not an identifier. */
    contactRole: contactRole("contact_role").notNull(),
    contactEmail: text("contact_email").notNull(),
    /**
     * Blind index: HMAC of the lowercased email under a key derived from
     * ENCRYPTION_KEY. Encrypted values use a random IV and so differ every
     * time, which would break both the duplicate constraint and lookup.
     * This restores exact-match on an encrypted column.
     *
     * It leaks equality — two rows with the same contact are visibly the
     * same contact — but not the address itself, and it cannot be reversed
     * without the key.
     */
    contactEmailHash: varchar("contact_email_hash", { length: 64 }).notNull(),
    contactPhone: text("contact_phone").notNull(),
    comment: text("comment"),

    /** Consent is recorded as given values, not implied by row existence. */
    consentData: boolean("consent_data").notNull(),
    consentGuardian: boolean("consent_guardian").notNull(),
    consentRules: boolean("consent_rules").notNull(),
    consentMedia: boolean("consent_media").notNull().default(false),
    /** When and from where consent was captured — needed to evidence it later. */
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull().defaultNow(),

    status: applicationStatus("status").notNull().default("pending_payment"),

    /** Opaque reference from the payment provider. Never card data. */
    paymentReference: varchar("payment_reference", { length: 255 }),
    paidAt: timestamp("paid_at", { withTimezone: true }),

    /** Locale the application was submitted in, so we reply in that language. */
    locale: varchar("locale", { length: 8 }).notNull().default("ru"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("applications_reference_idx").on(table.reference),
    /**
     * Business-level duplicate guard: the same contact cannot register the same
     * team name in the same discipline twice. Enforced by the database, not
     * only by application code, so a race between two concurrent submits
     * cannot slip a duplicate through.
     *
     * Uses the blind index rather than the encrypted column — ciphertext
     * differs on every write, so a unique constraint on it would never fire.
     */
    uniqueIndex("applications_dedupe_idx").on(
      table.contactEmailHash,
      table.teamName,
      table.discipline,
    ),
    index("applications_email_hash_idx").on(table.contactEmailHash),
    index("applications_discipline_idx").on(table.discipline),
    index("applications_status_idx").on(table.status),
    index("applications_created_idx").on(table.createdAt),
  ],
);

/**
 * Processed payment webhook events, for idempotency. A provider will retry a
 * webhook after a timeout; without this table a retry would be processed twice.
 */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    provider: varchar("provider", { length: 32 }).notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("webhook_events_processed_idx").on(table.processedAt)],
);

/* ── Admin panel ────────────────────────────────────────────────────────── */

/**
 * Admin sessions.
 *
 * The cookie carries a random token; only its SHA-256 hash is stored. A dump
 * of this table therefore does not let anyone log in — the same reasoning as
 * never storing a password in the clear.
 *
 * Server-side rows (rather than a self-contained signed cookie) exist so that
 * "sign out", "sign out everywhere" and forced expiry are real, immediate
 * actions rather than a wait for a token to age out.
 */
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** SHA-256 of the cookie token, hex encoded. */
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Absolute expiry. Not extended by activity. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Sliding idle timeout is measured from here. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    /** Coarse provenance for the audit trail. Not used for authorisation. */
    ip: varchar("ip", { length: 64 }),
    userAgent: varchar("user_agent", { length: 255 }),
  },
  (table) => [
    uniqueIndex("admin_sessions_token_idx").on(table.tokenHash),
    index("admin_sessions_expires_idx").on(table.expiresAt),
  ],
);

/**
 * Login attempts, for lockout.
 *
 * This has to be in the database, not in memory: on Vercel each request may
 * hit a different instance, so an in-memory counter would let an attacker
 * brute-force the shared admin password essentially unthrottled.
 */
export const adminLoginAttempts = pgTable(
  "admin_login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Client IP, or "unknown" when the proxy header is not configured. */
    identifier: varchar("identifier", { length: 64 }).notNull(),
    succeeded: boolean("succeeded").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("admin_login_attempts_lookup_idx").on(table.identifier, table.attemptedAt),
  ],
);

/**
 * Audit trail for changes made through the admin panel.
 *
 * This system holds the names and ages of children. Being able to answer "who
 * changed this entry, and when" is not optional — it is the difference between
 * an incident you can investigate and one you can only apologise for.
 */
export const applicationAudit = pgTable(
  "application_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id").notNull(),
    /** e.g. "status.confirmed", "export.csv", "viewed" */
    action: varchar("action", { length: 64 }).notNull(),
    fromStatus: varchar("from_status", { length: 32 }),
    toStatus: varchar("to_status", { length: 32 }),
    /** Session that performed it; null for system actions such as the webhook. */
    sessionId: uuid("session_id"),
    ip: varchar("ip", { length: 64 }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("application_audit_application_idx").on(table.applicationId),
    index("application_audit_at_idx").on(table.at),
  ],
);

export type ApplicationRow = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type ApplicationStatus = (typeof applicationStatus.enumValues)[number];
export type AdminSessionRow = typeof adminSessions.$inferSelect;
