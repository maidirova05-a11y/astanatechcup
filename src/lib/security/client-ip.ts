import { env, isDevelopment } from "@/lib/env";

/**
 * Resolve the client IP for rate limiting.
 *
 * `x-forwarded-for` is client-controlled unless a proxy you trust overwrites
 * it. Two failure modes to avoid:
 *   · Trusting a forged header ⇒ an attacker rotates a fake IP per request and
 *     the rate limiter never fires.
 *   · Ignoring the header entirely ⇒ every visitor behind the load balancer
 *     shares one bucket and real users get blocked.
 *
 * So: read the single header YOUR infrastructure sets (TRUSTED_IP_HEADER), and
 * take the LEFTMOST entry only when that header is one the platform is known
 * to overwrite. For a plain `x-forwarded-for` chain the rightmost entry is the
 * one your own proxy appended and the only one an attacker cannot control.
 */

/** Headers whose value the platform sets wholesale — the client cannot append. */
const PLATFORM_OWNED = new Set([
  "cf-connecting-ip",
  "x-vercel-forwarded-for",
  "x-real-ip",
  "true-client-ip",
  "fly-client-ip",
]);

export function getClientIp(headers: Headers): string {
  const headerName = env.TRUSTED_IP_HEADER.toLowerCase();
  const raw = headers.get(headerName);

  if (raw) {
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length > 0) {
      const value = PLATFORM_OWNED.has(headerName)
        ? parts[0]
        : // Rightmost hop: appended by our own proxy, not forgeable upstream.
          parts[parts.length - 1];
      const normalised = normaliseIp(value);
      if (normalised) return normalised;
    }
  }

  // No usable header. In development that is normal (direct connection).
  // In production it means the proxy configuration is wrong — everything
  // collapses into one bucket, which is safe-but-blunt, so it is logged.
  return isDevelopment ? "127.0.0.1" : "unknown";
}

/** Strip a port, unwrap IPv6 brackets, and reject anything that is not an IP. */
function normaliseIp(value: string): string | null {
  let candidate = value.trim();

  if (candidate.startsWith("[")) {
    const end = candidate.indexOf("]");
    if (end > 0) candidate = candidate.slice(1, end);
  } else if (candidate.includes(".") && candidate.includes(":")) {
    // IPv4 with a port.
    candidate = candidate.split(":")[0];
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(candidate)) {
    const octets = candidate.split(".").map(Number);
    return octets.every((o) => o >= 0 && o <= 255) ? candidate : null;
  }

  // Loose IPv6 shape check — enough to reject junk, not a full parser.
  if (/^[0-9a-fA-F:]+$/.test(candidate) && candidate.includes(":")) {
    return candidate.toLowerCase();
  }

  return null;
}

/**
 * Coarse bucket key that groups an IPv4 /24 or IPv6 /64 together. Used for
 * abuse heuristics where per-address granularity is too easy to rotate past.
 */
export function getIpBucket(ip: string): string {
  if (ip === "unknown") return ip;
  if (ip.includes(":")) return ip.split(":").slice(0, 4).join(":") + "::/64";
  const octets = ip.split(".");
  return octets.length === 4 ? `${octets[0]}.${octets[1]}.${octets[2]}.0/24` : ip;
}
