import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppContent } from './app-content';
import { AppShell } from './app-shell';
import {
    CboxAppSidebar,
    type CboxNavSection,
    type LinkComponent,
} from './cbox-app-sidebar';
import { AppSwitcher } from '../components/app-switcher';
import { NotificationsBell } from '../components/notifications-bell';
import { SearchTrigger } from '../components/search-trigger';
import { UserMenu } from '../components/user-menu';

export type CboxAppShellProps = {
    /** App key — drives the brand submark + aria labels. */
    appKey: string;
    /** Override the submark text (defaults to appKey). */
    brandSubmark?: string | null;
    /** Asset base for brand pngs. Default `/brand`. */
    assetBase?: string;
    /** Brand row href (typically the app's home). */
    brandHref?: string;

    /** Sidebar nav config. */
    sections: CboxNavSection[];
    /** Active path — used by both sidebar (highlight) and topbar
     *  (sidebar-collapse toggle aria state). */
    currentPath: string;
    /** Apps inject their router's Link primitive. */
    LinkComponent: LinkComponent;

    /** Persisted "sidebar collapsed?" state — owned by the host
     *  (the cookie hook lives there). */
    sidebarCollapsed?: boolean;
    /** Click handler for the topbar collapse toggle. Hide the
     *  toggle entirely by omitting this prop. */
    onToggleSidebar?: () => void;

    /**
     * Topbar centre slot — typically the org switcher / context
     * bar. Apps that aren't org-scoped (notifications, account
     * pages) leave this off.
     */
    topbarCentre?: ReactNode;

    /**
     * Handler to open the in-app command palette / search UI.
     * When provided, renders a `<SearchTrigger>` in the topbar right
     * cluster. When omitted, the search slot is hidden — so apps that
     * haven't wired a palette yet don't show a dead button.
     */
    onSearchOpen?: () => void;

    /**
     * Override the right cluster on the topbar. Default:
     * `[<SearchTrigger>?] <AppLauncher /> <NotificationsBell /> <UserMenu />`.
     * Override only when an app needs a completely different mix.
     */
    topbarRightCluster?: ReactNode;

    children: ReactNode;
};

/**
 * Top-level Cbox application shell. Composes sidebar + topbar +
 * content into the single chrome shape every Cbox app wears.
 *
 * Apps reduce to ~30 lines of layout: define nav, render
 * `<CboxAppShell>{children}</CboxAppShell>`. No app should
 * compose `<AppShell>`/`<AppContent>`/sidebar/topbar manually —
 * drift is the whole reason this component exists.
 */
export function CboxAppShell({
    appKey,
    brandSubmark,
    assetBase,
    brandHref,
    sections,
    currentPath,
    LinkComponent,
    sidebarCollapsed = false,
    onToggleSidebar,
    topbarCentre,
    onSearchOpen,
    topbarRightCluster,
    children,
}: CboxAppShellProps) {
    const ToggleIcon = sidebarCollapsed ? PanelLeftOpen : PanelLeftClose;

    return (
        <AppShell>
            <CboxAppSidebar
                appKey={appKey}
                brandSubmark={brandSubmark}
                assetBase={assetBase}
                brandHref={brandHref}
                sections={sections}
                currentPath={currentPath}
                LinkComponent={LinkComponent}
                collapsed={sidebarCollapsed}
            />
            <AppContent>
                <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-md">
                    <div className="flex min-w-0 items-center gap-2">
                        {onToggleSidebar !== undefined ? (
                            <button
                                type="button"
                                onClick={onToggleSidebar}
                                className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:inline-flex"
                                aria-label={
                                    sidebarCollapsed
                                        ? 'Expand sidebar'
                                        : 'Collapse sidebar'
                                }
                                title={
                                    sidebarCollapsed
                                        ? 'Expand sidebar'
                                        : 'Collapse sidebar'
                                }
                            >
                                <ToggleIcon
                                    className="h-4 w-4"
                                    strokeWidth={1.8}
                                />
                            </button>
                        ) : null}
                        <AppSwitcher />
                        {topbarCentre !== undefined ? topbarCentre : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {topbarRightCluster !== undefined ? (
                            topbarRightCluster
                        ) : (
                            <>
                                {onSearchOpen !== undefined ? (
                                    <SearchTrigger onOpen={onSearchOpen} />
                                ) : null}
                                <NotificationsBell />
                                <UserMenu />
                            </>
                        )}
                    </div>
                </header>
                {children}
            </AppContent>
        </AppShell>
    );
}
