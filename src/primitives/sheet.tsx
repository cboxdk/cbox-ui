import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type MouseEvent,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useCboxLocalization } from '../context/localization';
import { useScrollLock } from '../shell/scroll-lock';
import { useSheetDrag } from '../shell/sheet-drag';
import { cn } from '../utils/cn';
import { Button, type ButtonProps } from './button';

export type SheetSize = 'sm' | 'md' | 'lg';

export type SheetProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: ReactNode;
    /** One sentence on what the sheet is for. Read out with the title when it opens. */
    description?: ReactNode;
    /** The buttons, right-aligned in a footer that stays in view. Cancel first, the action last. */
    footer?: ReactNode;
    /** The panel's width on a wide screen: 26rem, 30rem (default) or 44rem. A phone's sheet is full width. */
    size?: SheetSize;
    /** Clicking the scrim (or dragging the phone's sheet down) closes it (default). Off for a form that would lose typed work. */
    dismissible?: boolean;
    className?: string;
    children?: ReactNode;
};

const TABBABLE = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'iframe',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

function tabbables(root: HTMLElement): HTMLElement[] {
    const all = Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter((element) => element.tabIndex >= 0 && element.closest('[hidden], [inert]') === null);
    // A radio group is one tab stop: the checked radio, or the first when none is.
    const checkedGroups = new Set(all.filter((element) => element instanceof HTMLInputElement && element.type === 'radio' && element.checked).map((element) => (element as HTMLInputElement).name));
    const seen = new Set<string>();
    return all.filter((element) => {
        if (!(element instanceof HTMLInputElement) || element.type !== 'radio' || element.name === '') return true;
        if (checkedGroups.has(element.name)) return element.checked;
        if (seen.has(element.name)) return false;
        seen.add(element.name);
        return true;
    });
}

const SheetContext = createContext<(() => void) | null>(null);

/** Closes the sheet it is inside (for a footer button that should not need the caller's state). */
export function useSheetClose(): () => void {
    const close = useContext(SheetContext);
    return close ?? (() => undefined);
}

/** A Button that closes the sheet it is inside, then runs its own `onClick`. Defaults to `ghost`. */
export function SheetClose({ onClick, ...props }: ButtonProps) {
    const close = useSheetClose();
    return (
        <Button
            {...props}
            onClick={(event) => {
                onClick?.(event);
                if (!event.defaultPrevented) close();
            }}
        />
    );
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Below 768px the sheet comes up from the bottom; the same breakpoint as `tokens/controls.css`. */
const NARROW = '(max-width: 767.98px)';

function useNarrow(): boolean {
    const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches);
    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const query = window.matchMedia(NARROW);
        const update = () => setNarrow(query.matches);
        update();
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    return narrow;
}

/**
 * A modal sheet: a panel sliding in from the right on a wide screen, a bottom sheet on a phone that
 * drags down to close. Cbox never centres a modal over the page; forms and confirmations open here.
 *
 * - Focus moves in on open: to an element marked `autoFocus` or `data-autofocus`, else the first
 *   field in the body, else the close button (never a destructive footer action).
 * - Tab and Shift+Tab stay inside; everything behind is `inert` and hidden from assistive
 *   technology; the page behind does not scroll (iOS included).
 * - Escape closes it (unless a control inside handled Escape first, an open combobox say), as do
 *   the close button and a click on the scrim.
 * - On close, focus goes back to whatever opened it, without scrolling, so a dialog opened from a
 *   menu item or a shortcut needs no trigger of its own.
 *
 * The close button's name ("Close") goes through the host's translator.
 */
export function Sheet({ open, onOpenChange, title, description, footer, size = 'md', dismissible = true, className, children }: SheetProps) {
    const { t } = useCboxLocalization();
    const id = useId();
    const titleId = `${id}-title`;
    const descriptionId = `${id}-description`;
    const layer = useRef<HTMLDivElement | null>(null);
    const scrim = useRef<HTMLDivElement | null>(null);
    const panel = useRef<HTMLDivElement | null>(null);
    const closeButton = useRef<HTMLButtonElement | null>(null);
    const body = useRef<HTMLDivElement | null>(null);
    const returnTo = useRef<HTMLElement | null>(null);
    const wasOpen = useRef(false);
    const pressedOnScrim = useRef(false);

    // Read the opener while rendering the open state, before any child's autoFocus moves focus.
    if (open && !wasOpen.current && typeof document !== 'undefined') {
        const active = document.activeElement;
        returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
    }
    wasOpen.current = open;

    const close = useCallback(() => onOpenChange(false), [onOpenChange]);

    const narrow = useNarrow();

    useScrollLock(open);
    // On a phone the sheet drags by its handle and header, and down to close (refused when not dismissible).
    useSheetDrag({ panel, scrim, size: 'fit', onClose: dismissible ? close : () => false, enabled: open && narrow });

    // Everything outside this dialog is inert while it is open; a nested dialog adds its own.
    useIsoLayoutEffect(() => {
        if (!open || layer.current === null) return;
        const own = layer.current;
        const made: HTMLElement[] = [];
        for (const sibling of Array.from(document.body.children)) {
            if (sibling === own || !(sibling instanceof HTMLElement) || sibling.hasAttribute('inert')) continue;
            if (sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE') continue;
            sibling.setAttribute('inert', '');
            made.push(sibling);
        }
        return () => {
            for (const element of made) element.removeAttribute('inert');
        };
    }, [open]);

    // Move focus in.
    useIsoLayoutEffect(() => {
        if (!open || panel.current === null) return;
        const root = panel.current;
        if (root.contains(document.activeElement)) return;
        const marked = root.querySelector<HTMLElement>('[data-autofocus]');
        const field = body.current?.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]');
        (marked ?? field ?? closeButton.current ?? root).focus({ preventScroll: true });
    }, [open]);

    // Focus that escapes anyway (a script, a click in a third-party overlay) is brought back.
    useEffect(() => {
        if (!open) return;
        const onFocusIn = (event: FocusEvent) => {
            const root = panel.current;
            const target = event.target;
            if (root === null || !(target instanceof Node) || root.contains(target)) return;
            // A dialog opened on top of this one owns focus now.
            if (target instanceof Element && target.closest('[data-cbx-dialog-layer]') !== null) return;
            (tabbables(root)[0] ?? root).focus({ preventScroll: true });
        };
        document.addEventListener('focusin', onFocusIn);
        return () => document.removeEventListener('focusin', onFocusIn);
    }, [open]);

    // Give focus back on close (and on unmount while open).
    useEffect(() => {
        if (!open) return;
        return () => {
            const target = returnTo.current;
            if (target !== null && target.isConnected) target.focus({ preventScroll: true });
        };
    }, [open]);

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.defaultPrevented) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
        }
        if (event.key !== 'Tab' || panel.current === null) return;
        const items = tabbables(panel.current);
        const first = items[0];
        const last = items[items.length - 1];
        if (first === undefined || last === undefined) {
            event.preventDefault();
            panel.current.focus({ preventScroll: true });
            return;
        }
        const active = document.activeElement;
        if (event.shiftKey && (active === first || active === panel.current)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    };

    if (!open || typeof document === 'undefined') return null;

    const onScrimDown = (event: MouseEvent<HTMLDivElement>) => {
        pressedOnScrim.current = event.target === event.currentTarget;
    };
    const onScrimClick = (event: MouseEvent<HTMLDivElement>) => {
        if (dismissible && pressedOnScrim.current && event.target === event.currentTarget) close();
        pressedOnScrim.current = false;
    };

    return createPortal(
        <SheetContext.Provider value={close}>
            <div ref={layer} data-cbx-scroll-layer="" data-cbx-dialog-layer="">
                <div ref={scrim} className="cbx-ui-overlay" aria-hidden="true" onMouseDown={onScrimDown} onClick={onScrimClick} />
                <div
                    ref={panel}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    aria-describedby={description !== undefined ? descriptionId : undefined}
                    tabIndex={-1}
                    className={cn('cbx-ui-sheet', `cbx-ui-sheet--${size}`, className)}
                    onKeyDown={onKeyDown}
                >
                    <div className="cbx-ui-sheet-handle cbx-sheet-grab" aria-hidden="true" />
                    <div className="cbx-ui-sheet-head cbx-sheet-grab">
                        <div className="cbx-ui-sheet-heading">
                            <h2 id={titleId} className="cbx-ui-sheet-title">
                                {title}
                            </h2>
                            {description !== undefined && (
                                <p id={descriptionId} className="cbx-ui-sheet-desc">
                                    {description}
                                </p>
                            )}
                        </div>
                        <button ref={closeButton} type="button" className="cbx-ui-iconbtn" aria-label={t('Close')} onClick={close}>
                            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>
                    {children !== undefined && children !== null && (
                        <div ref={body} className="cbx-ui-sheet-body" data-cbx-sheet-scroll="">
                            {children}
                        </div>
                    )}
                    {footer !== undefined && footer !== null && <div className="cbx-ui-sheet-foot">{footer}</div>}
                </div>
            </div>
        </SheetContext.Provider>,
        document.body,
    );
}

/** @deprecated Use `Sheet`; a Dialog is a Sheet (Cbox never centres a modal). */
export const Dialog = Sheet;
/** @deprecated Use `SheetClose`. */
export const DialogClose = SheetClose;
/** @deprecated Use `useSheetClose`. */
export const useDialogClose = useSheetClose;
/** @deprecated Use `SheetProps`. */
export type DialogProps = SheetProps;
/** @deprecated Use `SheetSize`. */
export type DialogSize = SheetSize;
