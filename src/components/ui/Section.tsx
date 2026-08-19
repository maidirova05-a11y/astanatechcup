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
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        // Headers never span the full width — long measure kills readability.
        align === "center" ? "mx-auto max-w-3xl" : "max-w-3xl",
        className,
      )}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Heading id={id} className="text-3xl md:text-4xl">
        {title}
      </Heading>
      {subtitle && (
        <p className="text-lg text-muted leading-relaxed">{subtitle}</p>
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
        "inline-flex items-center gap-2.5 text-2xs font-bold uppercase tracking-[0.18em] text-brand",
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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1",
        "text-2xs font-semibold uppercase tracking-wider",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
