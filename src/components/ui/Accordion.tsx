import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * FAQ accordion built on native `<details>` / `<summary>`.
 *
 * No JavaScript, no ARIA to get wrong, no focus management to maintain, and it
 * works before hydration — which for a page whose main job is answering a
 * worried parent's questions is exactly the right trade. Browsers also expose
 * `<details>` content to in-page find, so Ctrl+F still locates an answer
 * inside a collapsed panel.
 */

type AccordionItemProps = {
  question: string;
  answer: ReactNode;
  /** Open the first item so the pattern is obvious at a glance. */
  defaultOpen?: boolean;
  className?: string;
};

export function AccordionItem({
  question,
  answer,
  defaultOpen = false,
  className,
}: AccordionItemProps) {
  return (
    <details
      // `name` makes browsers behave as a single-open accordion natively.
      name="faq"
      open={defaultOpen}
      className={cn(
        "group border-b border-line last:border-b-0",
        "[&_summary::-webkit-details-marker]:hidden",
        className,
      )}
    >
      <summary
        className={cn(
          // 17–18px semibold from `md`, 16px on phones: a question is a
          // label to scan, not a heading, and ten of them in a row at 18px
          // made the FAQ read louder than the section title above it.
          "flex cursor-pointer list-none items-start justify-between gap-4 py-4 md:gap-6 md:py-5",
          "text-base font-semibold leading-snug md:text-lg",
          "transition-colors duration-200 hover:text-brand",
        )}
      >
        <span>{question}</span>
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
            "border border-line-strong text-muted",
            "transition-transform duration-300 ease-out-expo group-open:rotate-45",
          )}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </summary>
      {/* The right inset keeps the answer clear of the toggle column on wide
          screens; on a phone that column is only 28px and the inset would
          cost a tenth of the measure, so it starts at `sm`. */}
      <div className="max-w-[44rem] pb-5 text-muted leading-relaxed sm:pr-12 md:pb-6">{answer}</div>
    </details>
  );
}

export function Accordion({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-line", className)}>{children}</div>;
}
