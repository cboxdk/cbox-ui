// Identity context — every Cbox-family app wraps with this.
export {
    CboxIdProvider,
    useCboxId,
    useCboxIdOptional,
    type CboxAppKey,
    type CboxAppLink,
    type CboxIdContextValue,
    type CboxNotificationPreviewItem,
    type CboxNotificationsState,
    type CboxOrganization,
    type CboxUser,
} from './context/cbox-id';

// Layout shell — chrome that sits at the top of every app.
//
// Apps SHOULD use `<CboxAppShell>` — it composes the full chrome
// from a single nav config + brand. The lower-level primitives
// (AppShell / AppContent / TopBar) are exposed for unusual cases
// but normal product apps shouldn't compose them by hand.
export { AppContent } from './layout/app-content';
export { AppShell } from './layout/app-shell';
export {
    CboxAppShell,
    type CboxAppShellProps,
} from './layout/cbox-app-shell';
export {
    CboxAppSidebar,
    type CboxAppSidebarProps,
    type CboxNavItem,
    type CboxNavSection,
    type LinkComponent,
} from './layout/cbox-app-sidebar';
export { CboxBrand, type CboxBrandProps } from './layout/cbox-brand';
export {
    CboxOrgContextBar,
    type CboxOrgContextBarProps,
} from './layout/cbox-org-context-bar';
export { TopBar } from './layout/top-bar';

// Cross-app chrome controls.
export { AppLauncher } from './components/app-launcher';
export { NotificationsBell } from './components/notifications-bell';
export { OrgSwitcher } from './components/org-switcher';
export { SearchTrigger } from './components/search-trigger';
export { UserMenu } from './components/user-menu';

// Form primitives.
export { Combobox, type ComboboxOption, type ComboboxProps } from './components/combobox';

// Page primitives.
export {
    ContextBar,
    ContextAvatarChip,
    type ContextAvatar,
    type ContextCrumb,
    type ContextItem,
} from './primitives/context-bar';
export { DataPanel, PanelBody, SectionHeader } from './primitives/data-panel';
export { EmptyState } from './primitives/empty-state';
export { default as Heading } from './primitives/heading';
export { KeyValue, KeyValueList } from './primitives/key-value';
export { PageHeader } from './primitives/page-header';
export { PageShell, type PageWidth } from './primitives/page-shell';
export { RowLink } from './primitives/row-link';
export { PageTabs, type PageTabSpec } from './primitives/page-tabs';
export { StatTile } from './primitives/stat-tile';
export { StatusPill } from './primitives/status-pill';

// Cross-app surface runtime — single overlay layer (modal/drawer) that
// every Cbox app mounts so chrome controls (bell, search trigger) can
// open inbox/search/etc without route navigation.
export {
    CboxSurfaces,
    useCboxSurfaces,
    useCboxSurfacesOptional,
} from './surfaces/surface-state';
export type {
    CboxSurfacesProps,
    InboxState,
    RealtimeState,
    RealtimeStatus,
    SurfaceArgs,
    SurfaceConfig,
    SurfaceController,
    SurfaceId,
    Transport,
} from './surfaces/types';

// Utilities.
export { cn } from './utils/cn';
export {
    buildUrlSearch,
    defineUrlSchema,
    parseUrlSearch,
    urlBoolean,
    urlEnum,
    urlNumber,
    urlString,
    urlStringArray,
    type InferUrlState,
    type UrlField,
    type UrlSchema,
} from './utils/url-state';
