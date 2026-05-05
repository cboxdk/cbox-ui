import type { ReactNode } from 'react';
import { AppLauncher } from '../components/app-launcher';
import { NotificationsBell } from '../components/notifications-bell';
import { OrgSwitcher } from '../components/org-switcher';
import { UserMenu } from '../components/user-menu';
import { cn } from '../utils/cn';

type Props = {
    /**
     * App branding rendered on the left — typically a small logo +
     * the app name. Rendered inside a fixed-height bar so keep it
     * visually compact (24-32px tall content).
     */
    brand: ReactNode;
    /** Anything between brand and the right cluster — search, breadcrumbs, etc. */
    centre?: ReactNode;
    /**
     * Override slots if an app needs a different control mix in the
     * right cluster. Default: AppLauncher → NotificationsBell → UserMenu.
     */
    rightCluster?: ReactNode;
    /**
     * Whether to show the org switcher next to the brand. Hide on
     * non-org-scoped surfaces (eg id account-settings).
     */
    showOrgSwitcher?: boolean;
    className?: string;
};

/**
 * Standard Cbox top bar. Same shell across every app — keeps cross-app
 * navigation (launcher, account, notifications) muscle-memory-stable.
 */
export function TopBar({
    brand,
    centre,
    rightCluster,
    showOrgSwitcher = true,
    className,
}: Props) {
    return (
        <header
            className={cn(
                'flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4',
                className,
            )}
        >
            <div className="flex items-center gap-3">
                {brand}
                {showOrgSwitcher ? <OrgSwitcher /> : null}
            </div>
            <div className="min-w-0 flex-1">{centre}</div>
            <div className="flex shrink-0 items-center gap-1">
                {rightCluster ?? (
                    <>
                        <AppLauncher />
                        <NotificationsBell />
                        <UserMenu />
                    </>
                )}
            </div>
        </header>
    );
}
