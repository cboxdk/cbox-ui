# Changelog

## 0.8.0 — 2026-11-10

App icons come from Cbox ID's catalog, one light and one dark upload per app. No app keeps a local copy of the marks.

- `CboxAppCatalog` reads `icon_dark_url` next to `icon_url` and shows the icon for the current theme. **Breaking:** the `icons` prop (host-supplied marks) is gone; drop it and delete the app's local marks.
- `CboxAppIcon` renders one app's catalog icon: both uploads, swapped by the token stylesheet under `.dark` or `[data-theme="dark"]`, the initials when there is no icon or it fails to load. Only `https:` icon URLs are rendered.
- `CboxServiceMark` renders an app's own mark from the catalog this browser last kept. `CboxAppCatalog` keeps each answer (`localStorage`, key `cbox-app-catalog`) and tells the page, so the marks paint at once on the next page and repaint when the live answer arrives. `rememberAppCatalog` and `useKnownAppCatalog` are exported for hosts that load the catalog themselves.
- `CboxBrand` in collapsed mode (the rail) shows the app's catalog icon once it is known, and the Cbox icon until then.
- `AppSwitcher` and `AppLauncher`: `CboxAppLink.iconDarkUrl` joins `iconUrl`; both render through `CboxAppIcon`.
- Tokens: `.cbx-app-icon`, `.cbx-app-icon-light`, `.cbx-app-icon-dark` and `.cbx-app-icon-single`.

## 0.7.0 — 2026-11-09

Found while moving Cbox Infra onto the shell:

- `CboxWorkspaceShell`: the most specific href decides the active area and item (an area at the organization root no longer claims every page beneath it); active links carry `aria-current="page"`; the rail's pinned state and the subnav's collapsed state can be controlled by the host (`pinned`/`onPinnedChange`, `collapsed`/`onCollapsedChange`, or `defaultPinned`/`defaultCollapsed`); `brandHref` and `mainId` (default `main-content`, for a skip link). `activeNavArea`, `activeNavItem` and `navMatchLength` are exported for hosts that draw the same navigation elsewhere (a command palette, an eyebrow).
- `CboxAppCatalog`: the Switch-app control fed live from the host's same-origin catalog endpoint (the contract Infra, Signals and Stache each re-implemented), with `refresh_after` polling while open, the reconnect link when the grant is missing, and host-supplied marks. `parseAppCatalog` and `authorizeHref` are exported.
- `UserMenu`: `LinkComponent` for the account and organization rows, so an app whose profile page is its own keeps the visit client-side.
- `CboxUser.id` and `CboxOrganization.id` accept a string as well as a number: the apps mirror Cbox ID's prefixed ids (`usr_…`, `org_…`).
- Tokens: dark mode also applies under `[data-theme="dark"]`, for hosts that store the choice as an attribute and paint it before first paint.
- `interpolate` (the `{name}` placeholder rule the chrome's strings use) is exported, so a host's translator can apply it.
- `LinkComponent` accepts `aria-current`.

- Charts on ECharts in `@cboxdk/cbox-ui/charts`: `TimeChart` (events, per-series lines, zoom) and the `Chart` wrapper; `echarts` ^6 is an optional peer dependency. `Sparkline`, `niceTicks` and `timeTicks` stay in the root entry without ECharts.
- Included from main since 0.6.0: aligned core tokens and two-tier workspace navigation (`CboxWorkspaceShell`), host-owned localization for shared chrome (`CboxLocalizationProvider`), compact context and service branding on mobile, organization breadcrumb avatar geometry. Token values changed, so this is a minor release.
