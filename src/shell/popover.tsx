import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';

export type Placement = 'bottom-start' | 'bottom-end' | 'top-start';

const GAP = 6;
const MARGIN = 8;

type Position = { top?: number; bottom?: number; left: number; maxHeight: number };

function place(anchor: DOMRect, size: { width: number }, placement: Placement): Position {
    const width = window.innerWidth;
    const height = window.innerHeight;
    let left = placement === 'bottom-end' ? anchor.right - size.width : anchor.left;
    left = Math.max(MARGIN, Math.min(left, width - size.width - MARGIN));
    if (placement === 'top-start') {
        const bottom = height - anchor.top + GAP;
        return { bottom, left, maxHeight: Math.max(160, height - bottom - MARGIN) };
    }
    const top = anchor.bottom + GAP;
    return { top, left, maxHeight: Math.max(160, height - top - MARGIN) };
}

/**
 * A menu surface anchored to its trigger. It is positioned `fixed` from the trigger's box before
 * the first paint (no jump, never clipped by a scrolling parent), closes on a pointer down outside
 * it and on Escape, and hands focus back to the trigger when it closes from the keyboard.
 */
export function Popover({
    open,
    anchor,
    placement = 'bottom-start',
    onClose,
    className,
    label,
    children,
}: {
    open: boolean;
    anchor: RefObject<HTMLElement | null>;
    placement?: Placement;
    onClose: (reason: 'escape' | 'outside' | 'tab') => void;
    className?: string;
    label: string;
    children: ReactNode;
}) {
    const surface = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<Position | null>(null);

    useLayoutEffect(() => {
        if (!open) {
            setPosition(null);
            return;
        }
        const update = () => {
            const box = anchor.current?.getBoundingClientRect();
            const el = surface.current;
            if (box === undefined || el === null) return;
            setPosition(place(box, { width: el.offsetWidth }, placement));
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [open, anchor, placement]);

    useEffect(() => {
        if (!open) return;
        const down = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (target === null) return;
            if (surface.current?.contains(target) || anchor.current?.contains(target)) return;
            onClose('outside');
        };
        document.addEventListener('pointerdown', down, true);
        return () => document.removeEventListener('pointerdown', down, true);
    }, [open, anchor, onClose]);

    if (!open) return null;

    const style: CSSProperties = position === null
        ? { position: 'fixed', top: 0, left: 0, visibility: 'hidden' }
        : { position: 'fixed', top: position.top, bottom: position.bottom, left: position.left, maxHeight: position.maxHeight };

    return (
        <div
            ref={surface}
            className={`cbx-popover ${className ?? ''}`}
            style={style}
            role="dialog"
            aria-label={label}
            onKeyDown={event => {
                if (event.key === 'Escape' && !event.defaultPrevented) {
                    event.preventDefault();
                    event.stopPropagation();
                    onClose('escape');
                    anchor.current?.focus();
                }
                if (event.key === 'Tab' && !event.defaultPrevented) {
                    // Tab leaves the menu: it closes and the trigger has focus, so the next Tab
                    // goes on through the header.
                    event.preventDefault();
                    onClose('tab');
                    anchor.current?.focus();
                }
            }}
        >
            {children}
        </div>
    );
}

/** Keep Tab inside `container` while it is modal (mobile sheets, the Help overlay, the palette). */
export function trapTab(event: { key: string; shiftKey: boolean; preventDefault: () => void }, container: HTMLElement | null): void {
    if (event.key !== 'Tab' || container === null) return;
    const focusable = Array.from(
        container.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    ).filter(el => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');
    if (focusable.length === 0) {
        event.preventDefault();
        return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
    }
}

/**
 * Scroll `id`'s element into view inside its own scrolling list only. `scrollIntoView` would also
 * scroll every parent (a sheet, the page), which makes a menu jump when it opens.
 */
export function revealInList(id: string): void {
    if (typeof document === 'undefined') return;
    const option = document.getElementById(id);
    if (option === null) return;
    const list = option.closest<HTMLElement>('[role="listbox"]');
    if (list === null || list.scrollHeight <= list.clientHeight) return;
    const box = list.getBoundingClientRect();
    const item = option.getBoundingClientRect();
    if (item.top < box.top) list.scrollTop -= box.top - item.top + 8;
    else if (item.bottom > box.bottom) list.scrollTop += item.bottom - box.bottom + 8;
}
