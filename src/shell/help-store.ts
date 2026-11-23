/**
 * Help's state lives outside React (§7.1): open or closed, what it shows, the search, the scroll
 * position and the support updates survive an Inertia visit and even a remount of the shell,
 * like a browser side panel. The conversation itself lives in the `<cbox-support>` element, which
 * survives as long as the shell sits in the host's persistent layout.
 */

import { safeUrl } from './data';

export type HelpArticle = {
    id: string;
    title: string;
    excerpt?: string;
    body?: string;
    /** The body as HTML from Assistant's article endpoint. Shown only after `cleanArticleHtml`. */
    bodyHtml?: string;
    url?: string;
    source?: string;
};

/**
 * The support session Help reads Assistant's API with, when the app has no URL of its own for an
 * endpoint (see `help-api.ts`). `key` is the session URL and organization it belongs to.
 */
export type HelpSession = {
    key: string;
    status: 'loading' | 'ready';
    /** The short-lived bearer token. Absent when the session could not be loaded. */
    identity?: string;
    /** When `identity` runs out, in milliseconds. */
    expiresAt?: number;
    searchUrl?: string;
    /** Articles for a topic, as a template: `{topic}` is replaced. */
    articlesUrl?: string;
    /** One article with its body, as a template: `{id}` is replaced. */
    articleUrl?: string;
    updatesUrl?: string;
};

export type SupportUpdate = { id: string; kind: 'ticket' | 'chat'; title: string; excerpt?: string; at?: string; unread: boolean; url?: string };

export type HelpStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export type HelpState = {
    open: boolean;
    /** The article shown instead of the home view, or null. */
    article: HelpArticle | null;
    query: string;
    scrollTop: number;
    updates: SupportUpdate[];
    updatesStatus: HelpStatus;
    /** A question waiting for the chat to be ready ("Ask Cbox: …" from the palette). */
    pendingQuestion: string | null;
    /** The chat fills the column instead of the home view (an SDK that renders it inline). */
    chat: boolean;
    /** The support session, once Help has asked for it. */
    session: HelpSession | null;
    /** Whether `open` was taken from the person's saved preference yet. */
    seeded: boolean;
    /**
     * `open` came from the saved preference, not from the person on this page. Help left open
     * shows docked from 1280px; below that it waits until the person opens it, so a phone or a
     * narrow window never lands under the full-screen overlay.
     */
    restored: boolean;
    /** Which list the support updates came from (URL and organization), so a switch reloads them. */
    updatesKey: string | null;
};

export type HelpStore = {
    get(): HelpState;
    set(patch: Partial<HelpState> | ((state: HelpState) => Partial<HelpState>)): void;
    subscribe(listener: () => void): () => void;
};

export const INITIAL_HELP_STATE: HelpState = {
    open: false,
    article: null,
    query: '',
    scrollTop: 0,
    updates: [],
    updatesStatus: 'idle',
    pendingQuestion: null,
    chat: false,
    session: null,
    seeded: false,
    restored: false,
    updatesKey: null,
};

/** Whether Help is on screen: open, and either docked or opened by the person on this page. */
export function helpVisible(state: Pick<HelpState, 'open' | 'restored'>, docked: boolean): boolean {
    return state.open && (docked || !state.restored);
}

export function createHelpStore(initial: Partial<HelpState> = {}): HelpStore {
    let state: HelpState = { ...INITIAL_HELP_STATE, ...initial };
    const listeners = new Set<() => void>();
    return {
        get: () => state,
        set(patch) {
            const next = typeof patch === 'function' ? patch(state) : patch;
            state = { ...state, ...next };
            listeners.forEach(listener => listener());
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

let browserStore: HelpStore | null = null;

/**
 * The page's one store. On the server every render gets a fresh one, so two people's requests
 * never share Help state.
 */
export function sharedHelpStore(): HelpStore {
    if (typeof window === 'undefined') return createHelpStore();
    browserStore ??= createHelpStore();
    return browserStore;
}

export function parseUpdates(body: unknown): SupportUpdate[] {
    const rows = Array.isArray(body) ? body : typeof body === 'object' && body !== null && Array.isArray((body as { data?: unknown }).data) ? (body as { data: unknown[] }).data : [];
    return rows.flatMap((value: unknown) => {
        if (typeof value !== 'object' || value === null) return [];
        const row = value as Record<string, unknown>;
        if ((typeof row.id !== 'string' && typeof row.id !== 'number') || typeof row.title !== 'string') return [];
        const update: SupportUpdate = {
            id: String(row.id),
            kind: row.kind === 'chat' ? 'chat' : 'ticket',
            title: row.title,
            unread: row.unread === true || row.read === false || (row.read_at === null && row.unread !== false),
        };
        if (typeof row.excerpt === 'string') update.excerpt = row.excerpt;
        const at = row.at ?? row.updated_at ?? row.created_at;
        if (typeof at === 'string') update.at = at;
        const url = safeUrl(row.url);
        if (url !== undefined) update.url = url;
        return [update];
    });
}

/** One article row, in the shell's shape or Assistant's `help_article`. */
function parseArticle(value: unknown, source?: string): HelpArticle | null {
    if (typeof value !== 'object' || value === null) return null;
    const row = value as Record<string, unknown>;
    if ((typeof row.id !== 'string' && typeof row.id !== 'number') || typeof row.title !== 'string') return null;
    const article: HelpArticle = { id: String(row.id), title: row.title };
    if (typeof row.excerpt === 'string') article.excerpt = row.excerpt;
    if (typeof row.body === 'string') article.body = row.body;
    if (typeof row.body_html === 'string') article.bodyHtml = row.body_html;
    const url = safeUrl(row.url);
    if (url !== undefined) article.url = url;
    if (typeof row.source === 'string') article.source = row.source;
    else if (source !== undefined) article.source = source;
    return article;
}

/**
 * Articles from a list (`[…]` or `{ data: […] }`), or from Assistant's search, which answers
 * `{ groups: [{ source, data: […] }] }`: docs, help centre and knowledge base, in that order.
 */
export function parseArticles(body: unknown): HelpArticle[] {
    const answer = typeof body === 'object' && body !== null ? (body as { data?: unknown; groups?: unknown }) : {};
    if (!Array.isArray(body) && !Array.isArray(answer.data) && Array.isArray(answer.groups)) {
        return answer.groups.flatMap((group: unknown) => {
            const rows = typeof group === 'object' && group !== null ? (group as { data?: unknown; source?: unknown }) : {};
            const source = typeof rows.source === 'string' ? rows.source : undefined;
            return (Array.isArray(rows.data) ? rows.data : []).flatMap((row: unknown) => parseArticle(row, source) ?? []);
        });
    }
    const rows = Array.isArray(body) ? body : Array.isArray(answer.data) ? answer.data : [];
    return rows.flatMap((row: unknown) => parseArticle(row) ?? []);
}

/** One article with its body, as Assistant's article endpoint answers it (bare or under `data`). */
export function parseArticleBody(body: unknown): HelpArticle | null {
    const answer = typeof body === 'object' && body !== null ? (body as { data?: unknown }) : null;
    return parseArticle(answer !== null && typeof answer.data === 'object' && answer.data !== null && !Array.isArray(answer.data) ? answer.data : body);
}
