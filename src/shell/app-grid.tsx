import { ArrowUpRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { initials, parseAppCatalog, rememberAppCatalog, secureIconUrl, signInTarget } from '../app-switcher/catalog';
import { useShell } from './context';

/** One app in the grid (§9). */
export type ShellApp = {
    key: string;
    name: string;
    /** One line: "Identity and sign-in". */
    purpose: string | null;
    /** Fixed per-app hue (0–360); the tile is drawn in it, in light and dark. */
    hue: number;
    iconUrl: string | null;
    iconDarkUrl: string | null;
    /** Where the tile goes: the app, or its admission page when the organization lacks it. */
    url: string;
    /** The organization has this app. False: "More from Cbox", dimmed. */
    inOrganization: boolean;
};

/** Each app's fixed hue when the catalog sends none. */
export const APP_HUES: Readonly<Record<string, number>> = {
    id: 258,
    billing: 145,
    engage: 25,
    telemetry: 300,
    work: 70,
    brain: 330,
    infra: 200,
    status: 160,
    assistant: 280,
    sites: 110,
    tax: 45,
    signals: 0,
    stache: 230,
    domains: 185,
};

/** A stable hue for an unknown key, so its tile keeps its colour between pages. */
export function hueFor(key: string, given?: unknown): number {
    if (typeof given === 'number' && Number.isFinite(given)) return ((given % 360) + 360) % 360;
    const known = APP_HUES[key];
    if (known !== undefined) return known;
    let hash = 0;
    for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) % 360;
    return hash;
}

export type ShellCatalogState =
    | { status: 'loading' }
    | { status: 'ready'; apps: ShellApp[] }
    | { status: 'signin_required'; href: string | null }
    | { status: 'unavailable' };

/**
 * The catalog answer, with the shell's additions (§9.3): `in_organization` (default true),
 * `admission_url` for apps the organization does not have, `purpose` (falls back to
 * `description`) and `hue`. Only http(s) links are kept.
 */
export function parseShellCatalog(ok: boolean, body: unknown, here?: { origin: string; pathname: string; search: string }): ShellCatalogState {
    const base = parseAppCatalog(ok, body);
    if (base.status === 'signin_required') return { status: 'signin_required', href: here === undefined ? null : signInTarget(base, here) };
    if (!ok || typeof body !== 'object' || body === null || !Array.isArray((body as { apps?: unknown }).apps)) return { status: 'unavailable' };
    const apps: ShellApp[] = [];
    for (const entry of (body as { apps: unknown[] }).apps) {
        if (typeof entry !== 'object' || entry === null) continue;
        const app = entry as Record<string, unknown>;
        if (typeof app.key !== 'string' || typeof app.name !== 'string') continue;
        const inOrganization = app.in_organization !== false;
        const launch = typeof app.launch_url === 'string' && /^https?:\/\//i.test(app.launch_url) ? app.launch_url : null;
        const admission = typeof app.admission_url === 'string' && /^https?:\/\//i.test(app.admission_url) ? app.admission_url : null;
        const url = inOrganization ? launch : admission ?? launch;
        if (url === null) continue;
        const purpose = typeof app.purpose === 'string' ? app.purpose : typeof app.description === 'string' ? app.description : null;
        apps.push({
            key: app.key,
            name: app.name,
            purpose,
            hue: hueFor(app.key, app.hue),
            iconUrl: secureIconUrl(app.icon_url),
            iconDarkUrl: secureIconUrl(app.icon_dark_url),
            url,
            inOrganization,
        });
    }
    return { status: 'ready', apps };
}

let kept: { url: string; state: ShellCatalogState; until: number } | null = null;

/** The catalog, loaded when the grid first opens and kept for its `refresh_after`. */
export function useShellCatalog(url: string, enabled: boolean): [ShellCatalogState, () => void] {
    const [state, setState] = useState<ShellCatalogState>(() => (kept !== null && kept.url === url ? kept.state : { status: 'loading' }));
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!enabled) return;
        if (kept !== null && kept.url === url && kept.until > Date.now() && attempt === 0) {
            setState(kept.state);
            return;
        }
        const controller = new AbortController();
        if (kept === null || kept.url !== url) setState({ status: 'loading' });
        fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: controller.signal })
            .then(async response => {
                let body: unknown = null;
                try {
                    body = await response.json();
                } catch {
                    body = null;
                }
                const next = parseShellCatalog(response.ok, body, window.location);
                const refresh = typeof (body as { refresh_after?: unknown })?.refresh_after === 'number' ? Math.min(60, Math.max(1, (body as { refresh_after: number }).refresh_after)) : 60;
                if (next.status === 'ready') {
                    kept = { url, state: next, until: Date.now() + refresh * 1000 };
                    rememberAppCatalog(next.apps.map(app => ({ key: app.key, name: app.name, launch_url: app.url, icon_url: app.iconUrl, icon_dark_url: app.iconDarkUrl })));
                }
                setState(next);
            })
            .catch((error: unknown) => {
                if ((error as { name?: string })?.name !== 'AbortError') setState({ status: 'unavailable' });
            });
        return () => controller.abort();
    }, [url, enabled, attempt]);
    return [state, useCallback(() => setAttempt(value => value + 1), [])];
}

export function AppTile({ app, current }: { app: ShellApp; current: boolean }) {
    const [failed, setFailed] = useState(false);
    const style = { '--cbx-hue': String(app.hue) } as Record<string, string>;
    return (
        <a
            href={app.url}
            className={`cbx-app ${current ? 'is-current' : ''} ${app.inOrganization ? '' : 'is-elsewhere'}`}
            aria-current={current ? 'page' : undefined}
            data-app={app.key}
        >
            <span className="cbx-app-tile" style={style} aria-hidden="true">
                {app.iconUrl !== null && !failed ? (
                    <>
                        <img src={app.iconUrl} alt="" className={app.iconDarkUrl !== null ? 'cbx-app-icon-light' : ''} onError={() => setFailed(true)} />
                        {app.iconDarkUrl !== null && <img src={app.iconDarkUrl} alt="" className="cbx-app-icon-dark" onError={() => setFailed(true)} />}
                    </>
                ) : (
                    initials(app.name.replace(/^Cbox\s*·?\s*/i, ''))
                )}
            </span>
            <span className="cbx-app-name cbx-truncate" title={app.name}>{app.name.replace(/^Cbox\s*·\s*/i, '')}</span>
            {app.purpose !== null && <span className="cbx-app-purpose cbx-truncate" title={app.purpose}>{app.purpose}</span>}
        </a>
    );
}

/**
 * Arrow keys across the 3-column grid; Home and End jump. "All products" is the last stop: ↓
 * from the bottom row and End reach it, ↑ from it goes back to the last tile.
 */
function gridKeys(event: KeyboardEvent<HTMLElement>, container: HTMLElement | null): void {
    if (container === null) return;
    const tiles = Array.from(container.querySelectorAll<HTMLElement>('.cbx-app'));
    const all = container.querySelector<HTMLElement>('.cbx-apps-all');
    const stops = all === null ? tiles : [...tiles, all];
    const index = stops.indexOf(document.activeElement as HTMLElement);
    if (index < 0 || stops.length === 0) return;
    const onAll = all !== null && index === tiles.length;
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
    let next = index;
    if (onAll) {
        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = tiles.length - 1;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End' || event.key === 'ArrowDown' || event.key === 'ArrowRight') next = index;
        else return;
    } else if (event.key === 'ArrowDown' && index + 3 > tiles.length - 1 && all !== null) next = tiles.length;
    else if (event.key === 'ArrowRight' && index === tiles.length - 1 && all !== null) next = tiles.length;
    else if (event.key in moves) next = Math.max(0, Math.min(tiles.length - 1, index + moves[event.key]!));
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = stops.length - 1;
    else return;
    event.preventDefault();
    stops[Math.max(0, next)]?.focus();
}

/**
 * The app grid (§9): "In {organization}" with the current app marked, "More from Cbox" dimmed
 * (each opens that app's admission page in the same organization), and "All products ↗".
 */
export function AppGrid({ autoFocus = true }: { autoFocus?: boolean }) {
    const { shell, t } = useShell();
    const [state, retry] = useShellCatalog(shell.apps.catalogUrl, true);
    const box = useRef<HTMLDivElement>(null);
    const organization = shell.context.levels[0]?.current.name;

    useEffect(() => {
        if (!autoFocus || state.status !== 'ready') return;
        const tiles = box.current?.querySelectorAll<HTMLElement>('.cbx-app');
        const current = box.current?.querySelector<HTMLElement>('.cbx-app.is-current');
        (current ?? tiles?.[0])?.focus();
    }, [state.status, autoFocus]);

    const mine = state.status === 'ready' ? state.apps.filter(app => app.inOrganization) : [];
    const more = state.status === 'ready' ? state.apps.filter(app => !app.inOrganization) : [];

    return (
        <div className="cbx-menu cbx-menu-apps" ref={box} onKeyDown={event => gridKeys(event, box.current)}>
            {state.status === 'loading' && <p className="cbx-list-note" aria-live="polite">{t('Loading apps…')}</p>}
            {state.status === 'unavailable' && (
                <p className="cbx-list-note" role="alert">
                    {t('Apps could not be loaded.')} <button type="button" className="cbx-link" onClick={retry}>{t('Try again')}</button>
                </p>
            )}
            {state.status === 'signin_required' && (
                <p className="cbx-list-note" role="alert">
                    {t('Sign in again to see your apps.')} {state.href !== null && <a className="cbx-link" href={state.href}>{t('Sign in')}</a>}
                </p>
            )}
            {state.status === 'ready' && (
                <>
                    <section aria-label={organization !== undefined ? t('In {organization}', { organization }) : t('Your apps')}>
                        <h3 className="cbx-pane-heading">{organization !== undefined ? t('In {organization}', { organization }) : t('Your apps')}</h3>
                        <div className="cbx-apps">
                            {mine.map(app => <AppTile key={app.key} app={app} current={app.key === shell.app.key} />)}
                        </div>
                        {mine.length === 0 && <p className="cbx-list-note">{t('No apps available')}</p>}
                    </section>
                    {more.length > 0 && (
                        <section aria-label={t('More from Cbox')}>
                            <h3 className="cbx-pane-heading">{t('More from Cbox')}</h3>
                            <div className="cbx-apps">
                                {more.map(app => <AppTile key={app.key} app={app} current={false} />)}
                            </div>
                        </section>
                    )}
                </>
            )}
            <div className="cbx-pane-foot">
                <a className="cbx-row cbx-row-action cbx-apps-all" href={shell.apps.productsUrl ?? 'https://cbox.dk'} target="_blank" rel="noopener">
                    <span className="cbx-row-name">{t('All products')}</span>
                    <ArrowUpRight className="cbx-row-trail" size={14} strokeWidth={1.8} aria-hidden />
                </a>
            </div>
        </div>
    );
}

/** Forget the kept catalog (tests, sign-out). */
export function forgetShellCatalog(): void {
    kept = null;
}
