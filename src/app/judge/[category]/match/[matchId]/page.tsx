import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { requireScoringSession } from "../../../auth";
import { JudgeShell } from "@/components/judge/JudgeShell";
import { MatchScorer } from "@/components/judge/MatchScorer";
import { CSRF_HEADER } from "@/lib/security/csrf";
import { getCategory, getCategoryClass } from "@/config/categories";
import { getMatch, loadTeamsById } from "@/lib/scoring/store";

export const dynamic = "force-dynamic";

/**
 * One match sheet.
 *
 * The page is a thin server shell: it resolves the match, names the two teams,
 * and hands the numbers to a client component. The steppers have to be
 * interactive — a referee taps a score four times between two exchanges and
 * cannot wait for a round trip each time — but nothing else here does.
 */
export default async function JudgeMatchPage({
  params,
}: {
  params: Promise<{ category: string; matchId: string }>;
}) {
  const session = await requireScoringSession();
  const { category: categoryId, matchId } = await params;

  const category = getCategory(categoryId);
  if (!category || category.scoring.kind !== "match") notFound();

  const match = await getMatch(matchId);
  // A match id from another category must not render here: the unit label,
  // the card fields and the best-of hint would all be the wrong ones.
  if (!match || match.categoryId !== categoryId) notFound();

  const t = await getTranslations({ locale: "ru", namespace: "categories" });
  const headerList = await headers();
  const csrfToken = headerList.get(CSRF_HEADER) ?? "";

  const teams = await loadTeamsById([match.redTeamId, match.blueTeamId]);
  const red = teams.get(match.redTeamId);
  const blue = teams.get(match.blueTeamId);
  if (!red || !blue) notFound();

  const cls = getCategoryClass(categoryId, match.classId);

  const outcome = match.isDraw
    ? "draw"
    : match.winnerTeamId === match.redTeamId
      ? "red"
      : match.winnerTeamId === match.blueTeamId
        ? "blue"
        : "open";

  const stageLabel = { group: "Групповой этап", playoff: "Плей-офф", final: "Финал" }[
    match.stage
  ];

  return (
    <JudgeShell
      role={session.role}
      title={`${red.code} — ${blue.code}`}
      subtitle={[cls?.label, stageLabel, match.roundLabel, match.groupLabel && `группа ${match.groupLabel}`]
        .filter(Boolean)
        .join(" · ")}
      back={{
        href: `/judge/${categoryId}?class=${match.classId}`,
        label: t(`items.${categoryId}.name`),
      }}
    >
      <MatchScorer
        matchId={match.id}
        categoryId={categoryId}
        csrfToken={csrfToken}
        unitLabel={t(`unit${unitKey(category.scoring.unit)}`)}
        showCards={category.scoring.cards}
        bestOf={category.scoring.bestOf}
        teams={{
          red: { code: red.code, name: red.name },
          blue: { code: blue.code, name: blue.name },
        }}
        initial={{
          redScore: match.redScore,
          blueScore: match.blueScore,
          redYellow: match.redYellow,
          redRed: match.redRed,
          blueYellow: match.blueYellow,
          blueRed: match.blueRed,
          outcome,
          state: match.state,
          notes: match.notes ?? "",
        }}
      />
    </JudgeShell>
  );
}

/** "goals" -> "Goals", so the message key reads `unitGoals`. */
function unitKey(unit: "goals" | "points" | "rounds"): string {
  return unit.charAt(0).toUpperCase() + unit.slice(1);
}
