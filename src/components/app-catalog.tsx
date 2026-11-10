import { createElement } from 'react';
import { useCboxLocalization } from '../context/localization';
import { defineCboxAppSwitcher } from '../app-switcher/elements';
import type { CboxThemeMode } from '../app-switcher/theme';

export {
    authorizeHref,
    parseAppCatalog,
    signInTarget,
    type CboxAppCatalogState,
    type CboxCatalogApp,
} from '../app-switcher/catalog';

defineCboxAppSwitcher();

export type CboxAppCatalogProps = {
    /**
     * Same-origin URL the host serves the person's app catalog from (a proxy of Cbox ID's
     * catalog, authorized for the signed-in person). `null` renders the control disabled, so the
     * chrome keeps its shape on pages without an organization.
     */
    endpoint: string | null;
    /** The app key of this app; its tile is marked current. */
    currentAppKey: string;
    /**
     * How the theme is read. Default `auto`: `.dark`/`[data-theme]` on the root, else the
     * system scheme. `class` for a host whose tokens only turn dark under `.dark`.
     */
    theme?: CboxThemeMode;
    className?: string;
};

/**
 * The Switch-app control. It renders `<cbox-app-switcher>` from `@cboxdk/cbox-ui/app-switcher`,
 * the same element every Blade app uses, so React and Blade apps draw one identical control:
 * the live catalog from the host's endpoint, Cbox ID's light and dark icons, a quiet retry when
 * the catalog cannot be loaded, and straight to sign-in when the host answers `401 { signin_url }`.
 */
export function CboxAppCatalog({ endpoint, currentAppKey, theme, className }: CboxAppCatalogProps) {
    const { t } = useCboxLocalization();
    const labels = JSON.stringify({
        title: t('Switch app'),
        loading: t('Loading apps…'),
        empty: t('No apps available'),
        unavailable: t('Apps could not be loaded.'),
    });

    return createElement('cbox-app-switcher', {
        endpoint: endpoint ?? '',
        current: currentAppKey,
        labels,
        theme,
        className,
    });
}
