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

The package is published to GitHub Packages under the `cboxdk` org. Configure auth once per machine:

```sh
echo "//npm.pkg.github.com/:_authToken=YOUR_PAT" >> ~/.npmrc
echo "@cboxdk:registry=https://npm.pkg.github.com" >> ~/.npmrc
```

## Wire it up

### 1. Pull the design tokens into your CSS

```css
/* resources/css/app.css */
@import 'tailwindcss';
@import '@cboxdk/cbox-ui/tokens';
```

That's it — every `text-foreground`, `bg-card`, `border-border`, `text-mono`, etc. utility now resolves against the Cbox palette. Light + dark variants come bundled.

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
| `UserMenu` | Avatar dropdown with "Manage account ↗" + "Team & billing ↗" (deep-links into id) + Sign out. |
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
