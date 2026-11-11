import { ChevronLeft, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useShell } from './context';
import { trapTab } from './popover';

/**
 * A modal sheet: a bottom sheet on the phone, a panel sliding in from the right on a desktop. It
 * traps focus, closes on Escape and on the scrim, and gives focus back to what opened it.
 * `back` puts a back button before the title (a pushed step).
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
    const opener = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);
    useEffect(() => {
        panel.current?.focus();
        const restore = opener.current;
        return () => {
            if (restore instanceof HTMLElement && restore.isConnected) restore.focus();
        };
    }, []);
    return (
        <div className="cbx-overlay cbx-sheet-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
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
                {side === 'bottom' && <div className="cbx-sheet-handle" aria-hidden="true" />}
                <div className={`cbx-sheet-head ${back !== undefined ? 'has-back' : ''}`}>
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
                <div className={`cbx-sheet-body ${bodyClassName ?? ''}`}>{children}</div>
            </div>
        </div>
    );
}
