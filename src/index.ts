// Identity context — every Cbox-family app wraps with this.
export {
    CboxIdProvider,
    useCboxId,
    useCboxIdOptional,
    type CboxAppKey,
    type CboxAppLink,
    type CboxIdContextValue,
    type CboxNotificationsState,
    type CboxOrganization,
    type CboxUser,
} from './context/cbox-id';

// Layout shell — chrome that sits at the top of every app.
export { TopBar } from './layout/top-bar';

// Cross-app chrome controls.
export { AppLauncher } from './components/app-launcher';
export { NotificationsBell } from './components/notifications-bell';
export { OrgSwitcher } from './components/org-switcher';
export { UserMenu } from './components/user-menu';

// Page primitives.
export { DataPanel, PanelBody, SectionHeader } from './primitives/data-panel';
export { EmptyState } from './primitives/empty-state';
export { default as Heading } from './primitives/heading';
export { KeyValue, KeyValueList } from './primitives/key-value';
export { PageHeader } from './primitives/page-header';
export { PageShell } from './primitives/page-shell';
export { PageTabs, type PageTabSpec } from './primitives/page-tabs';
export { StatTile } from './primitives/stat-tile';
export { StatusPill } from './primitives/status-pill';

// Utilities.
export { cn } from './utils/cn';
