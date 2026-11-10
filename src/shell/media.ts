import { useSyncExternalStore } from 'react';

/** Fine pointer and hover: a desktop. Only there does a search field take focus by itself (§4.5). */
export const DESKTOP_POINTER = '(hover: hover) and (pointer: fine)';
/** Help docks beside the page from here; below it is a full-screen overlay (§4.4). */
export const HELP_DOCKED = '(min-width: 1280px)';
/** The phone layout (§4.5). */
export const MOBILE = '(max-width: 767px)';

function query(media: string): MediaQueryList | null {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
    return window.matchMedia(media);
}

export function matches(media: string): boolean {
    return query(media)?.matches ?? false;
}

/** Whether a search field may focus itself: never on touch. */
export function canAutofocus(): boolean {
    return matches(DESKTOP_POINTER);
}

/** A live media query. `fallback` is what the server and the first client render assume. */
export function useMedia(media: string, fallback = false): boolean {
    return useSyncExternalStore(
        change => {
            const list = query(media);
            if (list === null) return () => undefined;
            list.addEventListener?.('change', change);
            return () => list.removeEventListener?.('change', change);
        },
        () => query(media)?.matches ?? fallback,
        () => fallback,
    );
}
