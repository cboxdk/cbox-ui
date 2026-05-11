import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCboxIdOptional, type CboxAppLink } from '../context/cbox-id';
import { cn } from '../utils/cn';

type AppLauncherProps = {
    className?: string;
    /**
     * Called when the user clicks an app they're not entitled to. Use
     * this to open an upgrade flow / Stripe checkout / Intercom message.
     * If unset, locked tiles fall through to a static "Add to plan"
     * affordance — the click is a no-op so we never silently ship the
     * user to a broken paywall.
     */
    onLockedAppClick?: (app: CboxAppLink) => void;
};

/**
 * Cross-app launcher — the 9-dot button in the top bar.
 *
 * Renders the Cbox suite as a vertical list with status per app:
 *   - entitled apps   → full-colour tile, click navigates with ?org=<slug>
 *   - locked apps     → greyed out + lock badge, opens upgrade flow if the
 *                       host app provides one (otherwise inert click)
 *   - coming-soon     → greyed out + "soon" badge, never clickable
 *   - the current app → highlighted ring on its monogram tile
 *
 * Row layout (vs. the old 3-col grid) gives us room for descriptions
 * and status badges, which makes the entitlement signal readable at a
 * glance instead of needing a tooltip.
 */
export function AppLauncher({ className, onLockedAppClick }: AppLauncherProps) {
    // Soft-read: if a layout above us forgot to mount <CboxIdProvider>
    // (e.g. an admin shell that doesn't expose cross-app context yet),
    // render nothing instead of crashing the chrome. Throwing here used
    // to take the whole top bar down for any single missing-provider
    // bug downstream.
    const cboxId = useCboxIdOptional();
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Click-outside + Escape close. Mirrors the standard popover
    // contract every other Cbox top-bar control follows.
    useEffect(() => {
        if (! open) {
            return;
        }

        function onPointerDown(event: PointerEvent): void {
            if (
                containerRef.current !== null &&
                ! containerRef.current.contains(event.target as Node)
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

    // No provider above us, or no apps to render — just don't show the
    // launcher button at all. The chrome stays clean.
    if (cboxId === null || cboxId.apps.length === 0) {
        return null;
    }

    const apps = cboxId.apps;

    // Carry the active org slug across apps so users don't have to
    // re-pick after switching. The destination URL embeds the slug
    // directly (`<app>/org/<slug>`) — every Cbox app exposes a
    // canonical `GET /org/{slug}` route that redirects to its own
    // default landing sub-page. URL is the source of truth.
    const orgSlug = cboxId.currentOrganization?.slug;

    // Split entitled vs. locked so the "available" set lands at the
    // top of the list and the upgrade-able set sits in its own section
    // below. Coming-soon apps go with the locked set — they share the
    // "not actionable now" visual treatment.
    const entitled: CboxAppLink[] = [];
    const locked: CboxAppLink[] = [];
    for (const app of apps) {
        const isEntitled = app.entitled !== false && app.comingSoon !== true;
        (isEntitled ? entitled : locked).push(app);
    }

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            <button
                type="button"
                aria-label="Open app launcher"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                    open && 'bg-secondary text-foreground',
                )}
            >
                <Grid />
            </button>
            {open ? (
                <div
                    role="dialog"
                    aria-label="Cbox app launcher"
                    // Cap width at viewport-minus-gutter on narrow
                    // screens so the panel stays inside the visible
                    // area on mobile (390px viewport, 320px panel
                    // would overflow). `right-0` anchors at the
                    // launcher button.
                    className="absolute right-0 top-full z-50 mt-1.5 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
                >
                    <div className="border-b border-border/70 px-3 py-2.5">
                        <p className="text-mono text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                            Cbox suite
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
    onLockedAppClick: AppLauncherProps['onLockedAppClick'];
};

function AppRow({ app, orgSlug, onLockedAppClick }: AppRowProps): ReactNode {
    const isComingSoon = app.comingSoon === true;
    const isLocked = app.entitled === false || isComingSoon;

    const monogram = app.monogram ?? app.name.slice(0, 1).toUpperCase();
    const accent = app.accentColor;
    // Apply the per-app accent colour to the monogram chip so each
    // app keeps its visual identity. Skip when an iconUrl is set —
    // the icon supplies its own colour.
    const tileStyle =
        accent !== undefined && app.iconUrl === undefined
            ? { backgroundColor: accent, color: '#fff', borderColor: accent }
            : undefined;

    // Land directly on `<app>/org/<slug>` so the destination URL is
    // canonical from the first hop — no `?org=` query, no extra
    // redirect. Each Cbox app's `/org/{slug}` route picks its default
    // landing within that org. Skip on the current-app tile (the
    // user is already there).
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
                        isLocked
                            ? 'text-muted-foreground/70'
                            : 'text-muted-foreground',
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
                    onClick={() => onLockedAppClick?.(app)}
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

    return (
        <li>
            <a
                href={href}
                className={cn(
                    'group flex w-full items-center gap-3 rounded-md px-2.5 py-2 transition-colors hover:bg-secondary',
                    app.current && 'bg-accent-soft hover:bg-accent-soft',
                )}
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
        // URL constructor strips trailing slash on origin assembly,
        // preserving any existing path/query/fragment from the app's
        // configured base. We override the path to `/org/<slug>` so
        // every app lands on its canonical org-scoped entry point.
        const u = new URL(url);
        u.pathname = `/org/${encodeURIComponent(orgSlug)}`;
        return u.toString();
    } catch {
        return `${url.replace(/\/$/, '')}/org/${encodeURIComponent(orgSlug)}`;
    }
}

function Grid(): ReactNode {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            {[1, 8, 15].flatMap((y) =>
                [1, 8, 15].map((x) => (
                    <rect
                        key={`${x}-${y}`}
                        x={x}
                        y={y}
                        width="2.5"
                        height="2.5"
                        rx="0.6"
                        fill="currentColor"
                    />
                )),
            )}
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
