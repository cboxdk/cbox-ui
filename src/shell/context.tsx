import { createContext, useContext, type AnchorHTMLAttributes, type ComponentType, type ReactNode } from 'react';
import type { CboxTranslator } from '../context/localization';
import type { HelpArticle, HelpStore } from './help-store';
import type { ShellIcon } from './icons';
import type { PaletteRecord, Shell, ShellNavigate, ShellPreferenceChange, ShellPreferences } from './types';
import type { ShellRenderCreate } from './create';

/** A client-side link (Inertia's `Link`). Receives `href`, `className`, `children` and ARIA props. */
export type ShellLinkComponent = ComponentType<AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }>;

/** Which overlay is open. Only one at a time, so two menus never stack. */
export type ShellOverlay =
    | 'org'
    | 'context'
    | 'apps'
    | 'account'
    | 'palette'
    | 'more'
    | 'context-sheet'
    | 'apps-sheet'
    | 'create'
    | null;

/**
 * Where the phone's context sheet opens: its root, a level's list (by key), or every environment.
 * `direct`: opened at that step from More or the palette, so Back closes the sheet.
 */
export type ContextStep = { step: 'root' | 'environments' | (string & {}); direct: boolean; underMore?: boolean };

/** The app's own records search, for the palette's Records group. */
export type ShellRecordSearch = (query: string, signal: AbortSignal) => Promise<PaletteRecord[]>;

export type ShellApi = {
    shell: Shell;
    t: CboxTranslator;
    navigate: ShellNavigate;
    Link: ShellLinkComponent;
    icons: Readonly<Record<string, ShellIcon>>;
    preferences: ShellPreferences;
    setPreference: ShellPreferenceChange;
    overlay: ShellOverlay;
    setOverlay: (overlay: ShellOverlay) => void;
    help: HelpStore;
    /** Open or close Help. */
    toggleHelp: (open?: boolean) => void;
    /** Open Help on an article. */
    openArticle: (article: HelpArticle) => void;
    /** Open Help and send a question to the chat with the page as context. */
    ask: (question: string) => void;
    /** Switch context: `chosen` maps level keys to ids. */
    switchTo: (chosen: Record<string, string>) => void;
    /** The phone layout is on (below 768px). */
    mobile: boolean;
    /** Open the context switcher: the phone's sheet at a step, or the desktop's menu. */
    openContext: (step?: ContextStep['step'], direct?: boolean) => void;
    contextStep: ContextStep;
    /** Open the create sheet on a creatable, or on the page's own create target. */
    openCreate: (key?: string) => void;
    /** The creatable the create sheet opened on, or null for the tree. */
    createKey: string | null;
    /** True when "+" has something to open: a create target and the app's forms. */
    canCreate: boolean;
    renderCreate?: ShellRenderCreate;
    searchRecords?: ShellRecordSearch;
};

export const ShellContext = createContext<ShellApi | null>(null);

export function useShell(): ShellApi {
    const api = useContext(ShellContext);
    if (api === null) throw new Error('[cbox-ui] Shell parts must be rendered inside <CboxShell>.');
    return api;
}

/** The create sheet, for a page's own "New …" button, or `null` outside the shell. */
export function useShellCreate(): { openCreate: (key?: string) => void } | null {
    const api = useContext(ShellContext);
    return api === null || api.renderCreate === undefined ? null : { openCreate: api.openCreate };
}

/** Help for a page's own `?` button, or `null` outside the shell. */
export function useShellHelp(): Pick<ShellApi, 'toggleHelp' | 'openArticle' | 'ask'> | null {
    const api = useContext(ShellContext);
    return api === null ? null : { toggleHelp: api.toggleHelp, openArticle: api.openArticle, ask: api.ask };
}

/** Title text compared loosely: case, spacing and a trailing colon do not matter. */
export function sameTitle(a: string, b: string): boolean {
    const norm = (text: string) => text.replace(/\s+/g, ' ').trim().replace(/:$/, '').toLocaleLowerCase();
    return norm(a) !== '' && norm(a) === norm(b);
}

/**
 * The title the phone's top bar shows large (the current area's name), or `null` on a desktop and
 * outside the shell. A page heading that says the same is hidden on the phone (shown to screen
 * readers), so the title is not there twice: `PageHeader` does this itself; any other heading
 * opts in with `data-cbx-page-title`.
 */
export function useShellPageTitle(): string | null {
    const api = useContext(ShellContext);
    if (api === null || !api.mobile) return null;
    return api.shell.nav.areas.find(area => area.key === api.shell.nav.activeArea)?.label ?? null;
}
