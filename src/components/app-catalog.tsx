import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useCboxLocalization } from '../context/localization';
import { cn } from '../utils/cn';
import { CboxAppIcon, rememberAppCatalog } from './app-icon';

/** One app as the host's catalog endpoint lists it. */
export type CboxCatalogApp = {
    key: string;
    name: string;
    launch_url: string;
    /** Cbox ID's uploaded icon for light surfaces. */
    icon_url?: string | null;
    /** Cbox ID's uploaded icon for dark surfaces. */
    icon_dark_url?: string | null;
    description?: string | null;
};

export type CboxAppCatalogState =
    | { status: 'idle' | 'loading' }
    | { status: 'ready'; apps: CboxCatalogApp[]; refreshAfter: number }
    | { status: 'authorization_required'; authorizeUrl: string | null }
    | { status: 'unavailable' };

export type CboxAppCatalogProps = {
    /**
     * Same-origin URL the host serves the person's app catalog from (a proxy of Cbox ID's
     * catalog, authorized for the signed-in person). `null` renders the control disabled, so the
     * chrome keeps its shape on pages without an organization.
     */
    endpoint: string | null;
    /** The app key of this app; its tile is marked current and does not navigate. */
    currentAppKey: string;
    className?: string;
};

const DEFAULT_REFRESH_SECONDS = 60;

/**
 * Interpret the catalog endpoint's answer. The contract every Cbox app serves:
 *
 * - `200 { apps: [{ key, name, launch_url, icon_url?, icon_dark_url?, description? }], refresh_after?: seconds }`
 * - `401`/`403 { authorize_url?: string }` or `{ state: 'authorization_required' }`: the
 *   person has to (re)connect their catalog grant; `authorize_url` is where.
 * - anything else: unavailable right now.
 *
 * Only `http(s)` launch URLs are kept: the tiles are links the person will click.
 */
export function parseAppCatalog(ok: boolean, body: unknown): CboxAppCatalogState {
    const data = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    if (!ok) {
        const authorize = typeof data.authorize_url === 'string' ? data.authorize_url : null;
        if (authorize !== null || data.state === 'authorization_required') {
            return { status: 'authorization_required', authorizeUrl: authorize };
        }

        return { status: 'unavailable' };
    }
    if (!Array.isArray(data.apps)) {
        return { status: 'unavailable' };
    }
    const apps: CboxCatalogApp[] = [];
    for (const entry of data.apps as unknown[]) {
        if (typeof entry !== 'object' || entry === null) continue;
        const app = entry as Record<string, unknown>;
        if (typeof app.key !== 'string' || typeof app.name !== 'string' || typeof app.launch_url !== 'string') continue;
        if (!/^https?:\/\//.test(app.launch_url)) continue;
        apps.push({
            key: app.key,
            name: app.name,
            launch_url: app.launch_url,
            icon_url: typeof app.icon_url === 'string' ? app.icon_url : null,
            icon_dark_url: typeof app.icon_dark_url === 'string' ? app.icon_dark_url : null,
            description: typeof app.description === 'string' ? app.description : null,
        });
    }
    const refresh = typeof data.refresh_after === 'number' && Number.isFinite(data.refresh_after) ? data.refresh_after : DEFAULT_REFRESH_SECONDS;

    return { status: 'ready', apps, refreshAfter: Math.max(1, Math.min(DEFAULT_REFRESH_SECONDS, refresh)) };
}

/** The authorize link with `return_to` set to where the person is, when it is on this origin. */
export function authorizeHref(authorizeUrl: string | null, location: { origin: string; pathname: string; search: string }): string | null {
    if (authorizeUrl === null) return null;
    try {
        const url = new URL(authorizeUrl, location.origin);
        if (url.origin !== location.origin) return null;
        url.searchParams.set('return_to', location.pathname + location.search);

        return url.pathname + url.search;
    } catch {
        return null;
    }
}

/**
 * The Switch-app control: a grid of the Cbox apps this person can open, read live from the
 * host's catalog endpoint. The host owns the endpoint and the grant; this renders the answer,
 * refreshes it when it expires while the panel is open, and offers the way back to Cbox ID
 * when the grant is missing. Each tile shows the app's icon from the catalog (light and dark),
 * and the answer is kept so `CboxServiceMark` paints the app's own mark from it.
 */
export function CboxAppCatalog({ endpoint, currentAppKey, className }: CboxAppCatalogProps) {
    const { t } = useCboxLocalization();
    const [open, setOpen] = useState(false);
    const [state, setState] = useState<CboxAppCatalogState>({ status: 'idle' });
    const container = useRef<HTMLDivElement>(null);
    const flight = useRef<AbortController | null>(null);
    const expires = useRef(0);

    const load = useCallback(async () => {
        if (endpoint === null || flight.current !== null) return;
        const request = new AbortController();
        flight.current = request;
        setState(current => (current.status === 'ready' ? current : { status: 'loading' }));
        try {
            const response = await fetch(endpoint, {
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                signal: request.signal,
            });
            const body: unknown = await response.json().catch(() => null);
            if (request.signal.aborted) return;
            const next = parseAppCatalog(response.ok, body);
            expires.current = next.status === 'ready' ? Date.now() + next.refreshAfter * 1000 : 0;
            setState(next);
            if (next.status === 'ready') rememberAppCatalog(next.apps);
        } catch {
            if (!request.signal.aborted) { expires.current = 0; setState({ status: 'unavailable' }); }
        } finally {
            if (flight.current === request) flight.current = null;
        }
    }, [endpoint]);

    const refresh = useCallback(() => {
        if (document.visibilityState === 'visible' && Date.now() >= expires.current) void load();
    }, [load]);

    useEffect(() => {
        if (!open) return;
        refresh();
        const outside = (event: PointerEvent) => { if (container.current !== null && !container.current.contains(event.target as Node)) setOpen(false); };
        const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
        window.addEventListener('pointerdown', outside);
        window.addEventListener('keydown', key);
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            window.removeEventListener('pointerdown', outside);
            window.removeEventListener('keydown', key);
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [open, refresh]);

    useEffect(() => {
        if (!open || state.status !== 'ready') return;
        const timer = window.setTimeout(refresh, Math.max(50, expires.current - Date.now()));
        return () => window.clearTimeout(timer);
    }, [open, state, refresh]);

    useEffect(() => () => flight.current?.abort(), []);
    useEffect(() => { expires.current = 0; setState({ status: 'idle' }); }, [endpoint]);

    const reconnect = state.status === 'authorization_required' && typeof window !== 'undefined' ? authorizeHref(state.authorizeUrl, window.location) : null;

    return (
        <div ref={container} className={cn('relative', className)}>
            <button
                type="button"
                aria-label={t('Switch app')}
                title={t('Switch app')}
                aria-haspopup="dialog"
                aria-expanded={open}
                disabled={endpoint === null}
                onClick={() => setOpen(value => !value)}
                className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent',
                    open && 'bg-secondary text-foreground',
                )}
            >
                <Grid />
            </button>
            {open ? (
                <div role="dialog" aria-label={t('Switch app')} className="absolute right-0 top-full z-50 mt-1.5 w-[min(18.25rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-border bg-popover p-3 shadow-lg">
                    <h2 className="mb-2 text-sm font-semibold text-foreground">{t('Switch app')}</h2>
                    <div aria-live="polite">
                        {(state.status === 'idle' || state.status === 'loading') && <p className="px-1 py-2 text-sm text-muted-foreground">{t('Loading apps…')}</p>}
                        {state.status === 'unavailable' && (
                            <div className="space-y-2 px-1 py-2 text-sm">
                                <p role="alert" className="text-muted-foreground">{t('Apps could not be loaded.')}</p>
                                <button type="button" onClick={() => void load()} className="font-medium text-foreground underline">{t('Try again')}</button>
                            </div>
                        )}
                        {state.status === 'authorization_required' && (
                            <div className="space-y-2 px-1 py-2 text-sm">
                                <p role="alert" className="text-muted-foreground">{t('Apps could not be loaded.')}</p>
                                {reconnect !== null
                                    ? <a href={reconnect} className="font-medium text-foreground underline">{t('Reconnect to Cbox ID')}</a>
                                    : <button type="button" onClick={() => void load()} className="font-medium text-foreground underline">{t('Try again')}</button>}
                            </div>
                        )}
                        {state.status === 'ready' && (state.apps.length === 0
                            ? <p className="px-1 py-2 text-sm text-muted-foreground">{t('No apps available')}</p>
                            : (
                                <nav aria-label={t('Switch app')} className="grid grid-cols-3 gap-1">
                                    {state.apps.map(app => {
                                        const current = app.key === currentAppKey;
                                        return (
                                            <a
                                                key={app.key}
                                                href={app.launch_url}
                                                aria-current={current ? 'true' : undefined}
                                                title={app.description ?? app.name}
                                                onClick={() => setOpen(false)}
                                                className={cn('relative flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-md p-2 text-center text-[13px] font-medium leading-tight text-foreground hover:bg-secondary', current && 'bg-accent-soft')}
                                            >
                                                <CboxAppIcon name={app.name} iconUrl={app.icon_url} iconDarkUrl={app.icon_dark_url} />
                                                <span className="max-w-full break-words">{app.name.replace(/^Cbox\s*·\s*/i, '')}</span>
                                                {current && <Check />}
                                            </a>
                                        );
                                    })}
                                </nav>
                            ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function Grid(): ReactNode {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
            {[3, 9, 15].flatMap(y => [3, 9, 15].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.65" />))}
        </svg>
    );
}

function Check(): ReactNode {
    return (
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="absolute right-2 top-1.5 h-3 w-3 text-accent">
            <path d="m5 12 4 4L19 6" />
        </svg>
    );
}
