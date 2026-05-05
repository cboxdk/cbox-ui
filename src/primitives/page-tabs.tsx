import type { ComponentType, ReactNode } from 'react';
import { cn } from '../utils/cn';

export type PageTabSpec = {
    label: string;
    href: string;
    icon?: ComponentType<{ className?: string }>;
    /** Optional badge (count, "new", etc.) rendered next to the label. */
    badge?: ReactNode;
    /**
     * Match this tab when the current URL exactly equals href OR
     * starts with href + "/". Useful for nested routes.
     */
    matchPrefix?: boolean;
};

type Props = {
    items: PageTabSpec[];
    /** Current path the consumer wants to mark active. */
    currentPath: string;
    /**
     * Anchor renderer. Default uses `<a>` — Inertia consumers pass
     * `Link` from `@inertiajs/react` so navigation stays SPA-flavoured.
     * Receives `{ href, children, className }` and any other anchor
     * props the user passed via `linkProps` (rare).
     */
    LinkComponent?: ComponentType<{
        href: string;
        children: ReactNode;
        className?: string;
    }>;
    actions?: ReactNode;
    className?: string;
};

const DefaultLink: ComponentType<{
    href: string;
    children: ReactNode;
    className?: string;
}> = ({ href, children, className }) => (
    <a href={href} className={className}>
        {children}
    </a>
);

/**
 * Tabs strip on a page baseline. Active tab gets the accent
 * underline; everything else is muted.
 *
 * Decoupled from any router — pass `currentPath` and a `LinkComponent`
 * to plug in Inertia, Next, plain anchors, whatever.
 */
export function PageTabs({
    items,
    currentPath,
    LinkComponent = DefaultLink,
    actions,
    className,
}: Props) {
    const activeHref = (() => {
        const matches = items
            .map((item) => {
                const matched = item.matchPrefix
                    ? currentPath === item.href ||
                      currentPath.startsWith(item.href + '/')
                    : currentPath === item.href;
                return matched ? item.href : null;
            })
            .filter((href): href is string => href !== null);

        if (matches.length === 0) {
            return null;
        }

        return matches.reduce((longest, href) =>
            href.length > longest.length ? href : longest,
        );
    })();

    return (
        <div
            className={cn(
                'flex flex-wrap items-end justify-between gap-3 border-b border-border',
                className,
            )}
        >
            <nav className="-mb-px flex flex-wrap items-center gap-1">
                {items.map((item) => {
                    const Icon = item.icon;
                    const active = item.href === activeHref;
                    return (
                        <LinkComponent
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors',
                                active
                                    ? 'border-foreground text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                            <span>{item.label}</span>
                            {item.badge ? (
                                <span className="ml-1">{item.badge}</span>
                            ) : null}
                        </LinkComponent>
                    );
                })}
            </nav>
            {actions ? (
                <div className="flex shrink-0 items-center gap-2 pb-2">
                    {actions}
                </div>
            ) : null}
        </div>
    );
}
