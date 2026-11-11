# @cboxdk/cbox-ui

Shared UI for the Cbox app family — id, cortex, atlas, track, and whatever's next.

This package gives every Cbox app the same shell (`CboxShell`: rail, header with the context selectors, ⌘K palette, Help column, app switcher, account menu, phone layout) and the same page primitives (panels, headers, tabs, status pills), so moving between apps feels like one product. It also ships the design tokens (colours, fonts, radii) and the brand assets in one place.

The shell renders one Inertia prop, `shell`, which the server builds (laravel-console-kit). The prop carries only the current selection and URLs; menus, the app catalog, Help and search load in the browser after the page has painted, from same-origin endpoints the app serves. See [The shell](#the-shell) and the spec in `docs/specs/2026-11-10-shell-v1.md`.

## Install

```sh
# In a Cbox-family app
bun add @cboxdk/cbox-ui clsx tailwind-merge
# Peer deps (you almost certainly already have these):
bun add react react-dom tailwindcss lucide-react
```

The package is published on npm as `@cboxdk/cbox-ui` under the MIT License. The Cbox name and logos in `assets/` are trademarks and are not covered by the licence (see `TRADEMARKS.md`).

## Wire it up

### 1. Pull the design tokens into your CSS

```css
/* resources/css/app.css */
@import 'tailwindcss';
@import '@cboxdk/cbox-ui/tokens';
```

That's it — every `text-foreground`, `bg-card`, `border-border`, `text-mono`, etc. utility now resolves against the Cbox palette. Light + dark variants come bundled: dark applies under `.dark` or `data-theme="dark"` on the root, whichever the host writes. Add `@source '../../node_modules/@cboxdk/cbox-ui/dist';` so Tailwind generates the utilities the components use, and when the host stores its theme choice as an attribute, point Tailwind's `dark:` variant at it (`@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));`).

### 2. Render the shell in the persistent layout

```tsx
// resources/js/layouts/AppLayout.tsx
import { router, usePage, Link } from '@inertiajs/react';
import { CboxShell, type Shell } from '@cboxdk/cbox-ui';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { shell } = usePage<{ shell: Shell }>().props;
    return (
        <CboxShell
            shell={shell}
            LinkComponent={Link}
            navigate={(url, o) => (o?.newTab ? window.open(url, '_blank', 'noopener') : router.visit(url, { method: o?.method, data: o?.data }))}
            onPreferenceChange={(key, value) => router.post('/settings/shell', { [key]: value }, { preserveState: true, preserveScroll: true })}
        >
            {children}
        </CboxShell>
    );
}

// Every page: `Page.layout = page => <AppLayout>{page}</AppLayout>`, so the rail, Help and the
// chat stay mounted between visits.
```

Set the theme before the first paint: the server writes `class="dark"` and `data-theme` on
`<html>` from `shell.preferences.theme`, or the head carries the inline script
`themeBootScript(theme)` returns (it resolves `system` from the device without saving it).
Copy `public/brand/` (the Cbox wordmark: `cbox-logo.png`, `cbox-logo-white.png` and their `@2x`)
as before; `brandAssetBase` changes the path.

### 3. Identity context (inbox only)

`<CboxIdProvider>` still feeds the inbox surface (`CboxSurfaces`). The shell does not read it.

### 4. Use page primitives

```tsx
import {
    PageShell,
    PageHeader,
    PageTabs,
    DataPanel,
    PanelBody,
    SectionHeader,
    StatusPill,
    EmptyState,
    StatTile,
    KeyValue,
} from '@cboxdk/cbox-ui';
```

Match id's existing patterns — see id/resources/js/pages/* for examples.

## Components

### Shell

| Export | What it does |
|---|---|
| `CboxShell` | The one shell for every app, rendered from the `shell` prop. See [The shell](#the-shell). |
| `Shell`, `ContextLevel`, `ContextItem`, `NavArea`, `PaletteAction`, … | The prop's TypeScript contract (spec §11.1). laravel-console-kit produces it. |
| `useShellHelp()` | `toggleHelp`, `openArticle`, `ask` for a page's own `?` button. |
| `applyTheme`, `themeBootScript` | Put a theme choice on the document the way the tokens read it. |
| `CboxAppCatalog` | The framework-free `<cbox-app-switcher>` element in React. Kept for apps that have not moved to the shell yet. |

### Page primitives

| Component | What it does |
|---|---|
| `PageShell` | Outer page container with vertical rhythm. |
| `PageHeader` | Title + description + actions slot. Tab-strip-aware (no padding mismatch when followed by `PageTabs`). |
| `PageTabs` | Tabs strip on the page baseline. Pass `currentPath` + optional `LinkComponent` (Inertia's `Link`, Next's, etc.). |
| `DataPanel` / `PanelBody` / `SectionHeader` | The default building block for content sections. |
| `StatusPill` | Coloured chip for status / state. Tones: success / warning / destructive / info / muted / neutral. |
| `EmptyState` | Centred icon + heading + description for empty lists. |
| `StatTile` | Big-number metric tile. |
| `KeyValue` / `KeyValueList` | Definition-list style "label → value" for detail panels. |
| `Heading` | Section heading without the panel chrome. |

### Charts

Time series and bar charts use ECharts, from the `@cboxdk/cbox-ui/charts` entry so apps without charts never load it. Install `echarts` (^6) next to cbox-ui to use it; ECharts itself is fetched on the first chart's mount.

| Export | What it does |
|---|---|
| `TimeChart` (`/charts`) | Lines over a time window drawn to scale from zero with round ticks, a faint area under the primary series, thin lines for the rest (one per pod, say), labelled vertical lines for `events` (deploys, scaling), gaps for missing samples, an axis tooltip, and zoom by slider, pinch or Ctrl/⌘ + scroll. Colours come from `--chart-1…5` and follow dark mode. Times are milliseconds. Keep a table of the same numbers beside it. |
| `BarChart` (`/charts`) | Categories against values, to scale from zero with round ticks: side by side, `stacked` (the tooltip adds the total) or `horizontal`. Negative values hang below zero. One `values` entry per category, `null` for none; `tone` picks a chart token from 0. A legend shows with more than one series. Same tokens, fonts, grid and tooltip as `TimeChart`. |
| `WaterfallChart` (`/charts`) | A bridge (MRR movement): `steps` with `total: true` drawn from zero, the rest as signed changes floating from where the step before ended. Totals in `--chart-1`, growth in `--chart-2`, loss in `--chart-4`. For running levels that stay at or above zero. |
| `Chart` (`/charts`) | The ECharts wrapper under it: SVG renderer, token colours, theme and reduced-motion aware. Build other chart types on it. |
| `Sparkline` | A small decorative SVG line for table rows. No ECharts. |
| `niceTicks` / `niceRange` / `timeTicks` / `seriesData` / `barExtent` / `waterfallBars` | The axis, gap, stack and waterfall arithmetic. |

## Versioning

This package follows semver. **Breaking changes get a major bump** — every Cbox app pinning a major version stays safe. New components, new optional props, new tokens → minor. Token tweaks that don't change the visual contract → patch.

In practice during the early days (v0.x): treat every release as potentially breaking, pin exact versions, upgrade in lockstep.

## Local dev against id

While iterating, `bun link` the package locally so id picks up changes on rebuild:

```sh
# In cbox-ui:
bun run build && bun link

# In id:
bun link @cboxdk/cbox-ui
bun run dev
```

Switch back to the published version with `bun unlink @cboxdk/cbox-ui && bun install`.

## Brand

Brand guidelines, logo files, and the canonical asset set live in [`BRAND.md`](./BRAND.md) and `assets/`.

## Localization

Wrap the app shell in `CboxLocalizationProvider` to translate shared navigation,
menus, placeholders and accessible labels. Existing consumers keep English when
no provider is present. The host owns the selected language and its catalogs:

```tsx
<CboxLocalizationProvider locale={language} translate={t}>
    <CboxShell shell={shell}>{children}</CboxShell>
</CboxLocalizationProvider>
```

`translate(message, values?)` returns plain text. Messages use English source
keys and named placeholders, such as `Settings for {name}`. Preserve placeholders
when translating. React escapes the returned text; do not return HTML. Consumer
labels, notification content, organization names and other user data remain the
host's responsibility. The provider does not persist settings or infer regional
number/date formats from interface language. Cbox apps read those preferences
from Cbox ID's versioned `preferences` namespace.

Pass an optional `formatDate(isoTimestamp)` callback when the host manages date
format and timezone preferences separately. Notification timestamps use that
callback; without it, existing browser formatting is preserved.

### App catalog (Switch app)

The shell's own app grid reads the same endpoint (see [The shell](#the-shell)). The element below stays for apps that have not moved to the shell yet.

Every Cbox app, Blade or React, draws the same Switch-app control: the `<cbox-app-switcher>`
custom element from `@cboxdk/cbox-ui/app-switcher`. It has no React dependency and renders
in a shadow root with its own styles, so no app stylesheet (a reset, a missing preflight, a
global `button`, `img` or `svg` rule) changes how it looks. It takes only the host's Cbox
colour tokens (`--foreground`, `--popover`, `--border`, `--secondary`, `--muted`,
`--accent-soft`, `--ring`), each with a fallback.

**Blade (or any server-rendered page).** Import the module once in the app's Vite entry
(`resources/js/app.js`):

```js
import '@cboxdk/cbox-ui/app-switcher';
```

and put the tags in the layout:

```blade
<cbox-app-switcher
    endpoint="{{ $appCatalogUrl ?? '' }}"
    current="billing"
    labels="{{ json_encode(['title' => __('Switch app'), 'loading' => __('Loading apps…'), 'empty' => __('No apps available'), 'unavailable' => __('Apps could not be loaded.')], JSON_UNESCAPED_UNICODE) }}"
></cbox-app-switcher>

{{-- The app's own mark (rail, brand), from the same catalog --}}
<cbox-service-mark service="billing" aria-hidden="true"></cbox-service-mark>
```

**React.** `CboxAppCatalog` renders the same element:

```tsx
<CboxAppCatalog endpoint={appCatalogUrl} currentAppKey="infra" />
```

Attributes of `<cbox-app-switcher>`:

| Attribute | |
|---|---|
| `endpoint` | The host's same-origin catalog URL. Empty disables the control (pages without an organization). Another origin is refused. |
| `current` | This app's key: its tile is marked current. |
| `labels` | JSON with any of `title`, `loading`, `empty`, `unavailable`. Missing keys stay English. |
| `theme` | `auto` (default): `.dark`/`[data-theme="dark"]` or `.light`/`[data-theme="light"]` on `<html>`, else `prefers-color-scheme`. `class`: only the root marker counts, no marker is light (a host whose tokens only turn dark under `.dark`). `light`/`dark` pin it. |

`<cbox-service-mark service="key">` paints that app's icon from the catalog this browser last
kept, and repaints when a newer one arrives. It is 24px; set
`cbox-service-mark { --cbox-service-mark-size: 22px; }` to change it. It takes `theme` too.

The endpoint contract (`parseAppCatalog` and `signInTarget` are exported, so a host can test
its own answer):

- `200 { apps: [{ key, name, launch_url, icon_url?, icon_dark_url?, description? }], refresh_after?: seconds }`
  — `refresh_after` is clamped to 1–60 s; apps without an `http(s)` launch URL are dropped.
- `401`/`403 { signin_url }` — the person has to sign in again. When they open the control
  (or it is open when the answer arrives), the element sends the top window to `signin_url`:
  no message, no button. A page that merely loads in the background is never moved. If the
  same sign-in was tried in the last 30 seconds and the catalog still refuses, it shows "Apps
  could not be loaded." instead, so it never loops. The legacy `{ authorize_url }` is followed
  the same way, with `return_to` set to the current path (same-origin URLs only).
  `signin_url` must be on the app's own origin; anything else is ignored.
- Anything else, or no network — "Apps could not be loaded.", quietly, and it tries again by
  itself (2 s, 4 s, 8 s … up to 60 s). A grid it already shows stays.

Before navigating it fires `cbox-app-switcher:signin` (bubbling, composed, cancelable, with
`detail.url`); `preventDefault()` keeps the page where it is.

App icons come from Cbox ID's catalog only: `icon_url` for light surfaces and
`icon_dark_url` for dark ones; the element swaps them with the theme. Only `https:` icons
render; an app without one, or whose icon fails to load, shows its initials. Apps keep no
local copy of the marks. Each answer is kept in this browser (`localStorage`,
`cbox-app-catalog`), so the grid and the marks paint at once on the next page and the live
answer replaces them. The icons are served by Cbox ID, so the host's CSP needs
`img-src https://cbox.cboxid.com` (the element's styles are constructed stylesheets, which
`style-src` does not govern).

In React, `<CboxServiceMark appKey="infra" />` and the collapsed `CboxBrand` read the same
kept catalog; `CboxAppIcon` renders any single app's icon, and a host that loads the catalog
itself calls `rememberAppCatalog(apps)`.

## The shell

`CboxShell` is the one shell for every Cbox app (spec: `docs/specs/2026-11-10-shell-v1.md`).
The app passes the `shell` prop and the page; the shell does the rest.

```
┌──────┬────────────────────────────────────────────────────────────────────┬──────────┐
│ rail │ [C] Cbox ⇕ / [W] Webshop · ■ Production ⇕   [Search or ask… ⌘K] [Help²] [🔔] [⣿] │ Help     │
│      ├────────────────────────────────────────────────────────────────────┤ (docked  │
│ areas│ sandbox strip (only while the environment has test data)           │ ≥1280px) │
│ …    │ subnav │ page                                                      │          │
│ [SD] │        │                                                           │          │
└──────┴────────┴───────────────────────────────────────────────────────────┴──────────┘
```

### The `shell` prop

The types are exported (`Shell`, `ContextLevel`, `ContextItem`, `NavArea`, `NavPage`,
`PaletteAction`, `ShellHelp`, `ShellPreferences`, …) and are the contract laravel-console-kit
produces. Abridged:

```ts
type Shell = {
    app: { key; name; homeUrl };
    person: { id; name; initials; avatarUrl? };
    page?: { title; route?; create?; actions?: PaletteAction[] }; // the page's create target and its palette actions
    nav: { areas: NavArea[]; activeArea; activePage?; tabs?: string[] };  // tabs: the phone's tab bar, up to 4
    context: { levels: ContextLevel[]; switchUrl };  // 1–3 levels, organization first
    palette: { searchUrl?; gotoUrl?; actions: PaletteAction[]; placeholder?; recent?: PaletteRecord[] };
    create?: { items: ShellCreatable[]; default? };  // what "+" and the palette can create
    help: { enabled; topic?; sessionUrl?; scriptUrl?; portalUrl?; updatesUrl?; searchUrl?; articlesUrl?; articles?; unread? };
    notifications: { enabled: false } | { enabled: true; unread; url };
    apps: { catalogUrl; productsUrl? };
    account?: { profileUrl?; switchAccountUrl?; signOutUrl?; signOutMethod?; languages?; formats?; signedInWith? };
    banner?: ShellBanner;      // one strip (laravel-console-kit 0.2.3 and older)
    banners?: ShellBanner[];   // every strip, top to bottom; wins over `banner`
    preferences: { theme; locale; railPinned; helpOpen; subnavCollapsed?; regionalFormat?; timeZone? };
};
```

```ts
type NavArea = { key; label; url; icon?; pages?: NavPage[] };
type NavPage = {
    key; label; url; icon?;
    locked?: boolean;   // not in the plan: a lock and "(locked)", `url` leads to the upgrade prompt
    count?: number;     // a badge (open drafts); hidden at 0
    group?: string;     // a heading in the subnav and the phone nav ("Organization", "Project")
};
```

Pages of one `group` show together under its heading, in the order each group first appears.
Locked pages still show in the palette's Pages, marked "Locked". Every nav link (and the
banner action) also accepts `href` in place of `url`, the name laravel-console-kit 0.2.2 sends.
`palette.placeholder` replaces "Search or ask…" in the palette's field. The header's Search
button keeps "Search or ask…" in every app: spec §4.3 fixes that label so the header reads the
same across Cbox.

An area whose pages are all locked shows a lock on its rail item too (a badge on the icon while
the rail is collapsed, after the label when open) and is named "{area} (locked)"; the phone nav
marks it the same way.

`banners` stacks every strip under the header: the sandbox strip (shown only while the current
context has test data), then the app's banners, such as a tax hold or impersonation. An app
banner never hides the sandbox strip. Without `banners` the single `banner` shows as before.

`account` and each of its URLs are optional: the account menu leaves out a row it has no URL
for, and without `account` it holds only the preferences (laravel-console-kit's
`->account()` builds it).

The shell's first focusable element is a "Skip to content" link, hidden until focused. It
moves focus to `<main id={mainId}>` (default `main-content`).

`ContextLevel.settingsUrl` is a URL template on the wire: `{id}` is replaced with the row's id
(`/orgs/{id}/settings`). Nav and action icons are Lucide names (`"rocket"`, `"server"`); pass
`icons` to `CboxShell` for others.

### What the app serves (all same-origin JSON)

| URL | Request | Answer |
|---|---|---|
| `level.listUrl` | `GET ?q=&parent=&cursor=&limit=` | `{ object: "list", data: ContextItem[], has_more, next_cursor }`. Loaded when a menu opens; every level below the first gets `parent`, the level above's id (projects of an organization, environments of a project). Answers are kept for the page and dropped when the context changes. |
| `level.createUrl` | `POST { name, parent? }` | `{ id, detailsUrl }` (or `details_url`). The person lands on `detailsUrl`. A 422 shows its first error under the field. |
| `account.switchAccountUrl` | A plain link (full page load) | Usually a redirect to Cbox ID's account chooser. |
| `context.switchUrl` | `POST { select: { <level key>: id, … }, from }` (a form post through `navigate`; as a form, `select[project]=…&from=…`). laravel-console-kit's `/shell/switch` reads it. 0.10.3 and older posted the flat `{ <level key>: id, …, return_to }`, which console-kit 0.2.5 still accepts. | A redirect: the same page in the new context, or that area's list for an entity page (§5.6). |
| `palette.searchUrl` | `GET ?q=` | `{ data: [{ id, title, subtitle?, url }] }`, in the current context. |
| `palette.gotoUrl` | `GET ?q=` | `{ data: [{ title, subtitle?, levels?: { organization, project, … }, url? }] }` across organizations. |
| `apps.catalogUrl` | `GET` | The catalog below, plus `in_organization`, `admission_url`, `purpose` and `hue` per app. |
| `help.updatesUrl` | `GET`; `POST {updatesUrl}/{id}/read` | `{ data: [{ id, kind: "ticket" \| "chat", title, excerpt?, at, unread, url? }] }` |
| `help.searchUrl` | `GET ?q=&topic=` | `{ data: [{ id, title, excerpt?, body?, url?, source? }] }` |
| `help.articlesUrl` | `GET` (template, `{topic}`) | The same shape; the first three are shown. |

Every link the shell follows from these answers (`url`, `detailsUrl`) must be `http(s)://` or
a `/path`; anything else is dropped. None of these may call another service synchronously (local first): organizations come from
the app's mirror of Cbox ID, the catalog from a cached copy. Help and docs search are proxies of
Cbox Assistant served by laravel-assistant-client; when Assistant is down, Help says so and
everything else works.

Requests send `X-XSRF-TOKEN` (from the `XSRF-TOKEN` cookie) or `X-CSRF-TOKEN` (from
`<meta name="csrf-token">`). Without a `navigate` prop, POSTs are real form submits with
`_token`.

### Preferences and first paint

The shell reports every preference change through `onPreferenceChange(key, value)`: `theme`,
`locale`, `regionalFormat`, `timeZone` (Cbox ID's shared preferences), and `railPinned`,
`helpOpen`, `subnavCollapsed` (the app's cookie, read on the server). Without the callback it
writes a `cbox_shell_<key>` cookie. The server sends them back in `shell.preferences`, so the
rail, Help and the subnav render in place on the server; `themeBootScript(theme)` (or the same
class and `data-theme` written by the server) sets the theme before paint.

### Help

Help is part of the shell: support updates (the button's count), docs and knowledge base
search, articles for the page's `help.topic`, Ask Cbox, Talk to a person and the support portal.
It docks beside the page from 1280px (360px, 400px from 1440px) and is a full-screen dialog
below. Its state (open, article, search, scroll, updates) lives in a store outside React, so it
survives visits and even a remount; the chat element sits outside the home/article view, so
opening an article never ends the conversation, and it survives as long as the shell sits in
the persistent layout. Help the person left open shows docked on load; below 1280px it waits
until they open it, so a phone or a narrow window never lands under the overlay. Support
updates are per organization: they load again when the organization or `updatesUrl` changes.
Closing Help gives focus back to what opened it.

The chat is the Assistant SDK's `<cbox-support session-url>` element (laravel-assistant-client,
`/ai-assistant/support.js` by default, loaded the first time Help opens). The shell sets
`element.intent = { route, title, context, url }` (and an `intent` JSON attribute) on every
page, and calls `element.ask(question, intent)` / `element.handover()` when the SDK has them,
else `element.open()`.

A page's own `?` button uses `useShellHelp()?.toggleHelp()`, or `<PageHeader help />`. The page's
help topic is `shell.help.topic`, set on the server per route (console-kit's `helpTopic`), not
a prop of the header: Help needs it on the first paint and on pages without a header.

### Keyboard

⌘K / Ctrl+K opens the palette anywhere (↑↓ move, Enter opens, ⌘Enter opens in a new tab, Esc
closes). In the context menus ↑↓ Home End move, Enter picks, → makes a row's gear the active
option (Enter opens its settings; in the cascade a second → crosses to the environments), ←
goes back, Esc closes and Tab leaves; focus returns to the trigger. ↓ on a context trigger
opens its menu, and focus moves into the menu when it opens: the search field with a fine
pointer, else the list itself (typing there goes on in the search). ↓ past the last row
reaches "New …" and ↑ above the first reaches "View all", so both work without a mouse; in the
app grid End and ↓ from the bottom row reach "All products". ⌘. collapses the subnav. Search fields focus themselves only with a fine pointer and
hover, never on touch. Sheets and the Help overlay trap focus; the docked column does not.

### Scrolling

The document scrolls, not a box inside the shell. The rail, the header, the subnav and docked
Help stay in view with `position: sticky`. So Inertia resets the scroll on a new page and
restores it on back and forward with no `scroll-region`, and a full-page screenshot shows the
whole page. A page that needs its own scroller (a wide table) brings one.

### Phone (< 768px)

The phone has its own chrome (the approved V6 design):

- **Top bar:** the context pill (the organization chip; a small line with the levels above the
  deepest, `Org · Project`; the deepest level large, with the environment's colour), then Help
  (a dot while support has replied), Search and the page's "+". "+" shows only when the app
  passes `renderCreate` and has `shell.create`; its name is "New {thing}" on a page with
  `page.create`, else "Create". A dead button is never rendered.
- **Under it:** the area's name, large; the "not production" banner while the current
  environment is not live; the area's pages as chips (only with more than one page).
- **Tab bar:** the areas in `nav.tabs` (up to four; default the first four), then More.
- **More:** a full screen with push navigation: search all pages; the app's areas (each opens
  its grouped pages); "Where you work" (each level opens the context sheet at that step);
  Help with the page; Notifications when the app has a source; Switch app; and the profile
  last (the account screen: profile and security, language, regional format, time zone,
  theme, switch account, sign out). Tapping More again goes back to its top.
- **Context sheet:** Organization and Project rows (each opens its searchable list), the
  environment quick picks (the current one, a live one, a test one) and "All N environments",
  a searchable list under the app's environment `group`s with "New environment".
- **Help sheet:** "Help with {page}": ask (the page and where you work are shared), your
  conversations (`help.updatesUrl`), articles for the page, Chat with support and the Help
  centre. After a question, "Talk to a person" is always offered. The conversation itself is
  the Assistant SDK's element, as on a desktop.
- **Palette:** a near full-screen sheet with Cancel (see the palette below).

**Sheets behave like iOS sheets.** The grab handle and the header drag the sheet; the content
drags it too when scrolled to its top (down) or while the sheet can still grow (up). A sheet
that fits its content opens at most about half way and grows to 92% when there is more; a tall
sheet (Help, create, an environment list) opens at 90% and rests at half the screen too. Pulled
well down or flicked down, it closes; a tap on the scrim closes it. Each sheet has one scroller,
its body. While a sheet, the palette or Help is open the page behind does not scroll (iOS
included); the page's scroll position is kept. Fields are 16px on a phone, so iOS does not zoom
into them, and the chrome does not double-tap zoom (pinch-zoom stays). While the on-screen
keyboard is up, sheets sit above it and the tab bar steps aside.

**One title.** The top bar shows the area's name large. A page heading that says the same is
hidden on the phone and kept for screen readers: `PageHeader` does it by itself (string titles);
an app's own heading opts in with `data-cbx-page-title`, e.g.
`<h1 data-cbx-page-title>Status pages</h1>`. `useShellPageTitle()` gives the top bar's title on
the phone (`null` elsewhere) for a header the app lays out itself.

**The app's viewport meta tag.** The shell does not rewrite the host page's `<head>`. Every app
that renders `CboxShell` needs:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
```

`viewport-fit=cover` gives the tab bar and sheets the safe-area insets of the home indicator;
`interactive-widget=resizes-content` makes Android shrink the page for the keyboard (iOS ignores
it; the shell measures the keyboard itself). Do not add `maximum-scale=1` or
`user-scalable=no`: pinch-zoom is an accessibility need, and the 16px fields already stop the
zoom on focus. An app's own fields on the phone should be 16px or more too (the shell sets 16px
on fields inside the page; an app that styles its fields in a later cascade layer keeps its
own size).

Environments say whether they are live: `ContextItem.live` (else `testData` true is not live,
else `tone: 'production'` is live; with neither the banner never shows). The shell never guesses
from the name. `group` and `description` list them under headings with a second line; `tone`
also takes `staging`, `preview` and `development`. On a desktop the same banner shows under the
header when no sandbox strip does; on the phone it replaces the sandbox strip.

### Palette groups

Before anything is typed: "On {page}" (the page's create target and `page.actions`, else the
app's `palette.actions`), Recent (`palette.recent`, else the pages last visited on this device)
and Switch (other environments, the organization). With a query: Actions (page and app
actions, every creatable as "New …", switches), Go to, Records, Pages, Help and Ask Cbox last.
Scope chips (All, Actions, Records, Pages, Help) keep one kind. Records come from `searchUrl`,
or from `CboxShell`'s `searchRecords(query, signal)` when the app passes it. A `PaletteAction`
may carry `hint` (a second line) and `create` (a creatable key it opens instead of `url`).

### Create (V7)

`shell.create.items` lists what the person can create (`{ key, label, area, keywords?,
submitLabel? }`) and `create.default` the target of "+" on a page without its own
(`page.create`). "+" never navigates away: it opens the create sheet (a bottom sheet on the
phone, a panel from the right on a desktop) on that form, with "‹ Create" up to a searchable
tree of everything, grouped by area. The forms are the app's: `CboxShell`'s
`renderCreate(form)` returns the fields for `form.creatable.key`. A reference field calls
`form.createRef('customer', created => …)`, which stacks the customer form; its submit reads
"Create and use in invoice", and `form.done(created)` goes back and hands it over, with the
invoice form's state kept. The bottom form's `done()` closes the sheet. While the environment
is not live the sheet says "Creating in {environment}, not production". `CreateForm`,
`CreateField`, `CreateRefField`, `CreateSubmit` and the `cbx-cinput` class lay a form out like
the rest of the sheet. A page's own "New …" button calls `useShellCreate()?.openCreate(key)`.

### Tests and snapshots

`bun run test` runs the unit tests (vitest, Testing Library, happy-dom). `bun run test:visual`
renders the fixture page in `tests/visual` (the real shell, the fixture `shell` prop and its
answers) and compares every open state at 1440 and 390, light and dark, against
`tests/visual/__screenshots__`, and runs axe on every open state. It runs in the pinned
Playwright container (`scripts/visual.sh`, needs Docker), the same one CI's `visual` job uses,
so the Linux baselines match pixel for pixel. After an intended change:
`bun run test:visual:update`, then look at every changed image.

### Tokens

Core tokens now match the warm cream/ink design-system colors. Body text uses
the system stack; hosts self-host Plus Jakarta Sans for headings and JetBrains
Mono for technical values. Card/control/badge radii are 12/8/6px. The main canvas
uses the approved single radial wash at 30% 0 in both themes.

Words and icons in a tone use the tone's text token, not its fill: `--success-text`,
`--info-text`, `--warning-text` and `--destructive-text` (`text-success-text` and so on). They
reach 4.5:1 on the tone's soft tint over a card, the canvas or the background, in light and
dark; the fills (`--success` …) are for dots, squares and solid buttons. `StatusPill` and
`StatTile` use them. `tests/tokens/contrast.test.ts` checks every pair.
