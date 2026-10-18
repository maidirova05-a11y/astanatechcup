import { getTranslations } from "next-intl/server";
import { Section, SectionHeader } from "@/components/ui/Section";
import { buttonClasses, EXTERNAL_LINK_PROPS } from "@/components/ui/Button";
import { Play } from "@/components/ui/icons";
import { TRAILER_URL } from "@/config/event";
import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { GALLERY, PHOTOS } from "@/config/photos";

/**
 * Gallery / trailer: last season, in photos.
 *
 * Real frames from AstanaTechCup 2026 (see src/config/photos.ts): one wide
 * lead photo and four supporting ones. Set TRAILER_URL in
 * src/config/event.ts and the trailer button appears beside the header.
 */
export async function Gallery({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "gallery" });
  const tp = await getTranslations({ locale, namespace: "photos" });

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
          Keeps a gallery from reading as a uniform contact sheet. The
          supporting tiles are 4:3 rather than square so the whole block stays
          under one screen tall on a laptop instead of towering over the page. */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4 lg:grid-cols-4">
        {GALLERY.map((key, index) => (
          <PhotoFrame
            key={key}
            photo={PHOTOS[key]}
            alt={tp(key)}
            quiet
            sizes={index === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
            className={
              index === 0
                ? "col-span-2 row-span-2 aspect-[4/3] sm:aspect-[16/9] lg:aspect-auto"
                : "aspect-[4/3]"
            }
          />
        ))}
      </div>

      <p className="mt-4 text-sm text-subtle">{t("caption")}</p>
    </Section>
  );
}
