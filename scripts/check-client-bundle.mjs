/**
 * Guard: no client component may reach `@/lib/env`.
 *
 * ── The bug this exists to prevent ───────────────────────────────────────
 * `src/lib/env.ts` throws when NODE_ENV is production and the secrets are
 * absent. In the browser that is ALWAYS the case: a production bundle reports
 * `NODE_ENV === "production"`, and `process.env.CSRF_SECRET` does not exist
 * client-side and must not. So a client component that transitively imports
 * env.ts crashes the page on load with:
 *
 *     Uncaught Error: Refusing to start in production:
 *       · CSRF_SECRET is required in production
 *
 * The route then renders the browser's own "This page couldn't load".
 *
 * `next build` cannot see it. `npm run dev` cannot see it either, because in
 * development NODE_ENV is not production and env.ts never throws. It appears
 * only in a production runtime — the worst place to find anything.
 *
 * It has now happened twice. src/lib/security/constants.ts was created the
 * first time and says in its own header that it is "the only security module a
 * client component may import. Keep it that way." Nothing enforced that, so
 * six components drifted back to importing `@/lib/security/csrf`, and all
 * three sign-in pages — coach, judge and admin — were dead in production.
 *
 * A rule written in a comment is a wish. This is the enforcement.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const SRC = join(process.cwd(), "src");
const FORBIDDEN = "src/lib/env.ts";

/** Every .ts/.tsx file under src. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const sources = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

/** Resolve one import specifier to a file under src, or null if external. */
function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // node_modules — not our problem

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g;

function importsOf(file) {
  const source = sources.get(file) ?? "";
  const out = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const resolved = resolveImport(file, match[1]);
    if (resolved) out.push(resolved);
  }
  return out;
}

/**
 * Walk imports from a client entry point and return the first path that
 * reaches env.ts, so the report names the chain rather than just the file.
 *
 * A "use server" module is a boundary, not a leaf: its exports become network
 * references in the client bundle, so what it imports never ships. Following
 * through one would report false positives on every form that calls an action.
 */
function pathToEnv(entry) {
  const seen = new Set([entry]);
  const queue = [[entry]];

  while (queue.length > 0) {
    const chain = queue.shift();
    const current = chain[chain.length - 1];

    for (const next of importsOf(current)) {
      const relative = next.slice(process.cwd().length + 1).replace(/\\/g, "/");
      if (relative === FORBIDDEN) return [...chain, next];
      if (seen.has(next)) continue;

      const source = sources.get(next) ?? "";
      if (/^\s*["']use server["']/m.test(source)) continue;

      seen.add(next);
      queue.push([...chain, next]);
    }
  }
  return null;
}

const clientFiles = files.filter((f) =>
  /^\s*["']use client["']/m.test(sources.get(f) ?? ""),
);

/**
 * Second rule: packages that must never reach the browser bundle.
 *
 * `zod` is server-side validation. The form validates with HTML constraints
 * built from `@/lib/validation/registration-fields`; importing anything from
 * `@/lib/validation/registration` instead evaluates the whole schema module
 * and ships ~35 KB of gzipped zod on every page (it once did, through the
 * attribution capture in the [locale] layout).
 */
const FORBIDDEN_PACKAGES = ["zod"];

function externalImportsOf(file) {
  const source = sources.get(file) ?? "";
  const out = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const spec = match[1];
    if (spec.startsWith("@/") || spec.startsWith(".")) continue;
    if (/^\s*import\s+type\b/.test(match[0].trim())) continue;
    out.push(spec);
  }
  return out;
}

function pathToPackage(entry) {
  const seen = new Set([entry]);
  const queue = [[entry]];
  while (queue.length > 0) {
    const chain = queue.shift();
    const current = chain[chain.length - 1];
    for (const spec of externalImportsOf(current)) {
      const pkg = FORBIDDEN_PACKAGES.find((name) => spec === name || spec.startsWith(`${name}/`));
      if (pkg) return [...chain, `${spec} (package)`];
    }
    for (const next of importsOf(current)) {
      if (seen.has(next)) continue;
      const source = sources.get(next) ?? "";
      if (/^\s*["']use server["']/m.test(source)) continue;
      seen.add(next);
      queue.push([...chain, next]);
    }
  }
  return null;
}

const packageOffenders = [];
for (const file of clientFiles) {
  const chain = pathToPackage(file);
  if (chain) {
    packageOffenders.push(
      chain
        .map((f) => (f.startsWith(process.cwd()) ? f.slice(process.cwd().length + 1) : f).replace(/\\/g, "/"))
        .join("\n      → "),
    );
  }
}

if (packageOffenders.length > 0) {
  console.error(
    `\ncheck-client-bundle: ${packageOffenders.length} client component(s) pull a server-only package\n` +
      `(${FORBIDDEN_PACKAGES.join(", ")}) into the browser bundle:\n`,
  );
  for (const chain of packageOffenders) console.error(`  · ${chain}\n`);
  console.error(
    "Import limits and field names from @/lib/validation/registration-fields,\n" +
      "which has no imports by design.\n",
  );
  process.exit(1);
}

const offenders = [];
for (const file of clientFiles) {
  const chain = pathToEnv(file);
  if (chain) {
    offenders.push(
      chain.map((f) => f.slice(process.cwd().length + 1).replace(/\\/g, "/")).join("\n      → "),
    );
  }
}

if (offenders.length > 0) {
  console.error(
    `\ncheck-client-bundle: ${offenders.length} client component(s) reach ${FORBIDDEN}.\n` +
      "env.ts throws in a production browser bundle, so these routes render the\n" +
      "browser's own \"This page couldn't load\" — invisible to build and to dev.\n",
  );
  for (const chain of offenders) console.error(`  · ${chain}\n`);
  console.error(
    "Import shared constants from @/lib/security/constants, which has no imports\n" +
      "by design. See the header of that file.\n",
  );
  process.exit(1);
}

console.log(
  `check-client-bundle: ${clientFiles.length} client components, none reach env.ts or ${FORBIDDEN_PACKAGES.join(", ")}. OK`,
);
