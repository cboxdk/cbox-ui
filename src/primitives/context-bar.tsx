import {
    useEffect,
    useId,
    useRef,
    useState,
    type ComponentType,
    type ReactNode,
} from 'react';
import { cn } from '../utils/cn';

/**
 * ContextBar — the topbar breadcrumb-style context selector. One
 * crumb per level of context (org / project / environment / branch /
 * deployment). Each crumb renders as a chip (avatar + label +
 * chevron) and opens a dropdown with the items at that level plus
 * an optional "+ New X" footer.
 *
 * The pattern is the cloud-platform default — Vercel, Render, Forge,
 * GitHub, Stripe, Cortex all use it. Topbar carries identity and
 * context; sidebar carries navigation. The two never overlap.
 *
 * URL-driven by default — clicking a dropdown item navigates via the
 * supplied `LinkComponent`. Apps that need a non-navigational select
 * (post a form, mutate session state) pass `onSelect` instead.
 *
 * Separator between crumbs is a muted slash — same as Forge / Cortex.
 */

export type ContextAvatar = {
    /** 1–2 character monogram. Defaults to first letter of the label. */
    initials?: string;
    /**
     * Hex / CSS colour applied as the avatar's bg. Falls back to the
     * neutral chip when missing. Per-item override of the default.
     */
    accent?: string;
    /** Optional avatar image URL — overrides initials when set. */
    src?: string;
};

export type ContextItem = {
    /** Stable identity for the item (slug, id). */
    id: string;
    /** Primary display label. */
    label: string;
    /** Optional secondary line — slug, role, env name. Mono-tracked. */
    secondary?: string;
    /** Avatar specification. Same shape as the crumb's own avatar. */
    avatar?: ContextAvatar;
    /** Navigation target — clicking the item navigates here. */
    href?: string;
    /** Mark the item as the active selection (gets a check on the right). */
    current?: boolean;
    /**
     * Optional href to a settings page for this item. When set, a
     * cogwheel button appears on the right of the row on hover/focus
     * — clicking it navigates straight to settings without going
     * through the item's normal selection. Cortex-style shortcut.
     */
    settingsHref?: string;
    /**
     * Aria-label for the optional settings cogwheel. Defaults to
     * `Settings for <label>`. Override when the label alone isn't
     * enough context (eg multiple items with the same name).
     */
    settingsAriaLabel?: string;
};

export type ContextCrumb = {
    /** Stable identity for the crumb (used as React key). */
    id: string;
    /** The chip's visible label — typically the active item's name. */
    label: string;
    /** The chip's avatar — typically the active item's avatar. */
    avatar?: ContextAvatar;
    /** Items shown in the dropdown. Empty array = chip with no menu. */
    items: ContextItem[];
    /**
     * Optional footer link below the items — typically "+ New X" or
     * "Manage Y". Renders with a + icon and an accent text colour.
     */
    footerLink?: {
        label: string;
        href: string;
    };
    /**
     * Override per-item navigation. When set, item clicks call this
     * with the item's id instead of navigating to `item.href`. Useful
     * for posting a form (eg an org switcher that POSTs to a server-side
     * endpoint).
     */
    onSelect?: (itemId: string) => void;
    /** Optional aria-label for the chip's button (defaults to "Switch <label>"). */
    ariaLabel?: string;
};

type LinkComp = ComponentType<{
    href: string;
    prefetch?: boolean;
    className?: string;
    children: ReactNode;
}>;

type Props = {
    crumbs: ContextCrumb[];
    /**
     * The framework's link component. Inertia consumers pass the
     * Inertia Link; TanStack Router consumers pass their typed Link.
     * Plain `<a>` is the fallback.
     */
    LinkComponent?: LinkComp;
    className?: string;
};

const DefaultLink: LinkComp = ({ href, className, children }) => (
    <a href={href} className={className}>
        {children}
    </a>
);

export function ContextBar({
    crumbs,
    LinkComponent = DefaultLink,
    className,
}: Props) {
    if (crumbs.length === 0) {
        return null;
    }

    return (
        <nav
            data-component="context-bar"
            aria-label="Context"
            // No `overflow-x-auto` on the nav — it would clip the
            // dropdown panel that opens below each chip. If we need
            // horizontal scroll for 5+ crumbs later (cortex with
            // org/project/env/branch/region), the dropdown moves to a
            // portal so the nav can clip without affecting popovers.
            className={cn('flex min-w-0 items-center gap-1', className)}
        >
            {crumbs.map((crumb, index) => (
                <div
                    key={crumb.id}
                    className="flex min-w-0 items-center gap-1"
                >
                    {index > 0 ? <Separator /> : null}
                    <ContextCrumbChip
                        crumb={crumb}
                        LinkComponent={LinkComponent}
                    />
                </div>
            ))}
        </nav>
    );
}

function Separator() {
    return (
        <span
            aria-hidden
            className="text-mono shrink-0 text-[14px] font-light text-muted-foreground/50 select-none"
        >
            /
        </span>
    );
}

function ContextCrumbChip({
    crumb,
    LinkComponent,
}: {
    crumb: ContextCrumb;
    LinkComponent: LinkComp;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);
    const listId = useId();

    // Click-outside + Escape close.
    useEffect(() => {
        if (! open) return;

        function onPointerDown(event: PointerEvent): void {
            if (
                ref.current !== null &&
                ! ref.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        }

        function onKey(event: KeyboardEvent): void {
            if (event.key === 'Escape') setOpen(false);
        }

        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const hasMenu = crumb.items.length > 0 || crumb.footerLink !== undefined;

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => ! v)}
                aria-expanded={hasMenu ? open : undefined}
                aria-haspopup={hasMenu ? 'listbox' : undefined}
                aria-controls={hasMenu ? listId : undefined}
                aria-label={crumb.ariaLabel ?? `Switch ${crumb.label}`}
                disabled={! hasMenu}
                className={cn(
                    'flex h-8 min-w-0 items-center gap-2 rounded-md border border-transparent px-2 text-[13px] text-foreground transition-colors',
                    hasMenu &&
                        'hover:border-border hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    open && 'border-border bg-secondary/60',
                )}
            >
                {crumb.avatar !== undefined ? (
                    <ContextAvatarChip
                        avatar={crumb.avatar}
                        fallbackLabel={crumb.label}
                        size="sm"
                    />
                ) : null}
                <span className="truncate font-medium">{crumb.label}</span>
                {hasMenu ? <Chevron open={open} /> : null}
            </button>

            {open && hasMenu ? (
                <div
                    id={listId}
                    role="listbox"
                    aria-label={crumb.ariaLabel ?? crumb.label}
                    className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-md border border-border bg-popover shadow-lg"
                >
                    {crumb.items.length > 0 ? (
                        <ul className="max-h-72 overflow-y-auto py-1">
                            {crumb.items.map((item) => (
                                <ContextItemRow
                                    key={item.id}
                                    item={item}
                                    onSelect={crumb.onSelect}
                                    LinkComponent={LinkComponent}
                                    onAfterClick={() => setOpen(false)}
                                />
                            ))}
                        </ul>
                    ) : null}

                    {crumb.footerLink !== undefined ? (
                        <>
                            {crumb.items.length > 0 ? (
                                <div className="border-t border-border/60" />
                            ) : null}
                            <div
                                // Close the dropdown when the footer
                                // link is clicked. SPA navigations
                                // don't unmount this menu (it's a
                                // sibling subtree), so without this
                                // the dropdown stays open on the next
                                // page.
                                onClickCapture={() => setOpen(false)}
                            >
                                <LinkComponent
                                    href={crumb.footerLink.href}
                                    prefetch
                                    className="flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-info transition-colors hover:bg-info-soft"
                                >
                                    <Plus />
                                    <span>{crumb.footerLink.label}</span>
                                </LinkComponent>
                            </div>
                        </>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

function ContextItemRow({
    item,
    onSelect,
    LinkComponent,
    onAfterClick,
}: {
    item: ContextItem;
    onSelect: ContextCrumb['onSelect'];
    LinkComponent: LinkComp;
    onAfterClick: () => void;
}) {
    const body = (
        <div className="flex w-full min-w-0 items-center gap-2.5 px-2.5 py-2">
            {item.avatar !== undefined ? (
                <ContextAvatarChip
                    avatar={item.avatar}
                    fallbackLabel={item.label}
                    size="md"
                />
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[13px] font-medium text-foreground">
                    {item.label}
                </span>
                {item.secondary !== undefined ? (
                    <span className="text-mono truncate text-[10px] text-muted-foreground">
                        {item.secondary}
                    </span>
                ) : null}
            </div>
            {item.current === true && item.settingsHref === undefined ? (
                <Check />
            ) : null}
        </div>
    );

    const baseClassName = cn(
        'group/item block w-full rounded-sm transition-colors',
        item.current === true
            ? 'bg-accent-soft hover:bg-accent-soft/80'
            : 'hover:bg-secondary',
    );

    // The settings cogwheel sits at the right of the row. It's a
    // separate Link / button — clicking it should NOT trigger the
    // item's main selection. We render it as a sibling of the body
    // and stop click propagation on the cogwheel itself.
    const settingsCog =
        item.settingsHref !== undefined ? (
            <LinkComponent
                href={item.settingsHref}
                prefetch
                className="invisible absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors group-hover/item:visible hover:bg-card hover:text-foreground focus-visible:visible focus-visible:bg-card focus-visible:text-foreground focus-visible:outline-none"
            >
                <span
                    aria-label={
                        item.settingsAriaLabel ?? `Settings for ${item.label}`
                    }
                    onClickCapture={(event) => {
                        event.stopPropagation();
                        onAfterClick();
                    }}
                    className="contents"
                >
                    <SettingsIcon />
                </span>
            </LinkComponent>
        ) : null;

    if (onSelect !== undefined) {
        return (
            <li className="relative">
                <button
                    type="button"
                    onClick={() => {
                        onSelect(item.id);
                        onAfterClick();
                    }}
                    className={cn(baseClassName, 'text-left')}
                >
                    {body}
                </button>
                {settingsCog}
            </li>
        );
    }

    if (item.href !== undefined) {
        return (
            <li className="relative">
                <LinkComponent
                    href={item.href}
                    prefetch
                    className={baseClassName}
                >
                    {body}
                </LinkComponent>
                {settingsCog}
            </li>
        );
    }

    return (
        <li className="relative">
            <div className={baseClassName}>{body}</div>
            {settingsCog}
        </li>
    );
}

function SettingsIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <circle cx="7" cy="7" r="2" />
            <path d="M11.66 8.42a.79.79 0 0 0 .16.86l.03.03a.96.96 0 1 1-1.36 1.36l-.03-.03a.79.79 0 0 0-.86-.16.79.79 0 0 0-.48.72v.08a.96.96 0 1 1-1.92 0v-.04a.79.79 0 0 0-.52-.72.79.79 0 0 0-.86.16l-.03.03a.96.96 0 1 1-1.36-1.36l.03-.03a.79.79 0 0 0 .16-.86.79.79 0 0 0-.72-.48h-.08a.96.96 0 1 1 0-1.92h.04a.79.79 0 0 0 .72-.52.79.79 0 0 0-.16-.86l-.03-.03a.96.96 0 1 1 1.36-1.36l.03.03a.79.79 0 0 0 .86.16h.04a.79.79 0 0 0 .48-.72v-.08a.96.96 0 1 1 1.92 0v.04a.79.79 0 0 0 .48.72.79.79 0 0 0 .86-.16l.03-.03a.96.96 0 1 1 1.36 1.36l-.03.03a.79.79 0 0 0-.16.86v.04a.79.79 0 0 0 .72.48h.08a.96.96 0 1 1 0 1.92h-.04a.79.79 0 0 0-.72.48Z" />
        </svg>
    );
}

export function ContextAvatarChip({
    avatar,
    fallbackLabel,
    size = 'md',
}: {
    avatar: ContextAvatar;
    fallbackLabel: string;
    size?: 'sm' | 'md';
}) {
    const initials =
        avatar.initials ?? deriveInitials(fallbackLabel);
    const sizeClass =
        size === 'sm' ? 'h-5 w-5 text-[9px]' : 'h-7 w-7 text-[11px]';
    const style =
        avatar.src === undefined && avatar.accent !== undefined
            ? {
                  backgroundColor: avatar.accent,
                  color: '#fff',
              }
            : undefined;

    if (avatar.src !== undefined) {
        return (
            <img
                src={avatar.src}
                alt=""
                className={cn(
                    'shrink-0 rounded-sm bg-secondary object-cover',
                    sizeClass,
                )}
                loading="lazy"
            />
        );
    }

    return (
        <span
            style={style}
            className={cn(
                'flex shrink-0 items-center justify-center rounded-sm font-semibold tracking-tight',
                avatar.accent === undefined && 'bg-info-soft text-info',
                sizeClass,
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

function Chevron({ open }: { open: boolean }) {
    return (
        <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
                'shrink-0 text-muted-foreground transition-transform duration-150',
                open && 'rotate-180',
            )}
            aria-hidden
        >
            <path d="m2.5 4 2.5 2.5L7.5 4" />
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
