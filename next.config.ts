import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Don't advertise the stack. Cheap, and removes one fingerprinting signal.
  poweredByHeader: false,

  // Source maps are useful in the browser devtools of an attacker too.
  productionBrowserSourceMaps: false,

  images: {
    // Only these two modern formats; no SVG through the optimizer (an
    // attacker-supplied SVG is a script execution vector).
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowSVG: false,
    // No remotePatterns: every image is served from our own origin, which
    // keeps `img-src 'self'` in the CSP and leaks nothing to third parties.
    remotePatterns: [],
  },

  // Security headers live in src/proxy.ts, because the Content-Security-Policy
  // needs a per-request nonce and static headers here cannot produce one.
  // Only headers that are genuinely request-independent belong below.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Opt out of Google's FLoC/Topics-style interest cohorts.
          { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
        ],
      },
      // Note: no Cache-Control override for /_next/static — Next.js already
      // serves hashed build assets as immutable, and setting it by hand makes
      // the dev server warn and can break HMR.
    ];
  },
};

/**
 * Deny every powerful browser feature the site does not use. `payment` is
 * denied deliberately: the entry fee is collected on the payment provider's
 * own hosted page, never in our document, so nothing here should ever be
 * allowed to invoke the Payment Request API.
 */
const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=(self)",
  "camera=()",
  "display-capture=()",
  "encrypted-media=()",
  "fullscreen=(self)",
  "geolocation=()",
  "gyroscope=()",
  "interest-cohort=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

export default withNextIntl(nextConfig);
