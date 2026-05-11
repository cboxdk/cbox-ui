import { useCboxIdOptional } from '../context/cbox-id';
import { ContextBar, type ContextItem } from '../primitives/context-bar';
import type { LinkComponent } from './cbox-app-sidebar';

export type CboxOrgContextBarProps = {
    /**
     * Apps inject their router's Link primitive — used for the
     * crumb's brand-side anchor. The dropdown's onSelect calls
     * `onNavigate(href)` so apps can either `router.visit(href)`
     * (Inertia) or `<Link>`-style navigate.
     */
    LinkComponent: LinkComponent;

    /**
     * Called when the user picks a different org from the dropdown.
     * Receives an absolute path with the slug substituted in. Apps
     * trigger their router.
     *
     * Path-rewrite rule (Cbox suite convention):
     *   /org/<old-slug>/foo/bar  →  /org/<new-slug>/foo/bar
     *   /something-else          →  /org/<new-slug>
     *
     * Apps that aren't org-scoped (notifications) typically don't
     * render this component at all — but if they do, switching
     * lands on the new org's `/org/<slug>` root and lets the host
     * sort the rest out.
     */
    onNavigate: (href: string) => void;
};

/**
 * Standard Cbox topbar org switcher. One crumb, one dropdown,
 * URL-driven (no POST, no session pin). Mirrors id's pattern 1:1
 * so the chrome reads identically across the suite — that's the
 * whole reason it's here, not in each app.
 *
 * Apps render this in the `topbarCentre` slot of `CboxAppShell`.
 * Hides itself when there's no current org (eg pre-auth, or
 * non-org-scoped surfaces).
 */
export function CboxOrgContextBar({
    LinkComponent,
    onNavigate,
}: CboxOrgContextBarProps) {
    const cboxId = useCboxIdOptional();

    if (cboxId === null) {
        return null;
    }

    const { currentOrganization, organizations, urls } = cboxId;
    const activeOrg = currentOrganization ?? organizations[0] ?? null;

    if (activeOrg === null) {
        return null;
    }

    const idBase = urls.idBaseUrl.replace(/\/$/, '');

    const items: ContextItem[] = organizations.map((org) => ({
        id: org.slug,
        label: org.name,
        avatar: { initials: deriveInitials(org.name) },
        current: org.slug === activeOrg.slug,
        // Cogwheel shortcut → id's org-settings page. Cross-app
        // deep link; id handles the auth and rendering.
        settingsHref: `${idBase}/org/${org.slug}/settings`,
        settingsAriaLabel: `Settings for ${org.name}`,
    }));

    const onSelect = (slug: string) => {
        const org = organizations.find((o) => o.slug === slug);
        if (org === undefined) return;

        const path = typeof window !== 'undefined' ? window.location.pathname : '/';
        const next = path.startsWith('/org/')
            ? path.replace(/^\/org\/[^/]+/, `/org/${org.slug}`)
            : `/org/${org.slug}`;
        const search =
            typeof window !== 'undefined' ? window.location.search : '';

        onNavigate(next + search);
    };

    return (
        <ContextBar
            LinkComponent={LinkComponent}
            crumbs={[
                {
                    id: 'org',
                    label: activeOrg.name,
                    avatar: { initials: deriveInitials(activeOrg.name) },
                    items,
                    onSelect,
                    footerLink: {
                        label: 'Manage organizations',
                        href: `${idBase}/settings/organizations`,
                    },
                    ariaLabel: 'Switch organization',
                },
            ]}
        />
    );
}

function deriveInitials(label: string): string {
    const parts = label.trim().split(/\s+/);
    if (parts.length >= 2) {
        return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
    }

    return (label.slice(0, 2) || '?').toUpperCase();
}
