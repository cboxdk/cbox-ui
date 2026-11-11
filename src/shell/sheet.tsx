import { ChevronLeft, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useShell } from './context';
import { trapTab } from './popover';
import { useScrollLock } from './scroll-lock';
import { scrimHandlers, useSheetDrag } from './sheet-drag';

/**
 * A modal sheet: a bottom sheet on the phone, a panel sliding in from the right on a desktop. It
 * traps focus, closes on Escape and on the scrim, and gives focus back to what opened it.
 * `back` puts a back button before the title (a pushed step). The page behind does not scroll while
 * it is open. A bottom sheet drags by its handle and header (and by its content from the top):
 * between its detents, and down to close.
 */
export function Sheet({
    label,
    side = 'bottom',
    onClose,
    children,
    title,
    back,
    size,
    className,
    bodyClassName,
}: {
    /** The dialog's accessible name. */
    label: string;
    side?: 'bottom' | 'right';
    onClose: () => void;
    children: ReactNode;
    /** The visible title. Default `label`. */
    title?: ReactNode;
    back?: { label: string; onBack: () => void; text?: string };
    /** `tall` is 90% of the screen, `full` 94% (the palette); default fits its content up to 88%. */
    size?: 'tall' | 'full';
    className?: string;
    bodyClassName?: string;
}) {
    const { t } = useShell();
    const panel = useRef<HTMLDivElement>(null);
    const scrim = useRef<HTMLDivElement>(null);
    useScrollLock();
    useSheetDrag({ panel, scrim, size: size ?? 'fit', onClose, enabled: side === 'bottom' });
    const opener = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);
    useEffect(() => {
        panel.current?.focus();
        const restore = opener.current;
        return () => {
            if (restore instanceof HTMLElement && restore.isConnected) restore.focus({ preventScroll: true });
        };
    }, []);
    return (
        <div ref={scrim} className="cbx-overlay cbx-sheet-backdrop" {...scrimHandlers(onClose)}>
            <div
                ref={panel}
                className={`cbx-sheet cbx-sheet-${side} ${size !== undefined ? `is-${size}` : ''} ${className ?? ''}`}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                tabIndex={-1}
                onKeyDown={event => {
                    if (event.key === 'Escape' && !event.defaultPrevented) {
                        event.preventDefault();
                        onClose();
                    }
                    trapTab(event, panel.current);
                }}
            >
                {side === 'bottom' && <div className="cbx-sheet-handle cbx-sheet-grab" aria-hidden="true" />}
                <div className={`cbx-sheet-head ${side === 'bottom' ? 'cbx-sheet-grab' : ''} ${back !== undefined ? 'has-back' : ''}`}>
                    {back !== undefined && (
                        <button type="button" className="cbx-sheet-back" onClick={back.onBack} aria-label={back.label}>
                            <ChevronLeft size={20} strokeWidth={1.8} aria-hidden />
                            {back.text !== undefined && <span>{back.text}</span>}
                        </button>
                    )}
                    <strong className="cbx-sheet-title cbx-truncate">{title ?? label}</strong>
                    <button type="button" className="cbx-icon-button" onClick={onClose} aria-label={t('Close')}>
                        <X size={18} strokeWidth={1.8} aria-hidden />
                    </button>
                </div>
                <div className={`cbx-sheet-body ${bodyClassName ?? ''}`} data-cbx-sheet-scroll="">{children}</div>
            </div>
        </div>
    );
}
