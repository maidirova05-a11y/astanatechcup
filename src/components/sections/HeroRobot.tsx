import Image from "next/image";
import type { CSSProperties } from "react";
import { BRAND_ASSETS } from "@/config/event";
import { HeroRobot3D } from "./HeroRobot3D";

/**
 * The championship mascot, in 3D: every part flies in and locks onto the
 * last, the robot powers on, the logo sign pops in between its hands, then it
 * idles — floats, sways, tilts its head, blinks, wobbles its antenna.
 *
 * ── Where it comes from ──────────────────────────────────────────────────
 * scripts/blender/robot_assembly.py builds the scene. `--export` writes
 * public/models/robot.glb (the build clip) and `--poster` renders
 * public/models/robot-poster.png (the finished robot, transparent, through
 * the same camera). HeroRobotScene plays the clip in three.js and runs the
 * idle procedurally; HeroRobot3D loads it lazily after mount.
 *
 * ── Fallback ─────────────────────────────────────────────────────────────
 * This file stays a server component. The poster is server-rendered inside
 * the square stage, invisible at first, and fades in by itself after a delay
 * (CSS only), so if three.js is slow, blocked or WebGL is missing, the stage
 * still ends on the finished robot with no layout shift. Once WebGL draws its
 * first frame the poster is hidden. Under reduced motion (or Save-Data) the
 * 3D is never loaded: the global reduced-motion rule shows the poster at once.
 *
 * The build log reads the same frame table as the Blender script, and its CSS
 * stays paused until the 3D actually starts playing, so the caption always
 * matches the picture however long the model took to arrive.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Build frames at 30fps — `T` in robot_assembly.py. */
const FRAME = {
  footL: 8,
  torso: 25,
  armL: 35,
  head: 48,
  eyes: 71,
  logo: 93,
} as const;

const at = (frame: number) => Math.round((frame * 1000) / 30);
const ms = (n: number) => `${n}ms`;

/** Captions for the build log, each shown from its start until the next. */
const LOG = [
  { key: "chassis", at: at(FRAME.footL) },
  { key: "body", at: at(FRAME.torso) },
  { key: "arms", at: at(FRAME.armL) },
  { key: "head", at: at(FRAME.head) },
  { key: "boot", at: at(FRAME.eyes) },
] as const;

const READY_AT = at(FRAME.logo);

export type AssemblyLabels = Record<(typeof LOG)[number]["key"] | "ready", string>;

/**
 * The caption under the stage: what is being built right now, then "ready".
 * Decorative — the picture and the poster's alt text carry the meaning — so it
 * is hidden from assistive technology rather than announced five times.
 */
function BuildLog({ labels }: { labels: AssemblyLabels }) {
  return (
    <div aria-hidden="true" className="mx-auto mt-2 w-full max-w-xs">
      {/* The captions are stacked in one grid cell rather than absolutely
          positioned, so a label that wraps on a narrow phone grows the row
          instead of running into the progress bar below it. */}
      <div className="grid min-h-6 place-items-center text-center text-2xs font-bold uppercase leading-snug tracking-[0.14em]">
        {LOG.map((step, i) => {
          const end = i + 1 < LOG.length ? LOG[i + 1].at : READY_AT;
          return (
            <span
              key={step.key}
              className="log-step col-start-1 row-start-1 text-brand"
              style={{ "--d": ms(step.at), "--len": ms(end - step.at) } as CSSProperties}
            >
              {labels[step.key]}
            </span>
          );
        })}
        <span
          className="log-ready col-start-1 row-start-1 inline-flex items-center justify-center gap-2 text-accent"
          style={{ "--d": ms(READY_AT) } as CSSProperties}
        >
          <span className="size-2 shrink-0 rounded-full bg-accent" />
          {labels.ready}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="build-progress h-full rounded-full"
          style={{ "--d": ms(LOG[0].at), "--len": ms(READY_AT - LOG[0].at) } as CSSProperties}
        />
      </div>
    </div>
  );
}

export function HeroRobot({
  className,
  style,
  labels,
}: {
  className?: string;
  style?: CSSProperties;
  labels: AssemblyLabels;
}) {
  return (
    <HeroRobot3D className={className} style={style} logoUrl={BRAND_ASSETS.championship.src}>
      <div className="assembly-stage relative mx-auto aspect-square w-full max-w-lg">
        {/* Blueprint frame: corner brackets and a scan line that sweeps the
            stage while the robot is being built. */}
        <div aria-hidden="true" className="pointer-events-none absolute -inset-3 sm:-inset-5">
          <span className="stage-corner left-0 top-0 border-l-[3px] border-t-[3px]" />
          <span className="stage-corner right-0 top-0 border-r-[3px] border-t-[3px]" />
          <span className="stage-corner bottom-0 left-0 border-b-[3px] border-l-[3px]" />
          <span className="stage-corner bottom-0 right-0 border-b-[3px] border-r-[3px]" />
          <span
            className="scan-line"
            style={{ "--d": ms(LOG[0].at), "--len": ms(READY_AT - LOG[0].at) } as CSSProperties}
          />
        </div>

        {/* The finished robot as a still: the fallback, and what assistive
            technology is told the stage shows. */}
        <div data-robot-poster className="robot-poster absolute inset-0">
          <Image
            src="/models/robot-poster.png"
            alt={BRAND_ASSETS.championship.alt}
            width={720}
            height={720}
            sizes="(max-width: 640px) 80vw, (max-width: 1536px) 320px, 448px"
            className="size-full select-none object-contain"
            draggable={false}
          />
        </div>

        {/* HeroRobotScene appends its canvas here. */}
        <div data-robot-host className="pointer-events-none absolute inset-0" />
      </div>

      <BuildLog labels={labels} />
    </HeroRobot3D>
  );
}
