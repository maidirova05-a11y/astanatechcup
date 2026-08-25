import { ImageResponse } from "next/og";

/**
 * Favicon.
 *
 * Google shows a site's favicon next to the URL in mobile search results, so an
 * unset one is a visible gap in exactly the place this page is trying to look
 * credible. The supplied mark is a 1200×506 plate — letterboxed into a 32px
 * square it is an unreadable smudge — so this draws the initial in the brand's
 * own colours instead: the logo's navy, the trophy's gold, no third colour.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 22,
          fontWeight: 800,
          fontFamily: "sans-serif",
          borderRadius: 7,
        }}
      >
        A
        {/* The gold bar doubles as the crossbar of the A at this size, which is
            what keeps it reading as a mark rather than as a letter in a box. */}
        <div
          style={{
            position: "absolute",
            bottom: 5,
            width: 16,
            height: 3,
            borderRadius: 2,
            background: "#fcd800",
          }}
        />
      </div>
    ),
    size,
  );
}
