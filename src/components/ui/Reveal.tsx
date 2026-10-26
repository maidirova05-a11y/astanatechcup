"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useInViewOnce, usePrefersReducedMotion } from "./in-view";

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
 * Reduced motion is checked in JS as well as via the global CSS rule, because
 * the entrance runs on the Web Animations API, which the CSS override cannot
 * reach.
 *
 * ── How it animates ──────────────────────────────────────────────────────
 * The element is server-rendered at its start state — inline
 * `opacity: 0; transform: translateY(24px)`, byte for byte what Motion's
 * `initial` used to render — and, on entering the viewport, played to its end
 * state with `element.animate()`: same 0.55s, same easing, same 60ms stagger.
 * When the animation finishes the end state is committed as inline style and
 * the animation is cancelled, which leaves exactly the `opacity: 1;
 * transform: none` Motion left behind. WAAPI rather than a CSS transition so
 * nothing is added to the element's own `transition`, which the tiles use for
 * hover effects.
 * ─────────────────────────────────────────────────────────────────────────
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

type Tag = "div" | "li" | "article" | "section";

const OFFSETS = {
  up: "translateY(24px)",
  left: "translateX(-24px)",
  right: "translateX(24px)",
  none: null,
} as const;

const DURATION_MS = 550;
const STAGGER_MS = 60;
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

type RevealProps = {
  children: ReactNode;
  /** Stagger index — each step adds 60ms. Keep under ~6 or it feels slow. */
  index?: number;
  className?: string;
  as?: Tag;
  direction?: keyof typeof OFFSETS;
};

export function Reveal({
  children,
  index = 0,
  className,
  as = "div",
  direction = "up",
}: RevealProps) {
  const reduceMotion = usePrefersReducedMotion();
  const health = useObserverHealth();
  const plain = reduceMotion || health === false;

  const ref = useRef<HTMLElement>(null);
  // `once`: re-animating on every scroll past is a nausea trigger and makes a
  // long page feel unstable.
  const inView = useInViewOnce(ref, { amount: 0.15, enabled: !plain });
  const [done, setDone] = useState(false);
  const animation = useRef<Animation | null>(null);

  useEffect(() => {
    if (plain || !inView || done) return;
    // A real callback from a real observer: the probe can stand down.
    setHealth(true);

    const node = ref.current;
    if (!node || typeof node.animate !== "function") {
      setDone(true);
      return;
    }

    const offset = OFFSETS[direction];
    const running = node.animate(
      offset
        ? [
            { opacity: 0, transform: offset },
            { opacity: 1, transform: "none" },
          ]
        : [{ opacity: 0 }, { opacity: 1 }],
      {
        duration: DURATION_MS,
        delay: Math.min(index, 6) * STAGGER_MS,
        easing: EASING,
        fill: "forwards",
      },
    );
    animation.current = running;
    running.onfinish = () => setDone(true);
    return () => {
      running.onfinish = null;
    };
  }, [plain, inView, done, direction, index]);

  // Once the end state is in the inline style, the filled animation is
  // redundant; cancelling it before paint means there is no frame without one
  // or the other.
  useLayoutEffect(() => {
    if (done && animation.current) {
      animation.current.cancel();
      animation.current = null;
    }
  }, [done]);

  const Tag = as;

  if (plain) {
    return <Tag className={className}>{children}</Tag>;
  }

  const offset = OFFSETS[direction];
  const style: CSSProperties = done
    ? offset
      ? { opacity: 1, transform: "none" }
      : { opacity: 1 }
    : offset
      ? { opacity: 0, transform: offset }
      : { opacity: 0 };

  return (
    <Tag
      // Each tag accepts an HTMLElement ref; TypeScript cannot narrow the union.
      ref={ref as never}
      className={className}
      style={style}
    >
      {children}
    </Tag>
  );
}
