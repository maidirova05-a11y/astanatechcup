"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useInView, useReducedMotion } from "motion/react";
import type { Locale } from "@/i18n/routing";

/**
 * Stat counter that animates once, when scrolled into view.
 *
 * Renders the FINAL value on the server and on the first client render, so
 * hydration matches and a visitor without JavaScript still sees "2500", not
 * "0". The count-up only starts after mount, and is skipped entirely under
 * `prefers-reduced-motion`.
 */

/**
 * Thousands separator per locale — "2 500" in Russian and Kazakh (a
 * no-break space, so the figure never splits across lines), "2,500" in
 * English.
 *
 * Deliberately NOT `Intl.NumberFormat`: this component renders on the server
 * and again in the browser, and the two must print identical text or React
 * throws a hydration error and rebuilds the tree. Node ships full ICU data, so
 * `kk-KZ` gives "2 500" there, but browsers built with trimmed ICU (Chromium
 * builds among them) have no Kazakh data and silently fall back to "2,500".
 */
const GROUP_SEPARATOR: Record<Locale, string> = {
  ru: "\u00A0",
  kk: "\u00A0",
  en: ",",
};

function formatInteger(value: number, locale: string): string {
  const separator = GROUP_SEPARATOR[locale as Locale] ?? ",";
  const sign = value < 0 ? "-" : "";
  const digits = String(Math.abs(Math.round(value)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

type CountUpProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  className?: string;
};

export function CountUp({
  value,
  prefix = "",
  suffix = "",
  durationMs = 1600,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);

  const locale = useLocale();

  useEffect(() => {
    if (reduceMotion || !inView) return;

    let frame = 0;
    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      // easeOutExpo — fast start, long settle. Matches the page's motion feel.
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(Math.round(eased * value));
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    // The first rAF callback computes progress ≈ 0 and sets the value there.
    // Setting state synchronously in the effect body would cause a cascading
    // render before the animation even starts.
    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [inView, reduceMotion, value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {/* The true value is always available to assistive tech, whatever the
          animation is currently showing. */}
      <span className="sr-only">{`${prefix}${value}${suffix}`}</span>
      <span aria-hidden="true" className="tabular">
        {prefix}
        {formatInteger(display, locale)}
        {suffix}
      </span>
    </span>
  );
}
