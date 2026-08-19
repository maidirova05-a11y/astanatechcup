import { z } from "zod";
import {
  AGE_BOUNDS,
  DISCIPLINE_IDS,
  MAX_TEAM_SIZE,
  getDiscipline,
} from "@/config/event";
import { REGIONS } from "@/config/regions";

/**
 * The single validation schema, shared by the browser and the server.
 *
 * The client copy exists only to show friendly errors as the user types. The
 * server re-runs the exact same schema on the raw submission and treats its
 * verdict as final — a hand-crafted POST that skips the React form hits
 * identical rules.
 *
 * Posture is reject-don't-sanitize: values are normalised only where it is
 * genuinely lossless (trimming, lower-casing an email), never "cleaned up" by
 * stripping characters, which tends to turn a malicious payload into a
 * different, still-malicious payload.
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
