import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  BRAND_ASSETS,
  EVENT,
  EVENT_YEAR,
  QUALIFIER_START,
  QUALIFIER_END,
} from "@/config/event";
import { eventDay, eventMonth } from "@/lib/utils";

/**
 * The social share card.
 *
 * The brief says the audience arrives predominantly from Instagram and
 * WhatsApp. Every one of those links was rendering as a blank grey rectangle,
 * because `twitter:card: summary_large_image` was declared with no image behind
 * it. This is the highest-leverage SEO fix on the site and it is not really SEO
 * at all — it is the first impression of every shared link.
 *
 * ── Why the text is Latin-only ────────────────────────────────────────────
 * `ImageResponse` rasterises with Satori, which needs the actual font binary
 * for every glyph it draws. The site's faces are self-hosted through
 * `next/font`, which hashes them into `.next` rather than leaving a readable
 * file to hand to Satori — and Cyrillic outside the default font renders as
 * tofu, silently, in a picture nobody checks before it is on a thousand phones.
 *
 * So the card carries the mark, the name, the year, the dates and the city, all
 * of which are Latin or numerals in all three locales. It is deliberately the
 * same card for ru / kk / en. A localised subtitle would be nicer; a subtitle
 * of empty boxes would be much worse.
 * ──────────────────────────────────────────────────────────────────────────
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const alt = `${EVENT.name} ${EVENT_YEAR}`;

/** Read once at module scope; the file ships in the deployment. */
const logo = readFileSync(
  join(process.cwd(), "public", "brand", "astanatechcup.png"),
).toString("base64");

/** Latin month abbreviations — locale-independent by design, see above. */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function OpengraphImage() {
  const dates = `${eventDay(QUALIFIER_START)}–${eventDay(QUALIFIER_END)} ${
    MONTHS[eventMonth(QUALIFIER_START) - 1]
  } ${EVENT_YEAR}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          // The logo's own plate border — a share card that reads as the mark
          // enlarged, which is the same move the dark sections make.
          backgroundColor: "#00243c",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Gold rule across the top — the trophy hue, and the one element that
            makes the card recognisable as a thumbnail. */}
        <div style={{ display: "flex", height: 12, backgroundColor: "#fcd800", borderRadius: 6 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* The plate rule, from DESIGN.md: the mark is drawn as a white plate
              with a #00243c border, so on a #00243c ground its outline vanishes
              and the pixel letters sit on nothing. `<Logo plate />` solves this
              everywhere else on the site; this is the same fix, by hand. */}
          <div
            style={{
              display: "flex",
              background: "#ffffff",
              padding: "18px 26px",
              borderRadius: 24,
              alignSelf: "flex-start",
            }}
          >
            {/* Satori rasterises a plain <img>; next/image renders a client-side
                component that does not exist inside an ImageResponse. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${logo}`}
              width={380}
              height={Math.round(
                (380 * BRAND_ASSETS.championship.height) / BRAND_ASSETS.championship.width,
              )}
              alt={alt}
            />
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.03em",
            }}
          >
            {EVENT.name} {EVENT_YEAR}
          </div>

          <div style={{ display: "flex", fontSize: 34, color: "#b8c7ff" }}>
            National Robotics &amp; Tech Championship of Kazakhstan
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              backgroundColor: "#a800b4",
              color: "#ffffff",
              fontSize: 30,
              fontWeight: 700,
              padding: "14px 28px",
              borderRadius: 999,
            }}
          >
            {dates}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#ffffff" }}>
            {EVENT.city}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
