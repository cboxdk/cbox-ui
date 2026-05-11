import type { ComponentType, ReactNode } from 'react';
import { CboxBrand } from './cbox-brand';
import { cn } from '../utils/cn';

export type CboxNavItem = {
    label: string;
    /**
     * Absolute path the host's router can navigate to. Apps that
     * scope nav by org slug should compose the path themselves
     * (`/org/${slug}/endpoints`) before passing it in — cbox-ui
     * stays unaware of routing conventions.
     */
    href: string;
    icon: ComponentType<{ className?: string; strokeWidth?: number }>;
    /** Highlight the row for child routes too (`/endpoints/123`
     *  matches the `Endpoints` row when this is true). */
    matchPrefix?: boolean;
};

export type CboxNavSection = {
    label: string;
    items: CboxNavItem[];
};

/**
 * Generic Link contract — apps inject their own (Inertia's `Link`,
 * Wouter, React Router, plain `<a>`). cbox-ui doesn't depend on
 * any router so the same chrome works everywhere.
 */
export type LinkComponent = ComponentType<{
    href: string;
    prefetch?: boolean;
    children: ReactNode;
    className?: string;
    title?: string;
    'aria-label'?: string;
}>;

export type CboxAppSidebarProps = {
    /** App key for the brand submark (and aria labels). */
    appKey: string;
    /** Optional override for the submark — defaults to `appKey`. */
    brandSubmark?: string | null;
    /** Where brand assets live. Default `/brand`. */
    assetBase?: string;
    /** Where the brand row links to (typically the app's home). */
    brandHref?: string;

    /** Nav sections — top to bottom. */
    sections: CboxNavSection[];
    /** Active path — used to highlight the current row. */
    currentPath: string;

    /** Apps inject their router's Link primitive. */
    LinkComponent: LinkComponent;

    /** Persisted "is the desktop sidebar collapsed?" state. */
    collapsed?: boolean;

    className?: string;
};

/**
 * Standard Cbox sidebar. Every app wears this — the only variable
 * bits are `sections` (per-app nav) and `appKey` (drives the brand
 * submark).
 *
 * Hidden below `lg` — apps render a separate mobile drawer that
 * shares the same `sections` config.
 *
 * No app should ship its own sidebar component. The chrome is the
 * shape; nav items are the data.
 */
export function CboxAppSidebar({
    appKey,
    brandSubmark,
    assetBase,
    brandHref = '/',
    sections,
    currentPath,
    LinkComponent,
    collapsed = false,
    className,
}: CboxAppSidebarProps) {
    return (
        <aside
            data-slot="cbox-app-sidebar"
            data-collapsed={collapsed ? 'true' : 'false'}
            className={cn(
                'hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150 ease-out lg:flex',
                collapsed ? 'w-[60px]' : 'w-[240px]',
                className,
            )}
        >
            <LinkComponent
                href={brandHref}
                aria-label="Home"
                className={cn(
                    'flex h-14 shrink-0 items-center border-b border-sidebar-border/70',
                    collapsed ? 'justify-center px-0' : 'px-4',
                )}
            >
                <CboxBrand
                    appKey={appKey}
                    submark={brandSubmark}
                    assetBase={assetBase}
                    collapsed={collapsed}
                />
            </LinkComponent>

            <nav
                className={cn(
                    'flex-1 overflow-y-auto pt-5 pb-3',
                    collapsed ? 'space-y-3 px-2' : 'space-y-5 px-3',
                )}
            >
                {sections.map((section) => (
                    <div key={section.label} className="space-y-1">
                        {collapsed ? null : (
                            <p className="text-eyebrow px-3 pb-1">
                                {section.label}
                            </p>
                        )}
                        <ul className="space-y-0.5">
                            {section.items.map((item) => {
                                const active = item.matchPrefix === true
                                    ? currentPath === item.href ||
                                      currentPath.startsWith(item.href + '/')
                                    : currentPath === item.href;
                                const Icon = item.icon;

                                return (
                                    <li key={item.label}>
                                        <LinkComponent
                                            href={item.href}
                                            prefetch
                                            aria-label={
                                                collapsed
                                                    ? item.label
                                                    : undefined
                                            }
                                            title={
                                                collapsed
                                                    ? item.label
                                                    : undefined
                                            }
                                            className={cn(
                                                collapsed
                                                    ? 'group mx-auto flex h-9 w-9 items-center justify-center rounded-md transition-colors'
                                                    : 'group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-colors',
                                                active
                                                    ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                                                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground',
                                            )}
                                        >
                                            <Icon
                                                className={cn(
                                                    'h-4 w-4 shrink-0',
                                                    active
                                                        ? 'text-foreground'
                                                        : 'text-sidebar-muted',
                                                )}
                                                strokeWidth={1.7}
                                            />
                                            {collapsed ? null : (
                                                <span className="flex-1 truncate">
                                                    {item.label}
                                                </span>
                                            )}
                                        </LinkComponent>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>
        </aside>
    );
}
