import {
  ATTRIBUTION_FIELDS,
  type AttributionField,
} from "@/lib/validation/registration";

/**
 * Browser-side marketing attribution: the visit's utm_* parameters, external
 * referrer and landing path, kept in sessionStorage until the registration
 * form submits them.
 *
 * Captured by <AttributionCapture /> in the [locale] layout on whatever page
 * the visit starts on — a campaign landing on /ru/categories?utm_… keeps its
 * parameters and its real landing path when the visitor goes on to the form.
 * The form calls the same function, so it still captures when it happens to
 * mount first.
 */

export type AttributionValues = Partial<Record<AttributionField, string>>;

/**
 * sessionStorage key for the visit's attribution. Session-scoped on purpose:
 * it is the SOURCE of this visit that matters, and a tab closed and reopened
 * next week from a different campaign is a different visit. localStorage
 * would credit the first campaign a device ever saw.
 */
const ATTRIBUTION_KEY = "atc.attribution";

const UTM_FIELDS = ATTRIBUTION_FIELDS.filter((f) => f.startsWith("utm_"));

/**
 * Read the campaign parameters once per visit.
 *
 * Order matters: a stored record wins, because by the time the visitor
 * reaches the form they have usually navigated away from the landing URL and
 * the utm_* parameters are gone. Only when nothing is stored is the current
 * URL, `document.referrer` and the current path captured and remembered.
 *
 * Everything here is best-effort. sessionStorage throws in some private
 * windows and when site data is blocked; a form that cannot record where the
 * visitor came from must still register the team, so every failure path
 * returns whatever was gathered and nothing else happens.
 */
export function readAttribution(): AttributionValues {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.sessionStorage.getItem(ATTRIBUTION_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        const out: AttributionValues = {};
        for (const field of ATTRIBUTION_FIELDS) {
          const value = (parsed as Record<string, unknown>)[field];
          if (typeof value === "string" && value) out[field] = value;
        }
        return out;
      }
    }
  } catch {
    // Unreadable or malformed — fall through and capture afresh.
  }

  const fresh: AttributionValues = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const field of UTM_FIELDS) {
      const value = params.get(field);
      if (value) fresh[field] = value.slice(0, 200);
    }
    // A same-origin referrer is a page of this site, not a traffic source.
    const referrer = document.referrer;
    if (referrer && !referrer.startsWith(window.location.origin)) {
      fresh.referrer = referrer.slice(0, 600);
    }
    fresh.landing_path = window.location.pathname.slice(0, 255);
  } catch {
    return fresh;
  }

  try {
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(fresh));
  } catch {
    // Storage unavailable: the values still ride along with this page's form.
  }
  return fresh;
}
