"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Countdown to the application deadline.
 *
 * The server cannot know the visitor's clock, so it renders placeholder digits
 * of the exact final size and the real numbers appear on mount. That means:
 *   · no hydration mismatch — server and client first render are identical;
 *   · no layout shift — the boxes are already the right dimensions;
 *   · no impure `Date.now()` during render.
 *
 * The authoritative deadline check lives on the server
 * (`isRegistrationOpen`). This component is presentation only: a visitor with
 * a skewed clock sees odd numbers but cannot register late because of it.
 */

type CountdownProps = {
  /** Deadline as epoch milliseconds. */
  targetMs: number;
  className?: string;
  tone?: "light" | "dark";
};

type Remaining = { days: number; hours: number; minutes: number; seconds: number; done: boolean };

function computeRemaining(targetMs: number, nowMs: number): Remaining {
  const delta = Math.max(0, targetMs - nowMs);
  return {
    days: Math.floor(delta / 86_400_000),
    hours: Math.floor((delta % 86_400_000) / 3_600_000),
    minutes: Math.floor((delta % 3_600_000) / 60_000),
    seconds: Math.floor((delta % 60_000) / 1000),
    done: delta === 0,
  };
}

const PLACEHOLDER = "––";

export function Countdown({ targetMs, className, tone = "light" }: CountdownProps) {
  const t = useTranslations("countdown");
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    // setState happens inside the interval callback and the initial timeout,
    // never synchronously in the effect body.
    const tick = () => setRemaining(computeRemaining(targetMs, Date.now()));

    // A zero-delay timeout defers the first update out of the effect body,
    // so the placeholder paints once and is replaced on the next tick.
    const initial = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);

    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [targetMs]);

  if (remaining?.done) {
    return <p className={cn("text-lg font-semibold text-accent", className)}>{t("expired")}</p>;
  }

  const units = [
    { value: remaining?.days, label: t("days", { count: remaining?.days ?? 0 }) },
    { value: remaining?.hours, label: t("hours", { count: remaining?.hours ?? 0 }) },
    { value: remaining?.minutes, label: t("minutes", { count: remaining?.minutes ?? 0 }) },
    { value: remaining?.seconds, label: t("seconds", { count: remaining?.seconds ?? 0 }) },
  ];

  return (
    <div
      className={cn("flex items-stretch gap-2 sm:gap-3", className)}
      role="timer"
      // One announcement of the whole remaining time on focus, rather than a
      // screen reader reading a changing number once a second.
      aria-live="off"
      aria-label={
        remaining
          ? t("ariaLabel", {
              days: remaining.days,
              hours: remaining.hours,
              minutes: remaining.minutes,
            })
          : undefined
      }
    >
      {units.map((unit, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(
            "flex min-w-[4.25rem] flex-1 flex-col items-center justify-center rounded-lg px-2 py-3 sm:min-w-[5rem] sm:px-3",
            tone === "dark"
              ? "bg-white/10 ring-1 ring-white/15 backdrop-blur-sm"
              : "bg-surface-raised shadow-sm ring-1 ring-line",
          )}
        >
          <span className="tabular text-2xl font-extrabold leading-none sm:text-3xl">
            {unit.value === undefined ? PLACEHOLDER : String(unit.value).padStart(2, "0")}
          </span>
          <span className="mt-1.5 text-2xs font-medium uppercase tracking-wide text-muted">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}
