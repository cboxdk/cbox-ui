/**
 * Cross-app surface contract — the API hosts opt into and that
 * cbox-ui's runtime renders. Each `SurfaceId` corresponds to a
 * concrete surface implementation shipped by cbox-ui.
 *
 * Surfaces are intentionally a closed set. Adding a new surface
 * is a cbox-ui PR; hosts can't invent their own. That's the
 * discipline that keeps the chrome from drifting back into per-app
 * land.
 *
 * The criterion for accepting a new surface: "would it be useful
 * in *every* Cbox app?" Inbox yes. Search yes. Help yes. "Webhook
 * delivery details" no — that's a route inside webhooks, not a
 * cross-app overlay.
 */

import type { ReactNode } from 'react';

export type SurfaceId = 'inbox' | 'search' | 'activity' | 'help';

export type SurfaceArgs = {
    inbox: { focusUnread?: boolean };
    search: { initialQuery?: string };
    activity: { scope?: 'user' | 'org' };
    help: { topic?: string };
};

/**
 * Auth + transport plumbing the host injects. cbox-ui's surface
 * implementations call these to reach backend services. The token
 * function is async + cached so the host can implement it via a
 * server-side proxy (cookie-authed) or against an in-memory access
 * token (pure SPA) — both end up callable.
 */
export type Transport = {
    /**
     * Per-service base URLs. Surfaces look these up by service key.
     * A host can leave a key unset to disable surfaces that depend on it.
     */
    urls: Partial<{
        notifications: string;
        search: string;
        audit: string;
        realtime: string;
    }>;

    /**
     * Mint or fetch a fresh bearer token for a given audience.
     * cbox-ui caches the result until `expiresAt` minus a 60-second
     * guard, so the host implementation can be a real HTTP call.
     */
    getToken: (audience: string) => Promise<{
        token: string;
        expiresAt: number; // unix timestamp, seconds
    }>;

    /**
     * Optional CSRF token for host-shaped routes (mark-read
     * forwarders that go through the host's cookie session). Pure
     * SPA hosts can leave this off.
     */
    csrfToken?: () => string;
};

export type SurfaceConfig = Partial<{
    search: {
        placeholder?: string;
        scopes?: string[];
    };
    inbox: {
        // Reserved for future per-host customisation. Empty for now;
        // the inbox renders the same shape everywhere.
    };
}>;

/**
 * Imperative API hosts use to open/close surfaces. Returned from
 * `useCboxSurfaces()`. The runtime guarantees:
 *
 *   - At most one surface open at a time. `open` replaces the
 *     active surface if any.
 *   - `Escape` closes the active surface (modal/drawer dismiss).
 *   - Navigation (Inertia visit, history change) closes the active
 *     surface so users don't land in another section with a stale
 *     overlay still up.
 */
export type SurfaceController = {
    activeSurface: SurfaceId | null;
    open: <K extends SurfaceId>(id: K, args?: SurfaceArgs[K]) => void;
    close: () => void;
};

/**
 * Inbox preview state — surfaced to the bell badge (chrome) even
 * when the inbox surface itself isn't open. The runtime keeps this
 * live by listening to realtime events; chrome reads it to render
 * the unread count without round-tripping the server on every
 * navigation.
 *
 * (Realtime is a follow-up session; the v1 implementation hydrates
 * from the host's CboxIdProvider notifications state and updates
 * only when the inbox surface explicitly mutates.)
 */
export type InboxState = {
    unreadCount: number;
    /** ISO timestamp of last successful fetch. */
    lastFetchedAt: string | null;
};

export type RealtimeStatus =
    | 'idle'
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'unauthorized'
    | 'unsupported';

/**
 * Shape returned from `useCboxRealtime()` — host code rarely needs
 * this directly; surfaces consume it internally. Exposed so chrome
 * components (the bell) can show a connection-state indicator if
 * desired.
 */
export type RealtimeState = {
    status: RealtimeStatus;
};

export type CboxSurfacesProps = {
    transport: Transport;
    surfaces: SurfaceId[];
    config?: SurfaceConfig;
    /** Host renders this. cbox-ui mounts the surface runtime + any
     *  active overlay alongside. */
    children?: ReactNode;
};
