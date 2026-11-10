/**
 * Help's state lives outside React (§7.1): open or closed, what it shows, the search, the scroll
 * position and the support updates survive an Inertia visit and even a remount of the shell,
 * like a browser side panel. The conversation itself lives in the `<cbox-support>` element, which
 * survives as long as the shell sits in the host's persistent layout.
 */

export type HelpArticle = { id: string; title: string; excerpt?: string; body?: string; url?: string; source?: string };

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
    /** Whether `open` was taken from the person's saved preference yet. */
    seeded: boolean;
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
    seeded: false,
};

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
        if (typeof row.url === 'string') update.url = row.url;
        return [update];
    });
}

export function parseArticles(body: unknown): HelpArticle[] {
    const rows = Array.isArray(body) ? body : typeof body === 'object' && body !== null && Array.isArray((body as { data?: unknown }).data) ? (body as { data: unknown[] }).data : [];
    return rows.flatMap((value: unknown) => {
        if (typeof value !== 'object' || value === null) return [];
        const row = value as Record<string, unknown>;
        if ((typeof row.id !== 'string' && typeof row.id !== 'number') || typeof row.title !== 'string') return [];
        const article: HelpArticle = { id: String(row.id), title: row.title };
        if (typeof row.excerpt === 'string') article.excerpt = row.excerpt;
        if (typeof row.body === 'string') article.body = row.body;
        if (typeof row.url === 'string' && /^(https?:\/\/|\/)/i.test(row.url)) article.url = row.url;
        if (typeof row.source === 'string') article.source = row.source;
        return [article];
    });
}
