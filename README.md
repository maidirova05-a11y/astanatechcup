# AstanaTechCup — landing page and admin panel

Trilingual (Russian / Kazakh / English) landing page, team-registration flow
and organiser admin panel for the III Republican technology championship of
Kazakhstan.

Built from the project brief in `AstanaTechCup brief.docx`. Every factual claim
on the page traces back to that document; everything the brief left blank is
marked as an assumption in code and listed under **[Open questions](#open-questions)**.

---

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000> — it redirects to `/ru`. Switch language with the
header toggle, or go straight to `/kk` or `/en`.

**No configuration is needed to run it.** With an empty environment the site
boots, the registration form works end to end, and applications are held in an
in-memory store. Production boot is blocked until the required variables are
set — see [Configuration](#configuration).

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run check` | Message parity + scoring maths + typecheck + lint (run this before committing) |
| `npm run check:messages` | Fails if the three locale catalogs drift apart |
| `npm run check:scoring` | Checks the standings and tiebreak maths against the rulebooks |
| `npm run admin:hash` | Generate an admin or judges' password hash (hidden prompt) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration from `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |

---

## The one file you will edit most

**`src/config/event.ts`** is the single source of truth for every date, price,
discipline, age range, team size and contact channel. It is imported by the
page copy, the FAQ, the terms of participation *and* the server-side validation
— so the fee quoted in the terms can never disagree with the fee charged at
checkout, and a discipline's advertised team size is the same number the server
enforces.

Change the year of the whole championship with one line:

```ts
export const EVENT_YEAR = 2027;
```

---

## Architecture

```
src/
├── config/            Event facts, region list, competition categories.
├── i18n/              Locale routing, navigation helpers, request config
├── messages/          ru.json · kk.json · en.json  (identical key sets, CI-enforced)
├── proxy.ts           Edge: CSP nonce, security headers, CSRF, locale routing
├── app/
│   ├── [locale]/      Pages: landing, categories, results, privacy, terms, payment
│   ├── admin/         Organising committee: applications, export, audit
│   ├── judge/         Scoring console: match sheets and attempt times
│   ├── actions/       Server actions (registration)
│   └── api/           Payment webhook, CSP violation report sink
├── components/
│   ├── layout/        Header, footer, locale switcher, consent, legal shell
│   ├── sections/      One file per landing-page section, plus the two new pages
│   ├── forms/         Registration form
│   ├── judge/         Console shell, match scorer, run scorer
│   └── ui/            Design-system primitives
└── lib/
    ├── security/      CSP, CSRF, rate limiting, client IP, bot checks
    ├── validation/    Zod schemas shared by client and server
    ├── scoring/       Clock parsing, standings maths, scoring data access
    ├── db/            Drizzle schema + store (Postgres, memory fallback)
    ├── payments/      Provider-agnostic hosted checkout (Stripe adapter)
    ├── env.ts         Validated environment
    └── log.ts         Structured logging with PII redaction
```

### Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict ·
Tailwind CSS v4 · next-intl · Zod 4 · Drizzle ORM + Postgres · Motion ·
Stripe hosted Checkout.

No UI component library and no icon package: the icon set is ~25 inline SVGs in
`src/components/ui/icons.tsx`. Every dependency is an attack-surface decision,
and forty kilobytes of JavaScript for fifteen glyphs is a bad trade.

---

## Design system

> **`DESIGN.md` is the design contract.** It states the palette, type scale,
> spacing, motion and component rules in the [DESIGN.md](DESIGN.md) format that
> AI agents and designers both read. Change the primitive layer in
> `globals.css` and update that file in the same pass, or the two drift.


Three token layers in `src/app/globals.css`, in strict order:

1. **Primitive** — the only place a hex code may appear.
2. **Semantic** — `--surface`, `--text`, `--brand`, `--accent`, `--border`.
3. **Utilities** — the Tailwind classes generated from the two layers above.

No component file contains a colour. Applying `.on-dark` to a section
re-points the *semantic* layer, so every nested component adapts with zero
per-component dark-mode branching — that is the entire dark-section
implementation.

**Art direction — "Bright Tech".** The brief asks for "bright and friendly for
children" (Q16) while the event has to read as a serious technology
championship to sponsors and media. The resolution is a light-dominant page
whose premium quality comes from layout rigour, typographic scale and
whitespace, with dark sections used as deliberate punctuation (the RoboSumo
flagship, the RobotChallenge prize) so they read as "the arena".

> ⚠ **The palette is a documented placeholder.** The brief confirms a logo and
> brandbook exist; they were not supplied. Replace the primitive layer in
> `globals.css` and the whole site re-skins. `src/components/layout/Logo.tsx`
> is a typographic stand-in, not a proposed identity.

### Typography and Kazakh

Manrope (display) and Inter (body), both loaded with the `cyrillic-ext` subset.
This is a hard requirement, not a nicety: Kazakh needs **ә ғ қ ң ө ұ ү һ і**,
which sit outside the basic Cyrillic block. A face without `cyrillic-ext`
renders those as tofu, and nobody notices until a Kazakh speaker opens the
page. Verified in-browser: the glyphs resolve to the webfont, not a fallback.

Fonts are self-hosted by `next/font`, so there is no request to
`fonts.gstatic.com` — which keeps `font-src 'self'` in the CSP and leaks no
visitor IP addresses to a third party.

---

## Internationalisation

Russian, Kazakh and English — all prefixed routes off one deployment (`/ru`,
`/kk`, `/en`) with an always-visible header switcher. Kazakhstan is bilingual
and browsers frequently report `ru` for both local audiences, so an
auto-detected guess is not enough on its own; English is there for sponsors,
foreign partners and the RobotChallenge pipeline.

`src/i18n/routing.ts` is the only place the locale list lives. The switcher,
`<html lang>`, hreflang tags, the sitemap, `robots.txt` and the Stripe checkout
locale all derive from it. Adding a fourth language means appending to that
array and adding one JSON file.

`npm run check:messages` fails the build if the catalogs have different key
sets *or* different `{placeholders}` in the same message. A missing key is
invisible in review and shows up as an untranslated string in front of a user.

> ⚠ **The Kazakh translation needs a native-speaker review before launch.** It
> was written to be accurate and idiomatic, but it has not been checked by a
> native speaker, and this is a public-facing document for a national
> championship. The English is safe to ship as written.

---

## Admin panel

`/admin` — for the organising committee. Deliberately outside the `[locale]`
tree and in Russian only: it is an internal tool for a team that shares one
working language, and translating it three ways would be effort spent on
nobody.

- **Dashboard** — totals, participant count, fees collected, days to deadline,
  and breakdowns by status, discipline and region.
- **Applications** — searchable and filterable table with pagination. Filters
  live in the URL, so a view can be bookmarked and shared.
- **Detail** — full entry including team roster, contact, consents and an audit
  trail; status can be changed from here.
- **CSV export** — respects the active filters, guards against CSV injection,
  carries a UTF-8 BOM so Excel on Windows reads Cyrillic correctly, and writes
  an audit row every time.

Access is a single shared password, hashed with scrypt and held in
`ADMIN_PASSWORD_HASH`. **Generate it yourself** with `npm run admin:hash` — the
prompt is hidden and the plaintext never touches disk, argv or shell history.

With `ADMIN_PASSWORD_HASH` or `DATABASE_URL` unset, `/admin` returns **404**
rather than a login page, so a scanner cannot tell the panel exists.

---

## Categories and scoring

Two axes, deliberately not merged.

A **discipline** (`src/config/event.ts`) is what a team registers into — a
technology family: VEX, LEGO, Arduino, drones, esports. It drives the form, the
server-side validation and the admin panel, and its ids are already written into
every stored application.

A **category** (`src/config/categories.ts`) is what a team competes in on the
day: Robo Sumo, Line Follower, Robot Rugby, Drone Soccer, Ring Master Challenge,
Robot Bowling, Leap. Seven categories, twenty-one classes, transcribed from the
official RobotChallenge rulebooks with the revision date of each recorded
alongside it. That file is the single source for both the public rules page and
the scoring system, so a limit cannot mean one thing to a reader and another to
the form that scores it.

### `/[locale]/categories` — the rules page

Every category with its robot envelopes, arena dimensions, match format, key
rules and scoring method, in all three languages. Static, pre-rendered.

### `/judge` — the scoring console

For the referee crew. Mobile-first, Russian only, outside the `[locale]` tree
for the same reason as the admin panel.

- **Match categories** (Sumo, Rugby, Drone Soccer, Ring Master) — a sheet per
  pairing with stepper controls for the score and the cards. The judge declares
  the outcome; the form suggests one from the score but never overrides them,
  because every one of these rulebooks lets a referee award a match against the
  score.
- **Run categories** (Line Follower, Bowling, Leap) — one screen per attempt.
  Line Follower takes a clock value and writes the rulebook's own 03:00.001 for
  an attempt that does not finish. Leap reproduces its eighteen-row score sheet
  and totals it, including the time bonus, so nobody is adding up negative rows
  in their head beside a stage.
- **Teams** — start number, name, organisation, region, group letter. A withdrawn
  team is archived, never deleted, so its played matches keep a team to name.
- Every write is audited with the session, the role, the address and the previous
  value. A championship result is contestable, and "the system says so" is not an
  answer a team has to accept.

Access is a second shared password in `JUDGE_PASSWORD_HASH`, generated the same
way as the admin one. A judge session reaches the console and nothing else; an
admin session reaches both. Make them different passwords — the judges' one is
shared with a crew standing at a venue.

With neither password set, `/judge` returns **404**.

### `/[locale]/results` — the public scoreboard

Group tables and attempt rankings, computed from the filed sheets on every
render by the same functions the console uses. Nothing is stored as a standing.
Cached for thirty seconds, and pushed immediately whenever a judge saves.

Tiebreaks follow the rulebooks rather than football intuition — most of these
lead with the head-to-head result, not goal difference.

---

## Database

PostgreSQL via Drizzle. The schema is `src/lib/db/schema.ts`; migrations are
generated into `drizzle/` and committed.

```bash
npm run db:generate   # after changing the schema
```

```bash
npm run db:migrate    # apply to DATABASE_URL
```

Five tables: `applications`, `webhook_events`, `admin_sessions`,
`admin_login_attempts`, `application_audit`.

Team members live in a `jsonb` column on the application row rather than a
child table — they have no independent lifecycle, and it means a data-subject
deletion request is a single `DELETE`.

> ⚠ **Data residency.** This database holds names and ages of Kazakh minors.
> Law 94-V requires it to be physically located in Kazakhstan. See
> [DEPLOYMENT.md](DEPLOYMENT.md) for what that does and does not cover when the
> application server is hosted abroad.

---

## Registration flow

1. Visitor fills the form (works as plain HTML before hydration).
2. `registerTeam` server action runs eight checks, cheapest first:
   CSRF → rate limit → honeypot + timing → Turnstile → deadline → Zod
   validation → persist → hosted checkout.
3. The application is saved, and the visitor is redirected to the payment
   provider's own page.
4. The signature-verified webhook — and nothing else — marks it paid.

The application is committed **before** checkout. If the payment provider is
down or unconfigured, the entry is still saved and the organisers can send a
payment link manually; losing a registration because the payment step wobbled
would be the worst possible outcome for a team that spent months on a robot.

See **[SECURITY.md](SECURITY.md)** for the full control set.

---

## Configuration

Copy `.env.example` to `.env.local` and fill in. Everything is optional for
local development; three variables are required in production and the app
refuses to boot without them.

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | production | Canonical origin; CSRF comparison, payment return URLs |
| `CSRF_SECRET` | production | HMAC key for CSRF and form-timestamp tokens |
| `DATABASE_URL` | production | Postgres. Without it, entries live in memory |
| `TRUSTED_IP_HEADER` | recommended | Which header carries the real client IP |
| `TURNSTILE_*` | optional | Cloudflare Turnstile; honeypot + timing run regardless |
| `STRIPE_*` | optional | Hosted checkout and webhook verification |
| `NEXT_PUBLIC_ANALYTICS_*` | optional | Consent-gated analytics; nothing loads without both |
| `CSP_REPORT_ONLY` | optional | `1` to report CSP violations instead of enforcing |

---

## Before launch

- [ ] Confirm **`EVENT_YEAR`** and the qualifier/final dates
- [ ] Confirm whether **RoboSumo** is its own discipline, and supply its age range, team size and weight classes
- [ ] Drop in the **brandbook** — colours, logo files, fonts
- [ ] Fill in **`CONTACTS`** in `src/config/event.ts` (section 9 of the brief was blank)
- [ ] Add the **regulations PDF**, **trailer** and **gallery** assets
- [ ] Have a lawyer review `privacy` and `terms` — both are drafts and the site processes children's data
- [ ] Have a **native Kazakh speaker** review `src/messages/kk.json`
- [ ] Decide **data residency** (see SECURITY.md) and choose a database region
- [ ] Put **Cloudflare** or an equivalent WAF in front, and move rate limiting there
- [ ] Run the CSP in report-only mode for a few days, read the reports, then enforce

## Open questions

Answers to these change content, not architecture. The build proceeds under the
assumptions recorded in `src/config/event.ts`.

1. **Year.** The brief describes 2026 in the past tense but gives 15–16 May
   qualifiers, a 30 April deadline and an August final. Built for **2027**.
2. **RoboSumo.** Named as the flagship (Q7) but absent from the disciplines
   table. Modelled as a sixth discipline with its unknown fields marked
   provisional and rendered as "уточняется" rather than invented.
3. **Contacts, domain, hosting, acquiring bank, CRM, analytics** — all blank in
   the brief.

---

## Notes

- `node_modules` sits inside a OneDrive folder. It works, but OneDrive will try
  to sync tens of thousands of files; consider excluding the folder from sync.
- Screenshots could not be captured in the build environment, so the visual
  design has been verified structurally (computed styles, layout geometry,
  responsive overflow, contrast tokens, tap targets) rather than by eye. Give
  it a look on a real device before launch.
