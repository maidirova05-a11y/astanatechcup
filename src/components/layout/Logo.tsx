import Image from "next/image";
import { cn } from "@/lib/utils";
import { BRAND_ASSETS } from "@/config/event";

/**
 * The championship wordmark — the real supplied asset, not a stand-in.
 *
 * ── Why the `plate` prop exists ──────────────────────────────────────────
 * The mark is drawn as a white plate with a deep-navy border (#00243c), and
 * that navy is the same colour as the site's dark sections. Dropped straight
 * onto the footer it would lose its outline entirely and the pixel letters
 * would sit on nothing.
 *
 * `plate` renders it on its own white rounded panel, which is not a
 * workaround — it is how the mark is constructed. Use it on any `.on-dark`
 * surface.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Sizing: the caller sets a height (`h-9`, `h-8`) and the width follows from
 * the intrinsic aspect ratio, so the mark can never be stretched.
 */
export function Logo({
  className,
  plate = false,
  priority = false,
}: {
  className?: string;
  /** Render on a white panel. Required on dark surfaces. */
  plate?: boolean;
  /** Set on the header logo: it is above the fold on every page. */
  priority?: boolean;
}) {
  const image = (
    <Image
      src={BRAND_ASSETS.championship.src}
      alt={BRAND_ASSETS.championship.alt}
      width={BRAND_ASSETS.championship.width}
      height={BRAND_ASSETS.championship.height}
      priority={priority}
      className={cn("h-full w-auto object-contain", plate && "p-1")}
    />
  );

  if (!plate) {
    return <span className={cn("inline-flex items-center", className)}>{image}</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-white px-2 py-1",
        className,
      )}
    >
      {image}
    </span>
  );
}

/**
 * Organiser and partner marks. Both are supplied as dark-on-transparent, so
 * on a dark surface they need the same white-plate treatment as the
 * championship mark.
 */
export function OrganiserLogo({
  asset,
  className,
  plate = false,
}: {
  asset: { src: string; alt: string; width: number; height: number };
  className?: string;
  plate?: boolean;
}) {
  const image = (
    <Image
      src={asset.src}
      alt={asset.alt}
      width={asset.width}
      height={asset.height}
      className="h-full w-auto object-contain"
    />
  );

  return (
    <span
      className={cn(
        "inline-flex items-center",
        plate && "rounded-md bg-white px-3 py-2",
        className,
      )}
    >
      {image}
    </span>
  );
}
