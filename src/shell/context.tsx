import { createContext, useContext, type AnchorHTMLAttributes, type ComponentType, type ReactNode } from 'react';
import type { CboxTranslator } from '../context/localization';
import type { HelpArticle, HelpStore } from './help-store';
import type { ShellIcon } from './icons';
import type { Shell, ShellNavigate, ShellPreferenceChange, ShellPreferences } from './types';

/** A client-side link (Inertia's `Link`). Receives `href`, `className`, `children` and ARIA props. */
export type ShellLinkComponent = ComponentType<AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }>;

/** Which overlay is open. Only one at a time, so two menus never stack. */
export type ShellOverlay =
    | 'org'
    | 'context'
    | 'apps'
    | 'account'
    | 'palette'
    | 'nav-sheet'
    | 'context-sheet'
    | null;

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
};

export const ShellContext = createContext<ShellApi | null>(null);

export function useShell(): ShellApi {
    const api = useContext(ShellContext);
    if (api === null) throw new Error('[cbox-ui] Shell parts must be rendered inside <CboxShell>.');
    return api;
}

/** Help for a page's own `?` button, or `null` outside the shell. */
export function useShellHelp(): Pick<ShellApi, 'toggleHelp' | 'openArticle' | 'ask'> | null {
    const api = useContext(ShellContext);
    return api === null ? null : { toggleHelp: api.toggleHelp, openArticle: api.openArticle, ask: api.ask };
}
