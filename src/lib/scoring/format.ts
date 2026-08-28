/**
 * Clock formatting and parsing for the scoring system.
 *
 * Pure functions with no imports, deliberately: they run in the judge's
 * browser (a controlled input that reformats as you type), on the server (the
 * action that validates what was submitted) and in the public results table.
 * One implementation means the three can never disagree about what "1:23.45"
 * means, which is the kind of disagreement that surfaces as a protest.
 *
 * Times are integers in MILLISECONDS everywhere. Line Follower is decided on
 * thousandths — the rulebook's own did-not-finish constant is 03:00.001 — so
 * anything coarser silently creates ties that the rules do not have.
 */

/** `3:00.001`, `12.400`, `0.050`. Minutes are dropped when there are none. */
export function formatClock(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const millis = safe % 1000;

  const fraction = String(millis).padStart(3, "0");

  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, "0")}.${fraction}`
    : `${seconds}.${fraction}`;
}

/** `2:30`, `0:07` — for remaining time, where thousandths are noise. */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Longest time the parser will accept: one hour. Anything more is a typo. */
const MAX_CLOCK_MS = 60 * 60 * 1000;

/**
 * Parse what a judge actually types on a phone.
 *
 * Accepted: `1:23.456`, `1:23,456`, `1:23`, `83.456`, `83`, `1:23.4`.
 * A one- or two-digit fraction means tenths and hundredths, not milliseconds:
 * someone typing `12.4` means twelve and four tenths, and reading it as twelve
 * seconds and four milliseconds would be wrong by almost half a second.
 *
 * Returns null for anything it cannot read, so the caller decides what to do
 * rather than silently receiving a zero.
 */
export function parseClock(input: string): number | null {
  const value = input.trim().replace(",", ".");
  if (value === "") return null;

  const match = /^(?:(\d{1,2}):)?(\d{1,2}|\d{1,3})(?:\.(\d{1,3}))?$/.exec(value);
  if (!match) return null;

  const [, minutesRaw, secondsRaw, fractionRaw] = match;

  const minutes = minutesRaw ? Number(minutesRaw) : 0;
  const seconds = Number(secondsRaw);

  // Without a minutes field, "83" legitimately means 83 seconds. With one,
  // "1:83" does not mean anything.
  if (minutesRaw && seconds >= 60) return null;

  const millis = fractionRaw ? Number(fractionRaw.padEnd(3, "0")) : 0;

  const total = minutes * 60_000 + seconds * 1000 + millis;
  if (!Number.isFinite(total) || total < 0 || total > MAX_CLOCK_MS) return null;

  return total;
}

/** `mm:ss` from a judge's remaining-time field, or null. */
export function parseDuration(input: string): number | null {
  const value = input.trim();
  if (value === "") return null;

  const match = /^(?:(\d{1,2}):)?(\d{1,3})$/.exec(value);
  if (!match) return null;

  const [, minutesRaw, secondsRaw] = match;
  const minutes = minutesRaw ? Number(minutesRaw) : 0;
  const seconds = Number(secondsRaw);
  if (minutesRaw && seconds >= 60) return null;

  const total = (minutes * 60 + seconds) * 1000;
  return total > MAX_CLOCK_MS ? null : total;
}
