/**
 * Guard: every page under src/app/[locale] must render per request.
 *
 * ── The bug this exists to prevent ───────────────────────────────────────
 * src/proxy.ts mints a CSP nonce for every request and Next.js stamps it onto
 * the framework's own <script> tags. That works only when the HTML is produced
 * for that request. A page that is pre-rendered at build time, or cached by
 * ISR, ships HTML with no nonce — or a stale one — while the response header
 * still demands the fresh one. The policy carries `strict-dynamic`, which
 * makes `'self'` and host allow-lists inert, so the browser blocks EVERY
 * script on the page.
 *
 * The failure is silent in the worst way: the server returns 200, the HTML is
 * complete, `innerText` reports every character, and the page renders blank or
 * frozen because React never hydrates. Nothing short of opening a browser and
 * reading the console catches it.
 *
 * It reached production and sat there for nine days across four routes,
 * including the live scoreboard, whose auto-refresh is JavaScript.
 *
 * A nonce-based policy and cached HTML are mutually exclusive. If you want a
 * page static, the nonce has to go first — and that is a change to
 * src/proxy.ts and to SECURITY.md, not a one-line export.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src", "app", "[locale]");
const CSP_SOURCE = join(process.cwd(), "src", "lib", "security", "csp.ts");

function pages(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pages(full));
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

// If the policy ever stops pairing a nonce with strict-dynamic, this rule is
// moot and should not keep failing builds for a reason that no longer exists.
//
// A missing or moved file is NOT that case: it means this guard can no longer
// see the thing it guards, and a guard that quietly stands down when confused
// is worse than no guard at all. Fail loudly instead.
let cspSource;
try {
  cspSource = readFileSync(CSP_SOURCE, "utf8");
} catch {
  console.error(
    `\ncheck-csp: cannot read ${CSP_SOURCE}.\n` +
      "This guard cannot verify anything without it. If the CSP builder moved,\n" +
      "point CSP_SOURCE at its new home — do not delete this check.\n",
  );
  process.exit(1);
}

if (!/nonce/i.test(cspSource) || !cspSource.includes("strict-dynamic")) {
  console.log(
    "check-csp: the policy no longer pairs a nonce with strict-dynamic — rule skipped.",
  );
  process.exit(0);
}

const offenders = [];

for (const file of pages(ROOT)) {
  const source = readFileSync(file, "utf8");
  const relative = file.slice(process.cwd().length + 1).replace(/\\/g, "/");

  const forcesDynamic = /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/.test(source);
  const revalidates = /export\s+const\s+revalidate\s*=/.test(source);

  if (revalidates) {
    offenders.push(`${relative} — exports \`revalidate\`, which caches the HTML`);
    continue;
  }
  if (!forcesDynamic) {
    offenders.push(`${relative} — missing \`export const dynamic = "force-dynamic"\``);
  }
}

if (offenders.length > 0) {
  console.error(
    "\ncheck-csp: these pages would be served as cached HTML under a nonce-based CSP,\n" +
      "which blocks every script on them and leaves the page dead in the browser:\n",
  );
  for (const line of offenders) console.error(`  · ${line}`);
  console.error(
    "\nAdd `export const dynamic = \"force-dynamic\"`, or remove the nonce from\n" +
      "src/proxy.ts and update SECURITY.md. Do not silence this check.\n",
  );
  process.exit(1);
}

console.log(`check-csp: ${pages(ROOT).length} pages render per request. OK`);
