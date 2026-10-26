/**
 * Registration field limits and form field names — the parts of the
 * registration contract the BROWSER needs, with no imports at all.
 *
 * They used to live in `./registration.ts` next to the zod schema. A client
 * component importing only `LIMITS` still evaluated that whole module, and
 * zod's schema builders are not tree-shakable, so every page paid ~35 KB of
 * gzipped zod for a handful of numbers: <AttributionCapture /> sits in the
 * [locale] layout and reached it through `@/lib/attribution`.
 *
 * Keep this file import-free and schema-free. `scripts/check-client-bundle.mjs`
 * fails the build if a client component's import graph reaches `zod`.
 */

export const LIMITS = {
  teamName: { min: 2, max: 80 },
  organization: { min: 2, max: 140 },
  city: { min: 2, max: 80 },
  memberName: { min: 2, max: 80 },
  contactName: { min: 2, max: 80 },
  email: { max: 254 },
  phone: { min: 10, max: 20 },
  comment: { max: 1000 },
} as const;

/* ── Marketing attribution ──────────────────────────────────────────────── */

export const ATTRIBUTION_LIMITS = {
  utm: 120,
  referrer: 500,
  landingPath: 255,
} as const;

/** Form field names, shared by the client (hidden inputs) and the server parser. */
export const ATTRIBUTION_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
  "landing_path",
] as const;

export type AttributionField = (typeof ATTRIBUTION_FIELDS)[number];
