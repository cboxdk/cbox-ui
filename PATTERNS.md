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
| ≥ sm  | Horizontal underline strip + optional `actions` slot to the right. Sticky under the shell's header. |
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
- Optional avatar per option (`{initials, accent, src}`): a small
  initials chip like the shell's context menus.
- Optional grouped sections via `ComboboxGroup`.
- Optional empty-state text when filter excludes everything.
- Optional footer link ("+ New X") at the bottom of the panel.
- Two modes:
  - **Value mode** (`value` + `onChange`): controlled select.
  - **Navigation mode** (items have `href`, `LinkComponent` is set):
    each option is a Link.

## 2.d. Context up top, navigation and the account in the rail

One shell for every app (`CboxShell`, spec `docs/specs/2026-11-10-shell-v1.md`):

```
RAIL     [app] areas … [account]
HEADER   [C] Cbox ⇕ / [W] Webshop · ■ Production ⇕   [Search or ask… ⌘K] [Help] [Bell?] [Switch app]
SUBNAV   the area's pages, when it has more than one
```

- **The tenant is an Organization**, in every app and every string. Level 2 is named by the
  app (Project, Site, Space, Status page); level 3 is Environment.
- **Two triggers, styled the same:** the organization, and one for level 2 and 3 together
  (the cascade). No borders, a hover background, 32px tall, a light `/` between them.
- **Every menu has search** (it focuses itself only with a fine pointer), lists load lazily
  from the level's `listUrl`, and **New …** asks only for a name, creates it and lands on its
  details page. Never a dead end.
- **Switching keeps the page** when it exists in the new context; an entity page falls back
  to its area's list. The URL is the state (`/orgs/{org}/…`).
- **The account lives at the bottom of the rail**, never in the header. The header's right
  side is the same in every app: Search, Help, the bell only when the app has a source,
  Switch app.
- **Density:** rows at least 40px, 12px row padding, 4px between rows, 8px around a list,
  12px inside a pane; names truncate with the full name in a tooltip.

Environments are app-defined: each row may carry a `tone` (production, sandbox, neutral), a
short `label` and `testData`. The shell never sorts them, and the sandbox strip shows only
while the current one has test data.

## 3. The shell lives in cbox-ui

The rail, header, context menus, palette, Help column, app switcher, account menu and the
phone sheets are owned by cbox-ui and described by one server-built prop, `shell`
(laravel-console-kit). An app never draws its own: no copied `shared-shell.css`,
`app-switcher.ts`, `Shell.tsx` or `chrome/*`.

### Changing the shell

1. Change `src/shell/*` and the `Shell` type together; the type is the public contract.
2. Add a unit test for the behaviour and, for anything visible, a state in
   `tests/visual/shell.spec.ts`; run `bun run test:visual` and look at the images.
3. A changed or removed field in `Shell` is a breaking minor while we are 0.x.
4. console-kit produces the new field in the same round.

Never duplicate the shell in an app. If an app needs something the shell lacks, that is a
cbox-ui change.

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
- Menus are listboxes or `role="menu"` with roving focus: ↑↓ Home End Enter Esc work, Tab
  leaves, and focus returns to the trigger on close.
- Search fields focus themselves only on `(hover: hover) and (pointer: fine)`, never on touch.
- Targets are at least 32px on desktop and 44px on a coarse pointer.
- Sheets and overlays trap focus only while they are modal.
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
