import {
    createContext,
    useContext,
    type ReactNode,
} from 'react';

/**
 * Identity contract every Cbox-family app must populate.
 *
 * Shape mirrors what the future `@cboxdk/cbox-id-client` SDK returns
 * from id's `/api/v1/me` endpoint plus a small set of platform-level
 * URLs that each app needs to construct deep-links into id.
 *
 * In the id app itself, populate this from Inertia shared props
 * (id IS the source of truth — no API call needed).
 *
 * In cortex / atlas / track / future apps, populate from the
 * id-client SDK — typically once per session, then refreshed when
 * the user switches org or updates their profile.
 *
 * Components in this package read from the context but never write —
 * mutations always round-trip through id's API via the id-client.
 */

export type CboxAppKey = string;

export type CboxUser = {
    id: number;
    name: string;
    email: string;
    avatar_url?: string | null;
    /** ISO 639-1 (e.g. "en", "da"). Used by formatters that want a locale. */
    locale?: string | null;
    /** IANA tz identifier (e.g. "Europe/Copenhagen"). */
    timezone?: string | null;
};

export type CboxOrganization = {
    id: number;
    slug: string;
    name: string;
    /**
     * Role of the current user within this org as resolved by id.
     * Apps should honour this for permission gating in the chrome
     * (eg "Manage team" link is hidden for members).
     */
    role?: 'owner' | 'admin' | 'member' | string;
};

export type CboxAppLink = {
    /** Stable key — e.g. "id", "cortex", "atlas", "track". */
    key: CboxAppKey;
    /** Display name as shown in the launcher. */
    name: string;
    /** Absolute URL the launcher tile links to. */
    url: string;
    /**
     * Short tagline shown under the name. Keep to ~5–8 words —
     * the launcher truncates after one line.
     */
    description?: string;
    /**
     * One-letter monogram fallback when no icon is provided.
     * Defaults to the first letter of `name`.
     */
    monogram?: string;
    /** Optional inline SVG path or URL for the launcher tile icon. */
    iconUrl?: string;
    /**
     * Accent colour for the monogram tile (and current-app highlight).
     * Hex string or any CSS colour the browser accepts. Falls back to
     * the neutral chip when missing.
     */
    accentColor?: string;
    /** Tag the user's currently-active app so the launcher highlights it. */
    current?: boolean;
    /**
     * Whether the current org has access to this app. Defaults to
     * `true` so existing payloads render unchanged. `false` renders
     * the tile as locked: greyed out, no nav, and (if the host app
     * passes `onLockedAppClick`) opens an upgrade affordance.
     */
    entitled?: boolean;
    /**
     * Mark the app as not-yet-released. Renders as a disabled tile
     * with a "soon" badge — distinct from `entitled: false` which
     * implies "available, but not in your plan".
     */
    comingSoon?: boolean;
};

export type CboxNotificationPreviewItem = {
    id: string;
    title: string;
    body?: string | null;
    severity: 'info' | 'warning' | 'critical';
    /** ISO-8601 timestamp from the notifications service. */
    createdAt: string;
    /** Null when the user hasn't opened the notification yet. */
    readAt?: string | null;
    /** Optional deep-link — typically into the app that originated
     *  the notification (id/billing/invoice/123, webhooks/deliveries/x).
     *  Null when the notification is informational with no follow-up. */
    ctaUrl?: string | null;
    ctaLabel?: string | null;
};

export type CboxNotificationsState = {
    unreadCount: number;
    /**
     * "See all" target — typically the central notifications service
     * inbox (notifications.cbox.systems/inbox). The bell's POPOVER
     * shows the preview items inline; only this URL navigates the
     * user out of the current app.
     */
    inboxUrl: string;
    /**
     * Last 5 items (mixed read/unread) for the bell-popover preview.
     * Empty when the host hasn't fetched a preview yet — the bell
     * still renders the badge from `unreadCount`. Falsy on
     * pre-auth pages where the chrome shouldn't render the bell at all.
     */
    previewItems?: CboxNotificationPreviewItem[];
    /**
     * Endpoint pattern for marking a single notification read. The
     * popover POSTs to `markReadUrl.replace('{id}', notification.id)`
     * — a host-local route that forwards to the service via M2M.
     */
    markReadUrl?: string;
};

export type CboxIdContextValue = {
    user: CboxUser;
    /**
     * Org the current app context is scoped to. Null on user-only
     * surfaces (eg the id account-settings landing page).
     */
    currentOrganization: CboxOrganization | null;
    /**
     * All orgs the user belongs to — feeds the org switcher.
     * Should be small (≤ a few dozen). For users in many orgs,
     * the switcher swaps in a search field.
     */
    organizations: CboxOrganization[];
    /**
     * Sister apps in the Cbox family the user can launch into.
     * Static-ish — doesn't need to refresh per request.
     */
    apps: CboxAppLink[];
    /**
     * Deep-links into id used by chrome controls. Each app
     * constructs these via the id-client SDK; the package
     * doesn't hardcode URLs because id may live on different
     * hosts in dev / staging / prod.
     */
    urls: {
        /** Base of the id app — for the "manage account" link. */
        idBaseUrl: string;
        /** Absolute URL of the user's id profile page. */
        accountUrl: string;
        /** Absolute URL of the current org's settings page in id. */
        orgSettingsUrl: string | null;
        /** POST endpoint that signs the user out. */
        signOutUrl: string;
        /**
         * POST endpoint in id that switches the user's active org.
         * Used by OrgSwitcher as a fallback when `onSwitchOrganization`
         * is not provided — covers apps that can't do a pure URL swap.
         */
        switchOrgUrl?: string;
    };
    /**
     * Notification feed state, or null/undefined when the user has no
     * inbox configured. id's wire shape sets `null` explicitly; the
     * type accepts both shapes so apps can pass the payload straight
     * through without a null→undefined adapter.
     */
    notifications?: CboxNotificationsState | null;
    /**
     * True when the host app's cached payload is known to be out of
     * date — id has emitted a domain event (membership/role/sub
     * change) since the cache was populated. Apps should refetch
     * via the SDK before rendering anything that depends on the
     * cached membership / entitlement state. Soft-TTL covers the
     * case where the event was missed.
     *
     * Default: false (treated as fresh).
     */
    stale?: boolean;
    /**
     * Called when the user picks a different org from the switcher.
     * Apps own this — typically a same-app URL navigation that
     * swaps the slug in the current path (`/org/{slug}/...`). The
     * server validates membership at the destination via
     * EnsureOrganizationMembership, so this is a pure URL change with
     * no mutable state to update.
     */
    onSwitchOrganization?: (org: CboxOrganization) => void;
};

const CboxIdContext = createContext<CboxIdContextValue | null>(null);

export function CboxIdProvider({
    value,
    children,
}: {
    value: CboxIdContextValue;
    children: ReactNode;
}) {
    return <CboxIdContext.Provider value={value}>{children}</CboxIdContext.Provider>;
}

export function useCboxId(): CboxIdContextValue {
    const ctx = useContext(CboxIdContext);
    if (ctx === null) {
        throw new Error(
            '@cboxdk/cbox-ui: useCboxId() must be called inside <CboxIdProvider>. ' +
                'Wrap your app root and populate it from the id-client SDK (or, ' +
                'in id itself, from Inertia shared props).',
        );
    }
    return ctx;
}

/**
 * Soft variant — returns null instead of throwing. Useful for
 * components that gracefully degrade on auth-pre pages.
 */
export function useCboxIdOptional(): CboxIdContextValue | null {
    return useContext(CboxIdContext);
}
