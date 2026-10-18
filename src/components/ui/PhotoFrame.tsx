import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Photo } from "@/config/photos";

/**
 * A photo in the site's tile frame.
 *
 * The same 2px ink outline and hard bottom edge as every card, so a photo
 * reads as one more physical tile on the table rather than a hole cut into
 * the page. The caller sets the shape (`aspect-*` or a height) on
 * `className`; the image fills it with `object-cover`.
 *
 * `sizes` matters: without it next/image assumes 100vw and ships a 2–3×
 * larger file than a card-sized slot needs.
 */
export function PhotoFrame({
  photo,
  alt,
  sizes,
  className,
  imageClassName,
  quiet = false,
  priority = false,
}: {
  photo: Photo;
  alt: string;
  sizes: string;
  className?: string;
  /** e.g. `object-[50%_30%]` to keep a subject's face in frame. */
  imageClassName?: string;
  /** Half-height bottom edge, for photos inside dense grids. */
  quiet?: boolean;
  priority?: boolean;
}) {
  return (
    <div className={cn("tile relative overflow-hidden", quiet && "tile-quiet", className)}>
      <Image
        src={photo.src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-cover", imageClassName)}
      />
    </div>
  );
}
