/**
 * Which theme the host page shows, read the way every Cbox app marks it:
 *
 * - `.dark` or `[data-theme="dark"]` on the root element: dark;
 * - `.light` or `[data-theme="light"]` on the root element: light;
 * - neither: the system's `prefers-color-scheme`, unless the element says `theme="class"`
 *   (a host whose tokens only turn dark under `.dark`, so no marker means light).
 *
 * `theme="light"` or `theme="dark"` on the element pins it.
 */
export type CboxThemeMode = 'auto' | 'class' | 'light' | 'dark';

export function themeMode(value: string | null): CboxThemeMode {
    return value === 'class' || value === 'light' || value === 'dark' ? value : 'auto';
}

export function isDark(mode: CboxThemeMode = 'auto'): boolean {
    if (mode === 'light' || mode === 'dark') return mode === 'dark';
    if (typeof document === 'undefined') return false;
    const root = document.documentElement;
    const marked = root.getAttribute('data-theme');
    if (root.classList.contains('dark') || marked === 'dark') return true;
    if (root.classList.contains('light') || marked === 'light') return false;
    if (mode === 'class') return false;

    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

function notify(): void {
    for (const listener of [...listeners]) listener();
}

/** Call `change` when the root's theme marker or the system scheme changes. One observer serves every element. */
export function subscribeTheme(change: () => void): () => void {
    listeners.add(change);
    if (stop === null && typeof document !== 'undefined') {
        const observer = typeof MutationObserver === 'function' ? new MutationObserver(notify) : null;
        observer?.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
        const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
        media?.addEventListener?.('change', notify);
        stop = () => {
            observer?.disconnect();
            media?.removeEventListener?.('change', notify);
        };
    }

    return () => {
        listeners.delete(change);
        if (listeners.size === 0 && stop !== null) {
            stop();
            stop = null;
        }
    };
}
