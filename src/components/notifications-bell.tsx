import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCboxIdOptional } from '../context/cbox-id';
import type { CboxNotificationPreviewItem } from '../context/cbox-id';
import { useCboxSurfacesOptional } from '../surfaces/surface-state';
import { cn } from '../utils/cn';

/**
 * Bell with unread-count badge + popover preview. Click opens a
 * dropdown with the last 5 items inline (no navigation), each with
 * an inline mark-read action and an optional deep-link to the page
 * that originated the notification. "See all" at the bottom links
 * to the central notifications service inbox — the only navigation
 * away from the host app.
 *
 * Pattern matches Linear / GitHub / Stripe: glance + mark-read
 * without leaving context; cross-app jump only when the user
 * explicitly wants the full list.
 *
 * Renders nothing if the context is missing or notifications
 * aren't configured (eg pre-auth pages).
 */
export function NotificationsBell({ className }: { className?: string }) {
    const ctx = useCboxIdOptional();
    const surfaces = useCboxSurfacesOptional();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            const target = e.target;
            if (
                target instanceof Node &&
                ref.current !== null &&
                !ref.current.contains(target)
            ) {
                setOpen(false);
            }
        };
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onEsc);
        };
    }, [open]);

    if (
        ctx === null ||
        ctx.notifications === undefined ||
        ctx.notifications === null
    ) {
        return null;
    }

    const { unreadCount, inboxUrl, previewItems, markReadUrl } =
        ctx.notifications;
    const display = unreadCount > 99 ? '99+' : unreadCount.toString();

    return (
        <div ref={ref} className={cn('relative', className)}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={
                    unreadCount > 0
                        ? `${unreadCount} unread notifications`
                        : 'Notifications'
                }
                aria-expanded={open}
                aria-haspopup="menu"
                className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[open=true]:bg-secondary data-[open=true]:text-foreground"
                data-open={open ? 'true' : 'false'}
            >
                <Bell />
                {unreadCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-4 text-destructive-foreground">
                        {display}
                    </span>
                ) : null}
            </button>

            {open ? (
                <div
                    role="menu"
                    className="absolute right-0 z-30 mt-2 w-[360px] origin-top-right rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
                >
                    <header className="flex items-center justify-between border-b border-border/70 px-3 py-2">
                        <span className="text-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                            Notifications
                        </span>
                        {unreadCount > 0 ? (
                            <span className="text-mono text-[10px] tabular-nums text-muted-foreground">
                                {unreadCount} unread
                            </span>
                        ) : null}
                    </header>

                    <div className="max-h-[420px] overflow-y-auto">
                        {previewItems === undefined ||
                        previewItems.length === 0 ? (
                            <div className="px-3 py-8 text-center">
                                <p className="text-sm font-medium text-foreground">
                                    All caught up
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    No recent notifications.
                                </p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-border/70">
                                {previewItems.map((item) => (
                                    <PreviewRow
                                        key={item.id}
                                        item={item}
                                        markReadUrl={markReadUrl}
                                        onMarkedRead={() => setOpen(false)}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>

                    {surfaces !== null ? (
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                surfaces.open('inbox');
                            }}
                            className="flex w-full items-center justify-center border-t border-border/70 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                        >
                            See all notifications →
                        </button>
                    ) : (
                        <a
                            href={inboxUrl}
                            className="flex items-center justify-center border-t border-border/70 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                        >
                            See all notifications →
                        </a>
                    )}
                </div>
            ) : null}
        </div>
    );
}

function PreviewRow({
    item,
    markReadUrl,
    onMarkedRead,
}: {
    item: CboxNotificationPreviewItem;
    markReadUrl?: string;
    onMarkedRead: () => void;
}) {
    const tone =
        item.severity === 'critical'
            ? 'bg-destructive'
            : item.severity === 'warning'
            ? 'bg-warning'
            : 'bg-info';

    const ts = (() => {
        try {
            return new Date(item.createdAt).toLocaleString();
        } catch {
            return item.createdAt;
        }
    })();

    const markRead = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (markReadUrl === undefined || markReadUrl === '') return;
        const url = markReadUrl.replace('{id}', item.id);
        const csrf =
            document
                .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
                ?.content ?? '';
        try {
            await fetch(url, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrf,
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });
        } catch {
            // Non-fatal — the user can re-open the dropdown.
        }
        onMarkedRead();
    };

    const Wrapper = ({ children }: { children: ReactNode }) =>
        item.ctaUrl !== null && item.ctaUrl !== undefined && item.ctaUrl !== ''
            ? (
                <a
                    href={item.ctaUrl}
                    className="block transition-colors hover:bg-secondary/50"
                >
                    {children}
                </a>
            )
            : <div>{children}</div>;

    return (
        <li className={item.readAt === null ? 'bg-secondary/20' : ''}>
            <Wrapper>
                <div className="flex items-start gap-2 px-3 py-2.5">
                    <span
                        aria-hidden
                        className={cn(
                            'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                            tone,
                        )}
                    />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">
                            {item.title}
                        </p>
                        {item.body !== undefined && item.body !== null && item.body !== '' ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                {item.body}
                            </p>
                        ) : null}
                        <p className="text-mono mt-1 text-[10px] text-muted-foreground">
                            {ts}
                        </p>
                    </div>
                    {item.readAt === null ? (
                        <button
                            type="button"
                            onClick={markRead}
                            className="shrink-0 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            aria-label="Mark as read"
                            title="Mark as read"
                        >
                            ✓
                        </button>
                    ) : null}
                </div>
            </Wrapper>
        </li>
    );
}

function Bell(): ReactNode {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
        >
            <path
                d="M4 6.5a4 4 0 1 1 8 0v2.4l1.2 2H2.8l1.2-2V6.5z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
            />
            <path
                d="M6.5 12.5a1.5 1.5 0 0 0 3 0"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
            />
        </svg>
    );
}
