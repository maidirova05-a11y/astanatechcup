import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/admin/session";
import { getClientIp } from "@/lib/security/client-ip";
import { features } from "@/lib/env";
import { listAllForExport, parseFilters, recordExport } from "@/lib/admin/queries";
import { STATUS_LABELS } from "@/components/admin/AdminShell";

/**
 * CSV export of the currently filtered applications.
 *
 * This endpoint takes personal data about children *off* the system, which
 * makes it the highest-consequence route in the panel. Accordingly:
 *   · it authenticates itself rather than trusting any upstream check;
 *   · every export is written to the audit trail before the file is produced;
 *   · the response is marked no-store so it never lands in a shared cache.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Escape a value for CSV.
 *
 * The leading apostrophe on anything starting with = + - @ is a CSV-injection
 * guard: without it, a "team name" of `=HYPERLINK("http://evil","click")`
 * becomes a live formula the moment an organiser opens the file in Excel.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  if (/["\n\r,;]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

const COLUMNS = [
  "Номер заявки",
  "Статус",
  "Команда",
  "Дисциплина",
  "Организация",
  "Регион",
  "Город",
  "Участников",
  "Состав",
  "Контактное лицо",
  "Роль",
  "Email",
  "Телефон",
  "Комментарий",
  "Согласие на данные",
  "Согласие представителя",
  "Согласие с регламентом",
  "Согласие на съёмку",
  "Язык",
  "Подана",
  "Оплачена",
] as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!features.admin) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Authenticate here, not in a layout — a route handler has no layout above it.
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const filters = parseFilters({
    search: params.get("search") ?? undefined,
    discipline: params.get("discipline") ?? undefined,
    status: params.get("status") ?? undefined,
    region: params.get("region") ?? undefined,
    page: 1,
  });

  const rows = await listAllForExport(filters);

  await recordExport(
    { sessionId: session.id, ip: getClientIp(request.headers) },
    rows.length,
  );

  const lines = [
    COLUMNS.join(","),
    ...rows.map((row) =>
      [
        row.reference,
        STATUS_LABELS[row.status] ?? row.status,
        row.teamName,
        row.discipline,
        row.organization,
        row.region,
        row.city,
        row.memberCount,
        // Members flattened into one cell: "Имя (12); Имя (13)"
        row.members.map((m) => `${m.name} (${m.age})`).join("; "),
        row.contactName,
        row.contactRole,
        row.contactEmail,
        row.contactPhone,
        row.comment ?? "",
        row.consentData ? "да" : "нет",
        row.consentGuardian ? "да" : "нет",
        row.consentRules ? "да" : "нет",
        row.consentMedia ? "да" : "нет",
        row.locale,
        row.createdAt.toISOString(),
        row.paidAt ? row.paidAt.toISOString() : "",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  // UTF-8 BOM: without it Excel on Windows reads Cyrillic as mojibake, and
  // the people opening this file are on Windows.
  const body = "﻿" + lines.join("\r\n");

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="astanatechcup-applications-${stamp}.csv"`,
      // Personal data must not sit in any cache, shared or otherwise.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
