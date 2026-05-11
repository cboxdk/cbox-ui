import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { InboxSurface } from './inbox-surface';
import type {
    CboxSurfacesProps,
    SurfaceArgs,
    SurfaceController,
    SurfaceId,
    Transport,
} from './types';

const TransportContext = createContext<Transport | null>(null);
const SurfaceContext = createContext<SurfaceController | null>(null);

/**
 * Mount the cbox-ui surface runtime once per app, alongside the
 * page tree. The host's chrome (bell, search trigger) reads
 * `useCboxSurfaces()` to open surfaces; cbox-ui renders the
 * active one as a modal/drawer over the page.
 *
 * Exactly one CboxSurfaces should be in the tree — typically right
 * inside CboxAppShell. Multiple instances would race their state
 * machines.
 */
export function CboxSurfaces({
    transport,
    surfaces,
    config,
    children,
}: CboxSurfacesProps) {
    void config; // reserved for per-surface customisation; unused in v1
    const enabled = useMemo(() => new Set(surfaces), [surfaces]);
    const [active, setActive] = useState<{
        id: SurfaceId;
        args?: SurfaceArgs[SurfaceId];
    } | null>(null);

    const open = useCallback(
        <K extends SurfaceId>(id: K, args?: SurfaceArgs[K]) => {
            if (!enabled.has(id)) {
                console.warn(
                    `[cbox-ui] surface "${id}" is not enabled in this host. Add it to <CboxSurfaces surfaces={[…]}>.`,
                );
                return;
            }
            setActive({ id, args });
        },
        [enabled],
    );

    const close = useCallback(() => setActive(null), []);

    const controller = useMemo<SurfaceController>(
        () => ({
            activeSurface: active?.id ?? null,
            open,
            close,
        }),
        [active, open, close],
    );

    return (
        <TransportContext.Provider value={transport}>
            <SurfaceContext.Provider value={controller}>
                {children}

                {/*
                  * Active surface renders as a sibling of the page
                  * tree. Each surface owns its own portal-style fixed
                  * positioning so it escapes any positioned ancestor.
                  * Only one surface is mounted at a time.
                  */}
                <InboxSurface
                    open={active?.id === 'inbox'}
                    onClose={close}
                />
                {/* Search / activity / help surfaces will render here
                  * as additional `<Surface open={…} onClose={…} />`
                  * lines once shipped. They're additive — adding a
                  * new surface doesn't change anything in hosts. */}
            </SurfaceContext.Provider>
        </TransportContext.Provider>
    );
}

/**
 * Imperative API for triggering surfaces from anywhere in the
 * host page. The bell-popover's "See all" calls
 * `useCboxSurfaces().open('inbox')` instead of navigating.
 */
export function useCboxSurfaces(): SurfaceController {
    const ctx = useContext(SurfaceContext);
    if (ctx === null) {
        throw new Error(
            '[cbox-ui] useCboxSurfaces must be used inside <CboxSurfaces>. Did the host forget to mount it?',
        );
    }
    return ctx;
}

/**
 * Optional variant — returns `null` when no `<CboxSurfaces>` host is
 * mounted. Chrome controls (bell, search trigger) use this to
 * degrade gracefully to cross-app navigation when the host hasn't
 * opted into the surface runtime yet.
 */
export function useCboxSurfacesOptional(): SurfaceController | null {
    return useContext(SurfaceContext);
}

/**
 * Read-only access to the host-supplied transport. Internal —
 * surface implementations call this; host code shouldn't need it.
 */
export function useTransport(): Transport {
    const t = useContext(TransportContext);
    if (t === null) {
        throw new Error(
            '[cbox-ui] useTransport must be used inside <CboxSurfaces>.',
        );
    }
    return t;
}
