# cbox-ui — Cbox shared shell and UI (PROVIDER)

This package is the **single source of truth** for the Cbox app shell. Every Cbox app renders its
chrome through `CboxShell` from here. Changes here affect every app in the suite.

## The contract

- **The spec is `docs/specs/2026-11-10-shell-v1.md`.** It records the decisions behind every part. Read it before changing the shell.
- **`CboxShell` renders the whole chrome from one server-built `shell` prop.** The prop is typed by the exported `Shell` and `ContextLevel` types. `cboxdk/laravel-console-kit` (`Console::shell()`) builds it on the server.
- **Apps describe, the shell renders.** An app supplies its nav areas, context levels, search provider, actions, help topic and an optional notification source. It never renders its own rail, header, switchers, palette, Help or account menu, and never copies shell CSS or JS.

## Fixed rules (decided by Sylvester; do not change them without him)

- **Rail:** navigation only. The account menu sits at the bottom of the rail.
- **Header left:** the organization trigger, then one level-2/3 trigger (project · environment cascade).
  - Both triggers are styled alike, with no border.
  - Every context menu has search. Search autofocuses on desktop only (fine pointer + hover), never on touch.
  - Inline "New …" asks for a name only, then the person lands on the details page.
- **Header right, the same order everywhere:**
  1. Search (⌘K)
  2. Help (with the unread support count)
  3. Bell
  4. Switch app

  The bell is rendered **only** when the app has a notification source. A dead or disabled control is never rendered.
- **Help column:**
  - It pushes the page, docked from 1280px wide. Below 1280px it is a full-screen overlay.
  - It persists across page changes.
  - It links to the full support portal.
- **Environments are app-defined:** tone, label and testData come from the app. The sandbox strip shows only on test data.
- **Density:** rows are at least 40px, with 4px between rows. Menus must not feel cramped.
- **Polish is required:**
  - Keyboard and ARIA on every menu.
  - axe is clean.
  - Light and dark are pixel-checked.
  - Every scroll container scrolls on its own and smoothly.

## Breaking change policy

- **Any change to the `Shell` prop types or `CboxShell` props is a minor bump.** Consumers pin `^0.x` (see the `cbox-release` skill).
- **The Laravel side must move in step.** Keep `laravel-console-kit`'s `shell` payload aligned field-for-field.

## Versioning and release

- **Publishing is the `v*.*.*` tag push:** `.github/workflows/release.yml` publishes to npmjs with trusted publishing.
- **Bump `package.json` and `CHANGELOG.md`, then push a tag.** Releases need Sylvester's go (the `cbox-release` skill).

## Before releasing a new version

1. Run `bun run typecheck`, `bun run test` and `bun run build`.
2. Run `bun run test:visual`, which is Playwright in the pinned container via `scripts/visual.sh`, including axe on every open state. Update snapshots only for intended changes.
3. CI must be green on both jobs (test and visual).

## Brand assets

`CboxBrand` loads from `assetBase` (default `/brand`). Consumer apps ship `public/brand/`. App icons come from Cbox ID's app catalog.
