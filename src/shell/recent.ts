/**
 * The pages last visited in this app, on this device, for the palette's "Recent" when the app
 * sends none (`palette.recent`). Only titles, area names and same-origin paths are kept.
 */

export type RecentPage = { title: string; area?: string; url: string };

const LIMIT = 6;

function storageKey(app: string): string {
    return `cbox_shell_recent_${app}`;
}

export function recentPages(app: string): RecentPage[] {
    try {
        const raw = window.localStorage.getItem(storageKey(app));
        const parsed: unknown = raw === null ? [] : JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter((row): row is RecentPage => typeof row === 'object' && row !== null && typeof (row as RecentPage).title === 'string' && typeof (row as RecentPage).url === 'string' && (row as RecentPage).url.startsWith('/'))
            : [];
    } catch {
        return [];
    }
}

export function rememberPage(app: string, page: RecentPage): void {
    if (typeof window === 'undefined' || !page.url.startsWith('/')) return;
    try {
        const next = [page, ...recentPages(app).filter(row => row.url !== page.url)].slice(0, LIMIT);
        window.localStorage.setItem(storageKey(app), JSON.stringify(next));
    } catch {
        // Private mode or no storage: Recent stays empty.
    }
}
