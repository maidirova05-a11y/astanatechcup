import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { logger } from "@/lib/log";
import { getClientIp } from "@/lib/security/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";

/**
 * Health endpoint.
 *
 *   GET /api/health          liveness: the process is up. Touches nothing.
 *   GET /api/health?deep=1   readiness: also runs `select 1` against Postgres.
 *
 * Public by necessity (load balancers and uptime monitors call it), so it
 * reveals nothing beyond up/down, the deep probe is rate limited, and the
 * response is never cached.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const DB_TIMEOUT_MS = 2_000;

type DbState = "up" | "down" | "not_configured";

async function probeDatabase(): Promise<DbState> {
  if (!isDatabaseConfigured()) return "not_configured";
  try {
    await Promise.race([
      getDb().execute(sql`select 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), DB_TIMEOUT_MS),
      ),
    ]);
    return "up";
  } catch (error) {
    logger.error("health.database_down", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return "down";
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.searchParams.get("deep") !== "1") {
    return NextResponse.json({ status: "ok" }, { headers: NO_STORE });
  }

  const limit = await rateLimit("general", `health:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429, headers: NO_STORE });
  }

  const database = await probeDatabase();
  const healthy = database !== "down";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", database },
    { status: healthy ? 200 : 503, headers: NO_STORE },
  );
}
