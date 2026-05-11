import { X } from 'lucide-react';
import {
    useCallback,
    useEffect,
    useRef,
    type ReactNode,
} from 'react';
import { cn } from '../utils/cn';

type Props = {
    open: boolean;
    onClose: () => void;
    /** Title rendered in the modal header. */
    title: ReactNode;
    /** Optional eyebrow above the title. */
    eyebrow?: ReactNode;
    /** Right-side header slot — typically a small action cluster
     *  (filters, "open in new tab", search input). */
    headerActions?: ReactNode;
    /** Optional bottom bar — e.g. "showing 50 of 312" + pagination. */
    footer?: ReactNode;
    /** Modal width. Default `wide` (~960px) suits inbox-style lists.
     *  `spotlight` is the search-modal width, narrower + top-aligned. */
    size?: 'wide' | 'spotlight';
    children: ReactNode;
};

/**
 * Cbox cross-app surface modal. Identical chrome across every
 * surface — only `title`, `headerActions`, `children`, `footer`
 * vary. Surfaces compose this; hosts never instantiate it
 * directly.
 *
 * Behaviour:
 *   - ESC key dismisses
 *   - click on the backdrop dismisses
 *   - focus is trapped inside the dialog while open
 *   - body scroll locks while open (page underneath stays put)
 *   - first focusable element inside auto-focuses on open
 *
 * The modal mounts a sibling portal-style div that's a direct
 * child of `<body>` (via fixed positioning + z-index) so it
 * escapes any positioned ancestor in the host page tree.
 */
export function SurfaceModal({
    open,
    onClose,
    title,
    eyebrow,
    headerActions,
    footer,
    size = 'wide',
    children,
}: Props) {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    // Lock body scroll while open. Restore the page's previous
    // scrollbar gutter to avoid layout shift.
    useEffect(() => {
        if (!open) return;
        const original = document.body.style.overflow;
        const gutter = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = 'hidden';
        if (gutter > 0) {
            document.body.style.paddingRight = `${gutter}px`;
        }
        return () => {
            document.body.style.overflow = original;
            document.body.style.paddingRight = '';
        };
    }, [open]);

    // ESC dismiss + focus trap.
    useEffect(() => {
        if (!open) return;
        previousFocusRef.current = document.activeElement as HTMLElement | null;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key === 'Tab' && dialogRef.current !== null) {
                const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
                    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
                );
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (first === undefined || last === undefined) return;
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', onKey);

        // Auto-focus the first focusable element so keyboard users
        // land inside the dialog without an extra Tab.
        const id = window.setTimeout(() => {
            const focusable = dialogRef.current?.querySelector<HTMLElement>(
                'input, button, [tabindex]:not([tabindex="-1"])',
            );
            focusable?.focus();
        }, 50);

        return () => {
            document.removeEventListener('keydown', onKey);
            window.clearTimeout(id);
            previousFocusRef.current?.focus?.();
        };
    }, [open, onClose]);

    const onBackdrop = useCallback(
        (e: React.MouseEvent) => {
            if (e.target === e.currentTarget) onClose();
        },
        [onClose],
    );

    if (!open) return null;

    return (
        <div
            role="presentation"
            onMouseDown={onBackdrop}
            className={cn(
                'fixed inset-0 z-50 flex animate-in fade-in duration-150',
                size === 'spotlight'
                    ? 'items-start justify-center pt-[10vh]'
                    : 'items-center justify-center px-4 py-[5vh]',
                'bg-foreground/40 backdrop-blur-sm',
            )}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={typeof title === 'string' ? title : undefined}
                className={cn(
                    'flex max-h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl',
                    'animate-in zoom-in-95 slide-in-from-bottom-2 duration-150',
                    size === 'spotlight'
                        ? 'max-w-[640px]'
                        : 'max-w-[960px]',
                )}
            >
                <header className="flex shrink-0 items-start gap-3 border-b border-border/70 bg-background/80 px-5 py-4 backdrop-blur-md">
                    <div className="min-w-0 flex-1">
                        {eyebrow !== undefined ? (
                            <p className="text-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                                {eyebrow}
                            </p>
                        ) : null}
                        <h2 className="text-base font-semibold tracking-tight text-foreground">
                            {title}
                        </h2>
                    </div>
                    {headerActions !== undefined ? (
                        <div className="flex shrink-0 items-center gap-2">
                            {headerActions}
                        </div>
                    ) : null}
                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto">{children}</div>

                {footer !== undefined ? (
                    <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-background/80 px-5 py-3 text-xs text-muted-foreground backdrop-blur-md">
                        {footer}
                    </footer>
                ) : null}
            </div>
        </div>
    );
}
