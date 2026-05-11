import { useEffect, useState } from 'react';
import { useCboxIdOptional } from '../context/cbox-id';
import { EmptyState } from '../primitives/empty-state';
import { StatusPill } from '../primitives/status-pill';
import { useTransport } from './surface-state';
import { SurfaceModal } from './surface-modal';
import type { Transport } from './types';

type InboxItem = {
    id: string;
    event_type: string;
    severity: 'info' | 'warning' | 'critical';
    data: Record<string, unknown> | null;
    subject_type: string | null;
    subject_id: string | null;
    created_at: string;
    read_at: string | null;
};

type Inbox = {
    recipient: { external_id: string; display_name: string | null } | null;
    items: InboxItem[];
    unread_count: number;
};

type Props = {
    open: boolean;
    onClose: () => void;
};

const TONES: Record<
    InboxItem['severity'],
    'info' | 'warning' | 'destructive'
> = {
    info: 'info',
    warning: 'warning',
    critical: 'destructive',
};

/**
 * Full inbox modal — opened from the bell popover's "See all"
 * affordance. Renders inline over the host page so the user
 * never leaves their app context to read or manage notifications.
 *
 * Data flows:
 *   - Initial load: GET /api/v1/recipients/{id_user_id}/inbox via
 *     transport.getToken('notifications')
 *   - Mark-read: POST /api/v1/recipients/{id}/notifications/{nid}/read
 *     (optimistic; reverts on failure)
 *   - Realtime hooks land in a follow-up session
 *     (notifications.user.{id}.created topic)
 */
export function InboxSurface({ open, onClose }: Props) {
    const transport = useTransport();
    const cboxId = useCboxIdOptional();
    const [inbox, setInbox] = useState<Inbox | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const userId = cboxId?.user.id ?? null;
    const baseUrl = transport.urls.notifications ?? null;

    useEffect(() => {
        if (!open || userId === null || baseUrl === null) return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const headers = await authHeaders(transport, 'notifications');
                const response = await fetch(
                    `${baseUrl}/api/v1/recipients/${userId}/inbox?limit=100`,
                    { headers, credentials: 'include' },
                );
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const body = (await response.json()) as Inbox;
                if (!cancelled) setInbox(body);
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Load failed');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [open, userId, baseUrl, transport]);

    const markRead = async (id: string) => {
        if (inbox === null || userId === null || baseUrl === null) return;
        // Optimistic
        const prev = inbox;
        setInbox({
            ...inbox,
            items: inbox.items.map((it) =>
                it.id === id
                    ? { ...it, read_at: new Date().toISOString() }
                    : it,
            ),
            unread_count: Math.max(0, inbox.unread_count - 1),
        });
        try {
            const headers = await authHeaders(transport, 'notifications');
            const csrf = transport.csrfToken?.();
            if (csrf !== undefined && csrf !== '') {
                headers['X-CSRF-TOKEN'] = csrf;
                headers['X-Requested-With'] = 'XMLHttpRequest';
            }
            const response = await fetch(
                `${baseUrl}/api/v1/recipients/${userId}/notifications/${id}/read`,
                {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                },
            );
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch {
            setInbox(prev);
        }
    };

    const items = inbox?.items ?? [];
    const filtered =
        filter === 'unread' ? items.filter((i) => i.read_at === null) : items;

    const unread = inbox?.unread_count ?? 0;

    return (
        <SurfaceModal
            open={open}
            onClose={onClose}
            eyebrow="Notifications"
            title={
                unread > 0 ? `Inbox · ${unread} unread` : 'Inbox · all caught up'
            }
            headerActions={
                <div className="flex items-center gap-2">
                    <FilterTab
                        active={filter === 'all'}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </FilterTab>
                    <FilterTab
                        active={filter === 'unread'}
                        onClick={() => setFilter('unread')}
                    >
                        Unread
                    </FilterTab>
                </div>
            }
            footer={
                inbox !== null && baseUrl !== null ? (
                    <>
                        <span>
                            Showing {filtered.length} of {items.length}.
                        </span>
                        <a
                            href={`${baseUrl}/inbox`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-foreground hover:underline"
                        >
                            Open in new tab ↗
                        </a>
                    </>
                ) : (
                    <span>—</span>
                )
            }
        >
            {error !== null ? (
                <div className="px-5 py-8 text-center">
                    <p className="text-sm font-medium text-destructive">
                        Couldn't load inbox
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {error}
                    </p>
                </div>
            ) : loading && inbox === null ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                    Loading…
                </div>
            ) : filtered.length === 0 ? (
                <div className="px-5 py-12">
                    <EmptyState
                        title={
                            filter === 'unread'
                                ? 'No unread notifications'
                                : 'No notifications yet'
                        }
                        description="When a Cbox app sends you something — invitation accepted, billing event, security alert — it lands here."
                    />
                </div>
            ) : (
                <ul className="divide-y divide-border/70">
                    {filtered.map((item) => {
                        const data = (item.data ?? {}) as Record<
                            string,
                            string | undefined
                        >;
                        const ctaUrl = data.cta_url;
                        const InnerWrapper = ({
                            children,
                        }: {
                            children: React.ReactNode;
                        }) =>
                            ctaUrl !== undefined && ctaUrl !== '' ? (
                                <a
                                    href={ctaUrl}
                                    className="block transition-colors hover:bg-secondary/40"
                                >
                                    {children}
                                </a>
                            ) : (
                                <div>{children}</div>
                            );

                        return (
                            <li
                                key={item.id}
                                className={
                                    item.read_at === null
                                        ? 'bg-secondary/20'
                                        : ''
                                }
                            >
                                <InnerWrapper>
                                    <div className="flex items-start gap-3 px-5 py-3">
                                        <StatusPill
                                            tone={TONES[item.severity]}
                                            dot
                                        >
                                            {item.severity}
                                        </StatusPill>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-foreground">
                                                {data.title ??
                                                    item.event_type}
                                            </p>
                                            {(data.body ?? '') !== '' ? (
                                                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                                    {data.body}
                                                </p>
                                            ) : null}
                                            <p className="text-mono mt-1 text-[10px] text-muted-foreground">
                                                {item.event_type}
                                                {' · '}
                                                {new Date(
                                                    item.created_at,
                                                ).toLocaleString()}
                                            </p>
                                        </div>
                                        {item.read_at === null ? (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    void markRead(item.id);
                                                }}
                                                className="shrink-0 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-border-strong"
                                                aria-label="Mark as read"
                                            >
                                                Mark read
                                            </button>
                                        ) : null}
                                    </div>
                                </InnerWrapper>
                            </li>
                        );
                    })}
                </ul>
            )}
        </SurfaceModal>
    );
}

/**
 * Build request headers for a transport call. If the host's
 * `getToken` returns a non-empty bearer, it's attached. If it
 * returns an empty string, the surface assumes same-origin cookie
 * auth — the host is proxying the request through its own session.
 *
 * Either model is supported because hosts pick their security
 * trade-off: same-origin proxy keeps M2M tokens server-side; direct
 * CORS to notifications.cbox.systems is faster but exposes the
 * audience-bound bearer to the page.
 */
async function authHeaders(
    transport: Transport,
    audience: string,
): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };
    try {
        const { token } = await transport.getToken(audience);
        if (token !== '') {
            headers.Authorization = `Bearer ${token}`;
        }
    } catch {
        // Empty token / failure → fall back to cookie auth.
    }
    return headers;
}

function FilterTab({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                active
                    ? 'rounded-md bg-secondary px-2 py-1 text-xs font-medium text-foreground'
                    : 'rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
            }
            aria-pressed={active}
        >
            {children}
        </button>
    );
}
