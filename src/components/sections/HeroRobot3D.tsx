"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Client island for the 3D mascot. It owns only the stage state; everything
 * it wraps (blueprint frame, poster, build log) is server-rendered.
 *
 * States, written to `data-state` and read by the "Hero robot assembly" CSS:
 *   pending  — nothing yet. The poster fades in on its own after a delay, so a
 *              slow or failed load still ends on the finished robot.
 *   play     — WebGL is drawing and the build is playing; the build log runs.
 *   idle     — WebGL took over after the poster was already up, so the build
 *              is skipped and the robot starts assembled.
 *   static   — no WebGL, reduced motion or Save-Data: the poster is the robot.
 *
 * three.js and the model are loaded with a dynamic import after mount, so
 * none of it is in the hero's initial bundle.
 */

type State = "pending" | "play" | "idle" | "static";

export function HeroRobot3D({
  className,
  style,
  logoUrl,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  logoUrl: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rootEl = ref.current;
    const host = rootEl?.querySelector<HTMLElement>("[data-robot-host]");
    if (!rootEl || !host) return;
    // Written straight to the DOM: the state only ever drives CSS, so there
    // is nothing for React to re-render.
    const setState = (s: State) => {
      rootEl.dataset.state = s;
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ===
      true;
    if (reduce || saveData) {
      setState("static");
      return;
    }

    let cancelled = false;
    let dispose: (() => void) | null = null;
    const poster = rootEl.querySelector<HTMLElement>("[data-robot-poster]");

    import("./HeroRobotScene")
      .then(({ mountRobot }) =>
        cancelled
          ? null
          : mountRobot({
              host,
              logoUrl,
              shouldSkipBuild: () =>
                !!poster && Number(getComputedStyle(poster).opacity) > 0.02,
              onReady: (skipped) => {
                if (!cancelled) setState(skipped ? "idle" : "play");
              },
              onError: () => {
                if (!cancelled) setState("static");
              },
            }),
      )
      .then((handle) => {
        if (!handle) return;
        if (cancelled) handle.dispose();
        else dispose = handle.dispose;
      })
      .catch(() => {
        if (!cancelled) setState("static");
      });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [logoUrl]);

  return (
    <div ref={ref} className={className} style={style} data-robot data-state={"pending" satisfies State}>
      {children}
    </div>
  );
}
