import type { ReactNode } from "react";
import { Warning } from "@/components/ui/icons";

/**
 * Shared shell for the privacy policy and the terms of participation.
 *
 * The `notice` slot carries the draft warning. Both documents are drafted from
 * the brief, not reviewed by a lawyer, and the site processes children's data —
 * so the caveat is rendered prominently rather than buried, and it must stay
 * until the organiser's counsel signs the text off.
 */
export function LegalPage({
  title,
  updated,
  notice,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  notice: string;
  intro?: string;
  sections: { title: string; body: ReactNode }[];
}) {
  return (
    <article className="section">
      <div className="container-prose flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-4xl">{title}</h1>
          <p className="text-sm text-subtle">{updated}</p>
        </header>

        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-surface p-5">
          <Warning className="mt-0.5 shrink-0 text-lg text-warning" />
          <p className="text-sm leading-relaxed">{notice}</p>
        </div>

        {intro && <p className="text-lg leading-relaxed text-muted">{intro}</p>}

        <div className="flex flex-col gap-8">
          {sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-2.5">
              <h2 className="text-xl">{section.title}</h2>
              <p className="leading-relaxed text-muted">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
