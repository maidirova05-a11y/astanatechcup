import Image from "next/image";
import { cn } from "@/lib/utils";
import { BRAND_ASSETS } from "@/config/event";

/**
 * `sizes` for a logo drawn `h-full w-auto` inside a box of `heightPx` CSS
 * pixels: its widest rendered width, from the asset's aspect ratio.
 *
 * Without `sizes`, next/image treats a 1200-px-wide intrinsic `width` as the
 * display width and offers 1200w / 3840w — a 36-px-tall header mark was
 * downloaded at up to 3840 px on a phone, and preloaded at that size on every
 * page. With it the srcset is width-described and the browser fetches roughly
 * the rendered size times the device pixel ratio.
 */
function logoSizes(asset: { width: number; height: number }, heightPx: number): string {
  return `${Math.ceil((heightPx * asset.width) / asset.height)}px`;
}

/**
 * Pin the box to the master file's ratio. `w-auto` otherwise takes it from
 * whichever srcset candidate loaded, and a 96-px rendition rounds 1200×506 to
 * 96×40 — a 1-px wider logo that nudges the whole header nav sideways.
 */
function logoRatio(asset: { width: number; height: number }) {
  return { aspectRatio: `${asset.width} / ${asset.height}` };
}

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
  height,
  plate = false,
  priority = false,
}: {
  className?: string;
  /** Tallest the box in `className` gets, in CSS px (h-9 → 36). Sets `sizes`. */
  height: number;
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
      sizes={logoSizes(BRAND_ASSETS.championship, height)}
      style={logoRatio(BRAND_ASSETS.championship)}
      priority={priority}
      className="h-full w-auto object-contain"
    />
  );

  if (!plate) {
    return <span className={cn("inline-flex items-center", className)}>{image}</span>;
  }

  return (
    <span
      className={cn(
        // px-3 py-2, not px-2 py-1 plus p-1 on the image: the same box, with
        // the inset on the plate so the image box keeps the logo's ratio
        // (see logoRatio — on a padded image it would include the padding).
        "inline-flex items-center rounded-md bg-white px-3 py-2",
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
  height,
  plate = false,
}: {
  asset: { src: string; alt: string; width: number; height: number };
  className?: string;
  /** Tallest the box in `className` gets, in CSS px (h-9 → 36). Sets `sizes`. */
  height: number;
  plate?: boolean;
}) {
  const image = (
    <Image
      src={asset.src}
      alt={asset.alt}
      width={asset.width}
      height={asset.height}
      sizes={logoSizes(asset, height)}
      style={logoRatio(asset)}
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
