import { cn } from "@/lib/utils";

/**
 * Wordmark placeholder.
 *
 * ⚠ The brief confirms a logo and brandbook exist (section 12) but they were
 * not supplied. This is a typographic stand-in built from the design system's
 * own tokens so the header is not empty — NOT a proposed identity. Drop the
 * real asset in `/public` and replace the body of this component; nothing else
 * imports the mark directly.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-baseline gap-1.5 font-display", className)}
      aria-hidden="true"
    >
      <span className="flex items-center gap-1.5">
        {/* Three stacked bars — a nod to a podium and to a circuit trace. */}
        <svg
          viewBox="0 0 22 22"
          className="h-[1.15em] w-[1.15em] shrink-0"
          fill="none"
          aria-hidden="true"
        >
          <rect x="1" y="12" width="5.5" height="9" rx="1.5" fill="var(--cyan-400)" />
          <rect x="8.25" y="6" width="5.5" height="15" rx="1.5" fill="var(--brand)" />
          <rect x="15.5" y="1" width="5.5" height="20" rx="1.5" fill="var(--accent)" />
        </svg>
        <span className="text-[1.05em] font-extrabold leading-none tracking-tight">
          Astana
          <span className="text-brand">Tech</span>
          Cup
        </span>
      </span>
    </span>
  );
}
