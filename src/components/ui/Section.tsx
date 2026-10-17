import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Section shell and header.
 *
 * Every section on the page goes through these, which is what keeps the
 * vertical rhythm and the eyebrow → title → subtitle hierarchy identical
 * from top to bottom. Consistency at this level is most of what makes a
 * landing page feel designed rather than assembled.
 */

type SectionProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  /** Dark punctuation section — flips the whole semantic token layer. */
  dark?: boolean;
  tone?: "default" | "muted";
  tight?: boolean;
  container?: "page" | "wide" | "prose";
  /** Labelled by its own heading, for screen-reader landmark navigation. */
  labelledBy?: string;
};

export function Section({
  id,
  children,
  className,
  dark = false,
  tone = "default",
  tight = false,
  container = "page",
  labelledBy,
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        tight ? "section-tight" : "section",
        dark && "on-dark",
        !dark && tone === "muted" && "bg-surface-muted",
        "relative",
        className,
      )}
    >
      <div
        className={
          container === "wide"
            ? "container-wide"
            : container === "prose"
              ? "container-prose"
              : "container-page"
        }
      >
        {children}
      </div>
    </section>
  );
}

type SectionHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  id?: string;
  align?: "start" | "center";
  className?: string;
  as?: "h2" | "h1";
};

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  id,
  align = "start",
  className,
  as: Heading = "h2",
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        // Headers never span the full width — long measure kills readability.
        align === "center" ? "mx-auto max-w-3xl" : "max-w-3xl",
        className,
      )}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      {/* One fluid size, 26px → 40px (`--text-h2` in globals.css), instead of
          stepping from text-3xl to text-4xl at `md`. The step jumped ~10px at
          a single breakpoint and topped out at 44px, which on a page with a
          dozen sections read as every heading shouting. 40px still out-ranks
          every card title. */}
      <Heading id={id} className="text-h2">
        {title}
      </Heading>
      {subtitle && (
        // Narrower than the title: ~40rem keeps the subtitle near 70
        // characters a line, where body copy is comfortable to read.
        <p
          className={cn(
            "mt-1 max-w-[40rem] text-base leading-relaxed text-muted md:text-lg",
            align === "center" && "mx-auto",
          )}
        >
          {subtitle}
        </p>
      )}
    </header>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "label-caps inline-flex items-center gap-2.5 text-brand",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-block h-px w-6 bg-current opacity-60"
      />
      {children}
    </p>
  );
}

/** Small rounded chip used for metadata (age, team size, format, tags). */
export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "brand" | "warning";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-muted text-muted border-line",
    accent: "bg-accent text-on-accent border-transparent",
    brand: "bg-brand text-on-brand border-transparent",
    warning: "bg-warning-surface text-warning border-transparent",
  } as const;

  return (
    <span
      className={cn(
        "label-caps inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
