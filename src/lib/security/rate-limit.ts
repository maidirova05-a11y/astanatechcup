import "server-only";
import { createHash } from "node:crypto";
import { and, asc, count, eq, gt, lt } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { rateLimitHits } from "@/lib/db/schema";
import { logger } from "@/lib/log";

/**
 * Sliding-window rate limiting.
 *
 * STORAGE. With a database configured the counters live in Postgres
 * (`rate_limit_hits`, migration 0005): on Vercel each request may reach a
 * different instance, and an in-memory map gives an attacker a fresh budget on
 * every cold start. If the table is missing (migration not yet applied) or the
 * database is unreachable, the limiter falls back to the in-memory store for
 * that request — degraded, never failing open to "unlimited" and never taking
 * the registration form down. A WAF rule in front (Cloudflare) is still
 * recommended for volumetric attacks.
 */

export type RateLimitResult = {
  allowed: boolean;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Epoch ms when the window frees up. */
  resetAt: number;
};

export type RateLimitRule = {
  /** Max requests permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export interface RateLimitStore {
  /** Record a hit and report whether it is permitted. */
  hit(key: string, rule: RateLimitRule, now: number): Promise<RateLimitResult>;
}

/**
 * Named rules. Registration is deliberately tight: a real human submits one
 * team, occasionally two or three for a school. Ten per hour per IP is
 * generous for a teacher registering a club's worth of teams, and useless for
 * a spam script.
 */
export const RATE_RULES = {
  registration: { limit: 10, windowMs: 60 * 60 * 1000 },
  /** Burst guard — stops rapid-fire submits before the hourly budget applies. */
  registrationBurst: { limit: 3, windowMs: 60 * 1000 },
  contact: { limit: 8, windowMs: 60 * 60 * 1000 },
  /** Anything else that writes. */
  general: { limit: 60, windowMs: 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateRuleName = keyof typeof RATE_RULES;

/* ── In-memory implementation ───────────────────────────────────────────── */

type Bucket = { timestamps: number[] };

class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  async hit(key: string, rule: RateLimitRule, now: number): Promise<RateLimitResult> {
    this.sweep(now);

    const windowStart = now - rule.windowMs;
    const bucket = this.buckets.get(key) ?? { timestamps: [] };

    // Drop timestamps that have slid out of the window.
    const recent = bucket.timestamps.filter((t) => t > windowStart);

    if (recent.length >= rule.limit) {
      this.buckets.set(key, { timestamps: recent });
      return {
        allowed: false,
        remaining: 0,
        resetAt: recent[0] + rule.windowMs,
      };
    }

    recent.push(now);
    this.buckets.set(key, { timestamps: recent });

    return {
      allowed: true,
      remaining: rule.limit - recent.length,
      resetAt: recent[0] + rule.windowMs,
    };
  }

  /** Bound memory growth — without this the map is an unbounded sink. */
  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;

    const cutoff = now - 60 * 60 * 1000;
    for (const [key, bucket] of this.buckets) {
      const recent = bucket.timestamps.filter((t) => t > cutoff);
      if (recent.length === 0) this.buckets.delete(key);
      else bucket.timestamps = recent;
    }
  }
}

/* ── Postgres implementation ────────────────────────────────────────────── */

class PostgresRateLimitStore implements RateLimitStore {
  private lastPrune = 0;

  constructor(private readonly fallback: RateLimitStore) {}

  async hit(key: string, rule: RateLimitRule, now: number): Promise<RateLimitResult> {
    const keyHash = createHash("sha256").update(key).digest("hex");
    const since = new Date(now - rule.windowMs);

    try {
      const db = getDb();
      const inWindow = and(eq(rateLimitHits.keyHash, keyHash), gt(rateLimitHits.hitAt, since));
      const [[{ n }], oldestRows] = await Promise.all([
        db.select({ n: count() }).from(rateLimitHits).where(inWindow),
        db
          .select({ hitAt: rateLimitHits.hitAt })
          .from(rateLimitHits)
          .where(inWindow)
          .orderBy(asc(rateLimitHits.hitAt))
          .limit(1),
      ]);

      const oldest = oldestRows[0]?.hitAt.getTime() ?? now;
      if (n >= rule.limit) {
        return { allowed: false, remaining: 0, resetAt: oldest + rule.windowMs };
      }

      await db.insert(rateLimitHits).values({ keyHash, hitAt: new Date(now) });

      // At most once a minute per instance: keep about a day of rows.
      if (now - this.lastPrune > 60_000) {
        this.lastPrune = now;
        await db.delete(rateLimitHits).where(lt(rateLimitHits.hitAt, new Date(now - 86_400_000)));
      }

      return { allowed: true, remaining: rule.limit - n - 1, resetAt: oldest + rule.windowMs };
    } catch (error) {
      logger.error("rate_limit.store_unavailable", {
        reason: error instanceof Error ? error.message : String(error),
      });
      return this.fallback.hit(key, rule, now);
    }
  }
}

let store: RateLimitStore = isDatabaseConfigured()
  ? new PostgresRateLimitStore(new MemoryRateLimitStore())
  : new MemoryRateLimitStore();

/** Swap in a distributed store at startup. See the deployment note above. */
export function configureRateLimitStore(next: RateLimitStore): void {
  store = next;
}

export async function rateLimit(
  rule: RateRuleName,
  identifier: string,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  return store.hit(`${rule}:${identifier}`, RATE_RULES[rule], now);
}

/**
 * Apply several rules at once (e.g. burst + hourly). Fails on the first rule
 * that rejects, and reports the longest reset so the user is told the truth.
 */
export async function rateLimitAll(
  rules: RateRuleName[],
  identifier: string,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  let worst: RateLimitResult = { allowed: true, remaining: Number.MAX_SAFE_INTEGER, resetAt: now };

  for (const rule of rules) {
    const result = await rateLimit(rule, identifier, now);
    if (!result.allowed) return result;
    if (result.remaining < worst.remaining) worst = result;
  }

  return worst;
}
