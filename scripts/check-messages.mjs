/**
 * Fails the build if the locale catalogs drift apart.
 *
 * A missing key in one language is invisible in review and shows up as an
 * untranslated string in front of a user. Comparing the flattened key sets
 * catches it in CI instead.
 *
 * Run: npm run check:messages
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "messages");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

/** Flatten to `a.b.c` paths so nesting differences are caught too. */
function flatten(obj, prefix = "", out = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.add(path);
    }
  }
  return out;
}

/**
 * ICU plural and select branch keywords. A `{` preceded by one of these is the
 * body of a branch, not an argument reference — in `{n, plural, one {day}
 * other {days}}` the words `day` and `days` are literal text. Without this the
 * checker reports them as placeholders, which only surfaces in languages whose
 * branch text happens to be ASCII.
 */
const BRANCH_PREFIX = /(?:\b(?:zero|one|two|few|many|other)|=\d+)\s*$/;

/** Collect `{placeholder}` names so a translation can't drop an interpolation. */
function placeholders(obj, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      placeholders(value, path, out);
    } else if (typeof value === "string") {
      const names = new Set();
      for (const match of value.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*(?:,|\})/g)) {
        const before = value.slice(0, match.index);
        if (BRANCH_PREFIX.test(before)) continue;
        names.add(match[1]);
      }
      out.set(path, names);
    }
  }
  return out;
}

const catalogs = files.map((file) => {
  const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
  return { locale: file.replace(/\.json$/, ""), raw, keys: flatten(raw), vars: placeholders(raw) };
});

if (catalogs.length < 2) {
  console.log(`✓ Only ${catalogs.length} catalog(s) — nothing to compare.`);
  process.exit(0);
}

// Compare everything against the default locale, so error messages read
// "kk is missing X" rather than being relative to whatever sorted first.
const baseIndex = Math.max(0, catalogs.findIndex((c) => c.locale === "ru"));
const base = catalogs[baseIndex];
const rest = catalogs.filter((_, i) => i !== baseIndex);
let failed = false;

for (const other of rest) {
  const missing = [...base.keys].filter((k) => !other.keys.has(k));
  const extra = [...other.keys].filter((k) => !base.keys.has(k));

  for (const key of missing) {
    console.error(`✗ [${other.locale}] missing key: ${key}`);
    failed = true;
  }
  for (const key of extra) {
    console.error(`✗ [${other.locale}] key not present in ${base.locale}: ${key}`);
    failed = true;
  }

  for (const [key, names] of base.vars) {
    const theirs = other.vars.get(key);
    if (!theirs) continue;
    for (const name of names) {
      if (!theirs.has(name)) {
        console.error(`✗ [${other.locale}] ${key} is missing placeholder {${name}}`);
        failed = true;
      }
    }
    for (const name of theirs) {
      if (!names.has(name)) {
        console.error(`✗ [${other.locale}] ${key} has unexpected placeholder {${name}}`);
        failed = true;
      }
    }
  }
}

if (failed) {
  console.error("\nLocale catalogs are out of sync.");
  process.exit(1);
}

console.log(
  `✓ ${catalogs.length} catalogs in sync (${base.keys.size} keys): ${catalogs.map((c) => c.locale).join(", ")}`,
);
