import { z } from "zod";
import {
  AGE_BOUNDS,
  DISCIPLINE_IDS,
  MAX_TEAM_SIZE,
  getDiscipline,
} from "@/config/event";
import { REGIONS } from "@/config/regions";
import { ATTRIBUTION_LIMITS, LIMITS } from "./registration-fields";

// Re-exported so server code keeps one import site. Client components must
// import these from `./registration-fields` directly — see that file.
export {
  ATTRIBUTION_FIELDS,
  ATTRIBUTION_LIMITS,
  LIMITS,
  type AttributionField,
} from "./registration-fields";

/**
 * The single validation schema. It runs on the server, on the raw submission,
 * and its verdict is final — a hand-crafted POST that skips the React form hits
 * identical rules.
 *
 * The browser never loads this module: the form's own checks are HTML
 * constraint validation built from the same `LIMITS`, which live in the
 * zod-free `./registration-fields` so that zod stays out of the client bundle.
 *
 * Posture is reject-don't-sanitize: values are normalised only where it is
 * genuinely lossless (trimming, lower-casing an email), never "cleaned up" by
 * stripping characters, which tends to turn a malicious payload into a
 * different, still-malicious payload.
 */

/**
 * Control characters and Unicode direction overrides. The latter are how a
 * "team name" can be made to render as something entirely different in an
 * admin panel or an exported spreadsheet.
 */
const FORBIDDEN_CHARS =
  /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/u;

const cleanText = (min: number, max: number, messageKey: string) =>
  z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(min, messageKey)
        .max(max, messageKey)
        .refine((value) => !FORBIDDEN_CHARS.test(value), messageKey),
    );

/**
 * Kazakh, Russian and Latin letters, plus the punctuation that legitimately
 * appears in names ("Ай-Сұлу", "O'Brien", "Анна-Мария").
 */
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'’\-.]*$/u;

const personName = (messageKey: string) =>
  cleanText(LIMITS.memberName.min, LIMITS.memberName.max, messageKey).pipe(
    z.string().regex(NAME_PATTERN, messageKey),
  );

/**
 * Kazakh numbers are +7 7XX XXX XX XX. Accepted loosely (spaces, dashes and
 * parentheses are stripped) then required to be 10–15 digits with an optional
 * leading +, which is the E.164 range.
 */
const phone = z
  .string()
  .transform((value) => value.replace(/[\s()\-.]/g, ""))
  .pipe(
    z
      .string()
      .min(LIMITS.phone.min, "phoneInvalid")
      .max(LIMITS.phone.max, "phoneInvalid")
      .regex(/^\+?\d{10,15}$/, "phoneInvalid"),
  );

const email = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(1, "emailRequired")
      .max(LIMITS.email.max, "emailInvalid")
      .email("emailInvalid")
      // Belt and braces against header injection in the confirmation mail.
      .refine((value) => !/[\r\n,;<>]/.test(value), "emailInvalid"),
  );

/* ── Marketing attribution ──────────────────────────────────────────────── */

/**
 * Attribution values are the ONE place this schema sanitises instead of
 * rejecting. They are not typed by the applicant — they are copied out of the
 * URL and `document.referrer` by the form — and a campaign tag that is too
 * long or carries a stray control character must never cost a team its
 * registration. So: control and bidi characters are stripped, whitespace is
 * collapsed, the value is truncated to the column width, and anything empty
 * becomes null. The result is never shown back to a visitor.
 */
const stripControl = (value: string) =>
  value.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/gu, "");

/** Truncate by code points, so an emoji is never cut in half. */
const truncate = (value: string, max: number) => Array.from(value).slice(0, max).join("");

/**
 * `z.unknown()` rather than `z.string()`: whatever arrives — a number from a
 * hand-built request, an array — becomes null instead of a validation error.
 */
const attributionText = (max: number) =>
  z.unknown().transform((value): string | null => {
    if (typeof value !== "string") return null;
    // Whitespace first, so "a\tb" becomes "a b" rather than "ab".
    const collapsed = stripControl(value.replace(/\s+/g, " ")).replace(/ {2,}/g, " ").trim();
    const clean = truncate(collapsed, max).trim();
    return clean.length > 0 ? clean : null;
  });

/**
 * `document.referrer`, reduced to origin + path. The query string is dropped
 * on purpose: another site's URL parameters can carry its session tokens or
 * its own visitor ids, none of which belongs in this database. Anything that
 * is not an http(s) URL becomes null.
 */
const referrerUrl = z
  .unknown()
  .transform((value): string | null => {
    if (typeof value !== "string") return null;
    const clean = stripControl(value).trim();
    if (!clean) return null;
    let url: URL;
    try {
      url = new URL(clean);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const reduced = truncate(`${url.origin}${url.pathname}`, ATTRIBUTION_LIMITS.referrer);
    return reduced.length > 0 ? reduced : null;
  });

/** A site-relative path such as "/ru" or "/kk/categories" — nothing else. */
const landingPath = z
  .unknown()
  .transform((value): string | null => {
    if (typeof value !== "string") return null;
    // Path only: a query string would just repeat the utm_* fields, and a
    // fragment is never sent to a server anyway.
    const clean = truncate(
      stripControl(value).trim().split(/[?#]/, 1)[0],
      ATTRIBUTION_LIMITS.landingPath,
    );
    // One leading slash, no scheme, no "//host" protocol-relative form.
    return /^\/(?!\/)\S*$/.test(clean) ? clean : null;
  });

export const attributionSchema = z.object({
  utm_source: attributionText(ATTRIBUTION_LIMITS.utm),
  utm_medium: attributionText(ATTRIBUTION_LIMITS.utm),
  utm_campaign: attributionText(ATTRIBUTION_LIMITS.utm),
  utm_content: attributionText(ATTRIBUTION_LIMITS.utm),
  utm_term: attributionText(ATTRIBUTION_LIMITS.utm),
  referrer: referrerUrl,
  landing_path: landingPath,
});

export type Attribution = z.output<typeof attributionSchema>;

export const memberSchema = z.object({
  name: personName("memberNameRequired"),
  age: z.coerce
    .number({ message: "memberAgeRequired" })
    .int("memberAgeRequired")
    .min(AGE_BOUNDS.min, "memberAgeRange")
    .max(AGE_BOUNDS.max, "memberAgeRange"),
});

export type MemberInput = z.infer<typeof memberSchema>;

/** Checkbox values arrive as "on" / "true" / boolean depending on the caller. */
const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .transform((value) => value === true || value === "on" || value === "true");

const requiredConsent = (messageKey: string) =>
  checkbox.refine((value) => value === true, messageKey);

export const registrationSchema = z
  .object({
    teamName: cleanText(LIMITS.teamName.min, LIMITS.teamName.max, "teamNameRequired"),
    discipline: z.enum(DISCIPLINE_IDS as [string, ...string[]], {
      message: "disciplineRequired",
    }),
    organization: cleanText(
      LIMITS.organization.min,
      LIMITS.organization.max,
      "organizationRequired",
    ),
    region: z.enum(REGIONS as unknown as [string, ...string[]], {
      message: "regionRequired",
    }),
    city: cleanText(LIMITS.city.min, LIMITS.city.max, "cityRequired"),

    members: z
      .array(memberSchema)
      .min(1, "membersMin")
      // Outer ceiling; the per-discipline limit is applied in superRefine.
      .max(MAX_TEAM_SIZE, "membersMax"),

    contactName: personName("contactNameRequired"),
    contactRole: z.enum(["participant", "parent", "teacher"], {
      message: "contactRoleRequired",
    }),
    contactEmail: email,
    contactPhone: phone,

    comment: cleanText(0, LIMITS.comment.max, "commentLong").optional().or(z.literal("")),

    consentData: requiredConsent("consentDataRequired"),
    consentGuardian: requiredConsent("consentGuardianRequired"),
    consentRules: requiredConsent("consentRulesRequired"),
    // Deliberately NOT required — bundling photo consent with participation
    // would make it non-consent. It must be refusable at no cost.
    consentMedia: checkbox.optional().default(false),

    // Marketing attribution. Optional, sanitised rather than validated — see
    // attributionSchema. Absent entirely when the form was submitted without
    // JavaScript, which is a supported path.
    ...attributionSchema.shape,
  })
  /**
   * Business rules that depend on more than one field. These are the ones an
   * attacker most wants to skip: a 40-person "LEGO team", or a 25-year-old
   * entered into a 9–15 discipline.
   */
  .superRefine((data, ctx) => {
    const discipline = getDiscipline(data.discipline);
    if (!discipline) {
      ctx.addIssue({
        code: "custom",
        path: ["discipline"],
        message: "disciplineUnknown",
      });
      return;
    }

    if (discipline.teamSizeMax !== null && data.members.length > discipline.teamSizeMax) {
      ctx.addIssue({
        code: "custom",
        path: ["members"],
        message: "membersMax",
        params: { max: discipline.teamSizeMax },
      });
    }

    data.members.forEach((member, index) => {
      if (member.age < discipline.ageMin || member.age > discipline.ageMax) {
        ctx.addIssue({
          code: "custom",
          path: ["members", index, "age"],
          message: "memberAgeDiscipline",
          params: { min: discipline.ageMin, max: discipline.ageMax },
        });
      }
    });
  });

export type RegistrationInput = z.input<typeof registrationSchema>;
export type RegistrationData = z.output<typeof registrationSchema>;

/**
 * Flatten Zod issues into `{ "members.0.age": "memberAgeDiscipline" }`, which
 * is the shape react-hook-form and the message catalog both want. Only the
 * first issue per path survives — showing a user four errors on one field is
 * noise.
 */
export function collectFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!(path in errors)) errors[path] = issue.message;
  }
  return errors;
}
