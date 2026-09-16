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

export async function requireScoringSession(): Promise<AdminSession> {
  assertScoringEnabled();

  const session = await getSession();
  if (!session) redirect("/judge/login");

  return session;
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
