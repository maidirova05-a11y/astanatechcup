import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/log";
import { getClientIp } from "@/lib/security/client-ip";
import { rateLimit } from "@/lib/security/rate-limit";

/**
 * CSP violation sink, used while rolling the policy out in report-only mode
 * (`CSP_REPORT_ONLY=1`). Reports show which directive a real browser would
 * have broken *before* enforcement starts blocking visitors.
 *
 * This endpoint is public and unauthenticated by necessity — the browser posts
 * to it. So it is treated as hostile input: rate limited, size capped, and
 * nothing is echoed back.
 */

export const runtime = "nodejs";

/** Reports are small; anything larger is someone using this as a log-spam sink. */
const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request.headers);

  const limit = await rateLimit("general", `csp:${ip}`);
  if (!limit.allowed) {
    return new NextResponse(null, { status: 429 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // Log only the fields we actually need. `script-sample` is excluded on
  // purpose: it can contain page content, including form values.
  const report = extractReport(body);
  if (report) logger.warn("security.csp_violation", report);

  // 204 so the browser does not retry.
  return new NextResponse(null, { status: 204 });
}

function extractReport(body: unknown): Record<string, string> | null {
  if (typeof body !== "object" || body === null) return null;

  // Level 2 sends { "csp-report": {...} }; Level 3 Reporting API sends an array.
  const candidate =
    "csp-report" in body
      ? (body as Record<string, unknown>)["csp-report"]
      : Array.isArray(body)
        ? (body[0] as Record<string, unknown> | undefined)?.body
        : body;

  if (typeof candidate !== "object" || candidate === null) return null;

  const source = candidate as Record<string, unknown>;
  const pick = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.length <= 500) return value;
    }
    return undefined;
  };

  const directive = pick("effective-directive", "effectiveDirective", "violated-directive");
  const blocked = pick("blocked-uri", "blockedURL", "blockedURI");
  const documentUri = pick("document-uri", "documentURL");

  if (!directive && !blocked) return null;

  return {
    directive: directive ?? "unknown",
    blocked: blocked ?? "unknown",
    document: documentUri ?? "unknown",
  };
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}
