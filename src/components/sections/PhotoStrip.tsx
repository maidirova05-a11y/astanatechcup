import { getTranslations } from "next-intl/server";
import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { PHOTOS, type PhotoKey } from "@/config/photos";
import { cn } from "@/lib/utils";

/**
 * A band of photos between two text-heavy stretches of the page.
 *
 * It carries no copy on purpose: its job is to give the eye a rest and show,
 * before another paragraph does, what the championship is made of — robots,
 * workbenches, kids building. They are last season's event photos (see
 * src/config/photos.ts).
 *
 * ── Rhythm ───────────────────────────────────────────────────────────────
 * Three landscape tiles, the middle one dropped a step, so the band reads as
 * photos laid on a table rather than a contact sheet. On a phone the first
 * tile spans the row and the other two share the next.
 * ─────────────────────────────────────────────────────────────────────────
 */

type Tile = { key: PhotoKey; shape: string; position?: string };

const TILES: Tile[] = [
  { key: "coding", shape: "col-span-2 aspect-[16/9] sm:col-span-1 sm:aspect-[4/3]" },
  { key: "gripper", shape: "aspect-[4/3] sm:mt-8" },
  { key: "projectTable", shape: "aspect-[4/3]" },
];

export async function PhotoStrip({
  locale,
  className,
}: {
  locale: string;
  className?: string;
}) {
  const t = await getTranslations({ locale, namespace: "photos" });

  return (
    <section aria-label={t("stripLabel")} className={cn("section-tight overflow-hidden", className)}>
      <div className="container-wide">
        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 sm:gap-4 lg:gap-5">
          {TILES.map(({ key, shape, position }) => (
            <PhotoFrame
              key={key}
              photo={PHOTOS[key]}
              alt={t(key)}
              quiet
              sizes="(min-width: 640px) 30vw, 50vw"
              className={shape}
              imageClassName={position}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
