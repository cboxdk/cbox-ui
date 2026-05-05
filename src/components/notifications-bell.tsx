import type { ReactNode } from 'react';
import { useCboxIdOptional } from '../context/cbox-id';
import { cn } from '../utils/cn';

/**
 * Bell icon with unread-count badge. Links to id's unified inbox —
 * one notification feed across every Cbox-family app.
 *
 * Renders nothing if the context is missing or notifications aren't
 * configured (eg auth-pre pages).
 */
export function NotificationsBell({ className }: { className?: string }) {
    const ctx = useCboxIdOptional();
    if (ctx === null || ctx.notifications === undefined) {
        return null;
    }

    const { unreadCount, inboxUrl } = ctx.notifications;
    const display = unreadCount > 99 ? '99+' : unreadCount.toString();

    return (
        <a
            href={inboxUrl}
            aria-label={
                unreadCount > 0
                    ? `${unreadCount} unread notifications`
                    : 'Notifications'
            }
            className={cn(
                'relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground',
                className,
            )}
        >
            <Bell />
            {unreadCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-4 text-destructive-foreground">
                    {display}
                </span>
            ) : null}
        </a>
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
