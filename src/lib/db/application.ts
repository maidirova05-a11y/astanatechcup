import "server-only";
import {
  blindIndex,
  decryptField,
  decryptJson,
  decryptOptional,
  encryptField,
  encryptJson,
  encryptOptional,
} from "@/lib/crypto/field";
import type { ApplicationRow, NewApplication } from "./schema";

/**
 * The boundary between encrypted storage and the rest of the application.
 *
 * Everything above this file works with plaintext `Application` objects.
 * Everything below it — the schema, the queries, the database — sees only
 * ciphertext. Putting the conversion in exactly one place is what makes it
 * possible to say with confidence that no personal field reaches Postgres
 * unencrypted: there is only one function that writes them.
 */

export type Member = { name: string; age: number };

/** An application with its personal fields decrypted. Never persisted. */
export type Application = Omit<
  ApplicationRow,
  "members" | "contactName" | "contactEmail" | "contactPhone" | "comment" | "contactEmailHash"
> & {
  members: Member[];
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  comment: string | null;
};

/** Plaintext input, as it arrives from the registration form. */
export type ApplicationInput = {
  reference: string;
  teamName: string;
  discipline: string;
  organization: string;
  region: string;
  city: string;
  members: Member[];
  contactName: string;
  contactRole: "participant" | "parent" | "teacher";
  contactEmail: string;
  contactPhone: string;
  comment: string | null;
  consentData: boolean;
  consentGuardian: boolean;
  consentRules: boolean;
  consentMedia: boolean;
  locale: string;
};

/**
 * Plaintext → the row that gets written.
 *
 * `memberCount` is derived here rather than trusted from the caller: it is the
 * one piece of roster information kept in the clear, and it must not be able
 * to disagree with the encrypted roster it summarises.
 */
export function toRow(input: ApplicationInput): NewApplication {
  return {
    reference: input.reference,

    // Team and institution identifiers — deliberately not encrypted so the
    // admin panel can search and aggregate. See the note in schema.ts.
    teamName: input.teamName,
    discipline: input.discipline,
    organization: input.organization,
    region: input.region,
    city: input.city,

    // Personal data — encrypted.
    members: encryptJson(input.members),
    memberCount: input.members.length,
    contactName: encryptField(input.contactName),
    contactRole: input.contactRole,
    contactEmail: encryptField(input.contactEmail),
    contactEmailHash: blindIndex(input.contactEmail),
    contactPhone: encryptField(input.contactPhone),
    comment: encryptOptional(input.comment),

    consentData: input.consentData,
    consentGuardian: input.consentGuardian,
    consentRules: input.consentRules,
    consentMedia: input.consentMedia,
    locale: input.locale,
  };
}

/**
 * Row → plaintext.
 *
 * Throws if a value cannot be decrypted. That is deliberate: a wrong or
 * partial decrypt would put one team's data on another team's screen, and an
 * error page is the better outcome. In practice it means the key is wrong or
 * the row was tampered with, and both should be loud.
 */
export function toApplication(row: ApplicationRow): Application {
  return {
    ...row,
    members: decryptJson<Member[]>(row.members),
    contactName: decryptField(row.contactName),
    contactEmail: decryptField(row.contactEmail),
    contactPhone: decryptField(row.contactPhone),
    comment: decryptOptional(row.comment),
  };
}

/**
 * Decrypt a list, skipping rows that fail rather than failing the whole page.
 *
 * A single corrupt row must not make the entire applications table
 * unreachable three days before the deadline. Failures are counted so the
 * caller can surface "3 entries could not be read" rather than silently
 * showing a short list.
 */
export function toApplications(rows: ApplicationRow[]): {
  applications: Application[];
  failed: number;
} {
  const applications: Application[] = [];
  let failed = 0;

  for (const row of rows) {
    try {
      applications.push(toApplication(row));
    } catch {
      failed += 1;
    }
  }

  return { applications, failed };
}

/** Look up by email without ever putting the address in a query. */
export function emailLookupHash(email: string): string {
  return blindIndex(email);
}
