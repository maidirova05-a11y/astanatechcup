import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env, isProduction } from "@/lib/env";

/**
 * Field-level encryption for personal data at rest.
 *
 * ── Threat this addresses ────────────────────────────────────────────────
 * Someone obtains a copy of the database — a leaked backup, a compromised
 * provider account, a misconfigured snapshot, a subpoena to the wrong party.
 * Without this, that copy is a spreadsheet of Kazakh children's names, ages,
 * phone numbers and schools. With it, the same copy is ciphertext, and the key
 * lives somewhere else entirely (the deployment's environment, not the
 * database).
 *
 * It does NOT protect against an attacker who has code execution on the
 * server, because the running app must be able to decrypt. That case is
 * covered by the other controls in SECURITY.md.
 *
 * ── Design ──────────────────────────────────────────────────────────────
 * AES-256-GCM. Authenticated, so a modified ciphertext fails loudly instead of
 * decrypting to something plausible. A fresh 12-byte IV per value, which is
 * what GCM requires — reusing an IV under the same key is catastrophic for
 * GCM, so it is generated, never derived.
 *
 * Envelope: `v1.<iv>.<tag>.<ciphertext>`, all base64url. The version prefix
 * exists so a future key rotation can read old values while writing new ones.
 *
 * Two keys are derived from the single `ENCRYPTION_KEY` with HKDF, so
 * operators manage one secret but encryption and blind indexing never share
 * key material.
 * ─────────────────────────────────────────────────────────────────────────
 */

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

/** Thrown when a value cannot be decrypted. Never contains the ciphertext. */
export class DecryptionError extends Error {
  constructor(reason: string) {
    super(`Failed to decrypt field: ${reason}`);
    this.name = "DecryptionError";
  }
}

let cachedKeys: { encryption: Buffer; index: Buffer } | null = null;

function getKeys(): { encryption: Buffer; index: Buffer } {
  if (cachedKeys) return cachedKeys;

  const raw = env.ENCRYPTION_KEY;

  if (!raw) {
    if (isProduction) {
      // Unreachable — src/lib/env.ts blocks production boot without it. Kept
      // as a second gate so a refactor of that file cannot silently disable
      // encryption.
      throw new Error("ENCRYPTION_KEY is required in production");
    }
    // Development fallback so the app runs with an empty .env. Deterministic,
    // so data written in one dev session is readable in the next.
    cachedKeys = deriveKeys(Buffer.alloc(KEY_BYTES, 7));
    return cachedKeys;
  }

  const master = Buffer.from(raw, "base64");
  if (master.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly ${KEY_BYTES} bytes (got ${master.length}). Generate one with: npm run keygen`,
    );
  }

  cachedKeys = deriveKeys(master);
  return cachedKeys;
}

/**
 * HKDF with distinct `info` labels. Using the master key directly for both
 * purposes would mean a weakness in one construction weakens the other.
 */
function deriveKeys(master: Buffer): { encryption: Buffer; index: Buffer } {
  const salt = Buffer.from("astanatechcup.field.v1");
  return {
    encryption: Buffer.from(hkdfSync("sha256", master, salt, "encryption", KEY_BYTES)),
    index: Buffer.from(hkdfSync("sha256", master, salt, "blind-index", KEY_BYTES)),
  };
}

const b64 = (buffer: Buffer) => buffer.toString("base64url");

/** Encrypt a string. Returns the envelope; never returns the plaintext. */
export function encryptField(plaintext: string): string {
  const { encryption } = getKeys();
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv("aes-256-gcm", encryption, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${VERSION}.${b64(iv)}.${b64(tag)}.${b64(ciphertext)}`;
}

/**
 * Decrypt an envelope.
 *
 * Throws on any tampering. That is deliberate: silently returning a partial or
 * wrong value would put one team's data on another team's screen, which is
 * worse than an error page.
 */
export function decryptField(envelope: string): string {
  const { encryption } = getKeys();

  const parts = envelope.split(".");
  if (parts.length !== 4) throw new DecryptionError("malformed envelope");

  const [version, ivPart, tagPart, dataPart] = parts;
  if (version !== VERSION) throw new DecryptionError(`unsupported version ${version}`);

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(dataPart, "base64url");

  if (iv.length !== IV_BYTES) throw new DecryptionError("bad iv length");
  if (tag.length !== TAG_BYTES) throw new DecryptionError("bad tag length");

  try {
    const decipher = createDecipheriv("aes-256-gcm", encryption, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // GCM authentication failure. No detail is surfaced — an attacker probing
    // the endpoint should learn nothing about why.
    throw new DecryptionError("authentication failed");
  }
}

/** Nullable convenience wrappers, for optional columns. */
export function encryptOptional(value: string | null | undefined): string | null {
  return value === null || value === undefined || value === "" ? null : encryptField(value);
}

export function decryptOptional(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : decryptField(value);
}

/** JSON round-trip, for the member roster. */
export function encryptJson(value: unknown): string {
  return encryptField(JSON.stringify(value));
}

export function decryptJson<T>(envelope: string): T {
  return JSON.parse(decryptField(envelope)) as T;
}

/* ── Blind index ────────────────────────────────────────────────────────── */

/**
 * Deterministic HMAC of a normalised value, used where a column must stay
 * searchable and uniquely constrained after its plaintext is encrypted.
 *
 * The trade-off is explicit: this leaks equality. Two identical emails produce
 * identical index values, so someone with the database can tell that two
 * entries share a contact — but not what that contact is, and they cannot
 * reverse the index without the key.
 *
 * That is the price of keeping the duplicate-entry guard working as a database
 * constraint rather than as an application check that a race can defeat.
 */
export function blindIndex(value: string): string {
  const { index } = getKeys();
  return createHmac("sha256", index).update(value.trim().toLowerCase()).digest("hex");
}

/** Constant-time comparison of two blind index values. */
export function blindIndexEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** True when a stored value looks like one of our envelopes. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(`${VERSION}.`) && value.split(".").length === 4;
}
