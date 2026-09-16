import "server-only";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { features } from "@/lib/env";
import { getSession, type AdminSession } from "@/lib/admin/session";
import { getClientIp } from "@/lib/security/client-ip";
import type { ScoringContext } from "@/lib/scoring/store";

/**
 * Route guards for the judges' console.
 *
 * The console is reachable by BOTH roles. A judge session exists only to file
 * results; an admin session can do everything a judge can, because on the day
 * the person running the event is also the person covering the lane whose
 * referee stepped away.
 *
 * The reverse does not hold — see requireSession in src/app/admin/auth.ts. The
 * asymmetry is the point: widening admin access to scoring costs nothing,
 * widening judge access to a table of children's names costs everything.
 */

/**
 * With no database and no password configured, /judge does not exist at all —
 * a 404 rather than a sign-in form, so a scanner learns nothing about whether
 * this deployment has a console.
 */
export function assertScoringEnabled(): void {
  if (!features.scoring) notFound();
}

/**
 * LOCAL DEVELOPMENT ONLY: the console opens without a password.
 *
 * Keyed on `NODE_ENV === "development"`, which only `next dev` sets. Every
 * production runtime — the Vercel deployment, `next build && next start`,
 * a preview deploy — runs with `production`, so this branch cannot open
 * there. It is deliberately NOT an environment flag: a flag is a thing that
 * can be copied into Vercel's settings by mistake, and a NODE_ENV check is not.
 *
 * Writes made this way are still audited, under the nil UUID and the judge
 * role, so a row filed from a laptop is recognisable as such in the trail.
 * Remember that `.env.local` points at the shared database: a result typed
 * locally is a result on the live board.
 */
export const SCORING_AUTH_BYPASSED = process.env.NODE_ENV === "development";

const LOCAL_SESSION: AdminSession = {
  id: "00000000-0000-0000-0000-000000000000",
  expiresAt: new Date(8640000000000000),
  role: "judge",
};

export async function requireScoringSession(): Promise<AdminSession> {
  assertScoringEnabled();

  const session = await getSession();
  if (session) return session;
  if (SCORING_AUTH_BYPASSED) return LOCAL_SESSION;

  redirect("/judge/login");
}

/** Everything a write needs to be attributable afterwards. */
export async function getScoringContext(): Promise<ScoringContext> {
  const session = await requireScoringSession();
  const headerList = await headers();
  return {
    sessionId: session.id,
    role: session.role,
    ip: getClientIp(headerList),
  };
}
