# Cbox brand guidelines

Living document. Update as the brand matures — but commit the changes here, not in 5 different places across the apps.

## Voice

- **Refined-minimal, not maximalist.** Every Cbox surface should feel like an instrument: precise, quiet, dependable. We're building infrastructure, not entertainment.
- **Operationally honest.** Status pills say "trial — 7 days left", not "🎉 you're trialing!". Numbers, dates, and amounts are first-class — never hidden behind icons.
- **Danish-first, English-default.** Customer-facing strings ship in English; Danish localisation is a translation layer, not a separate brand voice.

## Typography

| Slot | Family | Notes |
|---|---|---|
| Display + sans | **Plus Jakarta Sans** | Headings, body, UI labels. Loaded via the host app's font setup. |
| Mono | **JetBrains Mono** | Code, IDs, timestamps, currencies. Surface when precision matters. |

We do **not** use Inter, Roboto, or any system-default font — those are explicitly rejected for being too "generic SaaS". Plus Jakarta Sans is the brand voice in pixels.

## Colour system

Tokens live in [`tokens/cbox.css`](./tokens/cbox.css). Read those — they're the source of truth. Highlights:

- **Primary**: deep blue (`oklch(0.45 0.16 258)` light, `oklch(0.65 0.18 258)` dark). Used for accents, focus rings, the active-tab underline.
- **Canvas**: a slightly cooler near-white (`oklch(0.975 0.008 250)`) so cards on top feel like they sit *on* a surface, not float in void.
- **Cards**: pure white in light, `oklch(0.2 0.01 250)` in dark. Subtle 1px border (`--color-border`) and a 1px shadow.
- **Tones**: success (green), warning (amber), info (cyan-blue), destructive (red). Each has a `-soft` variant for badge backgrounds and a foreground pair.

### Don't

- Mix tones inside a single component — pick one and commit to it.
- Use full-saturation colours for background fills. The `-soft` variants exist for that.
- Introduce new colour scales without updating `tokens/cbox.css` — drift kills brand consistency faster than anything else.

## Iconography

- **Lucide** for the standard set (24/16px outline icons).
- **Custom Cbox icons** (logos, app monograms, brand marks) live in `assets/`. SVG only.
- Icon size: `h-3.5 w-3.5` for inline tab/menu icons, `h-4 w-4` for buttons, `h-5 w-5` for empty-state heroes.

## Radius

- `--radius: 0.625rem` (10px) for cards + dialogs.
- `--radius-md: 8px` for buttons + inputs.
- `--radius-sm: 6px` for badges + small chips.

Uniformity matters more than the exact pixel — **don't round everything**, but never mix sharp corners with our chosen radii in the same component.

## Motion

- **Cubic-bezier(.4, 0, .2, 1)** for state transitions (the default Tailwind `transition`).
- **150ms** for hover/focus, **200ms** for menu open/close, **300ms** for layout shift.
- Avoid spring physics, fancy easing curves, or anything that draws attention to motion itself. The user shouldn't notice the animation — they should notice that things feel responsive.

## Layout rhythm

- Top bar: 56px (`h-14`).
- Sidebar: 240px collapsed, 280px expanded.
- Page max-width: untyped — pages span the full content area, sections inside use `max-w-*` as needed.
- Vertical spacing between sections on a page: `space-y-6` (24px).
- Padding inside `DataPanel`: 20px (`px-5 py-4`).

## Naming

- App keys are short, lowercase, single-word: `id`, `cortex`, `atlas`, `track`.
- App display names use Title Case: "Cbox · ID", "Cbox · Cortex" with the middle dot as separator.
- Avoid emoji in product names. The middle dot does the same job, more elegantly.

## Asset checklist (what should land in `assets/` over time)

- [ ] Wordmark — full-colour, white-on-dark, monochrome variants in SVG.
- [ ] App monograms — single-letter mark per app (I, C, A, T) sized for both 24px and 64px contexts.
- [ ] Favicon — 32×32, 16×16 ICO + `apple-touch-icon` PNG.
- [ ] Open Graph image template — 1200×630 PNG with the brand wordmark + a per-app variant.
- [ ] Email-header artwork — used by the notifications module's email channel.

We don't have these yet — the v0.1 of the package ships with the typography + colour + chrome contract. Logos / artwork land as they're produced.
