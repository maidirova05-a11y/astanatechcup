# Security

This site collects the names and ages of children. That single fact drives most
of what follows: the threat model is not "someone defaces a landing page", it is
"someone exfiltrates a database of minors' contact details three weeks before a
national event", and the controls are sized accordingly.

Mapped to the **OWASP Top 10 (2021)**, with the file that implements each.

---

## A01 — Broken access control

- Public identifiers are random: applications carry a UUIDv4 primary key and a
  `ATC-XXXX-XXXX` reference drawn from ~50 bits of entropy
  (`src/lib/reference.ts`). There is no `/application/1234` to walk.
- `/payment/success` is **cosmetic**. It mutates nothing and proves nothing —
  the reference in the query string is normalised before display and never
  trusted. Only the signature-verified webhook changes payment state.
- Unknown locales 404 rather than falling through to the default
  (`src/app/[locale]/layout.tsx`).

## Encryption of personal data at rest

**Threat:** someone obtains a copy of the database — a leaked backup, a
compromised provider account, a bad snapshot, a subpoena served on the wrong
party. Without this, that copy is a spreadsheet of Kazakh children's names,
ages, phone numbers and schools.

**Implementation** (`src/lib/crypto/field.ts`): AES-256-GCM, a fresh 12-byte IV
per value, authenticated so tampering fails loudly rather than decrypting to
something plausible. Envelope format `v1.<iv>.<tag>.<ciphertext>`; the version
prefix exists so a future rotation can read old values while writing new ones.

### What is and is not encrypted

| Encrypted | In the clear |
| --- | --- |
| Member roster (names + ages) | Team name |
| Contact name | School / organisation |
| Contact email | Region, city |
| Contact phone | Discipline, status, member **count** |
| Free-text comment | Reference, timestamps, consent flags |

The line is drawn at **person versus institution**. A school's name is not
personal data; a twelve-year-old's is. Keeping the institutional columns
readable is what lets the admin panel search and aggregate at all — encrypt
them too and the panel can only look up reference numbers. `schema.ts`
documents how to move a column across that line if you disagree.

### Blind index

Encrypting `contactEmail` with a random IV breaks two things: the duplicate
constraint and lookup by email. Both are restored by `contact_email_hash`, an
HMAC-SHA256 of the lowercased address under a separate key.

The trade-off is stated rather than hidden: **this leaks equality**. Someone
with the database can tell two entries share a contact, but not who it is, and
cannot reverse it without the key. That buys a duplicate guard enforced by a
database constraint instead of an application check a race can defeat.

Consequence for the admin panel: email search is **exact match**, and names and
phones cannot be searched at all. The UI says so on the search field.

### Key management

One secret, `ENCRYPTION_KEY` (32 bytes, base64). Two keys are derived from it
with HKDF under different `info` labels, so encryption and blind indexing never
share key material.

> ### ⚠ Losing `ENCRYPTION_KEY` destroys every registration
> It is not recoverable from the database — that is the entire point. Back it
> up somewhere that is neither the database nor this repository. `src/lib/env.ts`
> refuses to boot production without it, so it cannot be silently dropped.

**What this does not protect against:** an attacker with code execution on the
server, because the running application must be able to decrypt. That case is
covered by the controls below.

Verified with 29 checks: round-trip fidelity including Kazakh text, emoji and
5 KB values; 500 encryptions producing 500 distinct IVs; tampered ciphertext,
tag and IV all rejected; truncated, wrong-version and plaintext envelopes
rejected; blind index deterministic, case-normalising and irreversible; the two
derived keys distinct.

## A02 — Cryptographic failures

- HSTS `max-age=63072000; includeSubDomains; preload`, sent only over HTTPS so
  it cannot poison localhost (`src/lib/security/csp.ts`).
- TLS is required for the database connection in production; a misconfigured
  URL fails rather than silently sending children's names in the clear
  (`src/lib/db/store.ts`).
- No secrets in the repo. `.env.example` documents every key without values,
  and `src/lib/env.ts` validates them at startup so a typo fails the boot
  instead of quietly disabling a control.
- CSRF and form-timestamp tokens are HMAC-SHA-256 over Web Crypto, so the same
  code runs on the Edge runtime and in Node.

## A03 — Injection

| Vector | Control |
| --- | --- |
| SQL | Drizzle ORM only. No raw SQL, no string interpolation, anywhere. |
| XSS | React escaping; `dangerouslySetInnerHTML` is used nowhere. Strict CSP as defence in depth. |
| Input | Every server entry point revalidates with Zod before any logic runs. |
| Unicode | Team and person names reject control characters and bidirectional overrides (`U+202A`–`U+202E`, `U+2066`–`U+2069`) — the trick that makes a "team name" render as something else entirely in an admin panel or an exported spreadsheet. |
| Email header injection | `\r`, `\n`, `,`, `;`, `<`, `>` rejected in addresses. |
| Sparse-array DoS | `members.999999.name` is bounded and the roster is rebuilt densely (`src/app/actions/register.ts`). |

Posture is **reject, don't sanitize**. Values are normalised only where it is
lossless (trimming, lower-casing an email); "cleaning up" a payload tends to
produce a different payload rather than a safe one.

## A04 — Insecure design

Business rules are enforced server-side, from the same config the UI reads:

- Team size per discipline (VEX 4, LEGO 3, Arduino 3, Drones 3, Esports 6).
- Age range per discipline — a 25-year-old cannot be entered into a 9–15 event.
- The deadline is checked against the **server** clock, never the browser's.
- Duplicate guard on `(email, team name, discipline)` as a database unique
  index, so two concurrent submits cannot race past an application-level check.
- Idempotency key on checkout creation: a double-click cannot produce two
  charges for one team.

All four were verified by bypassing the client: removing the `min`/`max`
attributes and injecting extra member rows produced correct server-side
rejections with the right messages.

## A05 — Security misconfiguration

Set per request in `src/proxy.ts`, built in `src/lib/security/csp.ts`:

```
default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic' https:;
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
font-src 'self' data:; connect-src 'self'; frame-src 'self';
object-src 'none'; base-uri 'self'; frame-ancestors 'none';
form-action 'self'; upgrade-insecure-requests
```

Plus `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
`Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, and a
`Permissions-Policy` that denies every powerful feature — including `payment=()`,
deliberately, because the fee is collected on the provider's own page and
nothing here should ever invoke the Payment Request API.

The policy is assembled from the **enabled** integrations. If Turnstile is not
configured, its origin never appears in the policy at all.

Two documented compromises:

- `style-src 'unsafe-inline'` — Motion animates via the `style` attribute and
  Next injects critical CSS inline; neither can carry a nonce. Inline *style*
  is a far weaker vector than inline script, and `script-src` stays strict.
- `script-src https:` — ignored by any browser that honours `strict-dynamic`;
  present only as the CSP2 fallback.

`'unsafe-eval'` appears in **development only** (React Refresh needs it) and is
never in a production response. Verified against a running server.

## A06 — Vulnerable and outdated components

Minimal dependency surface; no UI kit, no icon package. Fonts self-hosted.

**Known advisory, accepted:** `drizzle-kit` pulls a transitive `esbuild`
≤0.24.2 (GHSA-67mh-4wv8-2f99, moderate). It is a **devDependency**, the issue
only affects esbuild's own dev server, and none of it is shipped. The
`npm audit fix` remedy is a major downgrade of `drizzle-kit` to 0.18.1, which is
worse. Re-evaluate when drizzle-kit updates its toolchain.

## A07 — Identification and authentication failures

Public users have no accounts, which removes an entire credential-breach
surface. Application status is looked up by an unguessable reference, not a
password.

### Admin panel

One shared password, held only as an scrypt hash in `ADMIN_PASSWORD_HASH`.

| Control | Implementation |
| --- | --- |
| Hashing | scrypt, N=2^17, r=8, p=1, 32-byte salt, 64-byte key (`src/lib/admin/password.ts`) |
| Cost | ~290 ms per verification, measured — slow to crack, imperceptible to log in |
| Comparison | `timingSafeEqual`, never `===` |
| Lockout | 5 failures per IP in 15 minutes, counted **in Postgres** |
| Failure response | One generic message and a 700 ms delay, identical for every cause |
| Sessions | 32-byte random token; only its SHA-256 is stored |
| Session limits | 12 h absolute, 1 h idle |
| Cookie name | `__Host-` prefixed in production (see below) |
| Revocation | Server-side, so sign-out is immediate rather than a wait for expiry |
| Discovery | Unconfigured ⇒ `/admin` is a **404**, not a login page |
| Indexing | `noindex, nofollow, noarchive` plus a `robots.txt` disallow |

**Why scrypt and not Argon2id:** Argon2id is the better algorithm, but it means
a native module, and native modules on serverless are a recurring source of
"works locally, fails on deploy". scrypt is memory-hard, standardised in
RFC 7914, ships inside Node, and adds zero supply-chain surface. For a single
high-entropy password that is also rate-limited and locked out server-side,
that trade is worth taking. `src/lib/admin/password.ts` is the only file that
would change if you later move to per-user accounts.

**Lockout must be in the database.** On Vercel each request may hit a different
instance, so an in-memory counter would let an attacker brute-force the shared
password essentially unthrottled. This is the same reasoning as the rate-limit
caveat below, but with worse consequences, so it is not deferred to a WAF.

**The plaintext password is never seen by this codebase's tooling.** It is
generated by the operator running `npm run admin:hash`, which reads a hidden
prompt and writes nothing to disk, argv or shell history.

Verified: correct password accepted, wrong/empty rejected, salt unique per
hash, and malformed, truncated, wrong-algorithm and absurd-parameter hashes all
rejected rather than crashing.

### Admin authorisation

Every admin page **and every admin server action** calls `requireSession()`
itself. There is no "the layout already checked it" shortcut — a layout does
not run before a server action, and relying on one is how admin panels acquire
an unauthenticated mutation endpoint. The CSV export route authenticates
independently for the same reason.

### Audit trail

`application_audit` records every status change and every CSV export, with the
session id, the IP and the before/after values. For a system holding children's
data, being able to answer "who changed this, and when" is the difference
between an incident you can investigate and one you can only apologise for.

CSV export is treated as the highest-consequence action in the panel — it moves
personal data off-system — so it is logged before the file is produced, capped
at 5,000 rows, and served `no-store`.

### CSV injection

Exported cells beginning `=`, `+`, `-` or `@` are prefixed with an apostrophe.
Without that, a team name of `=HYPERLINK("http://evil","click")` becomes a live
formula the moment an organiser opens the file in Excel.

## A08 — Software and data integrity failures

**CSRF, three independent layers** — one bypass in any of them is not enough:

1. `Origin` / `Referer` verified in `src/proxy.ts`; requests with neither are
   rejected outright, because every real browser sends `Origin` on POST.
2. An HMAC-signed, cookie-bound synchroniser token. The token is written into
   the form **server-side**, which is why the cookie can stay `HttpOnly` —
   unlike a classic double-submit, no client JavaScript ever reads it.
3. Next.js's built-in Server Action origin check.

Verified against the running server: a cross-origin POST and a POST with no
`Origin` both return **403**; a same-origin POST returns 200. The CSRF cookie is
confirmed invisible to `document.cookie`.

**`__Host-` cookie prefix.** In production both the CSRF and admin session
cookies are named `__Host-atc.*`. The prefix is enforced by the browser, not by
us: a cookie with that name is rejected unless it is `Secure`, has `Path=/` and
carries **no `Domain` attribute**. That last part is the point — it makes the
cookie un-settable from any subdomain, so a compromised `blog.astanatechcup.kz`,
or a stray preview deployment on `*.vercel.app`, cannot plant a CSRF token or an
admin session for the main site. It requires HTTPS, so localhost keeps the
unprefixed names.

> **Note on the Origin check and webhooks.** The Origin/Referer rule in
> `src/proxy.ts` deliberately skips `/api/payments/webhook` and
> `/api/csp-report`. A server-to-server callback carries no `Origin` header at
> all, so applying the browser rule there would have rejected every genuine
> payment confirmation with a 403 before the signature check ever ran — a bug
> that only surfaces on the first real payment. Those endpoints are
> authenticated by HMAC signature instead, which is strictly stronger than a
> header an attacker could simply omit.

**Payment webhooks** (`src/app/api/payments/webhook/route.ts`):

- Signature verified against the **raw** request bytes — parsing to JSON and
  re-stringifying would change the bytes and break the HMAC.
- Five-minute timestamp tolerance blocks replay of a captured request.
- The event id is recorded **before** the work is done, so a provider retry
  that arrives mid-flight loses the race and exits instead of double-processing.
- The status only ever advances *from* `pending_payment`; a replayed webhook
  cannot resurrect a cancelled entry.
- An unpaid session never marks a row paid, even if the completion event fires.
- The endpoint returns 503 when no signing secret is configured, rather than
  trusting an unverified body.

## A09 — Logging and monitoring failures

`src/lib/log.ts` redacts **at the logger**, not by convention — a call site
physically cannot leak a child's name by forgetting. Sensitive keys are
replaced with a shape-preserving marker (`[redacted:3 items]`), and emails and
phone numbers are stripped from free text too.

Observed in the running server for a real submission:

```
INFO registration.created {"reference":"ATC-GV4V-RXRJ","discipline":"lego",
                           "region":"astana","memberCount":1,"locale":"ru"}
```

Enough to debug; nothing that identifies a child. Security events are namespaced
`security.*` for easy routing and alerting.

## A10 — Server-side request forgery

No user-supplied URL is ever fetched server-side. The only outbound calls are to
Turnstile and Stripe, both to hardcoded hosts.

---

## Abuse prevention

Four layers, so no single one has to be perfect:

| Layer | Detail |
| --- | --- |
| Rate limiting | Sliding window, burst (3/min) + sustained (10/hour) per IP |
| Honeypot | Off-screen field, `aria-hidden`, `tabindex="-1"` — never `display:none`, which some bots skip |
| Timing | Signed server-issued render timestamp; rejects submissions under 3s |
| Turnstile | Optional; **fails closed** — an unverifiable visitor is not accepted |

The timing token is **signed and server-issued**, not written by client JS. That
matters twice: a bot cannot forge an older timestamp to fake having waited, and
the field is populated before hydration so the form still submits without
JavaScript.

Client IP resolution (`src/lib/security/client-ip.ts`) reads the single header
your infrastructure sets. Getting this wrong either collapses every visitor into
one bucket or lets an attacker rotate a forged header past the limiter — so it
is explicit configuration (`TRUSTED_IP_HEADER`), not a guess.

> ### ⚠ Rate limiting is in-memory and therefore per-instance
> Correct on a single VM. On Vercel or behind multiple containers an attacker
> gets N× the budget. Before launch, put Cloudflare in front and set the rules
> there — it also absorbs volumetric attacks before they reach the app — and/or
> implement the `RateLimitStore` interface against Redis. The interface exists
> precisely so this is a drop-in.

---

## Payments — scope statement

**This application never sees, transmits, logs or stores card data.** There is
no card form in this codebase and there must not be one. The payer is redirected
to the provider's hosted page; we keep an opaque transaction reference and a
status.

That holds the deployment in **PCI-DSS SAQ A**, the smallest possible scope, and
means a full compromise of this server exposes no payment instruments.

Stripe is the reference adapter. For Kazakh acquiring (Kaspi / ePay / RoboKassa),
add an adapter in `src/lib/payments/` satisfying the same two functions —
nothing outside that folder changes.

---

## Privacy and legal

### ⚠ Data residency — decide before choosing a hosting region

The database will hold names and ages of minors who are citizens of Kazakhstan.
**Law of the Republic of Kazakhstan No. 94-V "On personal data and its
protection"** requires personal data of Kazakh citizens to be stored on a
database physically located in Kazakhstan.

Recommendation: frontend anywhere, **primary personal-data store on a
KZ-resident provider or KZ cloud region**. This is a legal decision for the
organiser, not a technical default — hence `.env.example` flags it rather than
picking for you.

### Consent

- Each consent is a **separate, unticked** checkbox. Bundling them into one
  "I agree to everything" box is not valid consent.
- Photo/video permission is **optional and refusable at no cost** — it does not
  affect eligibility, and the form says so.
- Guardian confirmation is mandatory for under-18s, and the timestamp is stored
  so consent can be evidenced later.
- Analytics load **only** after an explicit choice. "Only necessary" is a real
  button of equal prominence, not a link hidden in a submenu, and the choice is
  stored in `localStorage` rather than a cookie so declining does not require
  setting the thing the user just refused.
- Members are stored as one `jsonb` column on the application row, so a
  data-subject deletion request is a single `DELETE`.

Both `privacy` and `terms` are **drafts** and render a visible warning saying so.
They must be reviewed by the organiser's counsel before launch.

---

## Verified against a running server

| Check | Result |
| --- | --- |
| Cross-origin POST | 403 |
| POST with no `Origin` | 403 |
| Same-origin POST | 200 |
| CSRF cookie readable by JS | No (`HttpOnly`) |
| Unsigned webhook | 503 (no secret configured) |
| `GET` on webhook / CSP report | 405 |
| Client-side age bypass (25 in a 6–18 discipline) | Rejected server-side |
| Client-side team-size bypass (5 in a max-3 discipline) | Rejected server-side |
| Duplicate application | Rejected |
| Log line for a real submission | No PII |
| `X-Powered-By` | Absent |
| HSTS in dev | Absent (correct) |

## Not covered by this build

- Admin interface for reviewing and exporting applications
- Confirmation email delivery (the flow returns the reference; wiring an
  provider such as Resend, with SPF/DKIM/DMARC, is a remaining task)
- Automated data-retention deletion (the policy is written; the job is not)
- Penetration test
