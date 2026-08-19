"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Scroll-triggered entrance.
 *
 * ── Failsafe, and why it exists ──────────────────────────────────────────
 * Every element starts at `opacity: 0` and is revealed by an
 * IntersectionObserver. If that observer never fires, the content stays
 * invisible — permanently, and silently, because `innerText` still reports
 * fully transparent text so no text-based check catches it.
 *
 * That is an unacceptable failure mode for the page that takes registrations.
 * So a module-level probe checks, once, whether IntersectionObserver actually
 * works in this environment. If it does not, every Reveal degrades to a plain
 * element and the content is simply there. Losing an animation is a shrug;
 * losing the disciplines grid is losing the event's entries.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `useReducedMotion` is checked in JS as well as via the global CSS rule,
 * because Framer Motion animates through inline styles that the CSS override
 * cannot reach.
 */

/** null = not yet determined, true = observer works, false = degrade to plain. */
let observerHealth: boolean | null = null;
const healthListeners = new Set<() => void>();
let probeStarted = false;

/** How long to wait for a single observer callback before giving up. */
const PROBE_TIMEOUT_MS = 2500;

function setHealth(value: boolean) {
  if (observerHealth === value) return;
  observerHealth = value;
  for (const listener of healthListeners) listener();
}

function startProbe() {
  if (probeStarted || typeof window === "undefined") return;
  probeStarted = true;

  if (typeof IntersectionObserver === "undefined") {
    setHealth(false);
    return;
  }

  let fired = false;
  const observer = new IntersectionObserver(() => {
    fired = true;
    setHealth(true);
    observer.disconnect();
  });
  observer.observe(document.body);

  window.setTimeout(() => {
    if (fired) return;
    observer.disconnect();
    // A hidden tab legitimately produces no callbacks; that is not a fault,
    // and the observer will fire normally once the tab is foregrounded.
    if (document.visibilityState !== "visible") {
      probeStarted = false; // re-probe on the next mount
      return;
    }
    setHealth(false);
  }, PROBE_TIMEOUT_MS);
}

function useObserverHealth(): boolean | null {
  const [health, setLocal] = useState(observerHealth);

  useEffect(() => {
    startProbe();
    const listener = () => setLocal(observerHealth);
    healthListeners.add(listener);
    listener();
    return () => {
      healthListeners.delete(listener);
    };
  }, []);

  return health;
}

/**
 * Components are resolved once, at module scope. Reading `motion[as]` inside
 * the render function hands React a new component identity on every render,
 * which remounts the subtree and tears down the observer before it can fire.
 */
const MOTION = {
  div: motion.div,
  li: motion.li,
  article: motion.article,
  section: motion.section,
} as const;

const PLAIN = {
  div: "div",
  li: "li",
  article: "article",
  section: "section",
} as const;

const OFFSETS = {
  up: { y: 24 },
  left: { x: -24 },
  right: { x: 24 },
  none: {},
} as const;

type RevealProps = {
  children: ReactNode;
  /** Stagger index — each step adds 60ms. Keep under ~6 or it feels slow. */
  index?: number;
  className?: string;
  as?: keyof typeof MOTION;
  direction?: keyof typeof OFFSETS;
};

export function Reveal({
  children,
  index = 0,
  className,
  as = "div",
  direction = "up",
}: RevealProps) {
  const reduceMotion = useReducedMotion();
  const health = useObserverHealth();

  if (reduceMotion || health === false) {
    const Plain = PLAIN[as];
    return <Plain className={className}>{children}</Plain>;
  }

  const Component = MOTION[as];

  return (
    <Component
      className={className}
      initial={{ opacity: 0, ...OFFSETS[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      // `once` matters: re-animating on every scroll past is a nausea trigger
      // and makes a long page feel unstable.
      viewport={{ once: true, amount: 0.15 }}
      onViewportEnter={() => setHealth(true)}
      transition={{
        duration: 0.55,
        delay: Math.min(index, 6) * 0.06,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </Component>
  );
}
