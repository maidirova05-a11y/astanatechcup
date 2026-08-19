---
version: alpha
name: AstanaTechCup-design-system
description: "A light-dominant championship canvas built on white (#ffffff) with an Astana night-sky blue (#1b3c8c) as the structural brand and a single reserved signal orange (#ff6b35) that appears only on primary actions and deadline urgency. The system resolves a deliberate tension: the brief asks for something bright and friendly to children, while sponsors and press must read a serious national technology event. The answer is not decoration but discipline — premium quality comes from layout rigour, a fluid modular type scale and generous whitespace, with near-black blue (#060e22) sections used as sparing punctuation so they read as the arena. Display type is Manrope 800 with tight negative tracking; body is Inter. Cards are white panels on a pale blue wash (#f1f6fe) with hairline borders and blue-tinted shadows — never neutral grey. Six discipline accents are derived from one controlled hue rotation so they read as a family rather than a sticker sheet."

colors:
  primary: "#1b3c8c"
  on-primary: "#ffffff"
  primary-strong: "#0d1c40"
  accent: "#ff6b35"
  accent-hover: "#e8500f"
  on-accent: "#ffffff"
  ink: "#151a21"
  ink-muted: "#515b6b"
  ink-subtle: "#9ba6b8"
  canvas: "#ffffff"
  surface-muted: "#f1f6fe"
  surface-sunken: "#f8f9fb"
  hairline: "#e0e5ed"
  hairline-strong: "#c7cfdc"
  focus-ring: "#326ada"
  energy-cyan: "#22d3ee"
  energy-violet: "#a78bfa"
  inverse-canvas: "#060e22"
  inverse-surface: "#0d1c40"
  inverse-ink: "#ffffff"
  inverse-ink-muted: "#bfd5fa"
  inverse-brand: "#22d3ee"
  semantic-success: "#16a34a"
  semantic-danger: "#dc2626"
  semantic-warning: "#b45309"

typography:
  display-xl:
    fontFamily: Manrope
    fontSize: clamp(44px, 30px + 4.2vw, 80px)
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: -0.022em
  display-lg:
    fontFamily: Manrope
    fontSize: clamp(36px, 27px + 2.6vw, 60px)
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: -0.022em
  display-md:
    fontFamily: Manrope
    fontSize: clamp(30px, 25px + 1.6vw, 44px)
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: -0.022em
  headline:
    fontFamily: Manrope
    fontSize: clamp(24px, 21px + 0.9vw, 32px)
    fontWeight: 800
    lineHeight: 1.10
    letterSpacing: -0.02em
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
  xs: 6px
  sm: 8px
  md: 14px
  lg: 20px
  xl: 28px
  full: 9999px

motion:
  ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)
  ease-spring: cubic-bezier(0.34, 1.36, 0.64, 1)
  duration-fast: 150ms
  duration-base: 260ms
  duration-slow: 520ms
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

The resolution is **"Bright Tech"**: a light-dominant page whose premium
quality comes from layout rigour, typographic scale and whitespace rather than
from visual effects. Playfulness lives in colour, motion and illustration.
Credibility lives in grid discipline and type. Dark sections are used as
deliberate punctuation — two of them, no more — so they read as "the arena"
rather than as a theme.

> ⚠ **The palette is a documented placeholder.** The organiser's brandbook
> exists but has not been supplied. Replace the primitive layer in
> `src/app/globals.css` and the entire site re-skins without touching a single
> component. Update the `colors` block above in the same pass so the two never
> drift.

## Colors

Three layers, in strict order. **Layer 1 is the only place a hex code may
appear.** Components never reference a primitive.

**1. Primitive** — raw ramps: `--blue-50…950`, `--cyan-300…500`,
`--violet-300…500`, `--signal-300…700`, `--neutral-0…900`, plus status hues.

**2. Semantic** — role names that components consume: `--surface`, `--text`,
`--brand`, `--accent`, `--border`, `--focus-ring`.

**3. Utility** — Tailwind classes generated from layer 2: `bg-surface`,
`text-muted`, `border-line`, `text-brand`, `bg-accent`.

### The signal colour rule

`--accent` (#ff6b35) is reserved **exclusively** for the primary call to action
and for deadline urgency. Nothing else on the page may use that hue. That one
constraint is what makes the primary action unambiguous on every screen without
any other element having to shout.

If two accent-coloured buttons are visible at once, one of them is wrong.

### Dark sections

Applying `.on-dark` re-points the semantic layer — surfaces invert, `--brand`
becomes cyan, borders become translucent white. Every nested component adapts
automatically. **This is the entire dark-section implementation; there are no
per-component `dark:` variants and there must not be any.**

Used in exactly two places: the RoboSumo flagship block and the RobotChallenge
prize block. Both are moments of drama, and both earn it.

### Discipline accents

Six disciplines each carry a `hue` value in `src/config/event.ts`, rendered
through one controlled rotation at fixed saturation and lightness. Six related
hues read as one family; six arbitrary brand colours read as a sticker sheet.

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

`--radius-xs` 6px · `--radius-sm` 8px · `--radius-md` 14px · `--radius-lg` 20px
· `--radius-xl` 28px. Buttons and pills are fully rounded.

Rule of thumb: the larger the surface, the larger the radius. A 6px radius on a
hero panel looks like a mistake; a 28px radius on an input looks like a toy.

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

- Brandbook, logo and brand colours were not supplied — the palette and the
  wordmark are placeholders.
- No photography or video: the gallery renders correctly-sized placeholders, so
  dropping real assets in changes no geometry.
- Partner logos not supplied; the wall renders an honest note rather than fake
  logos.
- Light-only. A full dark mode is a separate design job, and "bright and
  friendly for children" does not obviously translate into one.
- Kazakh copy needs a native-speaker review before launch.
