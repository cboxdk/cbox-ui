import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type ComponentType,
    type KeyboardEvent,
    type ReactNode,
} from 'react';
import { cn } from '../utils/cn';

/**
 * Combobox — the canonical select replacement for the Cbox suite.
 *
 * **Native `<select>` is forbidden.** It can't host avatars, can't
 * be searched, can't be styled into the design system, and on mobile
 * it pops the OS picker which breaks the visual contract. Combobox
 * solves all of that with a single primitive:
 *
 *   - Type-ahead filter on the search input (case-insensitive,
 *     matches label + secondary).
 *   - Keyboard contract: ArrowDown / ArrowUp move highlight, Enter
 *     selects, Escape closes, Home/End jump to bounds, Tab exits.
 *   - Optional avatar per option, optional secondary line.
 *   - Optional grouped sections with mono-tracked headers.
 *   - Optional footer link (eg "+ New environment").
 *   - Empty-state copy when the filter excludes everything.
 *
 * Two modes:
 *   - Value mode (default): `value` + `onChange` — Combobox manages
 *     selection state, host treats it like a controlled input.
 *   - Navigation mode: items carry `href` and `LinkComponent` is
 *     supplied — clicking an item is a Link visit, not a state mutation.
 *
 * Both modes are URL/router-friendly. Value mode is for filter
 * controls; navigation mode is for context switchers (the Combobox
 * inside a ContextBar crumb is exactly this).
 */

export type ComboboxOption = {
    /** Stable key. Used as React key and for active-state matching. */
    value: string;
    /** Visible label — primary line. */
    label: string;
    /** Optional secondary line — slug, role, environment, hint. */
    secondary?: string;
    /** Optional leading icon (lucide-style — h-3.5 w-3.5). */
    icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
    /**
     * Optional avatar — image src OR `{initials,accent}` chip. When
     * the option carries an avatar, the trigger renders one too if
     * the option is the active selection.
     */
    avatar?: ComboboxAvatar;
    /** Disable selection of this option. */
    disabled?: boolean;
    /**
     * Hidden text added to the searchable haystack. Useful for
     * synonyms ("United States" should match "USA", "us"). Not
     * displayed.
     */
    keywords?: string[];
    /**
     * Optional href for navigation mode. When set + LinkComponent is
     * supplied, clicking the option navigates instead of mutating
     * value state.
     */
    href?: string;
};

export type ComboboxGroup = {
    /** Group heading — uppercase mono-tracked. Empty string hides the heading. */
    label: string;
    options: ComboboxOption[];
};

export type ComboboxAvatar = {
    initials?: string;
    accent?: string;
    src?: string;
};

type LinkComp = ComponentType<{
    href: string;
    prefetch?: boolean;
    className?: string;
    children: ReactNode;
}>;

type CommonProps = {
    /** Options or grouped options. Pass an array of either shape. */
    items: ComboboxOption[] | ComboboxGroup[];
    /** Placeholder shown in the trigger when no value is selected. */
    placeholder?: string;
    /** Search input placeholder. */
    searchPlaceholder?: string;
    /** Empty-state copy when the filter matches nothing. */
    emptyText?: string;
    /** Optional footer link below the option list ("+ New X"). */
    footerLink?: {
        label: string;
        href: string;
    };
    /** Disable the entire combobox (greyed-out trigger). */
    disabled?: boolean;
    /** Required-field marker on the trigger. */
    required?: boolean;
    /** Aria-label for the trigger. */
    ariaLabel?: string;
    /** Trigger className override. Doesn't change padding/height. */
    triggerClassName?: string;
    /** Dropdown panel className override. */
    panelClassName?: string;
    /** Width policy for the trigger. Defaults to `auto` (intrinsic). */
    triggerWidth?: 'auto' | 'full';
    /**
     * Framework Link adapter for navigation-mode items + footer link.
     * If unset, navigation falls back to plain `<a>`.
     */
    LinkComponent?: LinkComp;
    /** ID for the trigger button (associate with a <Label htmlFor>). */
    id?: string;
    /** className for the outer wrapper. */
    className?: string;
};

type ValueModeProps = CommonProps & {
    /** Selected value or `null` when nothing is selected. */
    value: string | null;
    /** Called with the option's `value` when the user picks one. */
    onChange: (value: string) => void;
};

type NavModeProps = CommonProps & {
    /** Active value for highlight purposes. Optional in nav mode. */
    value?: string | null;
    /**
     * Omitted in nav mode. Items must carry `href`, and a
     * LinkComponent must be supplied for SPA navigation.
     */
    onChange?: never;
};

export type ComboboxProps = ValueModeProps | NavModeProps;

export function Combobox(props: ComboboxProps) {
    const {
        items,
        placeholder = 'Select…',
        searchPlaceholder = 'Search…',
        emptyText = 'Nothing matches.',
        footerLink,
        disabled = false,
        required = false,
        ariaLabel,
        triggerClassName,
        panelClassName,
        triggerWidth = 'auto',
        LinkComponent,
        id: idProp,
        className,
        value,
    } = props;

    const groups = useMemo(() => normaliseGroups(items), [items]);
    const flatOptions = useMemo(
        () => groups.flatMap((g) => g.options),
        [groups],
    );
    const activeOption = useMemo(
        () => (value !== null && value !== undefined
            ? flatOptions.find((opt) => opt.value === value)
            : null),
        [flatOptions, value],
    );

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(-1);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const listRef = useRef<HTMLUListElement | null>(null);
    const reactId = useId();
    const id = idProp ?? reactId;
    const listId = `${id}-listbox`;

    // Filtered groups (preserves group structure for headings).
    const filteredGroups = useMemo(
        () => filterGroups(groups, query),
        [groups, query],
    );
    const filteredFlat = useMemo(
        () => filteredGroups.flatMap((g) => g.options),
        [filteredGroups],
    );

    // Reset highlight when filter changes — first non-disabled option.
    useEffect(() => {
        if (! open) return;
        const firstEnabled = filteredFlat.findIndex(
            (opt) => opt.disabled !== true,
        );
        setHighlightIndex(firstEnabled);
    }, [filteredFlat, open]);

    // Auto-focus the search input when the menu opens.
    useEffect(() => {
        if (open) {
            // Run on the next tick so the input is mounted.
            const id = window.setTimeout(() => inputRef.current?.focus(), 0);
            return () => window.clearTimeout(id);
        }
        setQuery('');

        return undefined;
    }, [open]);

    // Click-outside close.
    useEffect(() => {
        if (! open) return;

        function onPointerDown(event: PointerEvent): void {
            if (
                containerRef.current !== null &&
                ! containerRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        }

        window.addEventListener('pointerdown', onPointerDown);
        return () => window.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    const onSelectOption = useCallback(
        (opt: ComboboxOption) => {
            if (opt.disabled === true) return;

            if (
                opt.href !== undefined &&
                LinkComponent !== undefined &&
                props.onChange === undefined
            ) {
                // Navigation mode — Link handles it; just close.
                setOpen(false);
                return;
            }

            if (props.onChange !== undefined) {
                props.onChange(opt.value);
            }
            setOpen(false);
        },
        [LinkComponent, props],
    );

    const onKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setHighlightIndex((current) =>
                    nextEnabledIndex(filteredFlat, current, 1),
                );
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setHighlightIndex((current) =>
                    nextEnabledIndex(filteredFlat, current, -1),
                );
                return;
            }
            if (event.key === 'Home') {
                event.preventDefault();
                setHighlightIndex(
                    filteredFlat.findIndex((o) => o.disabled !== true),
                );
                return;
            }
            if (event.key === 'End') {
                event.preventDefault();
                let last = -1;
                for (let i = 0; i < filteredFlat.length; i++) {
                    const opt = filteredFlat[i];
                    if (opt !== undefined && opt.disabled !== true) {
                        last = i;
                    }
                }
                setHighlightIndex(last);
                return;
            }
            if (event.key === 'Enter') {
                if (highlightIndex >= 0) {
                    event.preventDefault();
                    const opt = filteredFlat[highlightIndex];
                    if (opt !== undefined) {
                        onSelectOption(opt);
                    }
                }
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
                return;
            }
            if (event.key === 'Tab') {
                setOpen(false);
                return;
            }
        },
        [filteredFlat, highlightIndex, onSelectOption],
    );

    return (
        <div
            ref={containerRef}
            className={cn('relative', triggerWidth === 'full' && 'w-full', className)}
        >
            <button
                id={id}
                type="button"
                role="combobox"
                disabled={disabled}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls={listId}
                aria-required={required}
                aria-label={ariaLabel}
                onClick={() => setOpen((v) => ! v)}
                className={cn(
                    'flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-[13px] text-foreground transition-colors',
                    triggerWidth === 'full' && 'w-full',
                    'hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    open && 'border-border-strong ring-2 ring-ring/30',
                    disabled && 'cursor-not-allowed opacity-60',
                    triggerClassName,
                )}
            >
                {activeOption?.avatar !== undefined ? (
                    <ComboboxAvatarChip
                        avatar={activeOption.avatar}
                        fallbackLabel={activeOption.label}
                    />
                ) : activeOption?.icon !== undefined ? (
                    <activeOption.icon
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        strokeWidth={1.7}
                    />
                ) : null}
                <span
                    className={cn(
                        'flex-1 truncate',
                        activeOption === null || activeOption === undefined
                            ? 'text-muted-foreground'
                            : '',
                    )}
                >
                    {activeOption !== null && activeOption !== undefined
                        ? activeOption.label
                        : placeholder}
                </span>
                <Chevron open={open} />
            </button>

            {open ? (
                <div
                    className={cn(
                        'absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-lg',
                        panelClassName,
                    )}
                >
                    <div className="border-b border-border/60 px-2 py-2">
                        <div className="relative">
                            <SearchIcon />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={onKeyDown}
                                placeholder={searchPlaceholder}
                                className="h-8 w-full rounded-sm border-0 bg-transparent pl-7 pr-2 text-[13px] outline-none placeholder:text-muted-foreground/70"
                                aria-controls={listId}
                                aria-autocomplete="list"
                                aria-activedescendant={
                                    highlightIndex >= 0
                                        ? `${listId}-${highlightIndex}`
                                        : undefined
                                }
                            />
                        </div>
                    </div>

                    <ul
                        id={listId}
                        ref={listRef}
                        role="listbox"
                        className="max-h-72 overflow-y-auto py-1"
                    >
                        {filteredFlat.length === 0 ? (
                            <li className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                                {emptyText}
                            </li>
                        ) : (
                            filteredGroups.map((group, groupIndex) => (
                                <ComboboxGroupRows
                                    key={group.label || `group-${groupIndex}`}
                                    group={group}
                                    flatOptions={filteredFlat}
                                    listId={listId}
                                    highlightIndex={highlightIndex}
                                    activeValue={value ?? null}
                                    LinkComponent={LinkComponent}
                                    onSelect={onSelectOption}
                                    onHover={(idx) => setHighlightIndex(idx)}
                                />
                            ))
                        )}
                    </ul>

                    {footerLink !== undefined ? (
                        <FooterLink
                            label={footerLink.label}
                            href={footerLink.href}
                            LinkComponent={LinkComponent}
                            onAfterClick={() => setOpen(false)}
                        />
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

function ComboboxGroupRows({
    group,
    flatOptions,
    listId,
    highlightIndex,
    activeValue,
    LinkComponent,
    onSelect,
    onHover,
}: {
    group: ComboboxGroup;
    flatOptions: ComboboxOption[];
    listId: string;
    highlightIndex: number;
    activeValue: string | null;
    LinkComponent: LinkComp | undefined;
    onSelect: (opt: ComboboxOption) => void;
    onHover: (idx: number) => void;
}) {
    if (group.options.length === 0) return null;

    return (
        <>
            {group.label !== '' ? (
                <li
                    role="presentation"
                    className="text-mono px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase"
                >
                    {group.label}
                </li>
            ) : null}
            {group.options.map((opt) => {
                const flatIndex = flatOptions.indexOf(opt);
                const isHighlighted = flatIndex === highlightIndex;
                const isActive = opt.value === activeValue;
                const inner = (
                    <div className="flex w-full min-w-0 items-center gap-2.5 px-2.5 py-2">
                        {opt.avatar !== undefined ? (
                            <ComboboxAvatarChip
                                avatar={opt.avatar}
                                fallbackLabel={opt.label}
                            />
                        ) : opt.icon !== undefined ? (
                            <opt.icon
                                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                strokeWidth={1.7}
                            />
                        ) : null}
                        <div className="flex min-w-0 flex-1 flex-col leading-tight">
                            <span className="truncate text-[13px] font-medium text-foreground">
                                {opt.label}
                            </span>
                            {opt.secondary !== undefined ? (
                                <span className="text-mono truncate text-[10px] text-muted-foreground">
                                    {opt.secondary}
                                </span>
                            ) : null}
                        </div>
                        {isActive ? <Check /> : null}
                    </div>
                );

                const className = cn(
                    'group block w-full rounded-sm transition-colors text-left',
                    opt.disabled === true && 'cursor-not-allowed opacity-50',
                    isHighlighted && opt.disabled !== true && 'bg-secondary',
                    isActive && 'bg-accent-soft hover:bg-accent-soft/80',
                );

                if (
                    opt.href !== undefined &&
                    LinkComponent !== undefined
                ) {
                    return (
                        <li
                            key={opt.value}
                            id={`${listId}-${flatIndex}`}
                            role="option"
                            aria-selected={isActive}
                            aria-disabled={opt.disabled === true}
                            onMouseEnter={() => onHover(flatIndex)}
                        >
                            <LinkComponent
                                href={opt.href}
                                prefetch
                                className={className}
                            >
                                {inner}
                            </LinkComponent>
                        </li>
                    );
                }

                return (
                    <li
                        key={opt.value}
                        id={`${listId}-${flatIndex}`}
                        role="option"
                        aria-selected={isActive}
                        aria-disabled={opt.disabled === true}
                        onMouseEnter={() => onHover(flatIndex)}
                    >
                        <button
                            type="button"
                            disabled={opt.disabled === true}
                            onClick={() => onSelect(opt)}
                            className={className}
                        >
                            {inner}
                        </button>
                    </li>
                );
            })}
        </>
    );
}

function FooterLink({
    label,
    href,
    LinkComponent,
    onAfterClick,
}: {
    label: string;
    href: string;
    LinkComponent: LinkComp | undefined;
    onAfterClick: () => void;
}) {
    const className =
        'flex items-center gap-2 border-t border-border/60 px-3 py-2.5 text-[13px] font-medium text-info transition-colors hover:bg-info-soft';

    if (LinkComponent !== undefined) {
        return (
            <LinkComponent
                href={href}
                prefetch
                className={className}
            >
                <Plus />
                <span>{label}</span>
            </LinkComponent>
        );
    }

    return (
        <a
            href={href}
            className={className}
            onClick={onAfterClick}
        >
            <Plus />
            <span>{label}</span>
        </a>
    );
}

function ComboboxAvatarChip({
    avatar,
    fallbackLabel,
}: {
    avatar: ComboboxAvatar;
    fallbackLabel: string;
}) {
    const initials = avatar.initials ?? deriveInitials(fallbackLabel);
    const style =
        avatar.src === undefined && avatar.accent !== undefined
            ? { backgroundColor: avatar.accent, color: '#fff' }
            : undefined;

    if (avatar.src !== undefined) {
        return (
            <img
                src={avatar.src}
                alt=""
                className="h-5 w-5 shrink-0 rounded-sm bg-secondary object-cover"
                loading="lazy"
            />
        );
    }

    return (
        <span
            style={style}
            className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[9px] font-semibold tracking-tight',
                avatar.accent === undefined && 'bg-info-soft text-info',
            )}
        >
            {initials}
        </span>
    );
}

function deriveInitials(label: string): string {
    const parts = label.trim().split(/\s+/);
    if (parts.length >= 2) {
        return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
    }
    return (label.slice(0, 2) || '?').toUpperCase();
}

function normaliseGroups(
    items: ComboboxOption[] | ComboboxGroup[],
): ComboboxGroup[] {
    if (items.length === 0) return [];
    const first = items[0];
    if (first !== undefined && 'options' in first) {
        return items as ComboboxGroup[];
    }
    return [{ label: '', options: items as ComboboxOption[] }];
}

function filterGroups(
    groups: ComboboxGroup[],
    query: string,
): ComboboxGroup[] {
    const q = query.trim().toLowerCase();
    if (q === '') return groups;

    return groups
        .map((group) => ({
            label: group.label,
            options: group.options.filter((opt) => matchesQuery(opt, q)),
        }))
        .filter((group) => group.options.length > 0);
}

function matchesQuery(option: ComboboxOption, q: string): boolean {
    const haystack = [
        option.label,
        option.secondary ?? '',
        ...(option.keywords ?? []),
    ]
        .join(' ')
        .toLowerCase();

    return haystack.includes(q);
}

function nextEnabledIndex(
    options: ComboboxOption[],
    current: number,
    direction: 1 | -1,
): number {
    const total = options.length;
    if (total === 0) return -1;

    let i = current;
    for (let step = 0; step < total; step++) {
        i = (i + direction + total) % total;
        const opt = options[i];
        if (opt !== undefined && opt.disabled !== true) {
            return i;
        }
    }
    return -1;
}

function Chevron({ open }: { open: boolean }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={cn(
                'shrink-0 text-muted-foreground transition-transform duration-150',
                open && 'rotate-180',
            )}
        >
            <path d="m3.5 5.5 3.5 3.5 3.5-3.5" />
        </svg>
    );
}

function Check() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-accent"
            aria-hidden
        >
            <path d="m3 7.5 2.5 2.5L11 4.5" />
        </svg>
    );
}

function Plus() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
            aria-hidden
        >
            <path d="M6 2v8M2 6h8" />
        </svg>
    );
}

function SearchIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
        >
            <circle cx="6" cy="6" r="4.25" />
            <path d="m11.5 11.5-2.5-2.5" />
        </svg>
    );
}
