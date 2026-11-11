# Changelog

## 0.11.1 — 2026-11-11

The phone shell feels like an app: sheets drag and resize, the page behind holds still, nothing
zooms by accident and every list scrolls both ways. No prop changes; nothing for apps to change
in code. Apps should check their viewport meta tag (below).

### Fixed

- **Switch app on the phone got stuck** ("scrolls one way, then won't come back"). The app grid
  inside the sheet was a scroll container of its own (`.cbx-menu-apps { overflow-y: auto }`,
  given an 8px phantom range by the footer's negative margin) nested in the sheet's scrolling
  body. iOS latches a gesture onto the innermost scroller and bounces it at its edge instead of
  handing it to the body, so the body could not scroll back. Inside a sheet, menus and lists no
  longer scroll on their own: each sheet has one scroller, its body.
- **The page behind a sheet scrolled.** `overscroll-behavior: contain` on the sheet body was
  all there was, and iOS ignores it when the gesture starts on the header or a list is at its
  edge. A counted scroll lock now holds the page while any sheet, the palette or the phone's
  Help is open (`overflow: hidden` on the root, plus a touch guard that cancels any touch that
  would scroll outside the open layer or past a list's edge; pinch-zoom is never taken). The
  scroll position, and a scrollable `<main>`/`scroll-region` if an app has one, come back
  unchanged on close. No `position: fixed` on the body, so the sticky top bar does not jump.
- **Closing a sheet scrolled the page** in Safari: focus went back to the opener with
  scrolling. It now returns with `preventScroll`.
- **A swipe across the scrim closed the sheet** (it closed on pointer down). It now closes on a
  tap that starts and ends on the scrim.

### Changed

- **Sheets drag like iOS sheets** (every bottom sheet: Where you work and its steps, Switch app,
  create, Help, the palette). The grab handle and header drag; the content drags from its top,
  or upward while the sheet can still grow. Detents: a sheet that fits its content opens at
  most about half way (60%) and grows to 92% when there is more; tall sheets open at 90% (the
  palette 94%) and rest at half the screen too. Pulled well down or flicked down, it closes.
  Pointer events and inline height/transform, no new dependency; `prefers-reduced-motion`
  turns the settle animation off.
- **No accidental zoom:** fields in the shell are 16px on a phone or touch screen, and fields
  in the page are 16px in the phone layout (iOS zooms into anything smaller).
  `touch-action: manipulation` on the phone shell and on overlays stops double-tap zoom;
  pinch-zoom is untouched.
- **Ordinary pages:** the root gets `overscroll-behavior-y: none` while the phone layout is
  on, so the page scrolls under the fixed top bar and tab bar without the whole document
  rubber-banding (this also turns off Chrome's pull-to-refresh in the phone layout).
- **On-screen keyboard:** the shell tracks the visual viewport (`--cbx-keyboard`, `--cbx-vvh`
  on `<html>`); bottom sheets and the palette sit above the keyboard and fit what is visible,
  and the tab bar hides while a field has the keyboard up instead of riding over the page.
- Sheet heights use `dvh` (with the `svh` values as fallback).

### Added

- **No double title on the phone.** The top bar shows the area's name large; a page heading
  saying the same is now hidden on the phone (kept for screen readers). `PageHeader` does it by
  itself when its `title` is a string equal to the area's name (case and spacing ignored), and
  drops its `?` there (the top bar has Help). An app's own heading opts in with the
  `data-cbx-page-title` attribute. `useShellPageTitle()` returns the top bar's title on the
  phone (`null` on a desktop) for apps that lay out their own header. Desktop is unchanged.

### For apps

- The viewport meta tag should be
  `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`.
  The shell does not rewrite `<head>`. Do not add `maximum-scale` or `user-scalable=no`.
- An app that renders its own page heading (not `PageHeader`) adds `data-cbx-page-title` to it,
  and can drop any per-app hack that hid a duplicate title on the phone.
- Keep the app's own phone fields at 16px or more (an app that styles fields in a later cascade
  layer than the shell CSS keeps its own size).

## 0.11.0 — 2026-11-11

The phone layout is the approved V6 design, plus V7's create sheet. Every addition to the
`shell` prop and `CboxShell` is optional: a 0.10 prop renders, on a desktop as before.

### Changed

- **Phone (< 768px): new chrome.** A top bar with the context pill (organization chip, the
  levels above the deepest small, the deepest large with its environment colour), Help with an
  unread dot, Search and the page's "+"; the area's name large, a "not production" banner, the
  area's pages as chips; a bottom tab bar with up to four areas and More. More is a full screen
  with push navigation (search all pages, areas with their grouped pages, "Where you work",
  Help, Switch app, the profile last and an account screen). The ☰ navigation sheet and the
  breadcrumb context button are gone.
- **Phone context sheet:** Organization and Project rows that open their own searchable lists,
  environment quick picks and "All N environments" grouped by the app's groups. From More it
  opens at the chosen level.
- **Phone Help** is a bottom sheet, "Help with {page}": ask, the shared context, your
  conversations, articles for the page, Chat with support and the Help centre; "Talk to a
  person" after every question.
- **Palette (both layouts):** scope chips (All, Actions, Records, Pages, Help). Empty, it shows
  "On {page}", Recent and Switch; with a query the order is Actions, Go to, Records, Pages,
  Help, Ask Cbox. "Docs and help" is now "Help". On the phone it is a sheet with Cancel.
- **Desktop:** unchanged, except the palette above, the create panel, and a "not production"
  banner under the header when the environment is not live and no sandbox strip shows.

### Added

- `ContextItem.live`, `group`, `description`; `ContextTone` also `staging`, `preview`, `development`.
- `nav.tabs` (the phone's tab bar).
- `page.create` and `page.actions`; `PaletteAction.hint` and `PaletteAction.create`.
- `palette.recent` (`PaletteRecord[]`); without it, Recent lists the pages last visited on the device.
- `create` (`ShellCreate`: `items: ShellCreatable[]`, `default`) and `CboxShell`'s
  `renderCreate(form)`: the create sheet with a navigation stack (V7). `CreateForm`,
  `CreateField`, `CreateRefField`, `CreateSubmit`, `useShellCreate()` and the types
  `ShellCreateForm`, `ShellCreated`, `ShellRenderCreate`.
- `CboxShell`'s `searchRecords(query, signal)`: the app's own records search for the palette.
- `help.articles` (articles sent with the page) and `help.unread` (the count before
  `updatesUrl` answers).
- Helpers `isLive`, `quickEnvironments`, `groupItems`.

### Tests

- Unit: the phone top bar, chips, banner, tab bar, More and its screens, the context sheet,
  Help sheet, palette groups and scopes, the create stack, a Billing-shaped fixture.
- Playwright: phone and desktop states of the Billing fixture (`?fixture=billing`), light and
  dark, with axe on every phone sheet. Old phone baselines for the ☰ sheet were removed.

## v0.10.4 — 2026-11-11

Backward compatible: no `shell` prop or component prop changes.

### Fixed

- **Switching organization, project or environment did nothing.** `CboxShell` posted `{ <level key>: id, …, return_to }`, while laravel-console-kit's `/shell/switch` reads `select[<level key>]` and `from` (its documented contract, also used by its palette links), so it answered 404 "Nothing to switch to.". The shell now posts `{ select: {…}, from }` (`switchBody()`, new), and the default `navigate` sends nested objects as `select[project]=…` form fields. Works with every console-kit 0.2.x; console-kit 0.2.5 also accepts the old body.
- **The document scrolls, not `<main>`.** `.cbx-shell` was `height: 100svh; overflow: hidden` with `<main>` as a smooth-scrolling inner scroller, so Inertia neither reset the scroll on a new page nor restored it on back and forward, and full-page screenshots were blank below the fold. The shell now has `min-height: 100svh`; the rail, the header, the subnav and docked Help are `position: sticky`. `<main>` is no longer a scroller and has no `scroll-behavior: smooth`.
- **Tone text contrast.** `StatusPill` (11px) wrote success, info and warning at 2.2–3.0:1 in light, and destructive under 4.5:1 in both themes. New text tokens `--success-text`, `--info-text`, `--warning-text`, `--destructive-text` (Tailwind `text-*-text`, also in the v3 preset) reach 4.5:1 on the soft tint over card, canvas and background, light and dark. `StatusPill`, `StatTile`'s icon, the combobox's info row and the inbox error use them. The fills are unchanged.
- **StatTile caption** was `text-muted-foreground/80` (3.8:1); it is full `text-muted-foreground` (6:1 light, 6.2:1 dark).
- **SectionHeader** stacked its actions under the title below `sm`, leaving a lone "View all" on its own line. The actions now stay beside the title while there is room and wrap under it, left aligned, when there is not; several actions wrap among themselves.
- **Context switcher keyboard.** Focus did not move into a menu when it opened: it was placed before it was shown (`visibility: hidden`), and a hidden element cannot take focus. It now moves into the search field with a fine pointer, else into the list. ↓ (or ↑) on a context trigger opens its menu (or moves into it when open), and Esc on the trigger of an open menu closes it; Esc inside a menu still returns focus to the trigger.

### Deprecated

- `switchPayload()` (the flat body). Use `switchBody()`. Removed in 0.11.

### Tests

- Playwright: the context switcher from the keyboard, the document scroll with the sticky chrome (scrolled and full-page snapshots, light and dark, 1440 and 390). The mobile charts snapshot now shows all four charts (the inner scroller cut off the last).
- Unit: the tone and muted contrast on the published tokens, the switch body and its form fields, focus on a touch screen, ↓ and Esc on the trigger, the primitives' classes.

## v0.10.3 — 2026-11-11

All additions are optional; a 0.10.2 `shell` prop renders as before.

### Added

- `shell.banners`: every strip under the header, top to bottom. laravel-console-kit sends the sandbox strip first, then the app's banners, so an app banner (a tax hold) no longer hides the sandbox strip. A `sandbox` strip still shows only while the current context has test data. Without `banners`, the single `banner` shows as before.
- Rail lock: an area whose pages are all locked shows a lock on its rail item (a badge on the icon while collapsed, after the label when open), is named "{area} (locked)" for screen readers, and is marked the same in the phone nav.
- `BarChart` and `WaterfallChart` in `@cboxdk/cbox-ui/charts`: side-by-side, stacked and horizontal bars, and a waterfall (bridge), in the chart tokens with `TimeChart`'s fonts, grid and tooltip. The chart engine now registers ECharts' bar chart and legend, so an app no longer registers them itself. `niceRange`, `barExtent` and `waterfallBars` hold the arithmetic.
- Visual snapshots and axe for the banners with a locked rail area, and snapshots of the charts.

### Unchanged on purpose

- The header's Search button keeps "Search or ask…": spec §4.3 fixes that label in every app. `palette.placeholder` still changes the palette's search field only.

## v0.10.2 — 2026-11-11

### Fixed

- ⌘K no longer makes "Ask Cbox" the active row while results load. Pasting an id and pressing Enter opened Ask instead of the record. The highlight now goes to the first result of the current query; while results are on their way no row is active and Enter does nothing. Ask takes the highlight only once every group has answered with nothing, and Ask chosen with the keyboard or mouse stays chosen.

## v0.10.1 — 2026-11-11

All additions are optional fields; a 0.10.0 `shell` prop renders as before.

### Added

- "Skip to content": a link hidden until it has focus, the shell's first focusable element. It moves focus to `<main>` (`mainId`, default `main-content`), which is now focusable (`tabIndex={-1}`).
- `NavPage.locked`: a lock and an accessible "(locked)" in the subnav and the phone nav; the page's `url` leads to the upgrade prompt. The palette's Pages show it as "Locked".
- `NavPage.count`: a badge in the subnav and the phone nav, hidden at 0.
- `NavPage.group`: group headings within an area's subnav and phone nav, each an ARIA group; pages of one group show together.
- `shell.palette.placeholder`: the app's text for the palette's search field (default "Search or ask…").

### Changed

- `shell.account` and its `profileUrl`, `switchAccountUrl` and `signOutUrl` are optional. The account menu leaves out a row without its URL; without `account` it holds only the preferences, where it used to throw. laravel-console-kit builds `account` with `->account()`.

### Fixed

- Nav areas, nav pages and the banner action also read `href` when `url` is absent. laravel-console-kit 0.2.2 sends `href`, so these links were empty.

## 0.10.0 — 2026-11-10

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
- Unit tests for every behaviour in §12.3, and Playwright snapshots plus axe of every open state at 1440 and 390, light and dark (`bun run test:visual`, in the pinned Playwright container; CI's `visual` job runs the same).
- Keyboard: "New …", "View all" and "All products" are on the arrow keys; a row's gear is an option of its own (→, Enter); Help gives focus back on close.
- Help left open shows docked on load and waits below 1280px; support updates reload per organization; opening an article keeps the chat element.
- Lists below the first level carry `?parent=`, and kept lists and the app catalog are dropped on a context switch.
- Links from server answers must be `http(s)://` or a `/path`.

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
