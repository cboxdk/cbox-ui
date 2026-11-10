/**
 * `@cboxdk/cbox-ui/app-switcher` — the one Switch-app control for every Cbox app, framework
 * free. Importing this module defines `<cbox-app-switcher>` and `<cbox-service-mark>`:
 *
 *     import '@cboxdk/cbox-ui/app-switcher';
 *
 *     <cbox-app-switcher endpoint="/acme/apps/catalog" current="billing"
 *         labels='{"title":"Skift app"}'></cbox-app-switcher>
 *     <cbox-service-mark service="billing" aria-hidden="true"></cbox-service-mark>
 *
 * Both render in a shadow root with their own styles, so no app stylesheet changes them.
 */
import { defineCboxAppSwitcher } from './elements';

defineCboxAppSwitcher();

export { defineCboxAppSwitcher, DEFAULT_LABELS, SIGNIN_EVENT, type CboxAppSwitcherLabels } from './elements';
export {
    authorizeHref,
    parseAppCatalog,
    readKnownAppCatalog,
    rememberAppCatalog,
    secureIconUrl,
    signInTarget,
    subscribeKnownAppCatalog,
    type CboxAppCatalogState,
    type CboxCatalogApp,
    type CboxKnownApp,
} from './catalog';
export { isDark, type CboxThemeMode } from './theme';
