"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

/**
 * The two pieces of `motion/react` this site used — `useReducedMotion` and
 * `useInView` — as a few lines of platform API.
 *
 * Motion was in the client bundle for exactly these, plus one fade-up in
 * <Reveal>: ~40 KB gzipped on every page that shows a tile, parsed and
 * evaluated before the page became interactive. IntersectionObserver,
 * matchMedia and the Web Animations API do the same work natively, and they
 * are what Motion itself calls underneath.
 */

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * `prefers-reduced-motion`, live.
 *
 * `false` on the server and during hydration (the server snapshot), then the
 * real value — so the hydrated markup always matches the server's, and a
 * visitor who asked for less motion gets the plain element one render later.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

/**
 * True from the first time `ref` intersects the viewport, and stays true.
 *
 * `amount` is the IntersectionObserver threshold, as Motion's `amount` was:
 * the fraction of the element that must be visible. Like Motion, the decision
 * is the entry's `isIntersecting`. `enabled: false` leaves the observer
 * detached (and the hook at false).
 */
export function useInViewOnce(
  ref: RefObject<Element | null>,
  { amount, enabled = true }: { amount: number; enabled?: boolean },
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!enabled || inView || !node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: amount },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, amount, enabled, inView]);

  return inView;
}
