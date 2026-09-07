"use client";

import { useActionState, useState } from "react";
import { saveMatchAction } from "@/app/judge/actions";
import { initialScoringFormState } from "@/app/judge/form-state";
import { CSRF_FIELD } from "@/lib/security/constants";
import { Warning, Check } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * The match sheet, as a phone screen.
 *
 * Two things drive every decision here:
 *
 *  · It is operated one-handed, at arm's length, next to a ring. Every control
 *    that changes a number is at least 56px. There is no free-typing into the
 *    score — a typo in a score is a protest, and a stepper cannot produce one.
 *  · The judge declares the outcome; the form does not infer it. Each of these
 *    rulebooks lets a referee award a match against the score — a
 *    disqualification, a card count, a golden goal, Ring Master's Endgame — so
 *    the score is evidence, not a verdict. The outcome does FOLLOW the score
 *    until the judge touches it, which keeps the common case to zero taps.
 */

type Side = "red" | "blue";

export type MatchScorerProps = {
  matchId: string;
  categoryId: string;
  csrfToken: string;
  /** What the two big numbers count, e.g. "выигранные раунды". */
  unitLabel: string;
  showCards: boolean;
  teams: Record<Side, { code: string; name: string }>;
  initial: {
    redScore: number;
    blueScore: number;
    redYellow: number;
    redRed: number;
    blueYellow: number;
    blueRed: number;
    outcome: "red" | "blue" | "draw" | "open";
    state: "scheduled" | "live" | "completed";
    notes: string;
  };
  /** Best-of-N, when the category has one. Shown as a reminder, not enforced. */
  bestOf?: number;
};

export function MatchScorer({
  matchId,
  categoryId,
  csrfToken,
  unitLabel,
  showCards,
  teams,
  initial,
  bestOf,
}: MatchScorerProps) {
  const [state, formAction, isPending] = useActionState(
    saveMatchAction,
    initialScoringFormState,
  );

  const [redScore, setRedScore] = useState(initial.redScore);
  const [blueScore, setBlueScore] = useState(initial.blueScore);
  const [cards, setCards] = useState({
    redYellow: initial.redYellow,
    redRed: initial.redRed,
    blueYellow: initial.blueYellow,
    blueRed: initial.blueRed,
  });

  const [chosenOutcome, setChosenOutcome] = useState(initial.outcome);
  const [outcomeTouched, setOutcomeTouched] = useState(initial.outcome !== "open");
  const [matchState, setMatchState] = useState(initial.state);

  /**
   * Until the judge states an outcome themselves it is DERIVED from the score,
   * not stored — an effect that wrote it into state would fight every tap on a
   * stepper. The moment they pick one it sticks, because a referee who
   * overrode the score once must not have that undone by the next tap.
   *
   * A sheet still at 0:0 suggests nothing: a fresh pairing has not drawn, it
   * simply has not been played.
   */
  const suggested =
    redScore === 0 && blueScore === 0
      ? "open"
      : redScore > blueScore
        ? "red"
        : blueScore > redScore
          ? "blue"
          : "draw";

  const outcome = outcomeTouched ? chosenOutcome : suggested;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
      <input type="hidden" name="id" value={matchId} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="redScore" value={redScore} />
      <input type="hidden" name="blueScore" value={blueScore} />
      <input type="hidden" name="redYellow" value={cards.redYellow} />
      <input type="hidden" name="redRed" value={cards.redRed} />
      <input type="hidden" name="blueYellow" value={cards.blueYellow} />
      <input type="hidden" name="blueRed" value={cards.blueRed} />
      <input type="hidden" name="outcome" value={outcome} />

      {state.status === "error" && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-surface p-3 text-sm text-danger"
        >
          <Warning className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      )}

      {state.status === "saved" && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md border border-success/30 bg-success-surface p-3 text-sm text-success"
        >
          <Check className="mt-0.5 shrink-0" />
          Сохранено. Протокол ещё открыт — завершите его, когда бой закончится.
        </p>
      )}

      <p className="text-center text-xs uppercase tracking-wider text-subtle">
        {unitLabel}
        {bestOf ? ` · до ${Math.ceil(bestOf / 2)} побед из ${bestOf}` : ""}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <ScorePanel
          side="red"
          team={teams.red}
          value={redScore}
          onChange={setRedScore}
        />
        <ScorePanel
          side="blue"
          team={teams.blue}
          value={blueScore}
          onChange={setBlueScore}
        />
      </div>

      {showCards && (
        <fieldset className="rounded-lg border border-line bg-surface p-5">
          <legend className="px-2 text-sm font-semibold">Карточки</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            {(["red", "blue"] as const).map((side) => (
              <div key={side} className="flex flex-col gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-subtle">
                  {side === "red" ? "Красный угол" : "Синий угол"}
                </p>
                <Counter
                  label="Жёлтые"
                  value={cards[`${side}Yellow` as const]}
                  onChange={(update) =>
                    setCards((prev) => ({
                      ...prev,
                      [`${side}Yellow`]: update(prev[`${side}Yellow` as const]),
                    }))
                  }
                />
                <Counter
                  label="Красные"
                  value={cards[`${side}Red` as const]}
                  onChange={(update) =>
                    setCards((prev) => ({
                      ...prev,
                      [`${side}Red`]: update(prev[`${side}Red` as const]),
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">Результат</legend>
        <Segmented
          value={outcome}
          onChange={(next) => {
            setChosenOutcome(next as typeof outcome);
            setOutcomeTouched(true);
          }}
          options={[
            { value: "red", label: teams.red.code },
            { value: "draw", label: "Ничья" },
            { value: "blue", label: teams.blue.code },
            { value: "open", label: "Не определён" },
          ]}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">Статус протокола</legend>
        <Segmented
          value={matchState}
          onChange={(next) => setMatchState(next as typeof matchState)}
          options={[
            { value: "scheduled", label: "Запланирован" },
            { value: "live", label: "Идёт" },
            { value: "completed", label: "Завершён" },
          ]}
        />
        <input type="hidden" name="state" value={matchState} />
        <p className="text-xs text-subtle">
          В турнирную таблицу идут только завершённые протоколы.
        </p>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Комментарий судьи</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={500}
          defaultValue={initial.notes}
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
        {isPending ? "Сохраняем…" : "Сохранить протокол"}
      </button>
    </form>
  );
}

/* ── Controls ───────────────────────────────────────────────────────────── */

/**
 * `onChange` takes an UPDATER, never a computed number.
 *
 * A referee taps `+` three times in the two seconds between exchanges. Passing
 * `value + 1` closes over the `value` from the render that drew the button, so
 * three taps inside one React batch all compute the same number and the score
 * goes up by one. It looks like a missed tap and it is a wrong score.
 */
function ScorePanel({
  side,
  team,
  value,
  onChange,
}: {
  side: Side;
  team: { code: string; name: string };
  value: number;
  onChange: (update: (current: number) => number) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-lg border-2 bg-surface p-5",
        side === "red" ? "border-danger/40" : "border-brand/40",
      )}
    >
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span
          className={cn(
            "text-2xs font-bold uppercase tracking-wider",
            side === "red" ? "text-danger" : "text-brand",
          )}
        >
          {side === "red" ? "Красный угол" : "Синий угол"}
        </span>
        <span className="tabular font-display text-lg font-extrabold">{team.code}</span>
        <span className="text-sm text-muted">{team.name}</span>
      </div>

      <div className="flex items-center gap-4">
        <StepButton
          label={`Убавить счёт: ${team.name}`}
          onClick={() => onChange((current) => current - 1)}
        >
          −
        </StepButton>
        <output className="tabular w-20 text-center font-display text-5xl font-extrabold">
          {value}
        </output>
        <StepButton
          label={`Прибавить счёт: ${team.name}`}
          onClick={() => onChange((current) => current + 1)}
        >
          +
        </StepButton>
      </div>

      {/* Ring Master's penalties are −10 and −30; stepping there one tap at a
          time would take half a minute. */}
      <div className="flex gap-2">
        {[-10, -1, +1, +10].map((delta) => (
          <button
            key={delta}
            type="button"
            onClick={() => onChange((current) => current + delta)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line px-3 text-sm font-semibold text-muted"
          >
            {delta > 0 ? `+${delta}` : delta}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-14 items-center justify-center rounded-full border-2 border-line-strong bg-surface-muted text-3xl font-bold leading-none active:scale-95"
    >
      {children}
    </button>
  );
}

function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  /** An updater, for the reason spelled out above `ScorePanel`. */
  onChange: (update: (current: number) => number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange((current) => Math.max(0, current - 1))}
          aria-label={`${label}: убавить`}
          className="inline-flex size-11 items-center justify-center rounded-full border border-line-strong text-xl"
        >
          −
        </button>
        <output className="tabular w-7 text-center font-bold">{value}</output>
        <button
          type="button"
          onClick={() => onChange((current) => Math.min(20, current + 1))}
          aria-label={`${label}: прибавить`}
          className="inline-flex size-11 items-center justify-center rounded-full border border-line-strong text-xl"
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Radio group drawn as a segmented control.
 *
 * Real `<input type="radio">` elements under the styling: a segmented control
 * built from buttons is invisible to a screen reader as a choice, and the
 * keyboard arrow behaviour a radio group gets for free would have to be
 * rebuilt by hand.
 */
export function Segmented({
  value,
  onChange,
  options,
  name,
}: {
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
  name?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              "inline-flex min-h-12 cursor-pointer items-center rounded-full border-2 px-4 text-sm font-semibold transition-colors",
              active
                ? "border-brand-strong bg-brand-strong text-on-brand"
                : "border-line bg-surface text-muted",
            )}
          >
            <input
              type="radio"
              name={name ?? `segmented-${options.map((o) => o.value).join("-")}`}
              value={option.value}
              checked={active}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
