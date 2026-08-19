/**
 * Human-quotable application references, e.g. `ATC-7K3M-92`.
 *
 * Requirements this satisfies:
 *  · Unguessable — 10 random characters from a 32-symbol alphabet is ~50 bits.
 *    An attacker cannot enumerate other teams' applications by counting up.
 *  · Readable aloud over the phone to the organising committee, which is how
 *    people will actually use it — hence no 0/O or 1/I/L confusion.
 *  · Case-insensitive on lookup, because nobody types it back in caps.
 */

/** Crockford-style: no I, L, O or U (the last to avoid accidental words). */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const REFERENCE_PREFIX = "ATC";

export function generateReference(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);

  // Rejection-free mapping is unnecessary here: 256 % 32 === 0, so a plain
  // modulo is already uniform across the alphabet.
  const chars = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]);

  return `${REFERENCE_PREFIX}-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}`;
}

const REFERENCE_PATTERN = new RegExp(
  `^${REFERENCE_PREFIX}-[${ALPHABET}]{4}-[${ALPHABET}]{4}$`,
);

/**
 * Normalise user-typed input before it reaches a query: upper-case, and map
 * the characters people habitually substitute. Returns null for anything that
 * is not a well-formed reference, so a malformed value never reaches the store.
 */
export function normaliseReference(input: string): string | null {
  const candidate = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

  return REFERENCE_PATTERN.test(candidate) ? candidate : null;
}
