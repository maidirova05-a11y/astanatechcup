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

/**
 * What a signed-in session is allowed to do.
 *
 * `admin` is the organising committee: applications, children's personal data,
 * exports, and the scoring console on top. `judge` is the referee crew at the
 * venue: the scoring console and nothing else.
 *
 * The distinction is the whole reason this column exists. Handing a shared
 * password to twenty referees so they can file match sheets, on a panel that
 * also lists the names and ages of every minor at the event, is not a risk
 * worth taking for the convenience of one fewer environment variable.
 */
export const sessionRole = pgEnum("session_role", ["admin", "judge"]);

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
    /**
     * Fixed when the session is created, from which password verified. It is
     * never widened afterwards — a judge cannot become an admin by navigating.
     * Defaults to `admin` so sessions created before this column existed keep
     * the access they already had.
     */
    role: sessionRole("role").notNull().default("admin"),
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
export type SessionRole = (typeof sessionRole.enumValues)[number];

/* ── Scoring ────────────────────────────────────────────────────────────── */

/**
 * These four tables are what the judges' console writes and the public results
 * page reads. They are deliberately separate from `applications`:
 *
 *  · An application holds children's names, ages, e-mail addresses and phone
 *    numbers. A scoring team holds a team name, a start number and an org.
 *    Judges need the second and have no business with the first, and keeping
 *    them in different tables is what makes that separation enforceable
 *    rather than a matter of remembering which columns to select.
 *  · Results are public by design; applications are not. Nothing here is
 *    encrypted, because nothing here is personal data.
 *
 * `applicationId` links the two when a team was seeded from a paid entry, but
 * it is nullable and carries no foreign key: teams turn up on the day, and a
 * scoring row must never be blocked because paperwork is late.
 */

export const scoringStage = pgEnum("scoring_stage", ["group", "playoff", "final"]);

export const matchState = pgEnum("match_state", ["scheduled", "live", "completed"]);

/**
 * `ok` — a clean attempt. `dnf` — started, did not finish inside the limit.
 * `foul` — completed but voided by a rules breach. `dsq` — the team is out.
 *
 * Line Follower writes the rulebook's 03:00.001 for the failing three; the
 * points categories write zero. Either way the row exists, because a missing
 * attempt and a failed attempt rank differently and must look different.
 */
export const runState = pgEnum("run_state", ["ok", "dnf", "foul", "dsq"]);

export const scoringTeams = pgTable(
  "scoring_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Category id from src/config/categories.ts, e.g. "sumo". */
    categoryId: varchar("category_id", { length: 32 }).notNull(),
    /** Class id within that category, e.g. "mini-rc". */
    classId: varchar("class_id", { length: 48 }).notNull(),

    /** Start number as announced at the venue. Short and quotable. */
    code: varchar("code", { length: 16 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    organization: varchar("organization", { length: 200 }),
    region: varchar("region", { length: 40 }),

    /** Round-robin group letter — "A", "B". Null until the draw is made. */
    groupLabel: varchar("group_label", { length: 8 }),

    /** The paid entry this team came from, when there is one. */
    applicationId: uuid("application_id"),

    /**
     * Withdrawn teams are archived, never deleted: their played matches still
     * exist, and a standings table with a dangling team id is worse than one
     * showing a team that went home.
     */
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Two teams cannot share a start number inside one class. Enforced by the
    // database, because several judges add teams at the same time.
    uniqueIndex("scoring_teams_code_idx").on(table.categoryId, table.classId, table.code),
    index("scoring_teams_category_idx").on(table.categoryId, table.classId),
    index("scoring_teams_application_idx").on(table.applicationId),
  ],
);

export const scoringMatches = pgTable(
  "scoring_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    categoryId: varchar("category_id", { length: 32 }).notNull(),
    classId: varchar("class_id", { length: 48 }).notNull(),

    stage: scoringStage("stage").notNull().default("group"),
    groupLabel: varchar("group_label", { length: 8 }),
    /** Free text: "Раунд 3", "1/4", "Финал". Shown exactly as filed. */
    roundLabel: varchar("round_label", { length: 40 }),

    /** Red and blue are the rulebooks' own names for the two sides. */
    redTeamId: uuid("red_team_id").notNull(),
    blueTeamId: uuid("blue_team_id").notNull(),

    /**
     * Signed integers, not unsigned. Ring Master subtracts 10 and 30 for
     * penalties, so a team can genuinely finish a match below zero, and a
     * column that refused to store that would force the judge to lie.
     */
    redScore: integer("red_score").notNull().default(0),
    blueScore: integer("blue_score").notNull().default(0),

    redYellow: integer("red_yellow").notNull().default(0),
    redRed: integer("red_red").notNull().default(0),
    blueYellow: integer("blue_yellow").notNull().default(0),
    blueRed: integer("blue_red").notNull().default(0),

    state: matchState("state").notNull().default("scheduled"),

    /**
     * Written by the judge, not derived on read. Several rulebooks let a
     * referee award the match against the score — a disqualification, a card
     * count, a golden goal, Ring Master's Endgame — so "the higher number
     * wins" is not a rule this system can safely assume.
     */
    winnerTeamId: uuid("winner_team_id"),
    isDraw: boolean("is_draw").notNull().default(false),

    /** Referee's note. Public, and the form says so. */
    notes: text("notes"),

    playedAt: timestamp("played_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("scoring_matches_category_idx").on(table.categoryId, table.classId),
    index("scoring_matches_state_idx").on(table.state),
    index("scoring_matches_played_idx").on(table.playedAt),
    index("scoring_matches_red_idx").on(table.redTeamId),
    index("scoring_matches_blue_idx").on(table.blueTeamId),
  ],
);

export const scoringRuns = pgTable(
  "scoring_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    categoryId: varchar("category_id", { length: 32 }).notNull(),
    classId: varchar("class_id", { length: 48 }).notNull(),
    teamId: uuid("team_id").notNull(),

    /** 1-based attempt number. Line Follower has three, the rest have two. */
    roundNumber: integer("round_number").notNull(),

    state: runState("state").notNull().default("ok"),

    /** Milliseconds, for the time categories. Null for the points ones. */
    timeMs: integer("time_ms"),
    /** Points, for the points categories. Null for the time ones. */
    points: integer("points"),
    /** Time left on the clock, in ms. Breaks ties in Bowling and Leap. */
    remainingMs: integer("remaining_ms"),

    /**
     * JSON `{ itemId: count }` for the categories whose sheet is enumerated in
     * the rulebook — today that is Leap. Stored so a protest can be answered
     * with the sheet the judge actually filled in, not only the total it
     * produced.
     *
     * `text` rather than `jsonb`: nothing queries inside it, and a plain column
     * keeps the shape defined by src/config/categories.ts rather than by the
     * database.
     */
    breakdown: text("breakdown"),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One row per team per attempt. A judge filing round 2 twice is a
    // correction, not a second attempt, and the database says so.
    uniqueIndex("scoring_runs_attempt_idx").on(table.teamId, table.roundNumber),
    index("scoring_runs_category_idx").on(table.categoryId, table.classId),
    index("scoring_runs_created_idx").on(table.createdAt),
  ],
);

/**
 * Every write the console makes, with the session that made it.
 *
 * A championship result is contestable. When a team asks why their round 2 says
 * DNF, the answer has to be a record — which session filed it, from which
 * address, at which second, and what the value was before — not a
 * recollection. `before` and `after` are JSON snapshots of the changed fields.
 */
export const scoringAudit = pgTable(
  "scoring_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** "match" | "run" | "team" */
    entity: varchar("entity", { length: 16 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    /** "created" | "updated" | "archived" */
    action: varchar("action", { length: 32 }).notNull(),
    before: text("before"),
    after: text("after"),
    sessionId: uuid("session_id"),
    /** Role the session held at the time — an admin edit reads differently. */
    role: varchar("role", { length: 16 }),
    ip: varchar("ip", { length: 64 }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("scoring_audit_entity_idx").on(table.entity, table.entityId),
    index("scoring_audit_at_idx").on(table.at),
  ],
);

export type ScoringTeamRow = typeof scoringTeams.$inferSelect;
export type ScoringMatchRow = typeof scoringMatches.$inferSelect;
export type ScoringRunRow = typeof scoringRuns.$inferSelect;
export type ScoringStage = (typeof scoringStage.enumValues)[number];
export type MatchState = (typeof matchState.enumValues)[number];
export type RunState = (typeof runState.enumValues)[number];
