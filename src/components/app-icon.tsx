import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { cn } from '../utils/cn';
import { initials, readKnownAppCatalog, secureIconUrl, subscribeKnownAppCatalog, type CboxKnownApp } from '../app-switcher/catalog';

/**
 * Every Cbox app's icon comes from Cbox ID's catalog: one light and one dark upload per app
 * (`icon_url`, `icon_dark_url`). There is no local copy of the marks in this package or in an
 * app. The last catalog the browser saw is kept here so an app's own mark and the switcher
 * paint at once on the next page; the live answer replaces it when it arrives.
 */
export type { CboxKnownApp } from '../app-switcher/catalog';
export { readKnownAppCatalog, rememberAppCatalog, secureIconUrl } from '../app-switcher/catalog';

const EMPTY: CboxKnownApp[] = [];

/** The last catalog this browser kept; empty on the server and before the first answer. */
export function useKnownAppCatalog(): CboxKnownApp[] {
    return useSyncExternalStore(subscribeKnownAppCatalog, readKnownAppCatalog, () => EMPTY);
}

export type CboxAppIconProps = {
    /** The app's name; its first two letters stand in when it has no icon. */
    name: string;
    /** Catalog `icon_url`: the icon for light surfaces (or the only one). */
    iconUrl?: string | null;
    /** Catalog `icon_dark_url`: the icon for dark surfaces. */
    iconDarkUrl?: string | null;
    /** Size and shape of the icon box, e.g. `h-6 w-6`. */
    className?: string;
    /** Rendered instead of initials when the app has no usable icon. */
    fallback?: ReactNode;
};

/**
 * One app's icon from the catalog. With both uploads it renders two images and the token
 * stylesheet shows the one for the current theme (`.dark` or `[data-theme="dark"]` on the
 * root, the same switch the tokens use). Without an icon, or when it fails to load, it shows
 * the app's initials.
 */
export function CboxAppIcon({ name, iconUrl, iconDarkUrl, className = 'h-6 w-6', fallback }: CboxAppIconProps) {
    const light = secureIconUrl(iconUrl);
    const dark = secureIconUrl(iconDarkUrl);
    const [failed, setFailed] = useState<string | null>(null);
    const key = `${light ?? ''}|${dark ?? ''}`;
    if (light === null || failed === key) {
        if (fallback !== undefined) return <>{fallback}</>;
        return <span aria-hidden className={cn('grid shrink-0 place-items-center rounded bg-secondary text-[11px] font-semibold text-foreground', className)}>{initials(name)}</span>;
    }
    const lost = () => setFailed(key);

    return (
        <span aria-hidden className={cn('cbx-app-icon-box inline-flex shrink-0 items-center justify-center', className)}>
            <img src={light} alt="" decoding="async" onError={lost} className={cn('cbx-app-icon', dark === null ? 'cbx-app-icon-single' : 'cbx-app-icon-light', 'h-full w-full')} />
            {dark !== null && <img src={dark} alt="" decoding="async" onError={lost} className="cbx-app-icon cbx-app-icon-dark h-full w-full" />}
        </span>
    );
}

export type CboxServiceMarkProps = {
    /** The app key in Cbox ID's catalog (`signals`, `infra`, …). */
    appKey: string;
    /** Size of the mark. Default `h-6 w-6`. */
    className?: string;
    /** Shown while the catalog has not told this browser the app's icon yet. Default nothing. */
    fallback?: ReactNode;
};

/** An app's own mark (its rail or brand icon), read from the catalog this browser last kept. */
export function CboxServiceMark({ appKey, className = 'h-6 w-6', fallback = null }: CboxServiceMarkProps) {
    const app = useKnownAppCatalog().find(entry => entry.key === appKey);
    if (app === undefined || app.icon_url === null) return <>{fallback}</>;

    return <CboxAppIcon name={app.name} iconUrl={app.icon_url} iconDarkUrl={app.icon_dark_url} className={className} fallback={fallback ?? undefined} />;
}
