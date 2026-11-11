import { useEffect, useLayoutEffect } from 'react';

/**
 * The page behind a sheet, the palette or Help never scrolls while one is open (iOS Safari
 * included), and scrolling inside the sheet never chains to the page.
 *
 * - `overflow: hidden` on <html> and <body> stops the document on desktop browsers and on iOS 16
 *   and later. The scrollbar's width goes to padding, so nothing shifts sideways.
 * - A touch guard on the document cancels every `touchmove` that would scroll something outside
 *   the open layer, or past the edge of a list inside it. That is what stops iOS from handing a
 *   gesture to the page when a list is at its top or bottom, or not scrollable at all.
 * - A scrollable `<main>` (`.cbx-shell-main` or an element marked `scroll-region`) is held too.
 * - The scroll offsets in force when the first lock was taken are put back when the last one goes,
 *   in case iOS moved the page to show a focused field.
 *
 * Locks are counted, so stacked sheets share one lock; the page comes back when the last closes.
 * The layout does not change: no `position: fixed` on the body, so sticky bars stay where they are.
 */

type Saved = {
    x: number;
    y: number;
    html: { overflow: string; scrollBehavior: string };
    body: { overflow: string; paddingRight: string };
    regions: Array<{ element: HTMLElement; overflow: string; top: number }>;
};

let count = 0;
let saved: Saved | null = null;
let startY = 0;
let startX = 0;

/** The layers that may scroll while locked: the open overlays. */
const LAYER = '.cbx-overlay, [data-cbx-scroll-layer]';

function scrollable(element: Element, axis: 'x' | 'y'): boolean {
    const style = getComputedStyle(element);
    const overflow = axis === 'y' ? style.overflowY : style.overflowX;
    if (overflow !== 'auto' && overflow !== 'scroll') return false;
    return axis === 'y' ? element.scrollHeight > element.clientHeight + 1 : element.scrollWidth > element.clientWidth + 1;
}

/**
 * Whether a finger moving by (dx, dy) from `target` would scroll something inside an open layer.
 * Positive `dy` is the finger moving down, which scrolls content towards its top.
 */
export function canScrollWithin(target: EventTarget | null, dx: number, dy: number): boolean {
    if (!(target instanceof Element)) return false;
    const layer = target.closest(LAYER);
    if (layer === null) return false;
    const axis: 'x' | 'y' = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    const delta = axis === 'y' ? dy : dx;
    if (delta === 0) return true;
    // Text fields scroll themselves (a long textarea) and a range input slides.
    if (target.closest('textarea, input[type="range"]') !== null) return true;
    for (let node: Element | null = target; node !== null && node !== layer.parentElement; node = node.parentElement) {
        if (!scrollable(node, axis)) continue;
        const position = axis === 'y' ? node.scrollTop : node.scrollLeft;
        const max = axis === 'y' ? node.scrollHeight - node.clientHeight : node.scrollWidth - node.clientWidth;
        // Finger down: content moves towards its start. Finger up: towards its end.
        if (delta > 0 && position > 0) return true;
        if (delta < 0 && position < max - 1) return true;
        // At its edge: an outer scroller in the layer may still take the gesture.
    }
    return false;
}

function onTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    if (touch === undefined) return;
    startX = touch.clientX;
    startY = touch.clientY;
}

function onTouchMove(event: TouchEvent): void {
    // Two fingers: pinch-zoom stays the person's.
    if (event.touches.length > 1 || !event.cancelable) return;
    const touch = event.touches[0];
    if (touch === undefined) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    startX = touch.clientX;
    startY = touch.clientY;
    if (!canScrollWithin(event.target, dx, dy)) event.preventDefault();
}

function scrollRegions(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('.cbx-shell-main, [scroll-region]')).filter(element => {
        const overflow = getComputedStyle(element).overflowY;
        return overflow === 'auto' || overflow === 'scroll';
    });
}

/** Take a lock; call the function it returns to give it back. Safe to call on the server. */
export function lockScroll(): () => void {
    if (typeof document === 'undefined') return () => undefined;
    count += 1;
    if (count === 1) {
        const html = document.documentElement;
        const body = document.body;
        const gutter = Math.max(0, window.innerWidth - html.clientWidth);
        saved = {
            x: window.scrollX,
            y: window.scrollY,
            html: { overflow: html.style.overflow, scrollBehavior: html.style.scrollBehavior },
            body: { overflow: body.style.overflow, paddingRight: body.style.paddingRight },
            regions: scrollRegions().map(element => ({ element, overflow: element.style.overflow, top: element.scrollTop })),
        };
        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        if (gutter > 0) body.style.paddingRight = `calc(${getComputedStyle(body).paddingRight} + ${gutter}px)`;
        for (const region of saved.regions) region.element.style.overflow = 'hidden';
        html.setAttribute('data-cbx-scroll-locked', '');
        document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
        document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    }
    let released = false;
    return () => {
        if (released) return;
        released = true;
        count -= 1;
        if (count > 0 || saved === null) return;
        const html = document.documentElement;
        const body = document.body;
        const { x, y, regions } = saved;
        html.style.overflow = saved.html.overflow;
        body.style.overflow = saved.body.overflow;
        body.style.paddingRight = saved.body.paddingRight;
        html.removeAttribute('data-cbx-scroll-locked');
        document.removeEventListener('touchstart', onTouchStart, { capture: true });
        document.removeEventListener('touchmove', onTouchMove, { capture: true });
        // Put the page back where it was, at once (the shell's smooth scrolling would animate it).
        html.style.scrollBehavior = 'auto';
        for (const region of regions) {
            region.element.style.overflow = region.overflow;
            region.element.scrollTop = region.top;
        }
        if (window.scrollX !== x || window.scrollY !== y) {
            try {
                window.scrollTo(x, y);
            } catch {
                // happy-dom and old engines
            }
        }
        html.style.scrollBehavior = saved.html.scrollBehavior;
        saved = null;
    };
}

/** How many locks are held (tests). */
export function scrollLockCount(): number {
    return count;
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Hold a scroll lock while `active`. Taken before paint, so the page never moves under a sheet. */
export function useScrollLock(active = true): void {
    useIsoLayoutEffect(() => {
        if (!active) return;
        return lockScroll();
    }, [active]);
}
