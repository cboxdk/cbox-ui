import {
    useEffect,
    useId,
    useRef,
    useState,
    type ComponentType,
    type ReactNode,
} from 'react';
import { cn } from '../utils/cn';

/**
 * Section navigation: every "tab" is a real page with its own URL.
 * No internal active-state, no callbacks — the host's router is the
 * source of truth. This is what makes deep links and hard refreshes
 * lossless: paste any URL, the right tab is active and the right
 * panel renders, with no client-side coordination required.
 *
 * Layout:
 *   ≥ sm    horizontal underline strip + optional `actions` slot to
 *           the right; sticky just under the TopBar with a hairline
 *           border-bottom and a backdrop-blur for the scroll-into
 *           effect.
 *   < sm    dropdown showing the active tab + chevron; opens a panel
 *           with the full list. Actions reflow below the trigger.
 *
 * The same primitive runs the section nav across every Cbox app. It
 * lives here so that the visual contract is single-sourced — there's
 * no way for a feature page to invent its own slightly-different tab
 * strip.
 */

export type PageTabSpec = {
    /** Display label. Truncates inline if it overflows the strip. */
    label: string;
    /** Absolute or app-relative href. The host router renders this. */
    href: string;
    /**
     * Optional leading icon. Constrained to the icon shape we use
     * everywhere — this is how cbox-ui keeps icon weights aligned
     * across primitives without depending on `lucide-react`.
     */
    icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
    /**
     * Optional badge — a count, status pill, or "new" indicator. Use
     * sparingly; one badge in a row is signal, three is noise.
     */
    badge?: ReactNode;
    /**
     * Numeric count rendered inline. Convenience for the common
     * "Members 12" pattern; mutually exclusive with `badge` (badge
     * wins if both are set).
     */
    count?: number;
    /**
     * Match the current path by prefix. Use for hub pages whose
     * nested routes should still highlight the parent tab — e.g.
     * `/org/<slug>/members` highlights when on
     * `/org/<slug>/members/<id>`.
     */
    matchPrefix?: boolean;
};

export type PageTabsProps = {
    items: PageTabSpec[];
    /** Current pathname, host-supplied. Drives active-state matching. */
    currentPath: string;
    /**
     * The framework's link component. Inertia consumers pass the
     * Inertia `Link`; TanStack Router consumers pass their typed
     * `Link`; plain anchors are the fallback. We never invent
     * navigation here.
     */
    LinkComponent?: ComponentType<{
        href: string;
        prefetch?: boolean;
        className?: string;
        children: ReactNode;
        'aria-current'?: 'page' | undefined;
    }>;
    /**
     * Right-aligned slot on desktop, reflowed under the dropdown on
     * mobile. Use for primary section actions (Invite, Add token,
     * Export…) that belong to the section as a whole rather than the
     * specific tab. The slot is always reserved on desktop so pages
     * with and without actions keep identical row geometry — no
     * layout shift between sibling tabs.
     */
    actions?: ReactNode;
    className?: string;
};

const DefaultLink: ComponentType<{
    href: string;
    className?: string;
    children: ReactNode;
    'aria-current'?: 'page' | undefined;
}> = ({ href, className, children, 'aria-current': ariaCurrent }) => (
    <a href={href} className={className} aria-current={ariaCurrent}>
        {children}
    </a>
);

export function PageTabs({
    items,
    currentPath,
    LinkComponent = DefaultLink,
    actions,
    className,
}: PageTabsProps) {
    const activeHref = resolveActiveHref(items, currentPath);

    return (
        <div
            data-component="page-tabs"
            className={cn(
                // Card-style chrome — same border, radius, bg as DataPanel
                // so the tab strip reads as a peer of the content panels
                // beneath it instead of floating on the page background.
                // Width matches PageShell content; no sticky positioning.
                'rounded-lg border border-border bg-card',
                className,
            )}
        >
            {/* Desktop: strip + actions on the same baseline. The strip's
                active underline anchors the visual baseline of the row;
                the actions slot is always rendered (even when empty) so
                pages with and without actions stay byte-identical in
                width and content alignment. */}
            <div className="hidden items-end gap-3 px-3 sm:flex">
                <DesktopStrip
                    items={items}
                    activeHref={activeHref}
                    LinkComponent={LinkComponent}
                />
                <div className="flex min-h-12 shrink-0 items-center gap-2">
                    {actions}
                </div>
            </div>

            {/* Mobile: dropdown + actions stacked underneath. */}
            <div className="flex flex-col gap-2 p-3 sm:hidden">
                <MobileDropdown
                    items={items}
                    activeHref={activeHref}
                    LinkComponent={LinkComponent}
                />
                {actions !== undefined ? (
                    <div className="flex flex-wrap items-center gap-2">
                        {actions}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

type StripProps = {
    items: PageTabSpec[];
    activeHref: string | null;
    LinkComponent: NonNullable<PageTabsProps['LinkComponent']>;
};

function DesktopStrip({ items, activeHref, LinkComponent }: StripProps) {
    return (
        <nav
            // Pill-style tabs inside the card chrome read clearly as
            // switching controls: active gets a filled chip + ring,
            // inactive sits in plain text with a hover fill. The whole
            // strip is centered vertically inside the row so the actions
            // slot on the right shares the same baseline.
            className="flex min-h-12 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden py-1.5"
            role="tablist"
            aria-label="Section navigation"
        >
            {items.map((item) => {
                const Icon = item.icon;
                const active = item.href === activeHref;

                return (
                    <LinkComponent
                        key={item.href}
                        href={item.href}
                        prefetch
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                            'inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] whitespace-nowrap transition-colors',
                            active
                                ? 'bg-secondary font-semibold text-foreground shadow-sm ring-1 ring-border-strong/60'
                                : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                        )}
                    >
                        {Icon !== undefined ? (
                            <Icon
                                className={cn(
                                    'h-3.5 w-3.5 shrink-0',
                                    active
                                        ? 'text-foreground'
                                        : 'text-muted-foreground',
                                )}
                                strokeWidth={1.7}
                            />
                        ) : null}
                        <span>{item.label}</span>
                        <ItemTrailing item={item} active={active} />
                    </LinkComponent>
                );
            })}
        </nav>
    );
}

function MobileDropdown({ items, activeHref, LinkComponent }: StripProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);
    const listId = useId();

    const active = items.find((item) => item.href === activeHref) ?? items[0];

    // Click-outside + Escape close. Same popover contract every other
    // cbox-ui dropdown follows so it feels native to users navigating
    // by keyboard.
    useEffect(() => {
        if (! open) return;

        function onPointerDown(event: PointerEvent): void {
            if (
                ref.current !== null &&
                ! ref.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        }

        function onKey(event: KeyboardEvent): void {
            if (event.key === 'Escape') setOpen(false);
        }

        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (active === undefined) {
        return null;
    }

    const ActiveIcon = active.icon;

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => ! v)}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls={listId}
                className={cn(
                    'flex w-full min-h-11 items-center justify-between gap-2 rounded-md border border-border bg-card px-3 text-left text-[13px] font-medium text-foreground transition-colors hover:border-border-strong',
                    open && 'border-border-strong ring-2 ring-ring/30',
                )}
            >
                <span className="flex min-w-0 items-center gap-2">
                    {ActiveIcon !== undefined ? (
                        <ActiveIcon
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                            strokeWidth={1.7}
                        />
                    ) : null}
                    <span className="truncate">{active.label}</span>
                    <ItemTrailing item={active} active />
                </span>
                <Chevron open={open} />
            </button>

            {open ? (
                <ul
                    id={listId}
                    role="listbox"
                    aria-label="Section navigation"
                    className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-lg"
                >
                    {items.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.href === activeHref;

                        return (
                            <li key={item.href}>
                                <LinkComponent
                                    href={item.href}
                                    prefetch
                                    aria-current={isActive ? 'page' : undefined}
                                    className={cn(
                                        'flex w-full items-center gap-2 px-3 py-2.5 text-[13px] transition-colors',
                                        isActive
                                            ? 'bg-accent-soft font-semibold text-foreground'
                                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                                    )}
                                >
                                    {Icon !== undefined ? (
                                        <Icon
                                            className={cn(
                                                'h-3.5 w-3.5 shrink-0',
                                                isActive
                                                    ? 'text-foreground'
                                                    : 'text-muted-foreground',
                                            )}
                                            strokeWidth={1.7}
                                        />
                                    ) : null}
                                    <span className="flex-1 truncate">
                                        {item.label}
                                    </span>
                                    <ItemTrailing
                                        item={item}
                                        active={isActive}
                                    />
                                </LinkComponent>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );
}

function ItemTrailing({
    item,
    active,
}: {
    item: PageTabSpec;
    active: boolean;
}): ReactNode {
    if (item.badge !== undefined) {
        return <span className="ml-1 shrink-0">{item.badge}</span>;
    }

    if (item.count !== undefined) {
        return (
            <span
                className={cn(
                    'ml-1 shrink-0 rounded-sm border px-1 text-[10px] font-semibold tracking-tight tabular-nums',
                    active
                        ? 'border-border-strong bg-secondary text-foreground'
                        : 'border-border bg-secondary/60 text-muted-foreground',
                )}
            >
                {item.count}
            </span>
        );
    }

    return null;
}

function Chevron({ open }: { open: boolean }): ReactNode {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
                'shrink-0 text-muted-foreground transition-transform duration-150',
                open && 'rotate-180',
            )}
            aria-hidden
        >
            <path d="m3.5 5.5 3.5 3.5 3.5-3.5" />
        </svg>
    );
}

/**
 * Strip query string and hash from a URL/href so active-state matching
 * compares paths only. Tab hrefs may carry `?org=<slug>` or other
 * adapter-injected params (id's withOrgContext, cortex's org pinning,
 * etc.); the user's current URL doesn't include those when the page
 * mounted via a path-only navigation. Without this strip, `/foo` and
 * `/foo?org=cbox` are not equal and no tab lights up.
 */
function pathOnly(href: string): string {
    const queryIndex = href.indexOf('?');
    const hashIndex = href.indexOf('#');
    let end = href.length;
    if (queryIndex !== -1) end = Math.min(end, queryIndex);
    if (hashIndex !== -1) end = Math.min(end, hashIndex);

    return href.slice(0, end);
}

/**
 * Active-state resolver — picks the longest-matching href so a more
 * specific child wins over its parent. Without this rule, both
 * `/security` and `/security/passkeys` would match when the user is
 * on Passkeys and we'd light up two tabs.
 *
 * Matches paths only (query / hash stripped) so tab hrefs that carry
 * adapter-injected params still resolve.
 */
function resolveActiveHref(
    items: PageTabSpec[],
    currentPath: string,
): string | null {
    const current = pathOnly(currentPath);

    const candidates = items
        .map((item) => {
            const itemPath = pathOnly(item.href);
            const matched =
                item.matchPrefix === true
                    ? current === itemPath ||
                      current.startsWith(itemPath + '/')
                    : current === itemPath;

            return matched ? item.href : null;
        })
        .filter((href): href is string => href !== null);

    if (candidates.length === 0) return null;

    return candidates.reduce((longest, href) =>
        href.length > longest.length ? href : longest,
    );
}
