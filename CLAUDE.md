# cbox-ui — Cbox Shared Chrome Library (PROVIDER)

This package is the **single source of truth** for Cbox platform chrome. Every sister app renders its chrome through components exported from here. Changes here affect every app in the suite.

## Role in the Platform

cbox-ui is the chrome PROVIDER. It must never drift — the six required chrome elements are locked into `CboxAppShell` so they cannot be omitted or reordered per-app.

## Chrome contract exported by this package

`CboxAppShell` renders all six required chrome elements:
1. Sidebar (`CboxAppSidebar`) with brand + nav sections + collapse toggle
2. AppSwitcher (left topbar cluster)
3. OrgSwitcher slot (`topbarCentre` prop — consumer passes `CboxOrgContextBar`)
4. SearchTrigger (right topbar cluster) — always rendered
5. NotificationsBell (right topbar cluster) — always rendered
6. UserMenu (right topbar cluster)

**Never make any of these six elements conditional or removable by consumer props.** If a consumer needs to gate the BEHAVIOUR of a slot (e.g. search not wired), gate the behaviour — not the presence of the element.

## Breaking change policy

Any change to `CboxAppShell`'s props API is a minor or major version bump. Consumers pin to `^0.x.0` — a patch release must not break existing prop shapes.

## Versioning

Current: `0.5.0`. Next minor: `0.6.0`. Bump `package.json` version and push a git tag (`v0.x.y`) on every release. Publish to npm registry under `@cboxdk` scope.

## Brand assets

The `CboxBrand` component loads from `assetBase` (default `/brand`). Every consumer app must ship `public/brand/` with all 6 standard assets. This package does NOT bundle the brand assets — it only references them by URL.

## Consumer apps

- `id` (chrome HOST — uses `AppShell + AppSidebar + AppContent + TopBar` directly because it is the platform identity app; NOT a consumer of `CboxAppShell`)
- `webhooks` (consumer — uses `CboxAppShell`)
- `cbox-secrets` (consumer — uses `CboxAppShell`)
- `notifications` (consumer — uses `CboxAppShell`)
- future apps must scaffold from `cbox-starter` which ships `CboxAppShell` by default

## Before releasing a new version

1. Verify all six chrome elements still render on each of the 4 local test apps
2. Run Playwright and screenshot id.test, secrets.test, webhooks.test, notifications.test
3. Bump version in `package.json`
4. Tag the release: `git tag v0.x.y && git push origin v0.x.y`
5. Publish: `npm publish --access public`
6. Consumers bump their `@cboxdk/cbox-ui` pin and run `bun install`
