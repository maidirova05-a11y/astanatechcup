import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { requireScoringSession } from "../../../../auth";
import { JudgeShell } from "@/components/judge/JudgeShell";
import { RunScorer } from "@/components/judge/RunScorer";
import { CSRF_HEADER } from "@/lib/security/csrf";
import { getCategory, getCategoryClass, LEAP_SCORE_SHEET } from "@/config/categories";
import { getRun, getTeam } from "@/lib/scoring/store";
import { formatClock, formatDuration } from "@/lib/scoring/format";

export const dynamic = "force-dynamic";

/**
 * One attempt by one team.
 *
 * The URL carries the team and the round rather than a run id, because at the
 * moment a referee opens this screen the attempt usually does not exist yet.
 * The same address therefore means "file round 2" and "correct round 2", which
 * is what makes the attempt chips on the category screen a single tap either
 * way.
 */
export default async function JudgeRunPage({
  params,
}: {
  params: Promise<{ category: string; teamId: string; round: string }>;
}) {
  const session = await requireScoringSession();
  const { category: categoryId, teamId, round } = await params;

  const category = getCategory(categoryId);
  if (!category || category.scoring.kind !== "run") notFound();

  const roundNumber = Number(round);
  if (!Number.isInteger(roundNumber) || roundNumber < 1) notFound();
  if (roundNumber > category.scoring.rounds) notFound();

  const team = await getTeam(teamId);
  // A team id from another category would render this form against the wrong
  // rules — a points field where the category wants a clock.
  if (!team || team.categoryId !== categoryId) notFound();

  const existing = await getRun(teamId, roundNumber);

  const t = await getTranslations({ locale: "ru", namespace: "categories" });
  const headerList = await headers();
  const csrfToken = headerList.get(CSRF_HEADER) ?? "";

  const cls = getCategoryClass(categoryId, team.classId);
  const useSheet = categoryId === "leap";

  // A sheet already filed comes back as the counts the judge ticked, so a
  // correction starts from what was recorded rather than from an empty form.
  let counts: Record<string, number> = {};
  if (useSheet && existing?.breakdown) {
    try {
      const parsed: unknown = JSON.parse(existing.breakdown);
      if (parsed && typeof parsed === "object") {
        for (const item of LEAP_SCORE_SHEET) {
          const value = (parsed as Record<string, unknown>)[item.id];
          if (typeof value === "number" && Number.isInteger(value)) {
            counts[item.id] = value;
          }
        }
      }
    } catch {
      // A breakdown that will not parse is not a reason to refuse the screen —
      // the judge can re-tick the sheet, which is what they came here to do.
      counts = {};
    }
  }

  return (
    <JudgeShell
      role={session.role}
      title={`Попытка ${roundNumber} из ${category.scoring.rounds}`}
      subtitle={`${team.code} · ${team.name}${cls ? ` · ${cls.label}` : ""}`}
      back={{
        href: `/judge/${categoryId}?class=${team.classId}`,
        label: t(`items.${categoryId}.name`),
      }}
    >
      <RunScorer
        csrfToken={csrfToken}
        categoryId={categoryId}
        classId={team.classId}
        teamId={team.id}
        roundNumber={roundNumber}
        metric={category.scoring.metric}
        useSheet={useSheet}
        tracksRemaining={category.scoring.tracksRemaining}
        maxPoints={category.scoring.maxPoints}
        clockMs={category.clockMinutes * 60_000}
        initial={{
          state: existing?.state ?? "ok",
          time:
            existing?.timeMs !== null && existing?.timeMs !== undefined
              ? formatClock(existing.timeMs)
              : "",
          points: existing?.points?.toString() ?? "",
          remaining:
            existing?.remainingMs !== null && existing?.remainingMs !== undefined
              ? formatDuration(existing.remainingMs)
              : "",
          notes: existing?.notes ?? "",
          counts,
        }}
      />
    </JudgeShell>
  );
}
