/**
 * The app catalog contract every Cbox app serves, and the copy of it this browser keeps.
 * Framework-free: the `<cbox-app-switcher>` element and the React components both read it.
 *
 * Every app's icon comes from Cbox ID's catalog: one light and one dark upload per app
 * (`icon_url`, `icon_dark_url`). No app keeps a local copy of the marks.
 */

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
    /**
     * The person has to sign in again. `signinUrl` is the new contract (the host's `401
     * { signin_url }`), `authorizeUrl` the legacy one (`{ authorize_url }`).
     */
    | { status: 'signin_required'; signinUrl: string | null; authorizeUrl: string | null }
    | { status: 'unavailable' };

/** One app as this browser keeps it between pages. */
export type CboxKnownApp = { key: string; name: string; icon_url: string | null; icon_dark_url: string | null; launch_url?: string };

export const DEFAULT_REFRESH_SECONDS = 60;
export const KEPT_CATALOG_KEY = 'cbox-app-catalog';
export const CATALOG_EVENT = 'cbox-app-catalog';

/**
 * Interpret the catalog endpoint's answer:
 *
 * - `200 { apps: [{ key, name, launch_url, icon_url?, icon_dark_url?, description? }], refresh_after?: seconds }`
 * - `401`/`403 { signin_url }`: the person signs in again there. The legacy `{ authorize_url }`
 *   and `{ state: 'authorization_required' }` mean the same.
 * - anything else: unavailable right now.
 *
 * Only `http(s)` launch URLs are kept: the tiles are links the person will click.
 */
export function parseAppCatalog(ok: boolean, body: unknown): CboxAppCatalogState {
    const data = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    if (!ok) {
        const signin = typeof data.signin_url === 'string' && data.signin_url !== '' ? data.signin_url : null;
        const authorize = typeof data.authorize_url === 'string' && data.authorize_url !== '' ? data.authorize_url : null;
        if (signin !== null || authorize !== null || data.state === 'authorization_required') {
            return { status: 'signin_required', signinUrl: signin, authorizeUrl: authorize };
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
        if (!/^https?:\/\//i.test(app.launch_url)) continue;
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

type Here = { origin: string; pathname: string; search: string };

/** The legacy authorize link with `return_to` set to where the person is, on this origin only. */
export function authorizeHref(authorizeUrl: string | null, location: Here): string | null {
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
 * Where to send the person when the catalog says they must sign in again: the host's
 * `signin_url` when it is on this origin (the app's own sign-in; never another site), else the legacy authorize
 * link with `return_to`. `null` when neither is usable.
 */
export function signInTarget(state: { signinUrl: string | null; authorizeUrl: string | null }, location: Here): string | null {
    if (state.signinUrl !== null) {
        try {
            const url = new URL(state.signinUrl, location.origin);
            if (url.origin === location.origin) return url.href;
        } catch {
            // Fall through to the legacy link.
        }
    }
    const legacy = authorizeHref(state.authorizeUrl, location);

    return legacy === null ? null : new URL(legacy, location.origin).href;
}

/** Only `https:` icon URLs are rendered: the icons are hosted by Cbox ID. */
export function secureIconUrl(url: unknown): string | null {
    if (typeof url !== 'string' || url === '') return null;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' ? parsed.href : null;
    } catch {
        return null;
    }
}

/** The app's name without the `Cbox · ` prefix, as the tiles show it. */
export function displayName(name: string): string {
    return name.replace(/^Cbox\s*·\s*/i, '');
}

/** The two letters that stand in for an app without an icon. */
export function initials(name: string): string {
    return displayName(name).slice(0, 2);
}

const EMPTY: CboxKnownApp[] = [];
let cache: { raw: string | null; apps: CboxKnownApp[] } = { raw: null, apps: EMPTY };

function storage(): Storage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
}

/** The last catalog this browser kept (`localStorage` key `cbox-app-catalog`); empty without one. */
export function readKnownAppCatalog(): CboxKnownApp[] {
    let raw: string | null = null;
    try {
        raw = storage()?.getItem(KEPT_CATALOG_KEY) ?? null;
    } catch {
        raw = null;
    }
    if (raw === cache.raw) return cache.apps;
    let apps: CboxKnownApp[] = EMPTY;
    try {
        const value: unknown = raw === null ? [] : JSON.parse(raw);
        if (Array.isArray(value)) {
            apps = value.flatMap((entry: unknown) => {
                if (typeof entry !== 'object' || entry === null) return [];
                const app = entry as Record<string, unknown>;
                if (typeof app.key !== 'string' || typeof app.name !== 'string') return [];
                const known: CboxKnownApp = { key: app.key, name: app.name, icon_url: secureIconUrl(app.icon_url), icon_dark_url: secureIconUrl(app.icon_dark_url) };
                if (typeof app.launch_url === 'string' && /^https?:\/\//i.test(app.launch_url)) known.launch_url = app.launch_url;
                return [known];
            });
        }
    } catch {
        apps = EMPTY;
    }
    cache = { raw, apps };

    return apps;
}

/** Keep the catalog the person just loaded, and tell every mark on this page to repaint. */
export function rememberAppCatalog(apps: ReadonlyArray<{ key: string; name: string; launch_url?: string | null; icon_url?: string | null; icon_dark_url?: string | null }>): void {
    const kept = apps.map(({ key, name, launch_url, icon_url, icon_dark_url }) => {
        const app: CboxKnownApp = { key, name, icon_url: icon_url ?? null, icon_dark_url: icon_dark_url ?? null };
        if (typeof launch_url === 'string' && launch_url !== '') app.launch_url = launch_url;
        return app;
    });
    try {
        storage()?.setItem(KEPT_CATALOG_KEY, JSON.stringify(kept));
    } catch {
        // A private window or blocked storage: the marks wait for the next live answer.
    }
    if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent(CATALOG_EVENT));
}

/** Call `change` whenever the kept catalog changes, on this page or in another tab. */
export function subscribeKnownAppCatalog(change: () => void): () => void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;
    const storageChange = (event: StorageEvent) => { if (event.key === KEPT_CATALOG_KEY) change(); };
    document.addEventListener(CATALOG_EVENT, change);
    window.addEventListener('storage', storageChange);
    return () => {
        document.removeEventListener(CATALOG_EVENT, change);
        window.removeEventListener('storage', storageChange);
    };
}
