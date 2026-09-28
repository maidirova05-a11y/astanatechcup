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
    <section className="border-y border-line bg-surface" aria-labelledby="stats-title">
      <div className="container-page py-14 sm:py-16">
        <h2 id="stats-title" className="sr-only">
          {t("title")}
        </h2>

        <dl className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <Reveal key={stat.key} index={index}>
              {/* dt before dd in the DOM so the pair is announced in the right
                  order; `flex-col-reverse` puts the number on top visually,
                  which is the order the eye wants it in. */}
              {/* Sized off the tile's own width (container query units) so the
                  longest figure, "~2 500", never spills past the border in a
                  four-column row, whatever the viewport. */}
              <div className="tile tile-quiet @container flex h-full flex-col-reverse gap-1.5 p-5 sm:p-6">
                <dt className="text-sm font-medium text-muted">{t(stat.key)}</dt>
                <dd className="tabular font-display text-[clamp(2rem,22cqi,4.5rem)] font-extrabold leading-none text-brand">
                  <CountUp value={stat.value} prefix={stat.prefix} />
                </dd>
              </div>
            </Reveal>
          ))}
        </dl>

        <p className="mt-10 max-w-2xl text-sm text-subtle">{t("note")}</p>
      </div>
    </section>
  );
}
