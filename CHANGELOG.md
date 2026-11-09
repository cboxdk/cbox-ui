# Changelog

## Unreleased

- Rows in a rounded panel no longer paint a square hover/active fill over the panel's corners. `DataPanel` carries `cbx-panel` and `RowLink` carries `cbx-row`; the tokens round an edge row to the panel's inner radius without clipping the panel (menus opened from a row stay visible). Blade views use the same classes; set `--cbx-panel-radius` on a container with another radius. The notifications dropdown clips its rows like the other menus.

## Unreleased (`sd/infra-shell-gaps`, found while moving Cbox Infra onto the shell)

- `CboxWorkspaceShell`: the most specific href decides the active area and item (an area at the organization root no longer claims every page beneath it); active links carry `aria-current="page"`; the rail's pinned state and the subnav's collapsed state can be controlled by the host (`pinned`/`onPinnedChange`, `collapsed`/`onCollapsedChange`, or `defaultPinned`/`defaultCollapsed`); `brandHref` and `mainId` (default `main-content`, for a skip link). `activeNavArea`, `activeNavItem` and `navMatchLength` are exported for hosts that draw the same navigation elsewhere (a command palette, an eyebrow).
- `CboxAppCatalog`: the Switch-app control fed live from the host's same-origin catalog endpoint (the contract Infra, Signals and Stache each re-implemented), with `refresh_after` polling while open, the reconnect link when the grant is missing, and host-supplied marks. `parseAppCatalog` and `authorizeHref` are exported.
- `UserMenu`: `LinkComponent` for the account and organization rows, so an app whose profile page is its own keeps the visit client-side.
- `CboxUser.id` and `CboxOrganization.id` accept a string as well as a number: the apps mirror Cbox ID's prefixed ids (`usr_…`, `org_…`).
- Tokens: dark mode also applies under `[data-theme="dark"]`, for hosts that store the choice as an attribute and paint it before first paint.
- `interpolate` (the `{name}` placeholder rule the chrome's strings use) is exported, so a host's translator can apply it.
- `LinkComponent` accepts `aria-current`.

## 0.7.0 — unreleased on npm until published

- Charts on ECharts in `@cboxdk/cbox-ui/charts`: `TimeChart` (events, per-series lines, zoom) and the `Chart` wrapper; `echarts` ^6 is an optional peer dependency. `Sparkline`, `niceTicks` and `timeTicks` stay in the root entry without ECharts.
- Included from main since 0.6.0: aligned core tokens and two-tier workspace navigation (`CboxWorkspaceShell`), host-owned localization for shared chrome (`CboxLocalizationProvider`), compact context and service branding on mobile, organization breadcrumb avatar geometry. Token values changed, so this is a minor release.
