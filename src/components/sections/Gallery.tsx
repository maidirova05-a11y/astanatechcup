import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { buttonClasses, EXTERNAL_LINK_PROPS } from "@/components/ui/Button";
import { Play } from "@/components/ui/icons";
import { TRAILER_URL } from "@/config/event";

/**
 * Gallery / trailer.
 *
 * Section 8 of the brief confirms photo, video and a trailer all exist, but
 * none were supplied. Rather than ship a grid of stock photography — which
 * would misrepresent the event — this renders a labelled set of placeholders
 * sized to the final layout, so dropping the real assets in changes nothing
 * about the page's geometry.
 *
 * When files arrive: put them in /public/gallery, replace the placeholder
 * `<div>`s with next/image, and set TRAILER_URL in src/config/event.ts.
 */
export async function Gallery({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "gallery" });

  return (
    <Section id="gallery" labelledBy="gallery-title">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeader
          eyebrow={t("eyebrow")}
          id="gallery-title"
          title={t("title")}
          subtitle={t("subtitle")}
        />

        {TRAILER_URL && (
          <a
            href={TRAILER_URL}
            {...EXTERNAL_LINK_PROPS}
            className={buttonClasses({ variant: "outline", size: "md", className: "shrink-0" })}
          >
            <Play className="text-base" />
            {t("watchTrailer")}
          </a>
        )}
      </div>

      {/* Asymmetric mosaic: one wide hero tile plus four supporting tiles.
          Keeps a gallery from reading as a uniform contact sheet. */}
      <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          "col-span-2 row-span-2 aspect-[4/3] lg:aspect-[16/10]",
          "aspect-square",
          "aspect-square",
          "aspect-square",
          "aspect-square",
        ].map((shape, index) => (
          <div
            key={index}
            className={`${shape} flex items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-muted`}
          >
            <span
              aria-hidden="true"
              className="grid-texture size-full opacity-70"
            />
          </div>
        ))}
      </div>

      <p className="mt-5 text-sm text-subtle">{t("empty")}</p>
    </Section>
  );
}
