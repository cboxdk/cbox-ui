# Changelog

## 0.10.0 — unreleased

One shell for every Cbox app (spec `docs/specs/2026-11-10-shell-v1.md`). It replaces the two shell models, the five organization switchers and the hand-placed support of 0.9.

**Breaking.** This is a breaking minor under the 0.x caret rules: `^0.9.0` does not pick it up.

### Added

- `CboxShell`, rendered from one server-built prop, `shell`. Its TypeScript contract is exported: `Shell`, `ContextLevel`, `ContextItem`, `ContextTone`, `NavArea`, `NavPage`, `PaletteAction`, `ShellHelp`, `ShellNotifications`, `ShellAccount`, `ShellBanner`, `ShellPreferences`, `ShellNavigate`, `ShellPreferenceChange`, `AppKey`.
- Rail with the account button at the bottom; pin, Help open and subnav collapse reported through `onPreferenceChange` for the host to persist (a `cbox_shell_<key>` cookie without it) and read back from `shell.preferences` before first paint.
- Header: the organization trigger and one trigger for level 2 and 3, styled the same; Search (⌘K); Help with the unread support count; the bell only when the app has a notification source; Switch app.
- Context menus with search in every menu (it focuses itself only with a fine pointer), lazy lists from `listUrl` (`?q=`, `?parent=`, cursor pages), a gear per row from the `settingsUrl` template, inline "New …" (name only, `POST createUrl`, then the returned details page), and the project/environment cascade: hover or focus previews a project's environments, an environment switches both, a project keeps the environment of the same name, else its first. Environments carry an app-defined tone square, label and test-data flag; the sandbox strip shows only while the current one has test data.
- Command palette: Pages, Records, Actions, Go to, Docs and help, Ask Cbox; 120 ms debounce; each server group loads on its own; five per group, then "Show all in {group}"; ⌘Enter opens in a new tab.
- Help column: support updates (unread, mark read), docs and knowledge base search, three articles for the page's topic (shown in the column), Ask Cbox through the Assistant SDK's `<cbox-support>` with the page intent, Talk to a person, the support portal. Docked from 1280px (360px, 400px from 1440px), a full-screen dialog below; its state lives outside React and survives Inertia visits and remounts. It says so when Assistant is unavailable.
- Switch app grid: 440px, three columns, 48px tiles in each app's fixed hue (`APP_HUES`, or the catalog's `hue`), name and purpose; "In {organization}" and "More from Cbox" (dimmed, to `admission_url`); "All products". `parseShellCatalog` reads the catalog's new `in_organization`, `admission_url`, `purpose` and `hue`.
- Account menu: Profile and security, language, regional format and time zone (searchable lists), theme System/Light/Dark, Switch account, Sign out.
- Phone layout below 768px: ☰ navigation sheet (areas, pages, Switch app, notifications, account), one context button opening every level stacked, Search, Help full screen.
- `applyTheme`, `themeBootScript`, `useShellHelp`, `createHelpStore`, `pageIntent`.
- `tokens/shell.css` (imported by `tokens/cbox.css`, also exported as `@cboxdk/cbox-ui/shell.css`): plain CSS on the shared tokens, so the shell needs no Tailwind scan.
- Unit tests for every behaviour in §12.3 and Playwright snapshots of every open state at 1440 and 390, light and dark (`bun run test:visual`).

### Removed

- `CboxAppShell`, `CboxAppSidebar`, `CboxWorkspaceShell` (with `activeNavArea`, `activeNavItem`, `navMatchLength`, `CboxNavArea`, `CboxNavItem`, `CboxNavSection`, `LinkComponent`), `TopBar`, `OrgSwitcher`, `CboxOrgContextBar`, `AppLauncher`, `AppSwitcher` (React), `UserMenu`, `SearchTrigger`, `NotificationsBell`, `CboxMobileNavDrawer`, `ContextBar` (with `ContextAvatarChip` and its types).
- The `search`, `activity` and `help` surface stubs: `SurfaceId` is `'inbox'`; `Transport.urls.search` and `SurfaceConfig.search` are gone.
- The `.cbx-workspace*`, `.cbx-rail*` and `.cbx-subnav*` rules of the old workspace shell in `tokens/cbox.css` (the new shell has its own in `tokens/shell.css`).

`<cbox-app-switcher>`, `<cbox-service-mark>` and `CboxAppCatalog` stay for apps that have not moved yet.

### Migration

1. The server shares `shell` (laravel-console-kit's `HandleShell`), with the list, create, switch, search and help endpoints described in the README ("The shell").
2. Render `<CboxShell shell={shell} LinkComponent={Link} navigate={…} onPreferenceChange={…}>` in the Inertia persistent layout, in place of `CboxAppShell`/`CboxWorkspaceShell` and the app's own header, org switcher, user menu, bell, search trigger and mobile drawer.
3. Put the theme on `<html>` before paint (server-side class, or `themeBootScript`), and read `railPinned`, `helpOpen` and `subnavCollapsed` from the cookie into `shell.preferences`.
4. Remove the app's copied `shared-shell.css`, `app-switcher.ts`, `Shell.tsx`, `service-marks.json`, `chrome/*`, and its own `<cbox-support>` mount: the Help column mounts it.
5. Rename "Workspace", "Tenant" and "Team" to "Organization" in the app's strings.

## 0.9.0 — 2026-11-10

One Switch-app control for every Cbox app. Until now each Blade app carried its own copy of `app-switcher.ts` and its CSS, and they had drifted apart.

- New entry `@cboxdk/cbox-ui/app-switcher` (ESM, no React): importing it defines `<cbox-app-switcher endpoint current labels theme>` and `<cbox-service-mark service theme>`. Both render in a shadow root with their own styles (constructed stylesheets, so a strict `style-src` CSP is fine), so no app stylesheet can change them; they take only the Cbox colour tokens, each with a fallback.
- Icons only from the catalog's `icon_url`/`icon_dark_url`, swapped with the theme (`.dark`/`[data-theme]` on the root, else `prefers-color-scheme`; `theme="class"` for hosts whose tokens only follow `.dark`). Initials, on the same small tile, when an app has no icon or its icon fails; a real icon never sits on a tile.
- **Breaking:** no "Reconnect to Cbox ID" link and no "Try again" button. A `401 { signin_url }` sends the top window to `signin_url` when the person opens the control; the legacy `{ authorize_url }` the same way with `return_to`. A guard stops it from looping. Network and server errors show "Apps could not be loaded." and retry by themselves with backoff. The `retry` and `reconnect` labels are ignored.
- **Breaking:** `CboxAppCatalogState`'s `authorization_required` is now `signin_required` with `signinUrl` and `authorizeUrl`. `signInTarget` is exported.
- `CboxAppCatalog` is now a thin wrapper that renders `<cbox-app-switcher>`, so React and Blade apps are identical. It takes `theme`.
- The kept catalog (`localStorage` `cbox-app-catalog`) also keeps `launch_url`, so the grid paints at once on the next page. `readKnownAppCatalog` is exported from the root entry.
- Arrow keys, Home and End move between tiles; Tab stays in the panel; Escape closes it and gives focus back to the button.

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
