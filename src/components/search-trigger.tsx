import { useEffect, useState } from 'react';
import { cn } from '../utils/cn';

type Props = {
    /** Click handler — typically dispatches the app's command-palette
     *  open shortcut. Apps that don't have a palette yet pass a no-op
     *  so the chrome stays visually consistent across the suite. */
    onOpen?: () => void;
    className?: string;
    label?: string;
};

/**
 * Topbar Search trigger — a visual-only command-palette button.
 *
 * Hosted in cbox-ui because every Cbox app's chrome must show the
 * same search affordance in the same spot, with the same width and
 * the same shortcut hint. Drift across apps means users see layout
 * shifts when tabbing between id / webhooks / cortex; that's a UX
 * tax we don't want to charge them.
 *
 * The actual palette stays per-app (commands differ); this primitive
 * just renders the trigger and dispatches `onOpen`.
 */
export function SearchTrigger({ onOpen, className, label = 'Search' }: Props) {
    const [shortcut, setShortcut] = useState('⌘K');
    useEffect(() => {
        if (typeof navigator === 'undefined') return;
        setShortcut(/Mac/.test(navigator.platform) ? '⌘K' : 'Ctrl K');
    }, []);

    return (
        <button
            type="button"
            onClick={onOpen}
            className={cn(
                'hidden h-8 w-[180px] items-center gap-2 rounded-md border border-border bg-card pr-1.5 pl-2.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground sm:inline-flex',
                className,
            )}
            aria-label="Open command palette"
        >
            <SearchIcon />
            <span className="flex-1 text-left">{label}</span>
            <kbd className="text-mono ml-1 rounded-sm border border-border bg-secondary px-1 py-0.5 text-[10px] font-medium tracking-tight text-muted-foreground">
                {shortcut}
            </kbd>
        </button>
    );
}

function SearchIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    );
}
