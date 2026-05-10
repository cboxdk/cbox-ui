type Props = {
    /** Called when the user clicks the trigger button. */
    onOpen: () => void;
    /** Override the keyboard shortcut hint label. Defaults to auto-detected ⌘K / Ctrl+K. */
    shortcutLabel?: string;
};

/**
 * Topbar button that opens the command palette (or any search affordance).
 * Shows a ⌘K / Ctrl+K hint on the right.
 *
 * The component is intentionally display-only — it fires `onOpen` and lets
 * the host handle the actual palette mounting. This keeps cbox-ui free of
 * any palette dependency.
 */
export function SearchTrigger({ onOpen, shortcutLabel }: Props) {
    const isMac =
        typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
    const hint = shortcutLabel ?? (isMac ? '⌘K' : 'Ctrl+K');

    return (
        <button
            type="button"
            onClick={onOpen}
            aria-label={`Open search (${hint})`}
            className="flex h-8 items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
            <SearchIcon />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded bg-background px-1 py-0.5 text-[10px] font-mono text-muted-foreground shadow-sm sm:inline">
                {hint}
            </kbd>
        </button>
    );
}

function SearchIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden
        >
            <circle
                cx="6"
                cy="6"
                r="4"
                stroke="currentColor"
                strokeWidth="1.4"
            />
            <path
                d="M9.5 9.5L12 12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
            />
        </svg>
    );
}
