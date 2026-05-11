import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type ComponentType,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from 'react';
import { useCboxId, type CboxOrganization } from '../context/cbox-id';
import { cn } from '../utils/cn';

type Props = {
    /**
     * Optional renderer override for the trigger so apps can match
     * their topbar style (filled button vs ghost vs icon-only).
     */
    Trigger?: ComponentType<{
        organization: CboxOrganization | null;
        onClick: () => void;
        open: boolean;
    }>;
    className?: string;
};

/**
 * Dropdown that surfaces the user's orgs and dispatches the picked
 * one through `onSwitchOrganization`. Reads everything else from
 * CboxIdProvider so the same component works in id, cortex, atlas —
 * no per-app data wiring.
 *
 * Includes typeahead — auto-focus on open, filters by name as the
 * user types, arrow-key navigation, Enter to switch, Escape to close.
 */
export function OrgSwitcher({ Trigger = DefaultTrigger, className }: Props) {
    const { currentOrganization, organizations, onSwitchOrganization } = useCboxId();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const searchRef = useRef<HTMLInputElement | null>(null);

    // Reset transient state every open. requestAnimationFrame waits
    // for the input to mount before focusing it.
    useEffect(() => {
        if (open) {
            setQuery('');
            setActiveIndex(0);
            const id = requestAnimationFrame(() => searchRef.current?.focus());
            return () => cancelAnimationFrame(id);
        }
    }, [open]);

    // Click-outside + Escape. Matches AppSwitcher / every other Cbox
    // top-bar control.
    useEffect(() => {
        if (!open) {
            return;
        }

        function onPointerDown(event: PointerEvent): void {
            if (
                containerRef.current !== null &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        }

        function onKey(event: KeyboardEvent): void {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        }

        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (q === '') {
            return organizations;
        }
        return organizations.filter(
            (org) =>
                org.name.toLowerCase().includes(q) ||
                org.slug.toLowerCase().includes(q),
        );
    }, [organizations, query]);

    // Clamp activeIndex when the filter shrinks the list.
    useEffect(() => {
        if (activeIndex >= filtered.length) {
            setActiveIndex(0);
        }
    }, [filtered.length, activeIndex]);

    const onPick = (org: CboxOrganization) => {
        setOpen(false);
        if (onSwitchOrganization) {
            onSwitchOrganization(org);
            return;
        }
        // No fallback. Org switching is a URL navigation — apps own
        // the destination path because it's per-app (id has /dashboard,
        // webhooks has /endpoints, etc.). Failing loud here is better
        // than silently doing nothing.
        if (typeof console !== 'undefined') {
            console.warn(
                '[cbox-ui] OrgSwitcher: no onSwitchOrganization handler provided. Apps must wire one (router.visit) — there is no server endpoint to fall back to.',
            );
        }
    };

    function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (filtered.length === 0) {
                return;
            }
            setActiveIndex((i) => (i + 1) % filtered.length);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (filtered.length === 0) {
                return;
            }
            setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const target = filtered[activeIndex];
            if (target !== undefined) {
                onPick(target);
            }
        }
    }

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            <Trigger
                organization={currentOrganization}
                onClick={() => setOpen((v) => !v)}
                open={open}
            />
            {open ? (
                <div
                    role="dialog"
                    aria-label="Switch organization"
                    className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-md border border-border bg-popover shadow-md"
                >
                    <div className="border-b border-border/70 px-3 pt-2 pb-1">
                        <p className="text-mono text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                            Switch organization
                        </p>
                    </div>

                    <div className="border-b border-border/70 px-2 py-1.5">
                        <div className="flex items-center gap-2 rounded-md px-2 py-1 focus-within:bg-secondary">
                            <SearchIcon />
                            <input
                                ref={searchRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={onSearchKeyDown}
                                placeholder="Filter…"
                                aria-label="Filter organizations"
                                autoComplete="off"
                                spellCheck={false}
                                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto p-1">
                        {filtered.length === 0 ? (
                            <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                                No organizations match{' '}
                                <span className="text-mono text-foreground">
                                    “{query}”
                                </span>
                            </p>
                        ) : (
                            <ul className="space-y-0.5">
                                {filtered.map((org, index) => {
                                    const active = currentOrganization?.id === org.id;
                                    const highlighted = index === activeIndex;
                                    return (
                                        <li key={org.id}>
                                            <button
                                                type="button"
                                                onMouseEnter={() => setActiveIndex(index)}
                                                onClick={() => onPick(org)}
                                                className={cn(
                                                    'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
                                                    active
                                                        ? 'bg-accent-soft text-foreground'
                                                        : highlighted
                                                          ? 'bg-secondary'
                                                          : 'hover:bg-secondary',
                                                )}
                                            >
                                                <span className="truncate">{org.name}</span>
                                                {active ? (
                                                    <span className="text-mono text-[10px] text-muted-foreground">
                                                        current
                                                    </span>
                                                ) : null}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

const DefaultTrigger: ComponentType<{
    organization: CboxOrganization | null;
    onClick: () => void;
    open: boolean;
}> = ({ organization, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary"
    >
        <span className="truncate max-w-[180px]">
            {organization?.name ?? 'Pick an organization'}
        </span>
        <Chevron />
    </button>
);

function Chevron(): ReactNode {
    return (
        <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <path
                d="M2 4l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function SearchIcon(): ReactNode {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="shrink-0 text-muted-foreground"
        >
            <circle cx="5.25" cy="5.25" r="3.25" />
            <path d="M8 8l2 2" />
        </svg>
    );
}
