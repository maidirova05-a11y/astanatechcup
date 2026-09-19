import { ImageResponse } from "next/og";

/**
 * Touch icon for iOS home screens and the several crawlers and link previewers
 * that reach for `apple-touch-icon` before anything else.
 *
 * The site had only the 32px favicon, so saving the page to a phone's home
 * screen produced a screenshot of the hero — unreadable at icon size — and a
 * shortcut nobody keeps. A championship people are told about by phone, in a
 * WhatsApp message, should survive that gesture.
 *
 * Same mark as `icon.tsx`, scaled rather than redrawn: the brand's navy, the
 * trophy's gold, no third colour. The supplied logo is a 1200x506 plate that
 * letterboxes into an unreadable smudge at this size, which is why the mark is
 * drawn rather than cropped.
 *
 * `next/og` renders this once at build time and Next links it automatically —
 * no manifest entry and no hand-maintained <link> tag to fall out of date.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: "#00243c",
          color: "#ffffff",
          fontSize: 124,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        A
        {/* Doubles as the crossbar of the A, which is what keeps the mark
            reading as a mark rather than as a letter in a box. */}
        <div
          style={{
            position: "absolute",
            bottom: 30,
            width: 90,
            height: 16,
            borderRadius: 10,
            background: "#fcd800",
          }}
        />
      </div>
    ),
    size,
  );
}
