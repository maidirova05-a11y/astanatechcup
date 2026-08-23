import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Above-the-fold entrance.
 *
 * ── Why this is CSS and not Motion ───────────────────────────────────────
 * A JavaScript entrance ships `opacity: 0` as an inline style from the server
 * and depends on the bundle executing to clear it. If the bundle fails, is
 * blocked, or has simply not run yet, the hero renders invisible — and because
 * the text is still in the DOM, no text-based check notices. That is the worst
 * failure this page can have, on the one screenful that has to work.
 *
 * The CSS animation in `globals.css` cannot fail that way: if the stylesheet
 * loaded, it runs to completion by itself. It also lets this stay a server
 * component, which keeps Motion out of the hero's client bundle entirely.
 *
 * ── Why not `Reveal` ─────────────────────────────────────────────────────
 * `Reveal` waits for an IntersectionObserver, which is right for content
 * further down the page and pointless for content that is already on screen.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Elements are ordered by `step`, not by DOM position, so the choreography can
 * be retuned without moving markup around.
 */

/** One beat of the choreography. Eight steps ≈ 0.68s, which is brisk. */
const STEP_MS = 85;

type RiseProps = {
  children: ReactNode;
  /** Position in the sequence. Multiplied by one beat to get the delay. */
  step?: number;
  className?: string;
  as?: "div" | "span" | "p" | "li";
  /** Distance travelled, in pixels. Larger for bigger elements. */
  distance?: number;
};

export function Rise({
  children,
  step = 0,
  className,
  as: Component = "div",
  distance,
}: RiseProps) {
  const style: CSSProperties = { "--rise-delay": `${step * STEP_MS}ms` } as CSSProperties;
  if (distance !== undefined) {
    (style as Record<string, string>)["--rise-distance"] = `${distance}px`;
  }

  return (
    <Component className={cn("rise", className)} style={style}>
      {children}
    </Component>
  );
}
