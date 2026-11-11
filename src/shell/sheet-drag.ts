import { useEffect, useRef, type MouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

/**
 * Dragging a bottom sheet, like an iOS sheet: the grab handle and the header always drag; the
 * content drags the sheet only when it is scrolled to its top (finger down) or when the sheet can
 * still grow (finger up). Release settles on the nearest detent, or closes the sheet when it was
 * pulled far enough down or flicked down. Pointer events and inline height/transform, no library.
 */

/** How a sheet opens: `fit` its content (up to about half the screen), `tall` or `full`. */
export type SheetSize = 'fit' | 'tall' | 'full';

/** The largest a sheet grows, as a share of the visible viewport. */
export const LARGE = 0.92;
/** The medium detent of a tall sheet, as a share of the visible viewport. */
export const MEDIUM = 0.5;

/**
 * The heights (px, ascending) a sheet rests at. `current` is the height it opened at; `content`
 * the height it would need to show everything without scrolling.
 * - `fit`: where it opened, and when the content is taller, up to the large detent.
 * - `tall`/`full`: half the screen, and where it opened.
 */
export function sheetDetents({ size, viewport, current, content }: { size: SheetSize; viewport: number; current: number; content: number }): number[] {
    const large = Math.round(viewport * LARGE);
    const heights = size === 'fit' ? [current, Math.min(Math.max(content, current), Math.max(large, current))] : [Math.round(viewport * MEDIUM), current];
    const sorted = heights.map(Math.round).sort((a, b) => a - b);
    // Detents closer than 48px are one detent; where the sheet opened wins.
    const detents: number[] = [];
    for (const height of sorted) {
        const last = detents[detents.length - 1];
        if (last === undefined || height - last >= 48) detents.push(height);
        else if (height === Math.round(current)) detents[detents.length - 1] = height;
    }
    return detents;
}

/** Past the largest detent the sheet follows the finger less and less, like iOS. */
export function rubberBand(overshoot: number, limit = 120): number {
    if (overshoot <= 0) return 0;
    return limit * (1 - 1 / (overshoot / limit + 1));
}

/**
 * Where a released sheet goes. `height` is how tall it is when let go, `velocity` the finger's
 * speed in px/ms (positive is downward). Closes when it is below the smallest detent by more than
 * a third of it (at most 160px), or when it is flicked down below it; otherwise the detent nearest
 * to where the flick would carry it.
 */
export function settleSheet({ height, velocity, detents }: { height: number; velocity: number; detents: readonly number[] }): { close: true } | { close: false; height: number } {
    const smallest = detents[0] ?? height;
    const below = smallest - height;
    if (below > Math.min(160, smallest * 0.35) || (below > 12 && velocity > 0.5)) return { close: true };
    const projected = height - velocity * 200;
    let best = smallest;
    for (const detent of detents) if (Math.abs(detent - projected) < Math.abs(best - projected)) best = detent;
    return { close: false, height: best };
}

/** Finger speed over the last 100ms, px/ms, positive downward. */
export class VelocityTracker {
    private samples: Array<{ t: number; y: number }> = [];

    add(t: number, y: number): void {
        this.samples.push({ t, y });
        while (this.samples.length > 2 && t - this.samples[0]!.t > 100) this.samples.shift();
    }

    velocity(): number {
        const first = this.samples[0];
        const last = this.samples[this.samples.length - 1];
        if (first === undefined || last === undefined || last.t === first.t) return 0;
        return (last.y - first.y) / (last.t - first.t);
    }
}

/**
 * Whether a gesture that started on `zone` should move the sheet, given the finger's travel so far
 * and the content's scroll offset. `undefined`: not decided yet (it has hardly moved).
 */
export function dragIntent({ zone, dx, dy, scrollTop, canGrow }: { zone: 'grab' | 'content'; dx: number; dy: number; scrollTop: number; canGrow: boolean }): 'drag' | 'scroll' | undefined {
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return undefined;
    if (Math.abs(dx) > Math.abs(dy)) return 'scroll';
    if (zone === 'grab') return 'drag';
    if (dy > 0 && scrollTop <= 0) return 'drag';
    if (dy < 0 && canGrow) return 'drag';
    return 'scroll';
}

const EASE = 'cubic-bezier(.2, .9, .25, 1)';
const DURATION = 280;
/** Not dragged from here: fields keep their own touch behaviour (select text, move the caret). */
const NO_DRAG = 'input, textarea, select, [contenteditable], [data-no-drag]';
/**
 * Except a one-line field in the header (the palette's search fills most of it): a vertical
 * drag there moves the sheet, a tap still focuses it, a sideways drag still moves the caret.
 */
const GRAB_FIELD = '.cbx-sheet-grab :is(input[type="search"], input[type="text"], input:not([type]))';

function reducedMotion(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function visibleHeight(): number {
    return Math.round(window.visualViewport?.height ?? window.innerHeight);
}

type Gesture = {
    id: number;
    x: number;
    y: number;
    zone: 'grab' | 'content';
    scroller: HTMLElement | null;
    mode: 'drag' | 'scroll' | undefined;
    last: number;
    start: number;
    detents: number[];
    tracker: VelocityTracker;
};

/**
 * Wire dragging onto a bottom sheet. `panel` is the sheet, `scrim` the backdrop that fades with
 * it; the handle and header carry `.cbx-sheet-grab`. `onClose` runs once the sheet has slid away.
 * `enabled` false (a desktop panel, a closed sheet) does nothing and clears any size it was given.
 */
export function useSheetDrag({ panel, scrim, size, onClose, enabled = true }: { panel: RefObject<HTMLElement | null>; scrim?: RefObject<HTMLElement | null>; size: SheetSize; onClose: () => void; enabled?: boolean }): void {
    const close = useRef(onClose);
    close.current = onClose;

    useEffect(() => {
        const sheet = panel.current;
        if (!enabled || sheet === null || typeof window === 'undefined') return;
        let gesture: Gesture | null = null;
        let natural: number | null = null;
        let closing = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const scrollerOf = (target: Element): HTMLElement | null => {
            for (let node: Element | null = target; node !== null && node !== sheet; node = node.parentElement) {
                const overflow = getComputedStyle(node).overflowY;
                if ((overflow === 'auto' || overflow === 'scroll') && node instanceof HTMLElement) return node;
            }
            return null;
        };
        const contentHeight = (): number => {
            const body = sheet.querySelector<HTMLElement>('[data-cbx-sheet-scroll]');
            if (body === null) return sheet.offsetHeight;
            return sheet.offsetHeight - body.clientHeight + body.scrollHeight;
        };
        // The scrim fades as the sheet goes down: its colour reads `--cbx-scrim` (the sheet is inside
        // the scrim, so its opacity cannot be used).
        const setScrim = (fraction: number) => {
            if (scrim?.current) {
                if (fraction >= 1) scrim.current.style.removeProperty('--cbx-scrim');
                else scrim.current.style.setProperty('--cbx-scrim', String(Math.max(0, Math.min(1, fraction))));
            }
        };
        const animate = (on: boolean) => {
            const smooth = on && !reducedMotion();
            sheet.style.transition = smooth ? `height ${DURATION}ms ${EASE}, transform ${DURATION}ms ${EASE}` : 'none';
            if (scrim?.current) scrim.current.style.transition = smooth ? `--cbx-scrim ${DURATION}ms ${EASE}` : 'none';
        };
        const place = (height: number, detents: number[]) => {
            const smallest = detents[0]!;
            const largest = detents[detents.length - 1]!;
            let shown = height;
            let drop = 0;
            if (height > largest) shown = largest + rubberBand(height - largest);
            else if (height < smallest) {
                shown = smallest;
                drop = smallest - height;
            }
            sheet.style.maxHeight = 'none';
            sheet.style.height = `${Math.round(shown)}px`;
            sheet.style.transform = drop > 0 ? `translateY(${Math.round(drop)}px)` : '';
            setScrim(drop > 0 ? 1 - drop / smallest : 1);
            sheet.dataset.cbxDragging = 'true';
        };
        const begin = (event: PointerEvent): void => {
            // A gesture whose end never arrived (released outside the window) ends where it was.
            if (gesture !== null) finish(gesture.last, event.timeStamp);
            if (closing) return;
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            const target = event.target instanceof Element ? event.target : null;
            if (target === null || (target.closest(NO_DRAG) !== null && !target.matches(GRAB_FIELD))) return;
            const zone = target.closest('.cbx-sheet-grab') !== null ? 'grab' : 'content';
            gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, zone, scroller: scrollerOf(target), mode: undefined, last: event.clientY, start: 0, detents: [], tracker: new VelocityTracker() };
            gesture.tracker.add(event.timeStamp, event.clientY);
            // Followed on the window: a mouse leaves the sheet as soon as it drags it up.
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', end);
            window.addEventListener('pointercancel', end);
        };
        const canGrow = (): boolean => {
            const current = sheet.getBoundingClientRect().height;
            const detents = sheetDetents({ size, viewport: visibleHeight(), current: natural ?? current, content: contentHeight() });
            return current < detents[detents.length - 1]! - 1;
        };
        const decide = (dx: number, dy: number): 'drag' | 'scroll' | undefined => {
            if (gesture === null) return undefined;
            if (gesture.mode !== undefined) return gesture.mode;
            const mode = dragIntent({ zone: gesture.zone, dx, dy, scrollTop: gesture.scroller?.scrollTop ?? 0, canGrow: gesture.zone === 'content' && dy < 0 ? canGrow() : false });
            if (mode === 'drag') {
                clearTimeout(timer);
                const current = sheet.getBoundingClientRect().height;
                if (natural === null && sheet.style.height === '') natural = Math.round(current);
                gesture.start = current;
                gesture.detents = sheetDetents({ size, viewport: visibleHeight(), current: natural ?? current, content: contentHeight() });
                // The current height is a resting place too (the sheet may sit on a detent of its own).
                animate(false);
                try {
                    sheet.setPointerCapture(gesture.id);
                } catch {
                    // the pointer is already gone
                }
            }
            gesture.mode = mode;
            return mode;
        };
        const move = (event: PointerEvent): void => {
            if (gesture === null || event.pointerId !== gesture.id) return;
            const dx = event.clientX - gesture.x;
            const dy = event.clientY - gesture.y;
            if (decide(dx, dy) !== 'drag') return;
            gesture.last = event.clientY;
            gesture.tracker.add(event.timeStamp, event.clientY);
            place(gesture.start - dy, gesture.detents);
        };
        const end = (event: PointerEvent): void => {
            if (gesture === null || event.pointerId !== gesture.id) return;
            // A cancelled pointer may carry no position: use the last one seen.
            finish(event.type === 'pointerup' ? event.clientY : gesture.last, event.timeStamp);
        };
        const finish = (y: number, at: number): void => {
            const done = gesture;
            gesture = null;
            unfollow();
            if (done === null || done.mode !== 'drag') return;
            done.tracker.add(at, y);
            delete sheet.dataset.cbxDragging;
            const height = done.start - (y - done.y);
            const result = settleSheet({ height, velocity: done.tracker.velocity(), detents: done.detents });
            // A drag is not a tap: swallow the click it would end in.
            const swallow = (click: Event) => {
                click.preventDefault();
                click.stopPropagation();
            };
            sheet.addEventListener('click', swallow, { capture: true, once: true });
            setTimeout(() => sheet.removeEventListener('click', swallow, { capture: true }), 350);
            animate(true);
            if (result.close) {
                closing = true;
                sheet.style.transform = `translateY(${Math.round(sheet.getBoundingClientRect().height + 24)}px)`;
                setScrim(0);
                timer = setTimeout(() => close.current(), reducedMotion() ? 0 : DURATION - 40);
                return;
            }
            if (natural !== null && result.height === natural) {
                // Back to where it opened: hand the size back to the stylesheet so it follows its content.
                sheet.style.height = `${natural}px`;
                sheet.style.transform = '';
                setScrim(1);
                timer = setTimeout(() => {
                    sheet.style.height = '';
                    sheet.style.maxHeight = '';
                    sheet.style.transition = '';
                    natural = null;
                }, reducedMotion() ? 0 : DURATION);
                return;
            }
            sheet.style.height = `${result.height}px`;
            sheet.style.transform = '';
            setScrim(1);
        };
        // The browser must not start scrolling a gesture that moves the sheet. Pointer events fire
        // before their touch events, so the decision is already made here.
        const touchMove = (event: TouchEvent): void => {
            if (gesture === null || event.touches.length > 1) return;
            const touch = event.touches[0]!;
            const mode = decide(touch.clientX - gesture.x, touch.clientY - gesture.y);
            if (mode === 'drag' && event.cancelable) event.preventDefault();
        };

        const unfollow = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', end);
            window.removeEventListener('pointercancel', end);
        };
        sheet.addEventListener('pointerdown', begin);
        sheet.addEventListener('touchmove', touchMove, { passive: false });
        return () => {
            clearTimeout(timer);
            unfollow();
            sheet.removeEventListener('pointerdown', begin);
            sheet.removeEventListener('touchmove', touchMove);
            for (const property of ['height', 'maxHeight', 'transform', 'transition'] as const) sheet.style[property] = '';
            delete sheet.dataset.cbxDragging;
            if (scrim?.current) {
                scrim.current.style.removeProperty('--cbx-scrim');
                scrim.current.style.transition = '';
            }
        };
    }, [panel, scrim, size, enabled]);
}

/**
 * The scrim closes its sheet on a tap: pressed and released on the scrim itself. A swipe across
 * it, or a press that starts in the sheet and ends on the scrim (selecting text), does not.
 */
export function scrimHandlers(onClose: () => void): { onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void; onClick: (event: MouseEvent<HTMLElement>) => void } {
    return {
        onPointerDown: event => {
            event.currentTarget.dataset.cbxPressed = event.target === event.currentTarget ? 'true' : 'false';
        },
        onClick: event => {
            const pressed = event.currentTarget.dataset.cbxPressed === 'true';
            delete event.currentTarget.dataset.cbxPressed;
            if (pressed && event.target === event.currentTarget) onClose();
        },
    };
}
