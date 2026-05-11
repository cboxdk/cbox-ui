# Cbox UI Patterns

The contracts that keep id, cortex, atlas, and every future Cbox app
visually and behaviourally aligned. cbox-ui owns the primitives; apps
own the framework adapters and the routes. This document is the
single source of truth — when something looks or behaves differently
across two apps, one of them is wrong, and this doc says which.

If a pattern isn't documented here, it doesn't exist. New patterns
get a section, an example, and a justification before they ship.

---

## 1. URL is state

Anything a user might bookmark, share, or come back to after a
refresh **must** live in the URL. Tabs, filters, search input,
pagination, sort order, expanded rows that should persist — all of
it. Component state (`useState`) is for things that are genuinely
ephemeral: the value of an input mid-typing, whether a dropdown is
open, transient hover/focus.

### What this gives us

- **Hard refresh = identical view.** No "lost" state.
- **Deep links work.** Paste a URL with filters set; the recipient
  sees what you saw.
- **Back / forward navigate predictably.** Each filter change is a
  navigation; the back button undoes it.
- **Server-rendered first paint.** Inertia, TanStack Router, and
  every other URL-driven router can pre-render the right view because
  the URL tells them what to render.

### How

Use cbox-ui's `defineUrlSchema` to declare every URL-backed key once,
typed:

```ts
import {
    defineUrlSchema,
    urlEnum,
    urlNumber,
    urlString,
} from '@cboxdk/cbox-ui';

export const auditSchema = defineUrlSchema({
    q: urlString(''),
    action: urlString(''),
    tier: urlString(''),
    source_app: urlString(''),
    page: urlNumber(1, { min: 1 }),
});
```

Then read and write through the per-app adapter. id ships
`useUrlState` (Inertia); cortex uses TanStack Router's `useSearch`
+ `navigate({ search })`. The call site is identical:

```tsx
const [params, setParams] = useUrlState(auditSchema);
// params.q, params.page, etc — fully typed.

setParams({ page: params.page + 1 });
// Single key — others preserved. URL navigates with replace: true,
// preserveScroll: true, preserveState: true.
```

### Defaults are elided

`buildUrlSearch` strips fields that match their default so URLs stay
short and stable. `?role=all&page=1&q=` collapses to `''` when those
are defaults. A bookmark at `/audit?q=login` keeps working when
`page` is later added with default `1` — the URL doesn't grow stale.

### Ant-patterns to refuse

```tsx
// ❌ Filter state in React — breaks refresh, breaks deep link.
const [search, setSearch] = useState('');

// ❌ Manual router.get with hand-rolled query objects — drifts away
//    from the schema, can't be type-checked.
router.get(url, { q: search, page: 1, role: 'admin' });

// ❌ activeTab + onTabChange callback — tabs are pages, not state.
<Tabs value={activeTab} onChange={setActiveTab} />
```

The `useState` pattern is fine for the input value while the user is
typing — debounce it, then commit to the URL. The point is the URL
is authoritative for what gets rendered, not the React tree.

---

## 1.b. Pages go through one wrapper

Every authenticated page in id ships through a single `<Page>` primitive
that owns the page chrome:

```tsx
import { Page } from '@/components/page';

<Page
    title="Members"                              // H1 + default doc title
    documentTitle="Cbox · settings"              // optional override
    description="People in Cbox..."
    headerActions={<Button>Save</Button>}        // optional, right of H1
    tabs={membersTabs(slug)}                     // optional PageTabSpec[]
    tabActions={<Button>Invite</Button>}         // optional, right of tab strip
>
    <DataPanel>...</DataPanel>
    <DataPanel>...</DataPanel>
</Page>
```

`<Page>` renders `<Head>` + `<PageShell>` + `<PageHeader>` + (optional)
`<PageTabs>` + children, in that order, with fixed padding and column
width. There is **no** other way to lay out a page.

### What this rules out

```tsx
// ❌ Composing chrome manually — drift between pages.
<>
    <Head title="..." />
    <PageShell>
        <PageHeader title="..." />
        <PageTabs items={...} />
        <DataPanel>...</DataPanel>
    </PageShell>
</>

// ❌ Adding a per-page layout wrapper. The layout system has one job
//    (mount the chrome), Page has the other (lay out the page). Don't
//    re-introduce SettingsLayout / IntegrationsLayout / whatever.

// ❌ Skipping Page on a "small" form page. Use Page even when there
//    are no tabs and no header actions; the column width and padding
//    must match the rest of the app.
```

The corresponding cortex / atlas adapter is named identically (`<Page>`)
so a feature ported across apps changes only the import path.

## 1.c. URL conventions

Org-scoped pages live under `/org/{slug}/...`. Account-scoped pages
live under `/settings/...`. Cross-app paths (`/admin`, `/onboarding`,
`/oauth`, `/api`) live at the root.

```
/org/{slug}/dashboard         org overview
/org/{slug}/members           people in the org
/org/{slug}/security/roles    role definitions
/org/{slug}/audit             audit log
/org/{slug}/settings          org name / slug / danger zone
/org/{slug}/billing/...       plan, payment methods, invoices
/settings/profile             user profile
/settings/organizations       which orgs the user belongs to
/admin/...                    Cbox-staff console (gated by RequireSystemAdmin)
```

The slug appears once. Two-letter prefix (`org`, `admin`) reads
intent at a glance. Old paths get 301 redirects in the routes file
so bookmarks, OAuth redirect URIs, and webhook destinations keep
working.

## 1.d. Page slots

`<Page>` exposes a fixed set of slots — every page chrome variation
we ship lives inside this surface. If you need a 6th slot, propose a
primitive change rather than going inline.

```tsx
<Page
    eyebrow="WORKSPACE"             // tiny mono caps above the title
    title="Members"                 // H1
    titleBadge={<Badge>beta</Badge>} // inline pill next to the title
    description="People in Cbox..."
    headerActions={<Button>Save</Button>}
    tabs={membersTabs(slug)}
    tabActions={<Button>Invite</Button>}
    chromeNav={<Filters />}         // second-tier nav under tab strip
    footer={<StatusBar />}          // page-level status row
    width="wide"                    // comfortable | wide | full | bleed
    layout="page"                   // page (default) | canvas
>
    {/* DataPanels / forms / tables */}
</Page>
```

### Layout modes

**`page` (default)** — shell + header + tabs + body + footer in a
column-constrained surface. The bread-and-butter for forms, settings,
audit logs, members rosters.

**`canvas`** — full-bleed working surface with a soft gradient
background. Use for flow diagrams, dashboards, observability views,
or any page where the content draws its own padding. Width and
chromeNav still apply; `width` is ignored (canvas is always edge-to
-edge).

### Width policy (when `layout="page"`)

- `comfortable` (default) — `max-w-6xl`, prose-friendly column.
- `wide` — `max-w-7xl`, for tables and rosters.
- `full` — no max-width, normal padding. Tables on ultra-wide.
- `bleed` — no max-width, no padding. Embedded canvases / iframes.

## 2. Tabs are pages

`<PageTabs>` from cbox-ui is the section-navigation primitive. Every
tab is a real route. The active tab is whichever tab's `href`
matches the current URL — there is no `activeTab` prop, no
`onTabChange` callback. Clicking a tab is a `<Link>` navigation.

### Layout

| Width | Layout                                                                                    |
| ----- | ----------------------------------------------------------------------------------------- |
| ≥ sm  | Horizontal underline strip + optional `actions` slot to the right. Sticky under the TopBar. |
| < sm  | Dropdown (active tab + chevron). Opens to a panel with the full list. Actions stack below. |

This is the **only** section-nav layout. No vertical rails, no chip
groups, no segmented controls. One pattern, one set of muscle memory
across every app.

### Use

```tsx
import { PageTabs } from '@cboxdk/cbox-ui';
import { Link } from '@inertiajs/react';

<PageTabs
    items={[
        { label: 'People', href: people(slug).url, icon: Users, count: 12 },
        { label: 'Roles', href: roles(slug).url, icon: Crown, matchPrefix: true },
    ]}
    currentPath={currentUrl}
    LinkComponent={Link}
    actions={<Button>Invite</Button>}
/>
```

Apps may wrap `PageTabs` to inject app-specific concerns (id wraps
to plumb `withOrgContext`, `currentUrl`, and Inertia's Link). The
wrapper is **only** for plumbing — never for visual changes. Visual
changes go upstream into cbox-ui.

### Anti-patterns to refuse

```tsx
// ❌ Internal state — we lose deep links, refresh breaks.
const [tab, setTab] = useState('people');
<PageTabs activeTab={tab} onChange={setTab} />

// ❌ Building a different tab strip per page — visual drift.
<div className="flex gap-2 border-b">
    <button>People</button>
    <button>Roles</button>
</div>

// ❌ Hiding the strip on mobile with no replacement.
<PageTabs className="hidden lg:flex" />
```

---

## 2.b. Lists are clickable rows

Lists of items (organizations, members, projects, audit rows) use
`<RowLink>` from cbox-ui. The whole row is a clickable Link — no
"Manage" button on the side, no separate "Open" / "View" affordances.
Trailing content (status pills, secondary actions) sits in the
`trailing` slot; interactive controls there auto-stop propagation
via the closest `button|a|input|select|textarea|[role="button"]`
match so they don't fire the row navigation.

```tsx
<RowLink
    href={editOrg(slug).url}
    LinkComponent={Link}
    active={org.isCurrent}
    trailing={<StatusPill>owner</StatusPill>}
>
    <Avatar />
    <div>
        <p>{org.name}</p>
        <p className="text-mono">{org.slug}</p>
    </div>
</RowLink>
```

### Why no Manage buttons

Cbox is a 2026 product. Click-the-row is the table-stakes affordance.
Pinning a "Manage →" pill on every row is a 2008 pattern that wastes
horizontal space, hides the primary action behind a secondary control,
and breaks the natural "click the thing I care about" mental model.

## 2.c. Native `<select>` is forbidden

Use `<Combobox>` from cbox-ui. Always.

```tsx
import { Combobox } from '@cboxdk/cbox-ui';

<Combobox
    value={tier}
    onChange={setTier}
    items={[
        { value: 'all', label: 'All tiers' },
        { value: 'low', label: 'Low' },
        { value: 'guarded', label: 'Guarded' },
        { value: 'elevated', label: 'Elevated' },
        { value: 'high', label: 'High' },
    ]}
    placeholder="Pick a tier"
    triggerWidth="full"
/>
```

### Why never `<select>`

- Can't host avatars, secondary lines, dividers, or section headers.
- Can't be type-ahead-searched on >5 options.
- Mobile: pops the OS picker, breaking the design system.
- Cannot be styled into the chrome — borders, shadows, focus rings
  bypass the token system.
- Worse keyboard ergonomics than what we ship (no Home/End jump,
  no live-search filter, no incremental highlight).

The Radix `<Select>` wrapper currently in `components/ui/select.tsx`
is a transitional dependency — new pages must use `<Combobox>`. We
migrate existing usage incrementally; the lint rule lives in PR
review (and eventually as an eslint-no-restricted-imports rule).

### Combobox capabilities

- Type-ahead filter on `label`, `secondary`, and explicit `keywords`.
  Case-insensitive substring match.
- Keyboard contract: ↑/↓ move highlight, Home/End jump to bounds,
  Enter selects, Escape closes, Tab exits without selecting.
- Optional avatar per option (`{initials, accent, src}`) — same
  shape as ContextBar's avatar.
- Optional grouped sections via `ComboboxGroup`.
- Optional empty-state text when filter excludes everything.
- Optional footer link ("+ New X") at the bottom of the panel.
- Two modes:
  - **Value mode** (`value` + `onChange`): controlled select.
  - **Navigation mode** (items have `href`, `LinkComponent` is set):
    each option is a Link.

## 2.d. Identity + context up top, navigation in the rail

The chrome split across every Cbox app:

```
TOPBAR     [drawer] [collapse] [BRAND] / [ContextBar] … [actions] [⌘K] [Apps] [Bell] [User]
SIDEBAR    [nav sections only — Workspace, Security, Billing, Organization, …]
```

The brand mark and the contextual selectors (org / project / env /
branch as those layers grow) live in the **top bar**. The sidebar is
**pure navigation** — labelled rails, no brand, no org card, no user
identity card.

This is the cloud-platform standard (Vercel, Render, Forge, Cortex,
GitHub, Stripe). It scales:

- id today: 1 crumb (org)
- cortex tomorrow: 3 crumbs (org / project / environment)
- atlas later: 4 crumbs (org / project / region / cluster)

The same `<ContextBar>` primitive renders all of those. Each app
populates its crumbs from its own data source.

```tsx
import { ContextBar } from '@cboxdk/cbox-ui';

<ContextBar
    LinkComponent={Link}
    crumbs={[
        {
            id: 'org',
            label: org.name,
            avatar: { initials: 'CB' },
            items: orgs.map((o) => ({
                id: o.slug,
                label: o.name,
                secondary: o.slug,
                avatar: { initials: deriveInitials(o.name) },
                current: o.slug === org.slug,
            })),
            onSelect: (slug) => switchOrg(slug),
            footerLink: {
                label: 'Manage organizations',
                href: '/settings/organizations',
            },
            ariaLabel: 'Switch organization',
        },
        // optional: project crumb
        // optional: env crumb
    ]}
/>
```

### Why not the OrgCard in the sidebar?

The OrgCard pattern competes with the rail's nav for vertical space,
breaks down at 3+ levels of context, and scatters identity across
two chromes (sidebar vs topbar). The split-chrome model puts every
"who am I / where am I" signal in one row at the top of every page,
and frees the sidebar to be a pure information-architecture rail.

## 3. Chrome lives in cbox-ui

The cross-app chrome — TopBar, OrgSwitcher, AppLauncher, UserMenu,
NotificationsBell, AppShell, AppContent — is owned by cbox-ui. Apps
mount `<CboxIdProvider>` once, populate it from their identity
source, and consume the chrome.

The contract is enforced by `useCboxId()` throwing when no provider
is present. The exception is `useCboxIdOptional()` for chrome
components that should gracefully no-op when an unauthenticated
surface (admin tools without an org context, etc.) renders them.

### Adding a new chrome control

1. Build the component in `cbox-ui/src/components/<name>.tsx`.
2. Read context via `useCboxId()` (or `useCboxIdOptional()` for
   defensive cases).
3. Export from `cbox-ui/src/index.ts`.
4. Bump cbox-ui minor version if the change is additive; major-minor
   if any existing consumer breaks.
5. Update consuming apps' `package.json`.

Never duplicate chrome in an app. If id and cortex both render an
"environment switcher", that switcher belongs in cbox-ui, period.

---

## 4. Visual tokens are defined once

Colours, spacing, typography, radii, shadows, and z-index live in
cbox-ui's tokens (`tokens/cbox.css` + `tailwind.preset.js`). Apps
extend the preset; they do not redefine the tokens.

### Refined-minimal aesthetic

cbox-ui's design language is **refined minimal**: hairline borders,
muted neutrals, narrow accent palette, generous whitespace, modular
type ramp. We don't ship rainbow accents, glowing buttons, or busy
shadows. When in doubt: less is more.

### What this rules out

- ❌ Per-app colour palettes that drift from the tokens.
- ❌ Inline `style={{ color: '#3b82f6' }}` — use tokens.
- ❌ "Just for this page" type sizes outside the ramp.
- ❌ Tailwind utilities applied to override token-aware components
  (e.g. `<DataPanel className="bg-blue-50">`).

If a page needs a different visual treatment, bring it back to the
primitives: extend `<DataPanel>` with a variant, or compose existing
primitives differently.

---

## 5. Adapters per app, not per file

Each app declares **one** adapter for each cross-cutting concern:

| Concern              | id (Inertia)                              | cortex (TanStack Router)                 |
| -------------------- | ----------------------------------------- | ---------------------------------------- |
| URL state            | `resources/js/hooks/use-url-state.ts`     | `src/hooks/useUrlState.ts`               |
| Routing primitives   | `@inertiajs/react` `Link`, `router`       | `@tanstack/react-router` `Link`, `router`|
| Identity context     | populate `<CboxIdProvider>` from Inertia  | populate from `id-client` SDK            |
| Authenticated fetch  | Inertia auto-handles                      | `axios` instance with Bearer interceptor |

Adapters live next to each other in a known directory. New code
imports from those adapters; it does **not** import the framework
directly. That's how a single command (`bun replace`) can swap
underlying libraries without touching feature code.

### Anti-patterns to refuse

```tsx
// ❌ Reaching into Inertia from a feature page when an adapter exists.
import { router } from '@inertiajs/react';
router.get(url, params, { preserveState: true });

// ✅ Use the adapter.
const [, setParams] = useUrlState(schema);
setParams(params);
```

---

## 6. Deletions are a feature

When a primitive duplicates another, **delete one**. We don't keep
"both options" in the design system — that's how visual drift
happens. The migration cost lives in feature code, where it's
visible, not in the primitive layer where it compounds.

Examples of past deletions:
- `SubNav` (vertical rail) → folded into `<PageTabs>` 0.2.0.
- `app-content.tsx` / `app-shell.tsx` (id-local) → replaced by cbox-ui
  exports of the same name.

Each deletion is a major-minor bump. Migration notes go in the
release notes, not in the primitive's source.

---

## 7. Mobile is a first-class breakpoint

Every primitive has a defined mobile behaviour. `display: none` on
mobile is **not** an acceptable answer. If the desktop layout
doesn't compose on a 375px viewport, the primitive needs a mobile
variant before it lands.

### Standard breakpoints

| Token | px   | Use                                                              |
| ----- | ---- | ---------------------------------------------------------------- |
| `sm`  | 640  | Single-column → multi-column transition, mobile dropdowns close. |
| `md`  | 768  | Tablet — most chrome unlocks side-by-side layout.                |
| `lg`  | 1024 | Desktop — full sidebar, multi-rail layouts.                      |

Mobile-first authoring: write the mobile rules first, layer on
desktop overrides. Don't write desktop rules and patch mobile with
overrides.

---

## 8. Keyboard and a11y are non-negotiable

Every interactive primitive supports keyboard navigation, has the
right ARIA roles, and respects `prefers-reduced-motion`. Failing
this in PR review is reason enough to send it back.

Specifics that come up:
- Popovers close on Escape and click-outside.
- Tab strips have `role="tablist"` and links carry
  `aria-current="page"` when active.
- Dropdowns have `aria-expanded`, `aria-haspopup`, and
  `aria-controls` linking to the list id.
- Focus rings are visible — never `outline: none` without a
  `:focus-visible` ring replacement.

---

## 9. Versioning

cbox-ui follows semver:

- **Patch** (0.1.x → 0.1.y): bug fixes, copy tweaks, internal
  refactors that don't change the public surface.
- **Minor** (0.1.x → 0.2.0): new primitives, additive props, new
  exports. Existing consumers keep working.
- **Major-minor while we're 0.x** (0.x.y → 0.x+1.0): breaking
  changes — removed primitives, renamed props, behaviour shifts that
  require migration.

Every release lands with notes in the repo's CHANGELOG describing
what changed and how to migrate.
