import type { ContextItem, ContextLevel, ContextTone, ShellNavigate } from './types';

/**
 * The shell's few network shapes and the pure rules around them: list pages, inline create,
 * the switch payload and settings links. Everything here is same-origin and JSON.
 */

export type ListPage = { items: ContextItem[]; hasMore: boolean; nextCursor: string | null };

const TONES: readonly ContextTone[] = ['production', 'sandbox', 'neutral'];

/** First letters of the first two words, for a chip. */
export function initialsOf(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const letters = words.length > 1 ? (words[0]![0] ?? '') + (words[1]![0] ?? '') : name.trim().slice(0, 2);
    return letters.toUpperCase() || '?';
}

function toItem(value: unknown): ContextItem | null {
    if (typeof value !== 'object' || value === null) return null;
    const row = value as Record<string, unknown>;
    const id = typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id) : null;
    if (id === null || typeof row.name !== 'string') return null;
    const item: ContextItem = { id, name: row.name };
    if (typeof row.initials === 'string' && row.initials !== '') item.initials = row.initials;
    if (typeof row.tone === 'string' && (TONES as readonly string[]).includes(row.tone)) item.tone = row.tone as ContextTone;
    if (typeof row.label === 'string' && row.label !== '') item.label = row.label;
    const test = row.testData ?? row.test_data;
    if (typeof test === 'boolean') item.testData = test;
    return item;
}

/**
 * A list answer. The URL standard's envelope (`{ object: 'list', data, has_more, next_cursor }`)
 * and a bare array are both accepted; rows without an id and a name are dropped.
 */
export function parseListPage(body: unknown): ListPage {
    const envelope = Array.isArray(body) ? { data: body } : typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const rows = Array.isArray(envelope.data) ? envelope.data : [];
    const items = rows.map(toItem).filter((item): item is ContextItem => item !== null);
    const cursor = envelope.next_cursor ?? envelope.nextCursor;
    const nextCursor = typeof cursor === 'string' && cursor !== '' ? cursor : null;
    const more = envelope.has_more ?? envelope.hasMore;
    return { items, hasMore: (more === true || more === undefined) && nextCursor !== null, nextCursor };
}

/**
 * A server-supplied link the shell may follow: http(s) or a same-origin path. Anything else
 * (`javascript:`, `data:`) is dropped, so a bad answer from a proxy can never run script.
 */
export function safeUrl(url: unknown): string | undefined {
    return typeof url === 'string' && /^(https?:\/\/|\/)/i.test(url.trim()) ? url.trim() : undefined;
}

/** `url` with query parameters added; empty values are left out. Works for relative URLs. */
export function withQuery(url: string, params: Record<string, string | undefined | null>): string {
    const [path, hash = ''] = url.split('#') as [string, string?];
    const [base, query = ''] = path.split('?') as [string, string?];
    const search = new URLSearchParams(query);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') search.set(key, value);
    }
    const qs = search.toString();
    return base + (qs ? `?${qs}` : '') + (hash ? `#${hash}` : '');
}

/** The settings link of one item, from the level's URL template. Null when the level has none. */
export function settingsHref(level: Pick<ContextLevel, 'settingsUrl'>, id: string): string | null {
    if (level.settingsUrl === undefined || level.settingsUrl === '') return null;
    return level.settingsUrl.split('{id}').join(encodeURIComponent(id));
}

export function pluralOf(level: Pick<ContextLevel, 'label' | 'labelPlural'>): string {
    return level.labelPlural ?? `${level.label}s`;
}

/**
 * Which environment a project click lands on (§5.4): the one with the current environment's
 * name when the project has it, else its first. Undefined when the project has none.
 */
export function environmentFor(environments: readonly ContextItem[], currentName: string | undefined): ContextItem | undefined {
    if (currentName !== undefined) {
        const wanted = currentName.trim().toLowerCase();
        const same = environments.find(env => env.name.trim().toLowerCase() === wanted);
        if (same !== undefined) return same;
    }
    return environments[0];
}

/**
 * The switch payload (§5.6): every level above the chosen one keeps its current id, the chosen
 * levels get theirs, and levels below are left to the server (it lands on the last used one).
 * `return_to` is where the person is, so the server can stay on the same page.
 */
export function switchPayload(levels: readonly ContextLevel[], chosen: Record<string, string>, returnTo: string): Record<string, string> {
    const payload: Record<string, string> = {};
    const deepest = Math.max(-1, ...levels.map((level, index) => (chosen[level.key] !== undefined ? index : -1)));
    levels.forEach((level, index) => {
        const id = chosen[level.key];
        if (id !== undefined) payload[level.key] = id;
        else if (index < deepest) payload[level.key] = level.current.id;
    });
    payload.return_to = returnTo;
    return payload;
}

function cookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.split('; ').find(part => part.startsWith(`${name}=`));
    return match === undefined ? null : decodeURIComponent(match.slice(name.length + 1));
}

function csrfToken(): string | null {
    if (typeof document === 'undefined') return null;
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
}

/** Same-origin JSON with Laravel's CSRF headers. Throws `ShellRequestError` on a non-2xx. */
export async function requestJson<T = unknown>(url: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    const xsrf = cookie('XSRF-TOKEN');
    const csrf = csrfToken();
    if (xsrf !== null) headers['X-XSRF-TOKEN'] = xsrf;
    else if (csrf !== null) headers['X-CSRF-TOKEN'] = csrf;
    const response = await fetch(url, {
        method: init.method ?? 'GET',
        credentials: 'same-origin',
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: init.signal,
    });
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

export class ShellRequestError extends Error {
    constructor(readonly status: number, readonly body: unknown) {
        super(`Request failed with ${status}`);
    }

    /** The first validation message (RFC 9457 `errors`, or Laravel's `errors`/`message`). */
    get detail(): string | null {
        const body = typeof this.body === 'object' && this.body !== null ? (this.body as Record<string, unknown>) : {};
        const errors = body.errors;
        if (typeof errors === 'object' && errors !== null) {
            for (const messages of Object.values(errors as Record<string, unknown>)) {
                if (Array.isArray(messages) && typeof messages[0] === 'string') return messages[0];
                if (typeof messages === 'string') return messages;
            }
        }
        if (typeof body.detail === 'string') return body.detail;
        if (typeof body.message === 'string') return body.message;
        return null;
    }
}

/** Inline create (§5.7): `POST createUrl { name, parent? }` → the details page to land on. */
export async function createItem(createUrl: string, name: string, parent?: string): Promise<{ id: string; detailsUrl: string }> {
    const body: Record<string, string> = { name };
    if (parent !== undefined) body.parent = parent;
    const answer = await requestJson<Record<string, unknown>>(createUrl, { method: 'POST', body });
    const id = answer?.id;
    const detailsUrl = safeUrl(answer?.detailsUrl ?? answer?.details_url);
    if ((typeof id !== 'string' && typeof id !== 'number') || detailsUrl === undefined) {
        throw new ShellRequestError(500, { message: 'The answer had no details page.' });
    }
    return { id: String(id), detailsUrl };
}

/**
 * The default navigation when the host passes none: a GET is a page load, a POST a real form
 * submit with Laravel's `_token`, so the server's redirect is followed like any form.
 */
export const defaultNavigate: ShellNavigate = (url, options = {}) => {
    if (typeof window === 'undefined' || safeUrl(url) === undefined) return;
    if (options.newTab) {
        window.open(url, '_blank', 'noopener');
        return;
    }
    if ((options.method ?? 'get') === 'get') {
        window.location.assign(url);
        return;
    }
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.style.display = 'none';
    const fields: Record<string, unknown> = { ...(options.data ?? {}) };
    const token = csrfToken();
    if (token !== null) fields._token = token;
    for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = String(value);
        form.append(input);
    }
    document.body.append(form);
    form.submit();
};

/** Where the person is: path, query and hash. */
export function currentLocation(): string {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname + window.location.search + window.location.hash;
}
