/**
 * Where Help's articles, search and support updates come from (§7.3).
 *
 * A URL in the `shell.help` prop is the app's own same-origin route and wins. Without one, Help
 * uses Cbox Assistant's API directly: the support session the chat already uses
 * (`shell.help.sessionUrl`, laravel-assistant-client's `SupportSession::forUser()`) names the
 * endpoints and carries a three-minute identity that is sent as a bearer token. The session is
 * fetched in the browser after the page has painted, never during a render, and again when the
 * identity runs out or Assistant answers 401.
 */

import { requestJson, ShellRequestError } from './data';
import type { HelpSession, HelpStore } from './help-store';
import type { Shell, ShellHelp } from './types';

/** The endpoints Help may use, by what they are for. */
export type HelpEndpoint = 'search' | 'articles' | 'article' | 'updates';

const SESSION_FIELD: Record<HelpEndpoint, 'searchUrl' | 'articlesUrl' | 'articleUrl' | 'updatesUrl'> = { search: 'searchUrl', articles: 'articlesUrl', article: 'articleUrl', updates: 'updatesUrl' };

/** Refresh the identity this long before it runs out, so a request never leaves with a dead one. */
const EXPIRY_MARGIN_MS = 15_000;

/** The app's own URL for an endpoint, from the `shell.help` prop. */
function ownUrl(help: ShellHelp, endpoint: HelpEndpoint): string | undefined {
    if (endpoint === 'search') return help.searchUrl;
    if (endpoint === 'articles') return help.articlesUrl;
    if (endpoint === 'updates') return help.updatesUrl;
    return undefined;
}

/**
 * Which session Help needs on this page: the session URL and the organization, so a switch of
 * organization never reuses the other one's identity. Null when Help has no session.
 */
export function helpSessionKey(shell: Shell): string | null {
    const { help } = shell;
    if (!help.enabled || help.sessionUrl === undefined) return null;
    return `${help.sessionUrl}|${shell.context.levels[0]?.current.id ?? ''}`;
}

/** An Assistant URL from the session: https, or http on this machine, as the chat element requires. */
function endpointUrl(value: unknown): string | undefined {
    if (typeof value !== 'string' || value === '') return undefined;
    try {
        const url = new URL(value, typeof window === 'undefined' ? 'https://localhost' : window.location.href);
        const local = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
        return url.protocol === 'https:' || local ? value : undefined;
    } catch {
        return undefined;
    }
}

function parseSession(key: string, body: unknown): HelpSession {
    const row = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const session: HelpSession = { key, status: 'ready' };
    if (typeof row.identity !== 'string' || row.identity === '') return session;
    session.identity = row.identity;
    session.expiresAt = typeof row.expires_at === 'number' ? row.expires_at * 1000 : Date.now() + 120_000;
    const fields = { searchUrl: row.search_url, articlesUrl: row.topics_url, articleUrl: row.article_url, updatesUrl: row.updates_url } as const;
    for (const [field, value] of Object.entries(fields) as Array<[keyof typeof fields, unknown]>) {
        const url = endpointUrl(value);
        if (url !== undefined) session[field] = url;
    }
    return session;
}

const loading = new WeakMap<HelpStore, { key: string; promise: Promise<HelpSession> }>();

function fresh(session: HelpSession | null, key: string): session is HelpSession {
    return session !== null && session.key === key && session.status === 'ready' && (session.expiresAt === undefined || session.expiresAt - EXPIRY_MARGIN_MS > Date.now());
}

/**
 * The support session for `key`, loaded once and shared by everything that asks while it loads.
 * A session that cannot be loaded is an empty one: Help then has only the app's own URLs.
 */
export function loadHelpSession(store: HelpStore, help: ShellHelp, key: string, force = false): Promise<HelpSession> {
    const current = store.get().session;
    if (!force && fresh(current, key)) return Promise.resolve(current);
    const pending = loading.get(store);
    if (pending !== undefined && pending.key === key) return pending.promise;
    // The endpoints known so far stay in place while the identity is renewed, so nothing disappears.
    if (current === null || current.key !== key) store.set({ session: { key, status: 'loading' } });
    const promise = requestJson(help.sessionUrl!)
        .then(body => parseSession(key, body))
        .catch((): HelpSession => ({ key, status: 'ready' }))
        .then(session => {
            if (loading.get(store)?.promise === promise) loading.delete(store);
            // An organization switch while this loaded: the answer belongs to the page that asked.
            const latest = store.get().session;
            if (latest === null || latest.key === key) store.set({ session });
            return session;
        });
    loading.set(store, { key, promise });
    return promise;
}

/**
 * Whether Help has `endpoint` here. `pending` while only the support session can say; the control
 * is shown meanwhile and goes away if the session has no such endpoint.
 */
export function helpEndpointState(help: ShellHelp, session: HelpSession | null, key: string | null, endpoint: HelpEndpoint): 'ready' | 'pending' | 'none' {
    if (!help.enabled) return 'none';
    if (ownUrl(help, endpoint) !== undefined) return 'ready';
    if (key === null) return 'none';
    if (session === null || session.key !== key || session.status === 'loading') return 'pending';
    return session[SESSION_FIELD[endpoint]] !== undefined ? 'ready' : 'none';
}

/** Help has no such endpoint here: neither the app nor the support session names one. */
export class HelpUnavailableError extends Error {
    constructor(endpoint: HelpEndpoint) {
        super(`Help has no ${endpoint} endpoint here`);
    }
}

async function bearerJson<T>(url: string, identity: string, init: { method?: string; signal?: AbortSignal }): Promise<T> {
    // Another origin: no cookies and no CSRF header, only the identity.
    const response = await fetch(url, { method: init.method ?? 'GET', credentials: 'omit', headers: { Accept: 'application/json', Authorization: `Bearer ${identity}` }, signal: init.signal });
    const text = await response.text();
    let body: unknown = null;
    try {
        body = text === '' ? null : JSON.parse(text);
    } catch {
        body = null;
    }
    if (!response.ok) throw new ShellRequestError(response.status, body);
    return body as T;
}

/**
 * Call one of Help's endpoints. `build` turns the endpoint's URL (a template for `articles` and
 * `article`) into the URL to call. Throws {@link HelpUnavailableError} when there is no such
 * endpoint, and {@link ShellRequestError} when it fails.
 */
export async function helpRequest<T = unknown>(store: HelpStore, shell: Shell, endpoint: HelpEndpoint, build: (url: string) => string, init: { method?: string; signal?: AbortSignal } = {}): Promise<T> {
    const { help } = shell;
    const own = help.enabled ? ownUrl(help, endpoint) : undefined;
    if (own !== undefined) return requestJson<T>(build(own), init);
    const key = helpSessionKey(shell);
    if (key === null) throw new HelpUnavailableError(endpoint);
    const call = async (force: boolean): Promise<T> => {
        const session = await loadHelpSession(store, help, key, force);
        const url = session[SESSION_FIELD[endpoint]];
        if (url === undefined || session.identity === undefined) throw new HelpUnavailableError(endpoint);
        return bearerJson<T>(build(url), session.identity, init);
    };
    try {
        return await call(false);
    } catch (error) {
        // The identity ran out on the way: one new one, one more try.
        if (error instanceof ShellRequestError && error.status === 401) return call(true);
        throw error;
    }
}

const BLOCKS: Record<string, string> = { h1: 'h4', h2: 'h4', h3: 'h4', h4: 'h5', h5: 'h6', h6: 'h6' };
const KEPT = new Set(['p', 'br', 'hr', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'code', 'pre', 'blockquote', 'kbd', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img', 'h4', 'h5', 'h6']);
const DROPPED = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'form', 'link', 'meta', 'base', 'head', 'title']);

/**
 * An article body from Assistant (`body_html`), reduced to what the Help column shows. Assistant
 * already renders it from Markdown with raw HTML stripped; this is the page's own guard, so only
 * plain structure, http(s) links and https images ever reach the document. Headings start below
 * the article's title. Returns '' where there is no DOM (a server render).
 */
export function cleanArticleHtml(html: string): string {
    if (typeof DOMParser === 'undefined') return '';
    const source = new DOMParser().parseFromString(html, 'text/html');
    const out = source.implementation.createHTMLDocument('');
    const copy = (from: Node, into: Node): void => {
        for (const node of Array.from(from.childNodes)) {
            if (node.nodeType === 3) {
                into.appendChild(out.createTextNode(node.textContent ?? ''));
                continue;
            }
            if (node.nodeType !== 1) continue;
            const element = node as Element;
            const name = element.tagName.toLowerCase();
            if (DROPPED.has(name)) continue;
            const tag = BLOCKS[name] ?? name;
            if (!KEPT.has(tag)) {
                copy(element, into);
                continue;
            }
            const made = out.createElement(tag);
            if (tag === 'a') {
                const href = element.getAttribute('href')?.trim() ?? '';
                if (!/^(https?:\/\/|\/(?!\/)|#)/i.test(href)) {
                    copy(element, into);
                    continue;
                }
                made.setAttribute('href', href);
                if (/^https?:/i.test(href)) {
                    made.setAttribute('target', '_blank');
                    made.setAttribute('rel', 'noopener noreferrer');
                }
            }
            if (tag === 'img') {
                const src = element.getAttribute('src')?.trim() ?? '';
                if (!/^https:\/\//i.test(src)) continue;
                made.setAttribute('src', src);
                made.setAttribute('alt', element.getAttribute('alt') ?? '');
                made.setAttribute('loading', 'lazy');
                made.setAttribute('referrerpolicy', 'no-referrer');
            }
            if ((tag === 'td' || tag === 'th') && /^[1-9]\d?$/.test(element.getAttribute('colspan') ?? '')) made.setAttribute('colspan', element.getAttribute('colspan')!);
            copy(element, made);
            into.appendChild(made);
        }
    };
    copy(source.body, out.body);
    return out.body.innerHTML;
}
