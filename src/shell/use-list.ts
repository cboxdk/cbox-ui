import { useCallback, useEffect, useRef, useState } from 'react';
import { parseListPage, requestJson, withQuery } from './data';
import type { ContextItem } from './types';

export const DEBOUNCE_MS = 120;
const PAGE_SIZE = 25;

export type ListState = {
    items: ContextItem[];
    status: 'loading' | 'ready' | 'error';
    hasMore: boolean;
    loadingMore: boolean;
    loadMore: () => void;
    retry: () => void;
};

/** The page size, unless the app's list URL already names one. */
function pageSize(url: string): string | undefined {
    return /[?&]limit=/.test(url) ? undefined : String(PAGE_SIZE);
}

/** Answers kept for this page, so hovering back to a project shows its environments at once. */
const kept = new Map<string, { items: ContextItem[]; hasMore: boolean; nextCursor: string | null }>();

/** Forget kept answers (after a create, on a context switch, and between tests). */
export function forgetLists(): void {
    kept.clear();
    keptScope = null;
}

/** The context the kept answers belong to: every level's current id. */
let keptScope: string | null = null;

/**
 * Tie the kept answers to a context. When the person has switched (an Inertia visit keeps this
 * module alive), answers from the previous context are dropped, even when an app's list URL is
 * not scoped by organization in its path. Returns true when something was dropped.
 */
export function scopeLists(scope: string): boolean {
    if (keptScope === scope) return false;
    const changed = keptScope !== null;
    kept.clear();
    keptScope = scope;
    return changed;
}

/**
 * A level's list, loaded lazily (§11.2): only while `enabled`, searched with `?q=` (debounced),
 * scoped with `?parent=`, paged with `?cursor=`. An empty search is kept for the page's lifetime.
 */
export function useContextList(url: string | undefined, { q = '', parent, enabled = true }: { q?: string; parent?: string; enabled?: boolean }): ListState {
    const [query, setQuery] = useState(q);
    const [state, setState] = useState<{ key: string; items: ContextItem[]; status: ListState['status']; hasMore: boolean; nextCursor: string | null; loadingMore: boolean }>({
        key: '',
        items: [],
        status: 'loading',
        hasMore: false,
        nextCursor: null,
        loadingMore: false,
    });
    const [attempt, setAttempt] = useState(0);
    const abort = useRef<AbortController | null>(null);

    useEffect(() => {
        if (q === query) return;
        const timer = setTimeout(() => setQuery(q), DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [q, query]);

    const key = url === undefined ? '' : withQuery(url, { q: query.trim(), parent, limit: pageSize(url) });

    useEffect(() => {
        if (!enabled || url === undefined) return;
        const hit = kept.get(key);
        if (hit !== undefined) {
            setState({ key, items: hit.items, status: 'ready', hasMore: hit.hasMore, nextCursor: hit.nextCursor, loadingMore: false });
            return;
        }
        abort.current?.abort();
        const controller = new AbortController();
        abort.current = controller;
        setState(current => ({ ...current, key, status: 'loading', loadingMore: false }));
        requestJson(key, { signal: controller.signal })
            .then(body => {
                const page = parseListPage(body);
                if (query.trim() === '') kept.set(key, page);
                setState({ key, items: page.items, status: 'ready', hasMore: page.hasMore, nextCursor: page.nextCursor, loadingMore: false });
            })
            .catch((error: unknown) => {
                if ((error as { name?: string })?.name === 'AbortError') return;
                setState(current => ({ ...current, key, status: 'error', loadingMore: false }));
            });
        return () => controller.abort();
    }, [enabled, url, key, query, attempt]);

    const loadMore = useCallback(() => {
        setState(current => {
            if (!current.hasMore || current.loadingMore || current.nextCursor === null || url === undefined) return current;
            const cursor = current.nextCursor;
            requestJson(withQuery(current.key, { cursor }))
                .then(body => {
                    const page = parseListPage(body);
                    setState(now => {
                        if (now.key !== current.key) return now;
                        const items = [...now.items, ...page.items.filter(item => !now.items.some(have => have.id === item.id))];
                        if (query.trim() === '') kept.set(now.key, { items, hasMore: page.hasMore, nextCursor: page.nextCursor });
                        return { ...now, items, hasMore: page.hasMore, nextCursor: page.nextCursor, loadingMore: false };
                    });
                })
                .catch(() => setState(now => ({ ...now, loadingMore: false })));
            return { ...current, loadingMore: true };
        });
    }, [url, query]);

    const retry = useCallback(() => {
        kept.delete(key);
        setAttempt(value => value + 1);
    }, [key]);

    const settled = state.key === key;
    // While a new search loads, the last answer stays (nothing jumps); a new parent starts empty.
    const sameParent = state.key !== '' && new URL(state.key, 'http://x').searchParams.get('parent') === (parent ?? null);
    return {
        items: settled || sameParent ? state.items : [],
        status: settled ? state.status : 'loading',
        hasMore: settled && state.hasMore,
        loadingMore: settled && state.loadingMore,
        loadMore,
        retry,
    };
}

/** Load a list once, outside a component (a project click needs its environments). */
export async function fetchList(url: string, parent?: string): Promise<ContextItem[]> {
    const key = withQuery(url, { parent, limit: pageSize(url) });
    const hit = kept.get(key);
    if (hit !== undefined) return hit.items;
    const page = parseListPage(await requestJson(key));
    kept.set(key, page);
    return page.items;
}
