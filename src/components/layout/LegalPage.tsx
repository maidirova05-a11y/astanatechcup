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
      {/* A document, not a landing section: the title sits one step below
          the page's section headings and the section titles one below that,
          so nine headings in a row read as a contents list, not a stack of
          banners. */}
      <div className="container-prose flex flex-col gap-7 md:gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl">{title}</h1>
          <p className="text-sm text-subtle">{updated}</p>
        </header>

        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-surface p-4 sm:p-5">
          <Warning className="mt-0.5 shrink-0 text-lg text-warning" />
          <p className="text-sm leading-relaxed">{notice}</p>
        </div>

        {intro && <p className="text-base leading-relaxed text-muted md:text-lg">{intro}</p>}

        <div className="flex flex-col gap-7">
          {sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-2">
              <h2 className="text-lg md:text-xl">{section.title}</h2>
              <p className="leading-relaxed text-muted">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
