---
version: alpha
name: AstanaTechCup-design-system
description: "A white championship canvas whose entire palette is sampled from the event logo, so the site and the mark cannot drift apart. The logo runs deep navy #00243c into electric blue #0024a8 into magenta #a800b4, with a gold #fcd800 trophy; those four are the whole system. Deep navy is the ink, the 2px outline on every card and mascot, and the dark-section canvas — a dark section is literally the logo plate enlarged. Magenta is reserved for the primary action, electric blue for structure, gold for the arena. Hard bottom-edge shadows make controls read as physical keys, and six original robot mascots carry the friendliness the brief asks for while grid discipline and a fluid modular scale carry the credibility sponsors need."

colors:
  primary: "#0024a8"
  on-primary: "#ffffff"
  primary-strong: "#00243c"
  accent: "#a800b4"
  accent-hover: "#8a0094"
  accent-edge: "#6b0074"
  on-accent: "#ffffff"
  ink: "#00243c"
  ink-muted: "#47576f"
  ink-subtle: "#8d9db4"
  canvas: "#ffffff"
  surface-muted: "#eef2ff"
  surface-sunken: "#edf1f7"
  hairline: "#dde4ee"
  hairline-strong: "#bfcadb"
  focus-ring: "#1f47f0"
  electric-bright: "#3d68ff"
  magenta-bright: "#d940e6"
  gold: "#fcd800"
  inverse-canvas: "#00243c"
  inverse-surface: "#073152"
  inverse-ink: "#ffffff"
  inverse-ink-muted: "#b8c7ff"
  inverse-brand: "#fcd800"
  semantic-success: "#0e9460"
  semantic-danger: "#d02216"
  semantic-warning: "#96601a"

typography:
  display-xl:
    fontFamily: Manrope
    fontSize: clamp(44px, 30px + 4.2vw, 80px)
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: -0.028em
  display-lg:
    fontFamily: Manrope
    fontSize: clamp(36px, 27px + 2.6vw, 60px)
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: -0.028em
  display-md:
    fontFamily: Manrope
    fontSize: clamp(30px, 25px + 1.6vw, 44px)
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: -0.028em
  headline:
    fontFamily: Manrope
    fontSize: clamp(24px, 21px + 0.9vw, 32px)
    fontWeight: 800
    lineHeight: 1.10
  card-title:
    fontFamily: Manrope
    fontSize: clamp(21px, 19px + 0.55vw, 24px)
    fontWeight: 800
    lineHeight: 1.15
  body:
    fontFamily: Inter
    fontSize: clamp(16px, 15.4px + 0.2vw, 17px)
    fontWeight: 400
    lineHeight: 1.65
  body-sm:
    fontFamily: Inter
    fontSize: clamp(14px, 13.6px + 0.13vw, 15px)
    fontWeight: 400
    lineHeight: 1.60
  button:
    fontFamily: Inter
    fontWeight: 700
  eyebrow:
    fontFamily: Inter
    fontSize: clamp(11px, 10.6px + 0.14vw, 12px)
    fontWeight: 700
    letterSpacing: 0.18em
    textTransform: uppercase

spacing:
  section: clamp(64px, 8vw, 120px)
  section-tight: clamp(40px, 5vw, 72px)
  container-inline: clamp(16px, 4vw, 40px)
  container-page: 1280px
  container-wide: 1440px
  container-prose: 736px

radius:
  xs: 8px
  sm: 12px
  md: 18px
  lg: 24px
  xl: 32px
  full: 9999px

elevation:
  tile: 0 5px 0 0 var(--ink)
  tile-hover: 0 8px 0 0 var(--ink)
  tile-press: 0 2px 0 0 var(--ink)
  button-accent: 0 5px 0 0 var(--accent-edge)

motion:
  ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)
  ease-spring: cubic-bezier(0.34, 1.36, 0.64, 1)
  duration-fast: 150ms
  duration-base: 260ms
  duration-slow: 520ms
  robot-float: 4.5s ease-spring infinite
---

# AstanaTechCup — DESIGN.md

## Overview

AstanaTechCup is the national technology championship of Kazakhstan. The
landing page has one job: turn a hesitant visitor — a schoolchild, a parent
paying for the trip, a teacher entering four teams — into a submitted entry.

Every decision below is downstream of that, and of one tension in the brief.
Q16 asks for a look that is **bright and friendly for children**. The same page
has to convince sponsors and national press that this is a serious technology
event. Resolving that with decoration produces a page that is childish to
sponsors and corporate to children.

The resolution is **"Playful Arena"**: a toy language executed with precision.
Chunky rounded shapes, solid dark outlines and hard bottom-edge shadows make
controls look like objects you can press; six original robot mascots give the
page a cast. That is where the friendliness lives. The credibility lives in
grid discipline, a strict type scale and generous whitespace — nothing here is
childish, but a great deal of it is child-friendly.

Dark sections are used as deliberate punctuation — two of them, no more — so
they read as "the arena" rather than as a theme.

> **The palette is sampled from the supplied logo**, not invented. Every hex in
> the `colors` block above was measured out of
> `/public/brand/astanatechcup.png`. If the mark is ever revised, re-sample
> rather than eyeball: edit the primitive layer in `src/app/globals.css` and
> update the block above in the same pass, or the two drift.

## Colors

Three layers, in strict order. **Layer 1 is the only place a hex code may
appear.** Components never reference a primitive.

**1. Primitive** — raw ramps, every one sampled from the logo:
`--deep-950…600` (the navy of the mark), `--electric-50…900` (its blue run),
`--magenta-50…900` (its purple run), `--gold-100…600` (the trophy), and
`--ink-0…900` neutrals tinted toward the navy so nothing reads as flat grey.

**2. Semantic** — role names that components consume: `--surface`, `--text`,
`--brand`, `--accent`, `--border`, `--focus-ring`.

**3. Utility** — Tailwind classes generated from layer 2: `bg-surface`,
`text-muted`, `border-line`, `text-brand`, `bg-accent`.

### The signal colour rule

`--accent` (#a800b4, the magenta of the logo) is reserved **exclusively** for
the primary call to action and for deadline urgency. Nothing else on the page may use that hue. That one
constraint is what makes the primary action unambiguous on every screen without
any other element having to shout.

If two accent-coloured buttons are visible at once, one of them is wrong.

**Why magenta and not the blue of the logo.** Magenta is the one hue in the
mark that is neither the structural blue nor the gold, so a CTA can never be
mistaken for a heading or a medal. It also measures 6.32:1 against white —
comfortably past WCAG AA for normal-size text, which the `sm` and `md` button
labels are. Measured on the rendered buttons, not assumed from the tokens.

The brighter `--magenta-500` and `--electric-500` steps stay available for
mascot bodies and glows, where the 3:1 graphics threshold applies and every
shape carries a dark outline anyway.

### Dark sections

Applying `.on-dark` re-points the semantic layer — the canvas becomes
`--deep-900` (#00243c), which is *the plate border of the logo itself*, so a
dark section reads as the mark enlarged rather than as a generic dark theme.
`--brand` becomes gold, borders become translucent electric blue, and `--ink`
deliberately stays dark so mascot outlines still read against their light
chips. Every nested component adapts
automatically. **This is the entire dark-section implementation; there are no
per-component `dark:` variants and there must not be any.**

Used in exactly two places: the RoboSumo flagship block and the RobotChallenge
prize block. Both are moments of drama, and both earn it.

### Discipline accents

Six disciplines each carry a `hue` value in `src/config/event.ts`, rendered
through one controlled rotation at fixed saturation and lightness.

The arc is chosen to sit inside the range of the logo rather than to span the
colour wheel: gold 45° (RoboSumo, the flagship — the trophy hue), cyan 190°,
teal 160°, electric 220°, violet 265°, magenta 305°. Six related hues read as
one family; six arbitrary brand colours read as a sticker sheet.

## Typography

Manrope for display, Inter for body. Both self-hosted through `next/font`, so
there is no request to a third-party font host — which keeps `font-src 'self'`
in the Content-Security-Policy and leaks no visitor IP addresses.

**Non-negotiable constraint:** the site sets Russian, Kazakh and English.
Kazakh needs **ә ғ қ ң ө ұ ү һ і**, which live outside the basic Cyrillic
block. Any replacement face must ship the `cyrillic-ext` subset. A face without
it renders those letters as tofu, and nobody notices until a Kazakh speaker
opens the page.

The scale is fluid via `clamp()` — a 1.25 ratio at mobile widening to 1.333 at
desktop. Headings use `text-wrap: balance`, body copy uses `text-wrap: pretty`.

Numerals in the countdown and the stat counters use `.tabular` so digits do not
jitter as they tick.

## Layout

- **Containers:** `container-page` (80rem), `container-wide` (90rem),
  `container-prose` (46rem). Inline padding `clamp(1rem, 4vw, 2.5rem)`.
- **Section rhythm:** `clamp(4rem, 8vw, 7.5rem)` block padding, giving the page
  a consistent heartbeat. This is most of what makes it feel composed.
- **Measure:** section headers cap at `max-w-3xl`. Full-width running text is
  never acceptable.

### Page argument

Section order is the persuasive argument, in order: what this is → is it real →
the hook → what you can enter → how it works → what you win → who you are →
**sign up** → your objections → proof → who runs it → how to reach them.

Registration sits deliberately in the middle rather than at the end: by that
point the visitor has the discipline, the path and the prize, which is
everything needed to decide. The FAQ then catches whoever still hesitates, and
every one of its answers targets a barrier the brief actually named — cost,
travel, accommodation, skill level, unclear rules, fear of not qualifying.

## Elevation & Depth

Shadows are **tinted with the brand hue** (`rgb(13 28 64 / …)`), never neutral
grey. Grey shadows on a blue-tinted page read as dirt.

| Token | Use |
| --- | --- |
| `--shadow-sm` | Resting cards; sticky header once scrolled |
| `--shadow-md` | Card hover |
| `--shadow-lg` | Raised panels, the hero deadline card |
| `--shadow-xl` | Consent banner, modal surfaces |
| `--shadow-signal` | Accent buttons only — an orange glow, not a shadow |

Two decorative treatments, both pure CSS: `.aurora` (soft radial brand glow
behind hero and flagship art) and `.grid-texture` (circuit-board grid for dark
sections, radial-masked). No image request, no CSP exception, no layout cost.

## Shapes

`--radius-xs` 8px · `--radius-sm` 12px · `--radius-md` 18px · `--radius-lg` 24px
· `--radius-xl` 32px. Buttons and pills are fully rounded.

Radius is the single strongest lever on how "toy" the page reads, which is why
this scale is generous. Rule of thumb: the larger the surface, the larger the
radius. An 8px radius on a hero panel looks like a mistake; a 32px radius on an
input looks like a joke.

### The tile

`.tile` is the signature treatment: a 2px `--ink` outline, `radius-lg`, and a
**solid** 5px bottom edge instead of a blur. `.tile-interactive` lifts it to 8px
on hover and sinks it to 2px on press. That press physics is what makes a card
feel like an object rather than a drawing of one.

## Logos

Three supplied marks live in `/public/brand`, registered with their intrinsic
dimensions in `BRAND_ASSETS` (`src/config/event.ts`) so `next/image` reserves
the right box and nothing shifts while they load.

| Asset | Used in |
| --- | --- |
| `astanatechcup.png` | Header, footer, admin shell, admin login |
| `smarthub.png` | Hero credits, partners grid, footer |
| `azgroup.png` | Hero credits, partners grid, footer |

**The plate rule.** The championship mark is drawn as a white plate with a
#00243c border — the same navy the dark sections use. Dropped straight onto the
footer it loses its outline entirely and the pixel letters sit on nothing. So
`<Logo plate />` renders it on its own white panel. That is not a workaround; it
is how the mark is constructed. The organiser marks are dark-on-transparent and
need the same treatment on any `.on-dark` surface.

Sizing is by height only (`h-9`, `h-11`); width follows from the intrinsic
aspect ratio, so a mark can never be stretched. Mind that AZ Group is roughly
7.7:1 — at `h-14` it is over 400px wide, which is why it is given a smaller
height than SmartHub wherever the two sit side by side.

Each `alt` is the name of the organisation and the visible label states the role
(Organiser, Co-organiser), so the credit survives with images off.

## Mascots

Six original robot characters live in `src/components/ui/robots.tsx`, one per
discipline, plus a larger waving hero robot.

**They are original work.** Drawn from primitives, not traced from any existing
character. A national championship must not ship someone else's mascot, however
the brief gets interpreted.

Construction rules that keep them a set rather than six drawings:

- One 96×96 viewBox, one 2.4px outline weight, one shared `Eyes` component with
  a highlight dot — that highlight is most of what makes them read as alive.
- Body colour comes from `--r-accent`, which `.discipline-accent` points at the
  card's own hue. A card drives its robot; no robot carries its own palette.
- Outlines always use `--ink`, never `currentColor`, so they stay dark on a
  light chip inside a dark section.
- Sized in `em`, so a parent's `font-size` scales the whole character.

Every mascot is decorative: `aria-hidden`, `focusable="false"`, and carrying no
meaning that is not already in adjacent text. Where they are absolutely
positioned they also get `pointer-events-none`, so a robot can never swallow a
tap meant for the CTA behind it.

Inline SVG, no image requests — which keeps `img-src 'self'` honest, costs no
round trip, and stays sharp on a 3× phone screen.

On mobile the hero mascots are hidden below `sm`/`lg`. At 375px they would
crowd the headline, and the discipline cards already supply the cast.

## Components

### Buttons

Four variants — `accent` (the single primary action), `solid`, `outline`,
`ghost` — at three sizes with `min-h` 44 / 48 / 56px.

Two rules learned the hard way:

- **Never `whitespace-nowrap`.** Russian and Kazakh labels run far longer than
  their English equivalents; "Подать заявку и перейти к оплате" measures 402px
  on one line and overflows a 375px viewport. Labels wrap and the height grows.
- **`min-h`, never a fixed `h`.** A wrapped two-line label must grow the
  button, not spill out of it.

`Button` and `ButtonLink` are separate components on purpose. A link and a
button are different things to a keyboard and a screen reader, and blurring
them produces a "button" that cannot be opened in a new tab.

### Cards

White panel, hairline border, `radius-lg`, `p-6`. Hover lifts 4px and deepens
the shadow on `ease-out-expo`. Metadata rows are pushed down with `mt-auto` so
every card in a grid aligns regardless of description length.

### Form fields

48px control height and a real `<label>` bound by id — **never a placeholder
doing duty as a label**, which vanishes the moment you start typing. Hints and
errors wire through `aria-describedby`; errors set `aria-invalid` and carry
both an icon and text, so state is never conveyed by colour alone.

### Section header

`eyebrow → title → subtitle`, identical from the top of the page to the bottom.
That repetition is most of what makes a landing page feel designed rather than
assembled.

## Motion

`--ease-out-expo` for entrances: fast start, long settle. `--ease-spring` for
playful accents.

Scroll reveals run **once**. Re-animating on every scroll past is a nausea
trigger and makes a long page feel unstable.

Every animation is gated on `prefers-reduced-motion`, checked in **both** CSS
and JS — Framer Motion animates through inline styles that a CSS override
cannot reach.

> ⚠ **Content must never depend on JavaScript to become visible.** Reveal
> components start at `opacity: 0`; if the IntersectionObserver never fires,
> the content stays invisible forever — and `innerText` still reports it, so no
> text-based check catches it. `Reveal` therefore probes whether the observer
> works and degrades to plain content if it does not. Keep that failsafe.

## Do's and Don'ts

**Do**

- Put every new colour through the primitive → semantic → utility chain.
- Use `.on-dark` for dark sections and let nested components adapt.
- Keep tap targets at 44px or more. The audience is children and parents on
  phones. Inline links inside running text are the only exemption.
- Let long localised labels wrap.
- Check every new string in all three locales before shipping.

**Don't**

- Don't write a hex code in a component file.
- Don't use the accent hue for anything but the primary action and deadlines.
- Don't add a third dark section — the drama comes from scarcity.
- Don't add `dark:` variants; `.on-dark` is what exists instead.
- Don't choose a typeface without `cyrillic-ext`.
- Don't remove a focus ring.

## Responsive Behavior

Mobile-first, and not as a slogan: the audience arrives predominantly from
Instagram and WhatsApp on phones, from regional schools on modest connections.

- **375px is the design floor** and is verified to have zero horizontal
  overflow. Any new section must be checked at that width.
- Discipline and audience grids run 1 → 2 → 3 columns.
- The journey timeline is vertical on mobile and horizontal from `lg`, where
  the connector has room to read as progress.
- The registration fee summary is sticky from `lg` so the price and what it
  includes stay visible through a long form — the most common reason a paid
  registration is abandoned.
- Wide content scrolls inside its own container; the page body never scrolls
  horizontally.

## Accessibility

Target is **WCAG 2.2 AA**, treated as a design constraint rather than a later
audit.

- One `h1` per page, no skipped heading levels.
- Every section is `aria-labelledby` its own heading; every nav is labelled.
- A visible focus ring on everything, never removed.
- The FAQ is built on native `<details>` / `<summary>` — no ARIA to get wrong,
  it works before hydration, and Ctrl+F still finds answers inside collapsed
  panels.
- `<html lang>` switches correctly between `ru-KZ`, `kk-KZ` and `en`.
- Zoom is never locked.

## Iteration Guide

**Re-skinning to the real brandbook:** edit the primitive layer in
`src/app/globals.css`, then update the `colors` block at the top of this file.
Nothing else changes.

**Adding a section:** wrap it in `<Section>`, lead with `<SectionHeader>`, use
`<Reveal>` for entrances, and verify at 375px.

**Adding a discipline:** add it to `src/config/event.ts` with a `hue`, add its
copy to all three catalogs, and run `npm run check:messages`. The card, the
form option, the validation rules and the terms all follow automatically.

## Known Gaps

- Logos are supplied and in place, and the palette is derived from them. A full
  brandbook (typography rules, spacing, print specs) has still not been seen, so
  the type choices remain ours rather than those of the organiser.
- No photography or video: the gallery renders correctly-sized placeholders, so
  dropping real assets in changes no geometry.
- Partner logos not supplied; the wall renders an honest note rather than fake
  logos.
- Light-only. A full dark mode is a separate design job, and "bright and
  friendly for children" does not obviously translate into one.
- Kazakh copy needs a native-speaker review before launch.
