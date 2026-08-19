# Deployment

Target: **Vercel**, project `maidirova05-2314s-projects/astanatechcup`
(the account the `vercel` CLI is signed into as `azgroup01-2027`).

## Current state

| | |
| --- | --- |
| Project | created and linked |
| Build on Vercel | ✅ succeeds (41 s) |
| Deployed URL | `https://astanatechcup.vercel.app` |
| Runtime | ❌ **500 on every request** — see below |
| `CSRF_SECRET` | ✅ set (generated, never printed) |
| `ENCRYPTION_KEY` | ✅ set — **back it up, see below** |
| `APP_URL` | ✅ set to the vercel.app alias — change when the real domain lands |
| `TRUSTED_IP_HEADER` | ✅ set to `x-vercel-forwarded-for` |
| `DATABASE_URL` | ❌ **missing — this is the only thing stopping the site working** |
| `ADMIN_PASSWORD_HASH` | ❌ missing — optional; without it `/admin` returns 404 and the public site is unaffected |

Set `DATABASE_URL`, redeploy, and the site is live.

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

## ⚠ Why it 500s, and why that is deliberate

`src/lib/env.ts` refuses to boot in production without `DATABASE_URL`,
`CSRF_SECRET` and an https `APP_URL`.

A deployment that started without a database would accept registrations into
an in-memory store and lose them at the next cold start — silently, with no
error, with the team believing they had entered. Three weeks before a national
championship that is the worst failure mode available. Refusing to start is the
correct behaviour: loud and obvious beats quiet and lossy.

## ⚠ A local PostgreSQL cannot back this deployment

A database on your own machine listens on `localhost`. Vercel's servers are in
Frankfurt. They cannot reach it, and exposing a laptop's Postgres to the public
internet to make them able to would be a bad trade for a database holding
children's names and ages.

So there are two separate databases in play:

- **Local Postgres 18 on your machine** — for development and for seeing the
  admin panel work. Set up with `npm run setup:local`.
- **A reachable, hosted Postgres** — for the Vercel deployment. This is the one
  that must live in Kazakhstan per Law 94-V, and it is the one still missing.

---

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

Five tables: `applications`, `webhook_events`, `admin_sessions`,
`admin_login_attempts`, `application_audit`. The SQL is committed in `drizzle/`
— read it before running it against anything real.

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

Optional, when you have them: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

### Step 4 — Redeploy

Environment variables are bound at deploy time, so changing them requires a new
deployment:

```bash
vercel deploy --prod
```

### Step 5 — Point the domain at it

Once `astanatechcup.kz` (or whichever domain) is bought:

```bash
vercel domains add astanatechcup.kz
```

Then update `APP_URL` to the new origin — no trailing slash — and redeploy.
`APP_URL` is used for the CSRF origin comparison and the payment return URLs,
so a stale value breaks both.

### Step 6 — After the first working production deploy

- [ ] Point the domain at the project and update `APP_URL` to match
- [ ] Set the Stripe webhook endpoint to `https://<domain>/api/payments/webhook`
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
