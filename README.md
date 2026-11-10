# @cboxdk/cbox-ui

Shared UI for the Cbox app family — id, cortex, atlas, track, and whatever's next.

This package gives every Cbox app the same chrome (top bar, org switcher, app launcher, user menu, notifications bell) and the same page primitives (panels, headers, tabs, status pills) so cross-app navigation feels like one product. It also ships the design tokens (colours, fonts, radii) and the brand assets in one place.

The package is **headless about data**: every component reads identity, organization, and notification state from a `<CboxIdProvider>` context that the consuming app populates from the future `@cboxdk/cbox-id-client` SDK. Components never fetch — they render what the host gave them.

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

### 2. Wrap the app root with `<CboxIdProvider>`

In **id itself** (which IS the source of truth), populate from Inertia shared props:

```tsx
import { CboxIdProvider } from '@cboxdk/cbox-ui';

export default function AppRoot({ shared, children }) {
    return (
        <CboxIdProvider value={shared.cboxId}>
            {children}
        </CboxIdProvider>
    );
}
```

In **cortex / atlas / track / future apps**, populate from the id-client SDK on session start:

```tsx
import { CboxIdProvider } from '@cboxdk/cbox-ui';
import { useIdSession } from '@cboxdk/cbox-id-client';

export default function AppRoot({ children }) {
    const session = useIdSession(); // {user, organizations, currentOrg, ...}
    return (
        <CboxIdProvider value={session.cboxIdContext}>
            {children}
        </CboxIdProvider>
    );
}
```

The context shape is exported as `CboxIdContextValue` — see `src/context/cbox-id.tsx` for the full surface. Required keys:

- `user` — `{id, name, email, avatar_url?, locale?, timezone?}`
- `currentOrganization` — current org context (or null on user-only surfaces)
- `organizations` — every org the user belongs to (drives the switcher)
- `apps` — sister apps for the launcher
- `urls` — `{idBaseUrl, accountUrl, orgSettingsUrl, switchOrgUrl, signOutUrl}`
- `notifications?` — `{unreadCount, inboxUrl}` (optional, hides the bell when missing)
- `onSwitchOrganization?` — callback when the user picks an org (default: form-POST to `urls.switchOrgUrl`)

### 3. Drop in the chrome

```tsx
import { TopBar } from '@cboxdk/cbox-ui';

<TopBar
    brand={<MyAppLogo />}
    centre={<MySearchBar />}
    showOrgSwitcher
/>
```

The default right-cluster is `<AppLauncher>` → `<NotificationsBell>` → `<UserMenu>`. Override with `rightCluster={...}` if a particular app needs a different mix.

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

### Chrome (cross-app navigation)

| Component | What it does |
|---|---|
| `TopBar` | Standard 56px-tall app bar. Slot for brand + centre + right cluster. |
| `OrgSwitcher` | Dropdown listing the user's orgs. Calls `onSwitchOrganization` (or POSTs to `urls.switchOrgUrl`) on pick. |
| `AppLauncher` | 9-dot grid showing sister Cbox apps the user can jump into. |
| `UserMenu` | Avatar dropdown with "Manage account ↗" + "Team & billing ↗" (deep-links into id) + Sign out. Pass `LinkComponent` when those rows are pages of the host app, so the visit stays client-side. |
| `CboxAppCatalog` | The Switch-app control fed live from the host's catalog endpoint (see "App catalog" below). |
| `NotificationsBell` | Bell icon with unread badge, links to id's unified inbox. Renders nothing if context lacks `notifications`. |

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

Time series use ECharts, from the `@cboxdk/cbox-ui/charts` entry so apps without charts never load it. Install `echarts` (^6) next to cbox-ui to use it; ECharts itself is fetched on the first chart's mount.

| Export | What it does |
|---|---|
| `TimeChart` (`/charts`) | Lines over a time window drawn to scale from zero with round ticks, a faint area under the primary series, thin lines for the rest (one per pod, say), labelled vertical lines for `events` (deploys, scaling), gaps for missing samples, an axis tooltip, and zoom by slider, pinch or Ctrl/⌘ + scroll. Colours come from `--chart-1…5` and follow dark mode. Times are milliseconds. Keep a table of the same numbers beside it. |
| `Chart` (`/charts`) | The ECharts wrapper under it: SVG renderer, token colours, theme and reduced-motion aware. Build other chart types on it. |
| `Sparkline` | A small decorative SVG line for table rows. No ECharts. |
| `niceTicks` / `timeTicks` / `seriesData` | The axis and gap arithmetic. |

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
    <CboxAppShell {...shellProps}>{children}</CboxAppShell>
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

`AppSwitcher` and `AppLauncher` render the static `apps` list from `CboxIdProvider`. Apps
that read the person's catalog live from Cbox ID use `CboxAppCatalog` instead: the host
serves a same-origin endpoint (a proxy of Cbox ID's catalog under the signed-in person's
grant) and the component renders its answer, refreshes it when `refresh_after` expires
while the panel is open, and offers the way back to Cbox ID when the grant is missing.

```tsx
<CboxAppCatalog endpoint={appCatalogUrl} currentAppKey="infra" />
```

The endpoint contract (`parseAppCatalog` is exported, so a host can test its own answer):

- `200 { apps: [{ key, name, launch_url, icon_url?, icon_dark_url?, description? }], refresh_after?: seconds }`
  — `refresh_after` is clamped to 1–60 s; apps without an `http(s)` launch URL are dropped.
- `401`/`403` with `{ authorize_url }` or `{ state: 'authorization_required' }` — the panel
  says the apps could not be loaded and links "Reconnect to Cbox ID" to `authorize_url` with
  `return_to` set to the current path (same-origin URLs only).
- Anything else — "Apps could not be loaded." with a retry.

`endpoint={null}` renders the control disabled, so the chrome keeps its shape on pages
without an organization.

App icons come from Cbox ID's catalog: `icon_url` for light surfaces and `icon_dark_url` for
dark ones. The tiles render both and the token stylesheet shows the one for the current theme
(`.dark` or `[data-theme="dark"]` on the root); an app without an icon shows its initials. Apps
keep no local copy of the marks. Each answer is kept in this browser (`cbox-app-catalog`), so
`<CboxServiceMark appKey="infra" />` and the collapsed `CboxBrand` in the rail paint the app's
own icon at once on the next page. A host that loads the catalog itself calls
`rememberAppCatalog(apps)`; `CboxAppIcon` renders any single app's icon.

### Workspace navigation (current design contract)

`CboxWorkspaceShell` is the two-tier product shell. Pass `areas` (each has a
label, href, icon and optional child `items`), the router's `currentPath` and
`LinkComponent`, plus `context`, `tools` and `account` slots. Include the real
organization context, search, notifications and Switch app in these slots;
render `UserMenu placement="top-start"` in `account`. The account stays at the
bottom of the main rail. Existing `CboxAppShell` consumers retain their API.

The rail reserves 64px, expands on hover/focus without moving content, and
reserves 222px when pinned. Context navigation only appears for multi-page
areas; its panel button and Command/Control-period collapse it to a 26px strip.
Mobile uses a modal navigation sheet and retains the header app switcher.
Query strings do not change active navigation, and the **most specific href wins**: an
area at the organization root (`/acme`) does not claim `/acme/projects/...` when a
Projects area exists, and inside a subnav only the deepest matching item is active. Active
links carry `aria-current="page"`.

Hosts own route construction, organization switching, search and preference persistence.
For the two shell preferences the host persists, pass them in: `pinned` + `onPinnedChange`
and `collapsed` + `onCollapsedChange` (controlled), or `defaultPinned` / `defaultCollapsed`
to seed the shell's own state. `brandHref` points the brand row somewhere other than `/`
(the current organization's overview), and `mainId` names the `<main>` landmark for the
host's skip link (default `main-content`).

Core tokens now match the warm cream/ink design-system colors. Body text uses
the system stack; hosts self-host Plus Jakarta Sans for headings and JetBrains
Mono for technical values. Card/control/badge radii are 12/8/6px. The main canvas
uses the approved single radial wash at 30% 0 in both themes.
