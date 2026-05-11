import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCboxIdOptional, type CboxAppLink } from '../context/cbox-id';
import { cn } from '../utils/cn';

type AppSwitcherProps = {
    className?: string;
    /**
     * Called when the user clicks an app they're not entitled to. Use
     * this to open an upgrade flow / Stripe checkout / Intercom message.
     * If unset, locked rows fall through to a static "Add to plan"
     * affordance — the click is a no-op so we never silently ship the
     * user to a broken paywall.
     */
    onLockedAppClick?: (app: CboxAppLink) => void;
};

/**
 * Left-cluster app picker — the dropdown button that sits beside OrgSwitcher.
 *
 * Shows the current app's monogram + name as the trigger so both context
 * dimensions (which app, which org) are immediately visible in the left
 * cluster without needing to open anything.
 *
 * The dropdown preserves the full AppLauncher row richness: monogram tile
 * with per-app accent, name, description, and entitlement badges. Entitled
 * apps are grouped first; locked / coming-soon land in an "Available" section.
 *
 * Soft-reads via useCboxIdOptional — renders null when no provider is
 * mounted above (admin shells, pre-auth pages).
 */
export function AppSwitcher({ className, onLockedAppClick }: AppSwitcherProps) {
    const cboxId = useCboxIdOptional();
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Click-outside + Escape — mirrors every other Cbox top-bar control.
    useEffect(() => {
        if (!open) {
            return;
        }

        function onPointerDown(event: PointerEvent): void {
            if (
                containerRef.current !== null &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        }

        function onKey(event: KeyboardEvent): void {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        }

        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    // No provider, or nothing to show — render nothing. The chrome stays clean.
    if (cboxId === null || cboxId.apps.length === 0) {
        return null;
    }

    const apps = cboxId.apps;
    const orgSlug = cboxId.currentOrganization?.slug;

    // The host/current app — used to build the trigger label.
    const currentApp = apps.find((a) => a.current === true) ?? null;

    // Split entitled vs. locked so entitled apps appear first.
    // Coming-soon apps travel with the locked set — same "not actionable
    // right now" visual treatment.
    const entitled: CboxAppLink[] = [];
    const locked: CboxAppLink[] = [];
    for (const app of apps) {
        const isEntitled = app.entitled !== false && app.comingSoon !== true;
        (isEntitled ? entitled : locked).push(app);
    }

    const triggerMonogram =
        currentApp?.monogram ?? currentApp?.name.slice(0, 1).toUpperCase() ?? '⬛';
    const triggerName = currentApp?.name ?? 'Apps';
    const triggerAccent = currentApp?.accentColor;

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            <button
                type="button"
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-secondary"
            >
                {/* Monogram chip matching the AppLauncher tile style */}
                <span
                    style={
                        triggerAccent !== undefined
                            ? {
                                  backgroundColor: triggerAccent,
                                  color: '#fff',
                                  borderColor: triggerAccent,
                              }
                            : undefined
                    }
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary text-[10px] font-bold"
                >
                    {currentApp?.iconUrl ? (
                        <img
                            src={currentApp.iconUrl}
                            alt=""
                            className="h-3.5 w-3.5"
                            loading="eager"
                        />
                    ) : (
                        triggerMonogram
                    )}
                </span>
                <span className="max-w-[140px] truncate">{triggerName}</span>
                <Chevron />
            </button>

            {open ? (
                <div
                    role="dialog"
                    aria-label="Switch app"
                    // 22rem wide — enough for monogram + name + description in one line
                    // without wrapping. Clamps to viewport-minus-gutter on narrow screens.
                    className="absolute left-0 top-full z-50 mt-1 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
                >
                    <div className="border-b border-border/70 px-3 py-2.5">
                        <p className="text-mono text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                            Switch app
                        </p>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto py-1">
                        {entitled.length > 0 ? (
                            <ul className="space-y-0.5 p-1">
                                {entitled.map((app) => (
                                    <AppRow
                                        key={app.key}
                                        app={app}
                                        orgSlug={orgSlug}
                                        onLockedAppClick={onLockedAppClick}
                                        onNavigate={() => setOpen(false)}
                                    />
                                ))}
                            </ul>
                        ) : null}

                        {locked.length > 0 ? (
                            <>
                                {entitled.length > 0 ? (
                                    <div className="my-1 border-t border-border/50" />
                                ) : null}
                                <p className="text-mono px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase">
                                    Available
                                </p>
                                <ul className="space-y-0.5 p-1 pt-0">
                                    {locked.map((app) => (
                                        <AppRow
                                            key={app.key}
                                            app={app}
                                            orgSlug={orgSlug}
                                            onLockedAppClick={onLockedAppClick}
                                            onNavigate={() => setOpen(false)}
                                        />
                                    ))}
                                </ul>
                            </>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

type AppRowProps = {
    app: CboxAppLink;
    orgSlug: string | undefined;
    onLockedAppClick: AppSwitcherProps['onLockedAppClick'];
    onNavigate: () => void;
};

function AppRow({ app, orgSlug, onLockedAppClick, onNavigate }: AppRowProps): ReactNode {
    const isComingSoon = app.comingSoon === true;
    const isLocked = app.entitled === false || isComingSoon;

    const monogram = app.monogram ?? app.name.slice(0, 1).toUpperCase();
    const accent = app.accentColor;
    const tileStyle =
        accent !== undefined && app.iconUrl === undefined
            ? { backgroundColor: accent, color: '#fff', borderColor: accent }
            : undefined;

    // Land directly on `<app>/org/<slug>` — same convention as AppLauncher.
    // Skip the URL transform for the current app: the user is already there.
    const href =
        orgSlug !== undefined && app.current !== true
            ? buildOrgUrl(app.url, orgSlug)
            : app.url;

    const tile = (
        <div
            style={tileStyle}
            className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-[13px] font-semibold text-foreground',
                app.current && 'ring-2 ring-accent-edge ring-offset-1 ring-offset-popover',
                isLocked && 'opacity-60 grayscale',
            )}
        >
            {app.iconUrl ? (
                <img src={app.iconUrl} alt="" className="h-5 w-5" loading="lazy" />
            ) : (
                <span>{monogram}</span>
            )}
        </div>
    );

    const body = (
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <div className="flex items-center gap-2">
                <span
                    className={cn(
                        'truncate text-sm font-medium text-foreground',
                        isLocked && 'text-muted-foreground',
                    )}
                >
                    {app.name}
                </span>
                {app.current ? (
                    <span className="text-mono shrink-0 rounded-sm border border-accent-edge/40 bg-accent-soft px-1 text-[9px] font-semibold tracking-[0.14em] text-accent uppercase">
                        current
                    </span>
                ) : null}
            </div>
            {app.description ? (
                <span
                    className={cn(
                        'truncate text-[11px]',
                        isLocked ? 'text-muted-foreground/70' : 'text-muted-foreground',
                    )}
                >
                    {app.description}
                </span>
            ) : null}
        </div>
    );

    const trailing = isComingSoon ? (
        <span className="text-mono shrink-0 rounded-sm border border-border bg-secondary px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            soon
        </span>
    ) : isLocked ? (
        <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <Lock />
            Add
        </span>
    ) : null;

    if (isComingSoon) {
        return (
            <li>
                <div
                    aria-disabled
                    className="flex w-full cursor-not-allowed items-center gap-3 rounded-md px-2.5 py-2"
                    title={`${app.name} — coming soon`}
                >
                    {tile}
                    {body}
                    {trailing}
                </div>
            </li>
        );
    }

    if (isLocked) {
        return (
            <li>
                <button
                    type="button"
                    onClick={() => {
                        onLockedAppClick?.(app);
                        onNavigate();
                    }}
                    className={cn(
                        'group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                        onLockedAppClick !== undefined
                            ? 'hover:bg-secondary'
                            : 'cursor-default',
                    )}
                    title={`Add ${app.name} to your plan`}
                >
                    {tile}
                    {body}
                    {trailing}
                </button>
            </li>
        );
    }

    // Current app: render as a div (no navigation needed — user is already here).
    if (app.current === true) {
        return (
            <li>
                <div className="flex w-full items-center gap-3 rounded-md bg-accent-soft px-2.5 py-2">
                    {tile}
                    {body}
                    {trailing}
                </div>
            </li>
        );
    }

    return (
        <li>
            <a
                href={href}
                onClick={onNavigate}
                className="group flex w-full items-center gap-3 rounded-md px-2.5 py-2 transition-colors hover:bg-secondary"
            >
                {tile}
                {body}
                {trailing}
            </a>
        </li>
    );
}

function buildOrgUrl(url: string, orgSlug: string): string {
    if (url === '' || orgSlug === '') {
        return url;
    }
    try {
        const u = new URL(url);
        u.pathname = `/org/${encodeURIComponent(orgSlug)}`;
        return u.toString();
    } catch {
        return `${url.replace(/\/$/, '')}/org/${encodeURIComponent(orgSlug)}`;
    }
}

function Chevron(): ReactNode {
    return (
        <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <path
                d="M2 4l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function Lock(): ReactNode {
    return (
        <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <rect x="2.5" y="5" width="7" height="5" rx="1" />
            <path d="M4 5V3.5a2 2 0 1 1 4 0V5" />
        </svg>
    );
}
