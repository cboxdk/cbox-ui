import { type ComponentType, type ReactNode, useRef, useState } from 'react';
import { cn } from '../utils/cn';

export type ContextItem = {
    id: string;
    label: string;
    /** Avatar shown next to the label — currently supports initials only. */
    avatar?: { initials: string };
    /** Marks this item as the active selection. */
    current?: boolean;
    /** Optional gear-icon link to a settings page for this item. */
    settingsHref?: string;
    settingsAriaLabel?: string;
};

type CrumbFooterLink = {
    label: string;
    href: string;
};

type Crumb = {
    id: string;
    label: string;
    avatar?: { initials: string };
    /** Dropdown items. When absent, the crumb is non-interactive. */
    items?: ContextItem[];
    /** Called with the selected item's `id` when the user picks one. */
    onSelect?: (id: string) => void;
    /** Optional link at the bottom of the dropdown. */
    footerLink?: CrumbFooterLink;
    ariaLabel?: string;
};

type Props = {
    crumbs: Crumb[];
    /**
     * Link component provided by the host — e.g. Inertia's `Link` or
     * React Router's `Link`. Must accept `href` and `className`.
     */
    LinkComponent?: ComponentType<{ href: string; className?: string; children: ReactNode }>;
    className?: string;
};

/**
 * Horizontal breadcrumb row rendered in the topbar. Each crumb is a
 * labelled chip that opens a dropdown when it has `items`. Slash
 * separators appear between crumbs.
 *
 * Designed for cloud-platform chrome where context = org / project /
 * environment. Start with one crumb (org) and add more as the app grows.
 */
export function ContextBar({ crumbs, LinkComponent, className }: Props) {
    return (
        <nav
            aria-label="Context breadcrumb"
            className={cn('flex items-center gap-1', className)}
        >
            {crumbs.map((crumb, i) => (
                <span key={crumb.id} className="flex items-center gap-1">
                    {i > 0 ? (
                        <span className="text-muted-foreground/50 select-none">/</span>
                    ) : null}
                    <CrumbChip
                        crumb={crumb}
                        LinkComponent={LinkComponent}
                    />
                </span>
            ))}
        </nav>
    );
}

function CrumbChip({
    crumb,
    LinkComponent,
}: {
    crumb: Crumb;
    LinkComponent?: ComponentType<{ href: string; className?: string; children: ReactNode }>;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const hasItems = crumb.items && crumb.items.length > 0;

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={crumb.ariaLabel ?? crumb.label}
                aria-expanded={open}
                aria-haspopup={hasItems ? 'listbox' : undefined}
                className={cn(
                    'flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium transition-colors',
                    'text-foreground hover:bg-secondary',
                    !hasItems && 'cursor-default hover:bg-transparent',
                )}
            >
                {crumb.avatar ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-info text-[9px] font-bold uppercase text-background">
                        {crumb.avatar.initials}
                    </span>
                ) : null}
                <span className="max-w-[160px] truncate">{crumb.label}</span>
                {hasItems ? <Chevron /> : null}
            </button>

            {open && hasItems ? (
                <>
                    {/* Backdrop to close on outside click */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpen(false)}
                        aria-hidden
                    />
                    <div
                        role="listbox"
                        aria-label={crumb.ariaLabel ?? crumb.label}
                        className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover p-1 shadow-md"
                    >
                        <ul className="space-y-0.5">
                            {crumb.items!.map((item) => (
                                <li key={item.id}>
                                    <ItemRow
                                        item={item}
                                        LinkComponent={LinkComponent}
                                        onSelect={() => {
                                            setOpen(false);
                                            crumb.onSelect?.(item.id);
                                        }}
                                    />
                                </li>
                            ))}
                        </ul>

                        {crumb.footerLink ? (
                            <div className="mt-1 border-t border-border pt-1">
                                {LinkComponent ? (
                                    <LinkComponent
                                        href={crumb.footerLink.href}
                                        className="block rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                                    >
                                        {crumb.footerLink.label}
                                    </LinkComponent>
                                ) : (
                                    <a
                                        href={crumb.footerLink.href}
                                        className="block rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                                    >
                                        {crumb.footerLink.label}
                                    </a>
                                )}
                            </div>
                        ) : null}
                    </div>
                </>
            ) : null}
        </div>
    );
}

function ItemRow({
    item,
    LinkComponent,
    onSelect,
}: {
    item: ContextItem;
    LinkComponent?: ComponentType<{ href: string; className?: string; children: ReactNode }>;
    onSelect: () => void;
}) {
    return (
        <div
            className={cn(
                'group flex items-center justify-between gap-2 rounded-sm px-2 py-1.5',
                item.current ? 'bg-accent-soft' : 'hover:bg-secondary',
            )}
        >
            <button
                type="button"
                role="option"
                aria-selected={item.current}
                onClick={onSelect}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
                {item.avatar ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-info-soft text-[9px] font-bold uppercase text-info">
                        {item.avatar.initials}
                    </span>
                ) : null}
                <span className="truncate text-sm text-foreground">{item.label}</span>
                {item.current ? (
                    <CheckIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-info" />
                ) : null}
            </button>

            {item.settingsHref ? (
                <span className="opacity-0 transition-opacity group-hover:opacity-100">
                    {LinkComponent ? (
                        <LinkComponent
                            href={item.settingsHref}
                            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                            aria-label={item.settingsAriaLabel}
                        >
                            <GearIcon />
                        </LinkComponent>
                    ) : (
                        <a
                            href={item.settingsHref}
                            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                            aria-label={item.settingsAriaLabel}
                        >
                            <GearIcon />
                        </a>
                    )}
                </span>
            ) : null}
        </div>
    );
}

function Chevron() {
    return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
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

function CheckIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 12 12"
            fill="none"
            className={className}
            aria-hidden
        >
            <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function GearIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
                d="M6 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
                stroke="currentColor"
                strokeWidth="1.2"
            />
            <path
                d="M9.9 4.65a4.1 4.1 0 0 0-.4-.68l.55-.96-.94-.94-.96.55a4.1 4.1 0 0 0-.68-.4L7.25 1.5h-1.5l-.22 1.22a4.1 4.1 0 0 0-.68.4l-.96-.55-.94.94.55.96a4.1 4.1 0 0 0-.4.68L1.5 5.47v1.06l1.2.2c.1.25.23.49.4.7l-.55.96.94.94.96-.55c.2.17.44.3.68.4l.22 1.22h1.5l.22-1.22c.24-.1.48-.23.68-.4l.96.55.94-.94-.55-.96c.17-.2.3-.44.4-.68L10.5 6.53V5.47l-1.2-.2a4.1 4.1 0 0 0 .4-.68Z"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinejoin="round"
            />
        </svg>
    );
}
