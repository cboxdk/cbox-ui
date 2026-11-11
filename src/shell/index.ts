export { CboxShell, applyTheme, themeBootScript, type CboxShellProps } from './shell';
export { useShellHelp, type ShellLinkComponent } from './context';
export { createHelpStore, type HelpArticle, type HelpState, type HelpStore, type SupportUpdate } from './help-store';
export { contextTrail, pageIntent, type PageIntent } from './help';
export { APP_HUES, hueFor, parseShellCatalog, type ShellApp, type ShellCatalogState } from './app-grid';
export { environmentFor, initialsOf, parseListPage, settingsHref, switchBody, switchPayload, withQuery, type ListPage, type SwitchBody } from './data';
export { SHELL_ICONS, type ShellIcon } from './icons';
export type {
    AppKey,
    ContextItem,
    ContextLevel,
    ContextTone,
    Link as ShellActionLink,
    NavArea,
    NavPage,
    PaletteAction,
    Shell,
    ShellAccount,
    ShellBanner,
    ShellHelp,
    ShellNavigate,
    ShellNotifications,
    ShellOption,
    ShellPreferenceChange,
    ShellPreferences,
    ShellTheme,
} from './types';
