"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { env, features } from "@/lib/env";
import { logger, securityLog } from "@/lib/log";
import { getClientIp } from "@/lib/security/client-ip";
import { CSRF_COOKIE, CSRF_FIELD, assertCsrf } from "@/lib/security/csrf";
import { verifyPassword } from "@/lib/admin/password";
import {
  ADMIN_SESSION_COOKIE,
  adminCookieOptions,
  checkLockout,
  createSession,
  getSession,
  recordLoginAttempt,
  revokeSession,
} from "@/lib/admin/session";
import { getCategory, LEAP_SCORE_SHEET } from "@/config/categories";
import {
  archiveTeam,
  createMatch,
  createTeam,
  createTeamsBulk,
  deleteRun,
  deleteScheduledMatch,
  generateEliminationBracket,
  generateRoundRobin,
  getMatch,
  getTeam,
  listRunsForTeam,
  saveMatchResult,
  saveRun,
  setMatchTeams,
  updateTeam,
} from "@/lib/scoring/store";
import {
  bulkTeamSchema,
  generateBracketSchema,
  generateRoundRobinSchema,
  matchCreateSchema,
  matchResultSchema,
  matchRowSchema,
  parseRun,
  teamSchema,
  teamUpdateSchema,
} from "@/lib/validation/scoring";
import { formatClock } from "@/lib/scoring/format";
import { getScoringContext } from "./auth";
import type { JudgeLoginState, ScoringFormState } from "./form-state";
import type { SessionRole } from "@/lib/db/schema";

/**
 * Server actions for the judges' console.
 *
 * Every one of them re-checks the session itself. A server action is a public
 * endpoint; the fact that the page which rendered the form was guarded means
 * nothing to a request crafted by hand.
 */

/** Slows credential stuffing and flattens the timing difference on failure. */
const FAILURE_DELAY_MS = 700;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ── Sign in ────────────────────────────────────────────────────────────── */

/**
 * One form, two passwords.
 *
 * The judges' password is checked first, then the organisers'. Both are tried
 * on every attempt regardless of which one matched, so the time the request
 * takes does not reveal which password the submitted value was close to.
 */
async function resolveRole(password: string): Promise<SessionRole | null> {
  const [judgeOk, adminOk] = await Promise.all([
    env.JUDGE_PASSWORD_HASH
      ? verifyPassword(password, env.JUDGE_PASSWORD_HASH)
      : Promise.resolve(false),
    env.ADMIN_PASSWORD_HASH
      ? verifyPassword(password, env.ADMIN_PASSWORD_HASH)
      : Promise.resolve(false),
  ]);

  // Admin wins a tie. If the two hashes were ever set to the same password —
  // which the documentation tells the operator not to do — the person signing
  // in should not silently lose access they are entitled to.
  if (adminOk) return "admin";
  if (judgeOk) return "judge";
  return null;
}

export async function judgeLogin(
  _prevState: JudgeLoginState,
  formData: FormData,
): Promise<JudgeLoginState> {
  if (!features.scoring) {
    return { status: "error", message: "Система скоринга не настроена." };
  }

  const headerList = await headers();
  const cookieStore = await cookies();
  const ip = getClientIp(headerList);

  const submitted = formData.get(CSRF_FIELD);
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  if (!(await assertCsrf(typeof submitted === "string" ? submitted : undefined, cookieToken))) {
    securityLog.csrfFailure({ ip, endpoint: "judge.login" });
    return {
      status: "error",
      message: "Сессия устарела. Обновите страницу и попробуйте снова.",
    };
  }

  // Shared with the admin form on purpose: five failures from one address lock
  // both doors, so the console is not a softer way in to the same lockout.
  const lockout = await checkLockout(ip);
  if (lockout.locked) {
    securityLog.rateLimited({ ip, endpoint: "judge.login", failures: lockout.failures });
    const minutes = Math.ceil(lockout.retryAfterMs / 60_000);
    return {
      status: "error",
      message: `Слишком много неудачных попыток. Повторите через ${minutes} мин.`,
    };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0 || password.length > 512) {
    await recordLoginAttempt(ip, false);
    await delay(FAILURE_DELAY_MS);
    return { status: "error", message: "Неверный пароль." };
  }

  const role = await resolveRole(password);
  await recordLoginAttempt(ip, role !== null);

  if (!role) {
    securityLog.csrfFailure({ ip, endpoint: "judge.login", reason: "bad_password" });
    await delay(FAILURE_DELAY_MS);
    return { status: "error", message: "Неверный пароль." };
  }

  const { token } = await createSession(ip, headerList.get("user-agent"), role);
  cookieStore.set(ADMIN_SESSION_COOKIE, token, adminCookieOptions);

  logger.info("judge.login_success", { ip, role });

  redirect("/judge");
}

export async function judgeLogout(): Promise<void> {
  const cookieStore = await cookies();
  const session = await getSession();

  if (session) {
    await revokeSession(session.id);
    logger.info("judge.logout", { sessionId: session.id });
  }

  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/judge/login");
}

/* ── Shared plumbing ────────────────────────────────────────────────────── */

async function assertRequestCsrf(formData: FormData, endpoint: string): Promise<boolean> {
  const cookieStore = await cookies();
  const submitted = formData.get(CSRF_FIELD);
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  const ok = await assertCsrf(
    typeof submitted === "string" ? submitted : undefined,
    cookieToken,
  );
  if (!ok) securityLog.csrfFailure({ endpoint });
  return ok;
}

function fields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * Push the change to the public scoreboard immediately.
 *
 * Both results routes: the index, which shows every class and the latest
 * results across all of them, and the per-category board a hall full of
 * people is actually watching. Each renders per request (a cached document
 * cannot carry the CSP nonce — see the note on the results page), so this is
 * belt and braces rather than the only thing keeping them fresh; it costs
 * nothing and it is the line that would matter if either page were ever
 * given a revalidate window again.
 */
function publishResults(): void {
  revalidatePath("/[locale]/results", "page");
  revalidatePath("/[locale]/results/[category]", "page");
}

/* ── Teams ──────────────────────────────────────────────────────────────── */

export async function createTeamAction(formData: FormData): Promise<void> {
  const context = await getScoringContext();
  if (!(await assertRequestCsrf(formData, "judge.team.create"))) return;

  const parsed = teamSchema.safeParse(fields(formData));
  if (!parsed.success) {
    redirect(categoryPath(formData, "error=team"));
  }

  try {
    await createTeam(parsed.data, context);
  } catch (error) {
    // The unique index on (category, class, code) is the real guard against two
    // judges claiming the same start number; this turns it into a message.
    logger.warn("judge.team.duplicate", { message: String(error) });
    redirect(categoryPath(formData, "error=code"));
  }

  publishResults();
  redirect(categoryPath(formData, "saved=team"));
}

/**
 * One name per line, everything else shared — see bulkTeamSchema's comment.
 * Any row that collides with an existing start number stops the batch there
 * (the same unique-index guard as the single-team form); teams added before
 * the collision are already saved, so the judge sees a partial roster and a
 * clear reason rather than nothing.
 */
export async function createTeamsBulkAction(formData: FormData): Promise<void> {
  const context = await getScoringContext();
  if (!(await assertRequestCsrf(formData, "judge.team.bulk"))) return;

  const parsed = bulkTeamSchema.safeParse(fields(formData));
  if (!parsed.success) {
    redirect(categoryPath(formData, "error=team"));
  }

  try {
    await createTeamsBulk(
      {
        categoryId: parsed.data.categoryId,
        classId: parsed.data.classId,
        names: parsed.data.names,
        organization: parsed.data.organization,
        region: parsed.data.region,
        groupLabel: parsed.data.groupLabel,
      },
      context,
    );
  } catch (error) {
    logger.warn("judge.team.bulk_partial", { message: String(error) });
    redirect(categoryPath(formData, "error=code"));
  }

  publishResults();
  redirect(categoryPath(formData, "saved=team"));
}

export async function archiveTeamAction(formData: FormData): Promise<void> {
  const context = await getScoringContext();
  if (!(await assertRequestCsrf(formData, "judge.team.archive"))) return;

  const id = formData.get("id");
  if (typeof id === "string" && id.length > 0) {
    await archiveTeam(id, context);
    publishResults();
  }

  redirect(categoryPath(formData, "saved=archived"));
}

/* ── Matches ────────────────────────────────────────────────────────────── */

export async function createMatchAction(formData: FormData): Promise<void> {
  const context = await getScoringContext();
  if (!(await assertRequestCsrf(formData, "judge.match.create"))) return;

  const parsed = matchCreateSchema.safeParse(fields(formData));
  if (!parsed.success) {
    redirect(categoryPath(formData, "error=match"));
  }

  const match = await createMatch(parsed.data, context);
  redirect(`/judge/${match.categoryId}/match/${match.id}`);
}

/**
 * "Сформировать круговой этап" for one group: every pairing at once, in the
 * standard round-robin order, instead of a judge picking teams from two
 * dropdowns match by match. `error=already_scheduled` means the group has
 * matches already — delete the still-scheduled ones first if the intent is
 * to redo the draw, per generateRoundRobin's own reasoning.
 */
export async function generateRoundRobinAction(formData: FormData): Promise<void> {
  const context = await getScoringContext();
  if (!(await assertRequestCsrf(formData, "judge.bracket.roundrobin"))) return;

  const parsed = generateRoundRobinSchema.safeParse(fields(formData));
  if (!parsed.success) {
    redirect(categoryPath(formData, "error=bracket"));
  }

  const result = await generateRoundRobin(
    parsed.data.categoryId,
    parsed.data.classId,
    parsed.data.groupLabel,
    context,
  );

  redirect(categoryPath(formData, result.ok ? "saved=bracket" : `error=${result.reason}`));
}

/**
 * "Сформировать сетку плей-офф": the whole elimination tree, seeded and
 * placed, in one action. `seedOrder` is a newline list of team ids in the
 * order the console's seeding UI put them in.
 */
export async function generateBracketAction(formData: FormData): Promise<void> {
  const context = await getScoringContext();
  if (!(await assertRequestCsrf(formData, "judge.bracket.elimination"))) return;

  const parsed = generateBracketSchema.safeParse(fields(formData));
  if (!parsed.success) {
    redirect(categoryPath(formData, "error=bracket"));
  }

  const result = await generateEliminationBracket(
    parsed.data.categoryId,
    parsed.data.classId,
    parsed.data.teamIds,
    context,
  );

  redirect(categoryPath(formData, result.ok ? "saved=bracket" : `error=${result.reason}`));
}

export async function deleteMatchAction(formData: FormData): Promise<void> {
  const context = await getScoringContext();
  if (!(await assertRequestCsrf(formData, "judge.match.delete"))) return;

  const id = formData.get("id");
  if (typeof id === "string" && id.length > 0) {
    await deleteScheduledMatch(id, context);
  }

  redirect(categoryPath(formData));
}

/**
 * Save one row of the console's match table: score, outcome, and — when the
 * corner was filled by hand — who plays in it.
 *
 * Returns a state instead of redirecting. A redirect re-renders the entire
 * console (session lookup, every team, every match, every attempt in the
 * category) just to show one saved row; returning lets the row say "saved"
 * the moment the write lands, and the tables refresh behind it.
 *
 * It does not infer the winner from the scores (every rulebook here lets a
 * referee award a match against the score), does not touch cards or notes
 * (they are not on this row), and does not let an empty bracket slot be
 * declared the winner.
 */
export async function saveMatchRowAction(
  _prev: ScoringFormState,
  formData: FormData,
): Promise<ScoringFormState> {
  // Session and CSRF are independent checks, so they go out together.
  const [context, csrfOk] = await Promise.all([
    getScoringContext(),
    assertRequestCsrf(formData, "judge.match.row"),
  ]);
  if (!csrfOk) return { status: "error", message: "Сессия устарела. Обновите страницу." };

  // An empty corner select ("TBD") means "no change", not an invalid id.
  const rowFields = fields(formData);
  for (const key of ["redTeamId", "blueTeamId"]) {
    if (rowFields[key] === "") delete rowFields[key];
  }
  const parsed = matchRowSchema.safeParse(rowFields);
  if (!parsed.success) return { status: "error", message: "Проверьте счёт." };

  const { id, redScore, blueScore, outcome } = parsed.data;

  // The match and any team the row names, in one parallel read.
  const [match, redPick, bluePick] = await Promise.all([
    getMatch(id),
    parsed.data.redTeamId ? getTeam(parsed.data.redTeamId) : Promise.resolve(null),
    parsed.data.blueTeamId ? getTeam(parsed.data.blueTeamId) : Promise.resolve(null),
  ]);
  if (!match) return { status: "error", message: "Матч не найден." };

  // A corner wired to an earlier match belongs to that match's winner and is
  // never reassigned from here, whatever the form says.
  const redTeamId = match.redFromMatchId ? match.redTeamId : (redPick?.id ?? match.redTeamId);
  const blueTeamId = match.blueFromMatchId
    ? match.blueTeamId
    : (bluePick?.id ?? match.blueTeamId);

  for (const pick of [redPick, bluePick]) {
    if (pick && (pick.categoryId !== match.categoryId || pick.classId !== match.classId)) {
      return { status: "error", message: "Команда не из этого класса." };
    }
  }
  if (redTeamId && blueTeamId && redTeamId === blueTeamId) {
    return { status: "error", message: "Команда не может играть сама с собой." };
  }

  const winnerTeamId = outcome === "red" ? redTeamId : outcome === "blue" ? blueTeamId : null;
  if ((outcome === "red" || outcome === "blue") && winnerTeamId === null) {
    return { status: "error", message: "В этом слоте ещё нет команды." };
  }

  if (redTeamId !== match.redTeamId || blueTeamId !== match.blueTeamId) {
    await setMatchTeams(id, { redTeamId, blueTeamId }, context, match);
  }

  await saveMatchResult(
    id,
    {
      redScore,
      blueScore,
      // Carried across from the stored protocol, not re-read from the form.
      redYellow: match.redYellow,
      redRed: match.redRed,
      blueYellow: match.blueYellow,
      blueRed: match.blueRed,
      notes: match.notes,
      // A score with no outcome is a match being played; choosing an outcome
      // closes the sheet, clearing it re-opens one closed by mistake.
      state: outcome === "open" ? "live" : "completed",
      winnerTeamId,
      isDraw: outcome === "draw",
    },
    context,
    { ...match, redTeamId, blueTeamId },
  );

  return { status: "saved", savedAt: Date.now() };
}

/**
 * Save one row of the roster table — a corrected name, start number,
 * organisation, region or group.
 *
 * Nothing else has to be touched afterwards: standings, cross-tables, bracket
 * slots and the public board all read the team by id, so a typo fixed here is
 * fixed everywhere on their next render. Returns a state rather than
 * redirecting, for the same reason as saveMatchRowAction.
 */
export async function updateTeamAction(
  _prev: ScoringFormState,
  formData: FormData,
): Promise<ScoringFormState> {
  const [context, csrfOk] = await Promise.all([
    getScoringContext(),
    assertRequestCsrf(formData, "judge.team.update"),
  ]);
  if (!csrfOk) return { status: "error", message: "Сессия устарела. Обновите страницу." };

  const parsed = teamUpdateSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { status: "error", message: "Нужны номер и название (от 2 символов)." };
  }

  const { id, categoryId, classId, ...patch } = parsed.data;
  const before = await getTeam(id);
  if (!before || before.categoryId !== categoryId || before.classId !== classId) {
    return { status: "error", message: "Команда не найдена." };
  }

  try {
    await updateTeam(id, patch, context, before);
  } catch (error) {
    // The unique (category, class, code) index: the number is already taken.
    logger.warn("judge.team.update_duplicate", { message: String(error) });
    return { status: "error", message: "Этот номер уже занят в классе." };
  }

  return { status: "saved", savedAt: Date.now() };
}

/**
 * Save one team's row of the attempts table: every attempt cell at once.
 *
 * Each cell takes what a referee writes on the sheet — `31.075`, `1:02.340`, a
 * points total, or `DNF` / `DSQ` / `FOUL` — and an EMPTY cell deletes the
 * attempt, which is the fix for a result typed into the wrong team's row.
 * Unchanged cells are skipped. Notes and remaining time are not on this row
 * and are carried over untouched. Leap is not saved from here: its total is
 * the output of an itemised sheet.
 *
 * Reads the team and all its attempts in one parallel pass, then writes every
 * changed cell in parallel — a row of three attempts is one round of queries,
 * not three rounds one after another.
 */
export async function saveRunRowAction(
  _prev: ScoringFormState,
  formData: FormData,
): Promise<ScoringFormState> {
  const [context, csrfOk] = await Promise.all([
    getScoringContext(),
    assertRequestCsrf(formData, "judge.run.row"),
  ]);
  if (!csrfOk) return { status: "error", message: "Сессия устарела. Обновите страницу." };

  const raw = fields(formData);
  const category = getCategory(raw.categoryId ?? "");
  const teamId = raw.teamId ?? "";
  if (!category || category.scoring.kind !== "run" || category.id === "leap" || !teamId) {
    return { status: "error", message: "Эту попытку нельзя внести из таблицы." };
  }

  const [team, stored] = await Promise.all([getTeam(teamId), listRunsForTeam(teamId)]);
  if (!team || team.categoryId !== category.id || team.classId !== raw.classId) {
    return { status: "error", message: "Команда не найдена." };
  }

  const isTime = category.scoring.metric === "time";
  const writes: Promise<unknown>[] = [];

  for (let round = 1; round <= category.scoring.rounds; round++) {
    const key = `attempt_${round}`;
    if (!(key in raw)) continue;

    const value = raw[key].trim();
    const existing = stored.find((run) => run.roundNumber === round) ?? null;

    if (value === "") {
      if (existing) writes.push(deleteRun(team.id, round, context, existing));
      continue;
    }
    if (existing && value === formatAttempt(existing, isTime)) continue;

    const token = value.toUpperCase();
    const state =
      token === "DNF" || token === "СХОД"
        ? "dnf"
        : token === "DSQ" || token === "ДИСК"
          ? "dsq"
          : token === "FOUL" || token === "ФОЛ"
            ? "foul"
            : "ok";

    const result = parseRun(
      {
        categoryId: category.id,
        classId: team.classId,
        teamId: team.id,
        roundNumber: String(round),
        state,
        time: isTime && state === "ok" ? value.replace(",", ".") : "",
        points: !isTime && state === "ok" ? value : "",
        remaining: "",
        notes: existing?.notes ?? "",
      },
      null,
    );
    if (!result.ok) {
      return { status: "error", message: `Попытка ${round}: ${result.error}` };
    }

    writes.push(
      saveRun({ ...result.value, remainingMs: existing?.remainingMs ?? null }, context, existing),
    );
  }

  await Promise.all(writes);
  return { status: "saved", savedAt: Date.now() };
}

/** What an attempt cell shows — and therefore what "unchanged" compares against. */
function formatAttempt(
  run: { state: string; timeMs: number | null; points: number | null },
  isTime: boolean,
): string {
  if (run.state !== "ok") return run.state.toUpperCase();
  return isTime ? formatClock(run.timeMs ?? 0) : String(run.points ?? 0);
}

export async function saveMatchAction(
  _prevState: ScoringFormState,
  formData: FormData,
): Promise<ScoringFormState> {
  const context = await getScoringContext();
  if (!(await assertRequestCsrf(formData, "judge.match.save"))) {
    return { status: "error", message: "Сессия устарела. Обновите страницу." };
  }

  const id = formData.get("id");
  if (typeof id !== "string") {
    return { status: "error", message: "Матч не найден." };
  }

  const match = await getMatch(id);
  if (!match) return { status: "error", message: "Матч не найден." };

  const parsed = matchResultSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Проверьте поля протокола.",
    };
  }

  const { outcome, ...rest } = parsed.data;

  // A completed sheet must name an outcome. "Победитель не определён" is a
  // legitimate state for a match still being played, and a contradiction for
  // one being closed.
  if (rest.state === "completed" && outcome === "open") {
    return { status: "error", message: "Укажите победителя или ничью." };
  }

  const winnerTeamId =
    outcome === "red" ? match.redTeamId : outcome === "blue" ? match.blueTeamId : null;

  await saveMatchResult(
    id,
    { ...rest, winnerTeamId, isDraw: outcome === "draw" },
    context,
  );

  publishResults();

  // A finished sheet returns the judge to the list, ready for the next pairing.
  // An unfinished one stays put, because a live match is scored repeatedly.
  if (rest.state === "completed") {
    redirect(`/judge/${match.categoryId}?class=${match.classId}&saved=match`);
  }

  return { status: "saved", savedAt: Date.now() };
}

/* ── Runs ───────────────────────────────────────────────────────────────── */

export async function saveRunAction(
  _prevState: ScoringFormState,
  formData: FormData,
): Promise<ScoringFormState> {
  const context = await getScoringContext();
  if (!(await assertRequestCsrf(formData, "judge.run.save"))) {
    return { status: "error", message: "Сессия устарела. Обновите страницу." };
  }

  const raw = fields(formData);
  const category = getCategory(raw.categoryId ?? "");
  if (!category) return { status: "error", message: "Неизвестная категория." };

  /**
   * Leap is the one category whose sheet the rulebook enumerates, so the
   * console reproduces it and totals it here. Every other points category asks
   * for the number the judge already has on paper.
   */
  const breakdown =
    category.id === "leap"
      ? Object.fromEntries(
          LEAP_SCORE_SHEET.map((item) => [item.id, Number(raw[`item_${item.id}`] ?? 0)]),
        )
      : null;

  const parsed = parseRun(raw, breakdown);
  if (!parsed.ok) return { status: "error", message: parsed.error };

  await saveRun(parsed.value, context);
  publishResults();

  redirect(`/judge/${category.id}?class=${parsed.value.classId}&saved=run`);
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

/**
 * Where a form posts back to.
 *
 * Both ids are validated against the catalogue before they are used, so a
 * crafted value cannot turn a redirect into an open one — and the class is
 * carried through, because a referee working Mini Sumo who adds a team and is
 * returned to LEGO Sumo has to find their way back on every single entry.
 */
function categoryPath(formData: FormData, extra?: string): string {
  const categoryId = formData.get("categoryId");
  const category =
    typeof categoryId === "string" ? getCategory(categoryId) : undefined;
  if (!category) return "/judge";

  const classId = formData.get("classId");
  const known =
    typeof classId === "string" &&
    category.classes.some((cls) => cls.id === classId)
      ? classId
      : null;

  const query = new URLSearchParams();
  if (known) query.set("class", known);
  if (extra) {
    const [key, value] = extra.split("=");
    query.set(key, value);
  }

  const suffix = query.size > 0 ? `?${query}` : "";
  return `/judge/${category.id}${suffix}`;
}
