import { getTranslations } from "next-intl/server";
import { CountUp } from "@/components/ui/CountUp";
import { Reveal } from "@/components/ui/Reveal";
import { STATS } from "@/config/event";

/**
 * Social proof (Q2 of the brief: "эти цифры хорошо работают как социальное
 * доказательство"). Placed immediately after the hero, because the first
 * question a parent or a sponsor has is "is this real and how big is it".
 */
export async function Stats({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "stats" });

  return (
    <section className="relative bg-surface" aria-labelledby="stats-title">
      <div className="container-page py-10 sm:py-14">
        <h2 id="stats-title" className="sr-only">
          {t("title")}
        </h2>

        {/* One scoreboard rather than four cards: a single glass panel split
            by hairlines, figures lit from within. */}
        <dl className="tile grid grid-cols-2 overflow-hidden lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <Reveal key={stat.key} index={index}>
              {/* dt before dd in the DOM so the pair is announced in the right
                  order; `flex-col-reverse` puts the number on top visually,
                  which is the order the eye wants it in. */}
              {/* Sized off the tile's own width (container query units) so the
                  longest figure, "~2 500", never spills past the border in a
                  four-column row, whatever the viewport. Capped at 56px (the
                  5xl step) so the figures lead without dwarfing the hero's
                  headline right above them. */}
              <div
                className={
                  "@container flex h-full flex-col-reverse gap-2 border-line p-5 sm:p-7 " +
                  // Hairlines between cells: right edge on the first of each
                  // pair (phone) or every cell but the last (desktop), and a
                  // bottom edge on the first row of the 2×2 phone grid.
                  (index % 2 === 0 ? "border-r " : "") +
                  (index < 2 ? "border-b lg:border-b-0 " : "") +
                  (index === 1 ? "lg:border-r " : "")
                }
              >
                <dt className="font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-muted">{t(stat.key)}</dt>
                <dd className="score-figure tabular text-[clamp(1.5rem,16cqi,3rem)] font-bold leading-none text-content">
                  <CountUp value={stat.value} prefix={stat.prefix} />
                </dd>
              </div>
            </Reveal>
          ))}
        </dl>

        <p className="mt-5 max-w-2xl text-sm text-subtle">{t("note")}</p>
      </div>
    </section>
  );
}
