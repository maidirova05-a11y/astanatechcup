import "server-only";
import { notFound, redirect } from "next/navigation";
import { features } from "@/lib/env";
import { getCoachSession, type CoachSession } from "@/lib/coach/session";

/**
 * Route guards for the coaches' cabinet.
 *
 * Note what is absent: there is no function here that takes a role, and none
 * that admits an operator session. An admin who wants to see a coach's view
 * signs in as that coach or reads the panel, because a guard that accepted
 * both kinds of session would be one refactor away from the reverse also
 * being true.
 */

/**
 * With no database configured the cabinet does not exist — 404, not a sign-in
 * form, so a scanner learns nothing about whether this deployment has one.
 */
export function assertCoachEnabled(): void {
  if (!features.coach) notFound();
}

export async function requireCoachSession(): Promise<CoachSession> {
  assertCoachEnabled();

  const session = await getCoachSession();
  if (!session) redirect("/coach/login");

  return session;
}
