"use client";

import { useActionState, useMemo, useState } from "react";
import { saveRunAction } from "@/app/judge/actions";
import { initialScoringFormState } from "@/app/judge/form-state";
import { Segmented } from "@/components/judge/MatchScorer";
import { CSRF_FIELD } from "@/lib/security/constants";
import { Warning } from "@/components/ui/icons";
import { formatClock, parseClock, parseDuration } from "@/lib/scoring/format";
import { LEAP_SCORE_SHEET, leapTimeBonus } from "@/config/categories";
import { cn } from "@/lib/utils";

/**
 * One attempt.
 *
 * The shape of this form is decided by the category, not by a toggle the judge
 * has to find: a time category shows a clock field and no points field, Leap
 * shows its whole score sheet and no total field at all. Showing a referee an
 * input their category does not use is how the wrong number gets typed into it.
 *
 * The clock field echoes what the server will parse, live. `1:23,4` and
 * `1:23.400` mean the same thing and both are things people type; seeing
 * `1:23.400` appear underneath is what stops a judge wondering which one the
 * system took.
 */

export type RunScorerProps = {
  csrfToken: string;
  categoryId: string;
  classId: string;
  teamId: string;
  roundNumber: number;
  metric: "time" | "points";
  /** Leap's sheet is reproduced and totalled here; other categories are not. */
  useSheet: boolean;
  tracksRemaining: boolean;
  maxPoints?: number;
  /** Round length in ms — the ceiling for the remaining-time field. */
  clockMs: number;
  initial: {
    state: "ok" | "dnf" | "foul" | "dsq";
    time: string;
    points: string;
    remaining: string;
    notes: string;
    counts: Record<string, number>;
  };
};

export function RunScorer(props: RunScorerProps) {
  const [state, formAction, isPending] = useActionState(
    saveRunAction,
    initialScoringFormState,
  );

  const [runState, setRunState] = useState(props.initial.state);
  const [time, setTime] = useState(props.initial.time);
  const [remaining, setRemaining] = useState(props.initial.remaining);
  const [counts, setCounts] = useState<Record<string, number>>(props.initial.counts);

  const parsedTime = useMemo(() => parseClock(time), [time]);
  const parsedRemaining = useMemo(() => parseDuration(remaining), [remaining]);

  const sheetTotal = useMemo(() => {
    if (!props.useSheet) return null;
    const base = LEAP_SCORE_SHEET.reduce(
      (sum, item) => sum + (counts[item.id] ?? 0) * item.value,
      0,
    );
    const bonus = parsedRemaining ? leapTimeBonus(parsedRemaining, props.clockMs) : 0;
    return { base: Math.max(0, base), bonus, total: Math.max(0, base) + bonus };
  }, [counts, parsedRemaining, props.useSheet, props.clockMs]);

  const failed = runState !== "ok";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name={CSRF_FIELD} value={props.csrfToken} />
      <input type="hidden" name="categoryId" value={props.categoryId} />
      <input type="hidden" name="classId" value={props.classId} />
      <input type="hidden" name="teamId" value={props.teamId} />
      <input type="hidden" name="roundNumber" value={props.roundNumber} />
      <input type="hidden" name="state" value={runState} />

      {state.status === "error" && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-surface p-3 text-sm text-danger"
        >
          <Warning className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">Статус попытки</legend>
        <Segmented
          value={runState}
          onChange={(next) => setRunState(next as typeof runState)}
          options={[
            { value: "ok", label: "Зачтено" },
            { value: "dnf", label: "Не финишировал" },
            { value: "foul", label: "Фол" },
            { value: "dsq", label: "Дисквалификация" },
          ]}
        />
        {failed && (
          <p className="text-xs text-muted">
            {props.metric === "time"
              ? "Попытка будет записана штрафным временем по правилам категории."
              : "Попытка будет записана нулём очков."}
          </p>
        )}
      </fieldset>

      {!failed && props.metric === "time" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Время прохождения</span>
          <input
            name="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            inputMode="decimal"
            placeholder="1:23,456"
            autoComplete="off"
            required
            className="tabular h-14 w-full rounded-md border border-line-strong bg-surface px-4 text-center font-display text-2xl font-bold focus:border-brand"
          />
          <span
            className={cn(
              "text-sm",
              parsedTime === null && time !== "" ? "text-danger" : "text-subtle",
            )}
          >
            {time === ""
              ? "Формат м:сс,ммм — так, как показала система хронометража"
              : parsedTime === null
                ? "Не удалось разобрать время. Пример: 1:23,456"
                : `Будет записано: ${formatClock(parsedTime)}`}
          </span>
        </label>
      )}

      {!failed && props.metric === "points" && !props.useSheet && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Очки за попытку</span>
          <input
            name="points"
            type="number"
            inputMode="numeric"
            min={0}
            max={props.maxPoints ?? 9999}
            defaultValue={props.initial.points}
            required
            className="tabular h-14 w-full rounded-md border border-line-strong bg-surface px-4 text-center font-display text-2xl font-bold focus:border-brand"
          />
          {props.maxPoints && (
            <span className="text-xs text-subtle">
              Максимум по правилам категории — {props.maxPoints}
            </span>
          )}
        </label>
      )}

      {!failed && props.useSheet && (
        <SheetPanel counts={counts} onChange={setCounts} totals={sheetTotal!} />
      )}

      {props.tracksRemaining && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Остаток времени</span>
          <input
            name="remaining"
            value={remaining}
            onChange={(event) => setRemaining(event.target.value)}
            inputMode="numeric"
            placeholder="1:05"
            autoComplete="off"
            className="tabular h-12 w-full rounded-md border border-line-strong bg-surface px-4 text-base focus:border-brand"
          />
          <span
            className={cn(
              "text-xs",
              parsedRemaining === null && remaining !== "" ? "text-danger" : "text-subtle",
            )}
          >
            {props.useSheet
              ? "Формат мм:сс. Даёт бонус за время и разводит равные результаты."
              : "Формат мм:сс. Используется как дополнительный критерий при равенстве."}
          </span>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Комментарий судьи</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={500}
          defaultValue={props.initial.notes}
          className="w-full rounded-md border border-line-strong bg-surface p-3 text-base focus:border-brand"
        />
        <span className="text-xs text-subtle">
          Публикуется на сайте. Без персональных данных участников.
        </span>
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-14 items-center justify-center rounded-full bg-accent px-6 text-base font-bold text-on-accent disabled:opacity-60"
      >
        {isPending ? "Сохраняем…" : "Сохранить попытку"}
      </button>
    </form>
  );
}

/* ── Leap's score sheet ─────────────────────────────────────────────────── */

const SHEET_LABELS: Record<string, string> = {
  circuit: "Осмотр цепей: балка вдавлена в паз",
  micUpright: "Микрофон в зоне, стоит вертикально",
  micPlaced: "Микрофон в зоне, но не вертикально",
  micMoved: "Микрофон вне зоны, но сдвинут со старта",
  speakers: "Колонка поднята вертикально",
  screen: "Экран развёрнут",
  bandUpright: "Музыкант в зоне, стоит вертикально",
  bandPlaced: "Музыкант в зоне, но не вертикально",
  bandField: "Музыкант вне зоны, но на поле",
  lighting: "Свет направлен на сцену, поворот больше 90°",
  sound: "Переключатель звука в нужном положении",
  crane: "Ручка крана повёрнута по часовой больше 90°",
  fireworks: "Холодный фейерверк раскрыт полностью",
  diveOut: "Stage dive: предмет вышел за пределы поля",
  diveIn: "Stage dive: предмет остался на поле",
  bonus: "Бонусное задание чемпионата",
  intact: "Робот не потерял ни одной детали",
  retry: "Рестарты",
};

/**
 * Groups whose rows describe the SAME prop scored at different quality levels.
 *
 * Three microphones cannot be worth ten points each and five points each at the
 * same time. The rulebook says so implicitly by counting props, not rows; the
 * console says so out loud, because the alternative is a sheet that silently
 * totals to more than the task is worth.
 */
const EXCLUSIVE_GROUPS: { ids: string[]; max: number; label: string }[] = [
  { ids: ["micUpright", "micPlaced", "micMoved"], max: 3, label: "микрофонов" },
  { ids: ["bandUpright", "bandPlaced", "bandField"], max: 5, label: "музыкантов" },
  { ids: ["diveOut", "diveIn"], max: 1, label: "stage dive" },
];

/**
 * `onChange` takes an UPDATER, never a computed object.
 *
 * Eighteen rows, tapped quickly. Building the next object from the `counts`
 * captured at render means several taps inside one React batch all start from
 * the same snapshot and only the last survives — the judge taps `+` three times
 * for three microphones and the sheet records one. Silent, and worth 20 points.
 */
function SheetPanel({
  counts,
  onChange,
  totals,
}: {
  counts: Record<string, number>;
  onChange: (
    update: (current: Record<string, number>) => Record<string, number>,
  ) => void;
  totals: { base: number; bonus: number; total: number };
}) {
  const overfilled = EXCLUSIVE_GROUPS.filter((group) => {
    const sum = group.ids.reduce((n, id) => n + (counts[id] ?? 0), 0);
    return sum > group.max;
  });

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-sm font-semibold">Протокол заданий</legend>

      <ul className="flex flex-col gap-2">
        {LEAP_SCORE_SHEET.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-3"
          >
            <div className="flex min-w-0 flex-col">
              <span className="text-sm">{SHEET_LABELS[item.id] ?? item.id}</span>
              <span className="text-xs text-subtle">
                {item.value > 0 ? `+${item.value}` : item.value} за каждое, максимум{" "}
                {item.max}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label={`${SHEET_LABELS[item.id]}: убавить`}
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    [item.id]: Math.max(0, (current[item.id] ?? 0) - 1),
                  }))
                }
                className="inline-flex size-11 items-center justify-center rounded-full border border-line-strong text-xl"
              >
                −
              </button>
              <output className="tabular w-7 text-center font-display text-lg font-bold">
                {counts[item.id] ?? 0}
              </output>
              <button
                type="button"
                aria-label={`${SHEET_LABELS[item.id]}: прибавить`}
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    [item.id]: Math.min(item.max, (current[item.id] ?? 0) + 1),
                  }))
                }
                className="inline-flex size-11 items-center justify-center rounded-full border border-line-strong text-xl"
              >
                +
              </button>
            </div>

            <input type="hidden" name={`item_${item.id}`} value={counts[item.id] ?? 0} />
          </li>
        ))}
      </ul>

      {overfilled.length > 0 && (
        <p
          role="alert"
          className="rounded-md border border-warning/40 bg-warning-surface p-3 text-sm"
        >
          Проверьте строки:{" "}
          {overfilled.map((group) => `${group.label} — не больше ${group.max}`).join("; ")}.
          Один и тот же предмет нельзя засчитать дважды.
        </p>
      )}

      <div className="flex items-end justify-between gap-4 rounded-lg border-2 border-brand/40 bg-surface p-4">
        <div className="flex flex-col text-sm text-muted">
          <span>Задания: {totals.base}</span>
          <span>Бонус за время: {totals.bonus}</span>
        </div>
        <output className="tabular font-display text-4xl font-extrabold">
          {totals.total}
        </output>
      </div>
    </fieldset>
  );
}
