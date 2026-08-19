import "server-only";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { features } from "@/lib/env";
import { getSession, type AdminSession } from "@/lib/admin/session";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * Route guards for the admin area.
 *
 * `requireSession` is called at the top of every admin page and every admin
 * action. There is no "the layout already checked it" shortcut: a layout does
 * not run before a server action, and relying on one is how admin panels end
 * up with an unauthenticated mutation endpoint.
 */

/**
 * When the panel is not configured, /admin does not exist — a 404 rather than
 * a login page. An attacker scanning for admin panels learns nothing about
 * whether this deployment has one.
 */
export function assertAdminEnabled(): void {
  if (!features.admin) notFound();
}

export async function requireSession(): Promise<AdminSession> {
  assertAdminEnabled();

  const session = await getSession();
  if (!session) redirect("/admin/login");

  return session;
}

/** Context every mutating admin action records in the audit trail. */
export async function getActionContext(): Promise<{ sessionId: string; ip: string }> {
  const session = await requireSession();
  const headerList = await headers();
  return { sessionId: session.id, ip: getClientIp(headerList) };
}
