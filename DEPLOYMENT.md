# Deployment

Target: **Vercel**, project `maidirova05-2314s-projects/astanatechcup`
(the account the `vercel` CLI is signed into as `azgroup01-2027`).

Live at **<https://astanatechcup.kz>**.

## Current state

| | |
| --- | --- |
| Project | created and linked |
| Build on Vercel | ✅ succeeds |
| Domain | ✅ `astanatechcup.kz` + `www`, TLS issued, aliased to production |
| Runtime | ✅ 200 on the public site |
| `APP_URL` | ✅ `https://astanatechcup.kz` |
| `DATABASE_URL` | ✅ set — Neon (see the residency note below) |
| `CSRF_SECRET` | ✅ set (generated, never printed) |
| `ENCRYPTION_KEY` | ✅ set — **back it up, see below** |
| `TRUSTED_IP_HEADER` | ✅ `x-vercel-forwarded-for` |
| `ADMIN_PASSWORD_HASH` | ❌ missing — without it `/admin` returns 404; the public site is unaffected |
| `JUDGE_PASSWORD_HASH` | ❌ missing — without it (and without the admin one) `/judge` returns 404 and `/results` says it is not connected |
| Scoring migration `0001` | ✅ applied to the Neon database on 2026-08-29 |
| Stripe / Turnstile | ❌ not configured — both optional, both degrade safely |

### Migration `0001` — the scoring tables

`drizzle/0001_panoramic_juggernaut.sql` adds `scoring_teams`,
`scoring_matches`, `scoring_runs`, `scoring_audit` and a `role` column on
`admin_sessions`. It is purely additive — four `CREATE TABLE`s, four
`CREATE TYPE`s and one `ADD COLUMN` with a default — and touches no existing
row's data. It has been applied to the Neon database already.

If you move to a different Postgres (see step 1 below), apply it there too:

```bash
npm run db:migrate
```

Until it lands, `/[locale]/results` queries tables that do not exist. The page
catches that and renders "not connected" rather than a 500, so the site stays up
either way — but nothing is recorded.

### DNS

The domain is registered at **hoster.kz** and keeps hoster's nameservers
(`ns1–3.hoster.kz`); only the records point at Vercel. Vercel's dashboard will
show "Intended Nameservers ✗" — that is expected and not an error. It only
matters if you want Vercel to run DNS for the zone, which we do not.

| Record | Name | Value |
| --- | --- | --- |
| A | `@` | `76.76.21.21` |
| A | `www` | `76.76.21.21` |

`www` is redirected to the apex by a host-conditional rule in `vercel.json`, and
every page also emits a canonical pointing at the apex, so the two hostnames
cannot compete for indexing.

> **`APP_URL` is not cosmetic.** It is the CSRF origin comparison, the payment
> return URLs, `metadataBase`, the canonical tags, `robots.txt` and the sitemap.
> If the domain ever changes, change this in the same pass or search engines
> index the wrong host and payers get returned to a dead one.

---


## ⚠⚠ Back up ENCRYPTION_KEY before you take another step

Personal data is encrypted at rest with a key that exists in exactly one place:
Vercel's environment. **If that value is lost, every registration becomes
permanently unreadable.** There is no recovery, by design — a key recoverable
from the system it protects would protect nothing.

Pull it out and put it in a password manager now:

```bash
vercel env pull .env.production.local
```

Copy `ENCRYPTION_KEY` from that file into your password manager, then delete
the file. It is git-ignored, but it should not sit on a laptop either.

Do this before the first real registration arrives, not after.

---

## ⚠ The database is on Neon, and Neon is not in Kazakhstan

`src/lib/env.ts` refuses to boot in production without `DATABASE_URL`,
`CSRF_SECRET` and an https `APP_URL` — a deployment that started without a
database would accept registrations into an in-memory store and lose them at the
next cold start. Refusing to start is the correct behaviour: loud and obvious
beats quiet and lossy.

That check is satisfied. What it does **not** check is *where* the database is,
and the one currently wired up is a Neon project, which has no Kazakhstan
region. `.env.example` and the section below both state that KZ Law No. 94-V
requires personal data on citizens — here, the names and ages of minors — to be
stored on a database physically located in Kazakhstan.

**This is an open compliance item, not a technical fault.** The site works. But
either the organiser's counsel confirms the current arrangement is acceptable,
or `DATABASE_URL` moves to a Kazakh-hosted Postgres before real registrations
arrive. Migrating later means moving encrypted rows *and* the key, which is a
much worse day than switching the connection string now.

## ⚠ Data residency, revisited

You chose a Kazakh-hosted Postgres to satisfy Law 94-V. Worth being explicit
about what that does and does not cover:

- **The database** — the thing the law names — is in Kazakhstan. ✅
- **The application server** is not. Vercel has no Kazakhstan region; the
  closest is Frankfurt (`fra1`, configured in `vercel.json`). Personal data is
  therefore *processed in memory and in transit* outside Kazakhstan even though
  it is *stored* inside it.

Most readings of 94-V focus on where the database resides, so this is likely
fine — but it is exactly the kind of detail the organiser's counsel should
confirm rather than inherit from a config file.

There is also a practical cost: every admin query and every registration write
crosses roughly 4,000 km. Expect ~80–120 ms of round-trip latency per query.
The page itself is unaffected (it is static or cached), but the admin panel
will feel a beat slower than a local database.

**If that trade-off is unacceptable**, the alternative is hosting the whole
application in Kazakhstan too — a VPS running `npm run build && npm start`
behind nginx. The codebase supports it with no changes; only the rate-limiting
note in SECURITY.md becomes simpler (a single instance makes the in-memory
limiter correct).

---

---

## Local development setup

Run once. It prompts for your PostgreSQL superuser password, which is used for
that one connection and never stored:

```bash
npm run setup:local
```

It creates the `astanatechcup` database and a dedicated `astanatechcup_app`
role (the app never connects as `postgres` — a bug here should not be able to
drop your other databases), generates the secrets, writes `.env.local`, and
prints a local-only admin password once.

Then:

```bash
npm run db:migrate
```

```bash
npm run dev
```

`/admin` now works at <http://localhost:3000/admin>.

---

## Finishing the production deployment

### Step 1 — Provision a reachable Postgres in Kazakhstan

This is the outstanding item. Any provider works; the app needs a standard
connection string with TLS:

```
postgres://user:password@host:5432/astanatechcup?sslmode=require
```

### Step 2 — Apply the migrations to it

```bash
npm run db:migrate
```

Nine tables: `applications`, `webhook_events`, `admin_sessions`,
`admin_login_attempts`, `application_audit`, and the four the scoring system
adds — `scoring_teams`, `scoring_matches`, `scoring_runs`, `scoring_audit`. The
SQL is committed in `drizzle/` — read it before running it against anything
real.

### Step 3 — Set the remaining variables

```bash
vercel env add DATABASE_URL production
```

Use a connection string that requires TLS (`?sslmode=require`). The app also
demands TLS itself in production, so a non-TLS URL fails rather than quietly
sending children's names across the network in the clear.

Generate a production admin password (different from the local one) and set it:

```bash
npm run admin:hash
```

```bash
vercel env add ADMIN_PASSWORD_HASH production
```

Then a **different** password for the judges' console, generated the same way:

```bash
npm run admin:hash
```

```bash
vercel env add JUDGE_PASSWORD_HASH production
```

A judge session reaches `/judge` and nothing else — no applications, no personal
data, no export. That separation is the reason the two passwords exist, and it
is worth nothing if they are the same string: the judges' one is read out to a
crew standing at a venue and will be overheard.

Optional, when you have them: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

### Step 4 — Redeploy

Environment variables are bound at deploy time, so changing them requires a new
deployment:

```bash
vercel deploy --prod
```

### Step 5 — Point the domain at it ✅ done

Kept here as the record of what was actually run:

```bash
vercel domains add astanatechcup.kz
```

The A records at hoster.kz already pointed at Vercel, so the domain verified and
the certificate issued without further DNS work. `APP_URL` was then repointed
and production redeployed — environment variables bind at build time, so a new
deployment is required for the change to take effect:

```bash
vercel redeploy <latest-production-url> --target production
```

### Step 6 — After the first working production deploy

- [x] Point the domain at the project and update `APP_URL` to match
- [ ] Set `ADMIN_PASSWORD_HASH` so `/admin` exists in production
- [ ] Resolve the Law 94-V question on the Neon database (see above)
- [ ] Set the Stripe webhook endpoint to `https://astanatechcup.kz/api/payments/webhook`
      and put the resulting signing secret in `STRIPE_WEBHOOK_SECRET`
- [ ] Put Cloudflare (or the WAF of your choice) in front and move rate limiting
      there — the in-app limiter is per-instance and Vercel runs many
      (see SECURITY.md)
- [ ] Run with `CSP_REPORT_ONLY=1` for a few days, read `security.csp_violation`
      in the logs, then set it back to `0`
- [ ] Confirm the database is not reachable from the public internet except
      from Vercel's egress addresses

---

## Rolling back

```bash
vercel rollback
```

Instant, and it does not touch the database. Note that a rollback will **not**
undo a migration — if a deploy included a schema change, roll the schema back
deliberately and separately.

## Rotating the admin password

Generate a new hash, update the env var, redeploy. Existing sessions are stored
server-side, so to cut them immediately as well, truncate `admin_sessions`:

```sql
UPDATE admin_sessions SET revoked_at = now() WHERE revoked_at IS NULL;
```
