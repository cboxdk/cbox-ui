import { Bell, ChevronsUpDown, CircleHelp, LayoutGrid, Lock, PanelLeftClose, PanelLeftOpen, Pin, PinOff, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type AnchorHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { useCboxLocalization } from '../context/localization';
import { useKnownAppCatalog } from '../components/app-icon';
import { AccountMenu, Avatar } from './account-menu';
import { AppGrid, forgetShellCatalog, hueFor } from './app-grid';
import { CascadeLabel, Chip, CascadeMenu, OrganizationMenu, ToneSquare } from './context-menus';
import { ShellContext, useShell, type ContextStep, type ShellApi, type ShellLinkComponent, type ShellOverlay, type ShellRecordSearch } from './context';
import { CreateSheet, pageCreateKey, type ShellRenderCreate } from './create';
import { rememberPage } from './recent';
import { initials } from '../app-switcher/catalog';
import { currentLocation, defaultNavigate, switchBody } from './data';
import { HelpColumn, useHelpState, useUnreadCount } from './help';
import { helpVisible, sharedHelpStore, type HelpStore } from './help-store';
import { resolveIcon, type ShellIcon } from './icons';
import { HELP_DOCKED, MOBILE, matches, useMedia } from './media';
import { AppsSheet, ContextSheet, MobileAreaHead, MobileTopBar, MoreScreen, notLiveEnvironment, TabBar, useMoreView } from './mobile';
import { areaLocked, NavPageList, NavPageMarks, navUrl, shellBanners } from './nav-pages';
import { CommandPalette } from './palette';
import { Popover } from './popover';
import { scopeLists } from './use-list';
import type { Shell, ShellNavigate, ShellPreferenceChange, ShellPreferences, ShellTheme } from './types';

export type CboxShellProps = {
    /** The shared `shell` prop. */
    shell: Shell;
    /** The page. */
    children: ReactNode;
    /** How to move the person. Inertia: `(url, o) => router.visit(url, { method: o?.method, data: o?.data })`, plus `window.open` for `newTab`. Default: page loads and form posts. */
    navigate?: ShellNavigate;
    /** Client-side link for nav and settings links (Inertia's `Link`). Default `<a>`. */
    LinkComponent?: ShellLinkComponent;
    /** Extra icons by name, on top of the built-in Lucide set. */
    icons?: Readonly<Record<string, ShellIcon>>;
    /**
     * Called when the person changes a preference, for the host to persist (a cookie read before
     * first paint, and Cbox ID's preferences for theme, language, format and time zone). Without
     * it the shell writes a `cbox_shell_<key>` cookie.
     */
    onPreferenceChange?: ShellPreferenceChange;
    /** Help's state store. Default: one per page, so it outlives the shell's own remounts. */
    helpStore?: HelpStore;
    /** Where the Cbox wordmark is served. Default `/brand`. */
    brandAssetBase?: string;
    /** `id` of the `<main>` landmark, which the shell's "Skip to content" link targets. Default `main-content`. */
    mainId?: string;
    /**
     * The app's create forms, one per `shell.create` key (V7). The shell renders the sheet, the
     * stack and the words; the app renders the fields. Without it there is no "+".
     */
    renderCreate?: ShellRenderCreate;
    /**
     * The app's own records search for the palette's Records group, instead of
     * `palette.searchUrl`'s records. Called with the query and an abort signal.
     */
    searchRecords?: ShellRecordSearch;
};

const PlainLink: ShellLinkComponent = ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => <a href={href} {...props}>{children}</a>;

function writeCookie(key: string, value: unknown): void {
    if (typeof document === 'undefined') return;
    const name = `cbox_shell_${key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`;
    document.cookie = `${name}=${encodeURIComponent(String(value))}; path=/; max-age=31536000; SameSite=Lax`;
}

/**
 * Apply a theme choice to the document the way the tokens read it: `.dark` and `data-theme` on
 * the root, with `system` following the device. The saved choice stays `system`; the device's
 * scheme is never written back (cbox-design, shared preferences).
 */
export function applyTheme(theme: ShellTheme): void {
    if (typeof document === 'undefined') return;
    const dark = theme === 'dark' || (theme === 'system' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.themePreference = theme;
    root.style.colorScheme = dark ? 'dark' : 'light';
}

/**
 * The inline script a host puts in `<head>` so the theme is right before the first paint
 * (§12.1). `theme` is the person's saved choice from the `shell` prop.
 */
export function themeBootScript(theme: ShellTheme): string {
    const safe = theme === 'dark' || theme === 'light' ? theme : 'system';
    return `(function(){var t='${safe}';var d=t==='dark'||(t==='system'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.dataset.theme=d?'dark':'light';r.dataset.themePreference=t;r.style.colorScheme=d?'dark':'light';})();`;
}

function useIsMac(): boolean {
    const [mac, setMac] = useState(true);
    useEffect(() => {
        setMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
    }, []);
    return mac;
}

/**
 * The one shell for every Cbox app (spec 2026-11-10 shell v1): rail with the account at the
 * bottom, subnav, header with the context selectors, Search, Help, the bell when the app has a
 * source, Switch app; the ⌘K palette; the Help column; and the phone layout.
 *
 * Render it in the host's persistent layout (Inertia `Page.layout`), so the rail, Help and the
 * chat survive page visits; only `shell` and `children` change.
 */
export function CboxShell({ shell, children, navigate = defaultNavigate, LinkComponent = PlainLink, icons = {}, onPreferenceChange, helpStore, brandAssetBase = '/brand', mainId = 'main-content', renderCreate, searchRecords }: CboxShellProps) {
    const { t } = useCboxLocalization();
    const [store] = useState(() => helpStore ?? sharedHelpStore());
    const [preferences, setPreferences] = useState<ShellPreferences>(shell.preferences);
    const [overlay, setOverlay] = useState<ShellOverlay>(null);
    const [contextStep, setContextStep] = useState<ContextStep>({ step: 'root', direct: false });
    const [createKey, setCreateKey] = useState<string | null>(null);
    const mobile = useMedia(MOBILE, false);
    const [moreView, setMoreView] = useMoreView();

    // Help starts as the person left it, once per page; later visits keep the live state. Left
    // open, it shows docked from 1280px; below that it waits for the person (see `restored`).
    if (!store.get().seeded) store.set({ open: shell.preferences.helpOpen, restored: shell.preferences.helpOpen, seeded: true });

    // A new `shell` prop from the server wins for the preferences it carries.
    const serverPreferences = JSON.stringify(shell.preferences);
    useEffect(() => {
        setPreferences(JSON.parse(serverPreferences) as ShellPreferences);
    }, [serverPreferences]);

    const setPreference = useCallback<ShellPreferenceChange>(
        (key, value) => {
            setPreferences(current => ({ ...current, [key]: value }));
            if (key === 'theme') applyTheme(value as ShellTheme);
            if (onPreferenceChange !== undefined) onPreferenceChange(key, value);
            else writeCookie(key, value);
        },
        [onPreferenceChange],
    );

    const toggleHelp = useCallback(
        (open?: boolean) => {
            const next = open ?? !helpVisible(store.get(), matches(HELP_DOCKED));
            store.set({ open: next, restored: false });
            setPreference('helpOpen', next);
        },
        [store, setPreference],
    );

    const levels = shell.context.levels;
    const switchUrl = shell.context.switchUrl;

    // Lists and the app catalog kept from another context are never shown in this one.
    const scope = levels.map(level => `${level.key}:${level.current.id}`).join('|');
    if (scopeLists(scope)) forgetShellCatalog();
    const canCreate = renderCreate !== undefined && (shell.create?.items.length ?? 0) > 0;
    const api = useMemo<ShellApi>(
        () => ({
            shell,
            t,
            navigate,
            Link: LinkComponent,
            icons,
            preferences,
            setPreference,
            overlay,
            setOverlay,
            help: store,
            toggleHelp,
            openArticle: article => {
                store.set({ article, open: true, restored: false });
                setPreference('helpOpen', true);
            },
            ask: question => {
                store.set({ open: true, restored: false, article: null, pendingQuestion: question });
                setPreference('helpOpen', true);
            },
            switchTo: chosen => {
                setOverlay(null);
                navigate(switchUrl, { method: 'post', data: switchBody(levels, chosen, currentLocation()) });
            },
            mobile,
            contextStep,
            openContext: (step = 'root', direct = false) => {
                if (mobile) {
                    setContextStep({ step, direct, underMore: overlay === 'more' });
                    setOverlay('context-sheet');
                    return;
                }
                setOverlay(step === 'root' || step === levels[0]?.key || levels.length < 2 ? 'org' : 'context');
            },
            createKey,
            canCreate,
            openCreate: key => {
                if (!canCreate) return;
                setCreateKey(key ?? pageCreateKey(shell));
                setOverlay('create');
            },
            renderCreate,
            searchRecords,
        }),
        [shell, t, navigate, LinkComponent, icons, preferences, setPreference, overlay, store, toggleHelp, levels, switchUrl, mobile, contextStep, createKey, canCreate, renderCreate, searchRecords],
    );

    const preferencesRef = useRef(preferences);
    preferencesRef.current = preferences;

    // ⌘K / Ctrl+K anywhere; ⌘. collapses the subnav.
    useEffect(() => {
        const keydown = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
            if (event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setOverlay(current => (current === 'palette' ? null : 'palette'));
            } else if (event.key === '.') {
                event.preventDefault();
                setPreference('subnavCollapsed', !(preferencesRef.current.subnavCollapsed ?? false));
            }
        };
        window.addEventListener('keydown', keydown);
        return () => window.removeEventListener('keydown', keydown);
    }, [setPreference]);

    // A visit closes any open menu.
    const page = `${shell.nav.activeArea}|${shell.nav.activePage ?? ''}|${shell.page?.title ?? ''}`;
    useEffect(() => {
        setOverlay(current => (current === 'palette' ? current : null));
        setMoreView({ kind: 'root' });
        if (shell.page?.title !== undefined) {
            const area = shell.nav.areas.find(item => item.key === shell.nav.activeArea);
            rememberPage(shell.app.key, { title: shell.page.title, area: area?.label, url: currentLocation() });
        }
    }, [page]);

    const docked = useMedia(HELP_DOCKED, true);
    const testData = levels.some(level => level.current.testData === true);
    const helpOpen = useHelpState(store, state => helpVisible(state, docked));
    const notLive = notLiveEnvironment(levels);
    // On the phone the environment banner under the title says what the sandbox strip says, so
    // the strip is not shown twice. On a desktop the banner shows only when there is no strip.
    const banners = shellBanners(shell, testData).filter(banner => !(mobile && notLive !== null && banner.kind === 'sandbox'));
    const envBanner = !mobile && notLive !== null && !banners.some(banner => banner.kind === 'sandbox') ? notLive : null;

    const strips = banners.map((banner, index) => (
        <div key={`${banner.kind}-${index}`} className={`cbx-banner cbx-banner-${banner.kind}`} role="status">
            <span className="cbx-banner-text">{banner.text}</span>
            {banner.action !== undefined && <LinkComponent href={navUrl(banner.action)} className="cbx-banner-action">{banner.action.label}</LinkComponent>}
        </div>
    ));
    const skip = (
        <a
            className="cbx-skip-link"
            href={`#${mainId}`}
            onClick={event => {
                const main = document.getElementById(mainId);
                if (main === null) return;
                event.preventDefault();
                main.focus();
                main.scrollIntoView?.({ block: 'start' });
            }}
        >
            {t('Skip to content')}
        </a>
    );
    const overlays = (
        <>
            {overlay === 'palette' && <CommandPalette onClose={() => setOverlay(null)} />}
            {overlay === 'context-sheet' && <ContextSheet key={`${contextStep.step}:${String(contextStep.direct)}`} onClose={() => setOverlay(contextStep.underMore === true ? 'more' : null)} />}
            {overlay === 'apps-sheet' && <AppsSheet onClose={() => setOverlay('more')} />}
            {overlay === 'create' && <CreateSheet key={createKey ?? 'tree'} onClose={() => setOverlay(null)} />}
        </>
    );

    if (mobile) {
        // More stays on screen under the sheets it opens (Switch app, a context step).
        const moreOpen = overlay === 'more' || overlay === 'apps-sheet' || (overlay === 'context-sheet' && contextStep.underMore === true);
        return (
            <ShellContext.Provider value={api}>
                <div className="cbx-shell is-mobile" data-help-open={helpOpen}>
                    {skip}
                    <div className="cbx-shell-column">
                        <header className="cbx-m-chrome" hidden={moreOpen}>
                            <MobileTopBar />
                            <MobileAreaHead />
                            {strips}
                        </header>
                        <main id={mainId} tabIndex={-1} className="cbx-shell-main canvas-gradient">
                            {moreOpen && <MoreScreen view={moreView} setView={setMoreView} />}
                            {/* The page stays mounted under More, so its state survives. */}
                            <div className="cbx-m-page" hidden={moreOpen}>{children}</div>
                        </main>
                    </div>
                    <TabBar
                        onMore={() => {
                            setMoreView({ kind: 'root' });
                            setOverlay('more');
                        }}
                    />
                    <HelpColumn docked={false} mobile />
                    {overlays}
                </div>
            </ShellContext.Provider>
        );
    }

    return (
        <ShellContext.Provider value={api}>
            <div className="cbx-shell" data-help-open={helpOpen}>
                {skip}
                <Rail brandAssetBase={brandAssetBase} />
                <div className="cbx-shell-column">
                    <Header />
                    {envBanner !== null && (
                        <div className={`cbx-banner cbx-banner-env cbx-env-${envBanner.tone ?? 'neutral'}`} role="status">
                            <ToneSquare tone={envBanner.tone} />
                            <span className="cbx-banner-text">{t('{environment}. Not production, nothing here touches live customers.', { environment: envBanner.name })}</span>
                        </div>
                    )}
                    {strips}
                    <div className="cbx-shell-body">
                        <Subnav />
                        <main id={mainId} tabIndex={-1} className="cbx-shell-main canvas-gradient">{children}</main>
                    </div>
                </div>
                <HelpColumn docked={docked} />
                {overlays}
            </div>
        </ShellContext.Provider>
    );
}

function AppMark() {
    const { shell } = useShell();
    const known = useKnownAppCatalog().find(app => app.key === shell.app.key);
    const [failed, setFailed] = useState(false);
    const style = { '--cbx-hue': String(hueFor(shell.app.key)) } as Record<string, string>;
    if (known?.icon_url && !failed) {
        return (
            <span className="cbx-app-mark" aria-hidden="true">
                <img src={known.icon_url} alt="" className={known.icon_dark_url ? 'cbx-app-icon-light' : ''} onError={() => setFailed(true)} />
                {known.icon_dark_url && <img src={known.icon_dark_url} alt="" className="cbx-app-icon-dark" onError={() => setFailed(true)} />}
            </span>
        );
    }
    return <span className="cbx-app-mark cbx-app-tile" style={style} aria-hidden="true">{initials(shell.app.name.replace(/^Cbox\s*·?\s*/i, ''))}</span>;
}

function Rail({ brandAssetBase }: { brandAssetBase: string }) {
    const { shell, t, Link, icons, preferences, setPreference, overlay, setOverlay } = useShell();
    const [hovered, setHovered] = useState(false);
    const account = useRef<HTMLButtonElement>(null);
    const pinned = preferences.railPinned;
    const open = pinned || hovered || overlay === 'account';
    const name = shell.app.name.replace(/^Cbox\s*·?\s*/i, '');
    return (
        <div className="cbx-rail-slot" data-pinned={pinned}>
            <aside
                className="cbx-rail"
                data-open={open}
                aria-label={t('Main navigation')}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onFocusCapture={() => setHovered(true)}
                onBlurCapture={event => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false);
                }}
            >
                <div className="cbx-rail-top">
                    <Link href={shell.app.homeUrl} className="cbx-rail-home" aria-label={t('{app} home', { app: shell.app.name })}>
                        <AppMark />
                        <span className="cbx-rail-brand" aria-hidden="true">
                            <img className="cbx-wordmark cbx-wordmark-light" src={`${brandAssetBase}/cbox-logo.png`} srcSet={`${brandAssetBase}/cbox-logo.png 1x, ${brandAssetBase}/cbox-logo@2x.png 2x`} alt="" height={19} />
                            <img className="cbx-wordmark cbx-wordmark-dark" src={`${brandAssetBase}/cbox-logo-white.png`} srcSet={`${brandAssetBase}/cbox-logo-white.png 1x, ${brandAssetBase}/cbox-logo-white@2x.png 2x`} alt="" height={19} />
                            <span className="cbx-rail-app">{name}</span>
                        </span>
                    </Link>
                    <button type="button" className="cbx-icon-button cbx-rail-pin" onClick={() => setPreference('railPinned', !pinned)} aria-label={pinned ? t('Unpin navigation') : t('Pin navigation')} aria-pressed={pinned} tabIndex={open ? 0 : -1}>
                        {pinned ? <PinOff size={16} strokeWidth={1.8} aria-hidden /> : <Pin size={16} strokeWidth={1.8} aria-hidden />}
                    </button>
                </div>
                <nav className="cbx-rail-nav" aria-label={name}>
                    {shell.nav.areas.map(area => {
                        const Icon = resolveIcon(area.icon, icons);
                        const active = area.key === shell.nav.activeArea;
                        const locked = areaLocked(area);
                        const label = locked ? t('{area} (locked)', { area: area.label }) : area.label;
                        return (
                            <Link key={area.key} href={navUrl(area)} className={`cbx-rail-link ${active ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`} aria-current={active ? 'page' : undefined} title={open ? undefined : label} aria-label={label} data-locked={locked ? 'true' : undefined}>
                                <span className="cbx-rail-icon">
                                    <Icon size={18} strokeWidth={1.7} aria-hidden />
                                    {locked && (
                                        <span className="cbx-rail-lock" aria-hidden="true">
                                            <Lock size={9} strokeWidth={2.4} />
                                        </span>
                                    )}
                                </span>
                                <span className="cbx-rail-label">{area.label}</span>
                                {locked && <Lock className="cbx-rail-lock-open" size={13} strokeWidth={1.9} aria-hidden />}
                            </Link>
                        );
                    })}
                </nav>
                <div className="cbx-rail-foot">
                    <button
                        ref={account}
                        type="button"
                        className={`cbx-rail-account ${overlay === 'account' ? 'is-open' : ''}`}
                        aria-haspopup="menu"
                        aria-expanded={overlay === 'account'}
                        aria-label={t('Account and preferences')}
                        onClick={() => setOverlay(overlay === 'account' ? null : 'account')}
                    >
                        <Avatar />
                        <span className="cbx-rail-who">
                            <span className="cbx-rail-name cbx-truncate">{shell.person.name}</span>
                            <span className="cbx-rail-sub cbx-truncate">{t('Account and preferences')}</span>
                        </span>
                    </button>
                </div>
            </aside>
            <Popover open={overlay === 'account'} anchor={account} placement="top-start" label={t('Account')} onClose={() => setOverlay(null)}>
                <AccountMenu onDone={() => setOverlay(null)} />
            </Popover>
        </div>
    );
}

function Subnav() {
    const { shell, t, Link, preferences, setPreference } = useShell();
    const area = shell.nav.areas.find(item => item.key === shell.nav.activeArea);
    const pages = area?.pages ?? [];
    if (area === undefined || pages.length < 2) return null;
    const collapsed = preferences.subnavCollapsed ?? false;
    if (collapsed) {
        return (
            <aside className="cbx-subnav" data-collapsed="true" aria-label={area.label}>
                <button type="button" className="cbx-subnav-strip" onClick={() => setPreference('subnavCollapsed', false)} aria-label={t('Expand {area}', { area: area.label })} title="⌘.">
                    <PanelLeftOpen size={16} strokeWidth={1.8} aria-hidden />
                    <span>{area.label}</span>
                </button>
            </aside>
        );
    }
    return (
        <aside className="cbx-subnav" aria-label={area.label}>
            <div className="cbx-subnav-head">
                <strong className="cbx-truncate">{area.label}</strong>
                <button type="button" className="cbx-icon-button" onClick={() => setPreference('subnavCollapsed', true)} aria-label={t('Collapse {area}', { area: area.label })} title="⌘.">
                    <PanelLeftClose size={16} strokeWidth={1.8} aria-hidden />
                </button>
            </div>
            <nav aria-label={area.label} className="cbx-subnav-list">
                <NavPageList
                    pages={pages}
                    renderPage={page => {
                        const active = page.key === shell.nav.activePage;
                        return (
                            <Link key={page.key} href={navUrl(page)} className={`cbx-subnav-link ${active ? 'is-active' : ''} ${page.locked === true ? 'is-locked' : ''}`} aria-current={active ? 'page' : undefined} data-locked={page.locked === true ? 'true' : undefined}>
                                <span className="cbx-truncate" title={page.label}>{page.label}</span>
                                <NavPageMarks page={page} />
                            </Link>
                        );
                    }}
                />
            </nav>
        </aside>
    );
}

function Header() {
    const { shell, t, overlay, setOverlay, help, toggleHelp, Link } = useShell();
    const mac = useIsMac();
    const org = useRef<HTMLButtonElement>(null);
    const second = useRef<HTMLButtonElement>(null);
    const apps = useRef<HTMLButtonElement>(null);
    const docked = useMedia(HELP_DOCKED, true);
    const helpOpen = useHelpState(help, state => helpVisible(state, docked));
    const unread = useUnreadCount(help, shell.help.unread);
    const [organization, ...rest] = shell.context.levels;
    const close = useCallback(() => setOverlay(null), [setOverlay]);
    /** ↓ (or ↑) on a context trigger opens its menu, or moves into it when open; Esc closes it. */
    const triggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, menu: 'org' | 'context') => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (overlay !== menu) setOverlay(menu);
            else document.querySelector<HTMLElement>('.cbx-popover .cbx-pane-search input, .cbx-popover [role="listbox"]')?.focus();
        } else if (event.key === 'Escape' && overlay === menu) {
            event.preventDefault();
            setOverlay(null);
        }
    };

    return (
        <header className="cbx-header">
            {organization !== undefined && (
                <div className="cbx-context cbx-only-desktop">
                    <button ref={org} type="button" className={`cbx-trigger ${overlay === 'org' ? 'is-open' : ''}`} aria-haspopup="dialog" aria-expanded={overlay === 'org'} aria-label={t('{level}: {name}', { level: organization.label, name: organization.current.name })} onClick={() => setOverlay(overlay === 'org' ? null : 'org')} onKeyDown={event => triggerKeyDown(event, 'org')}>
                        <Chip item={organization.current} tone="solid" />
                        <span className="cbx-trigger-text" title={organization.current.name}>{organization.current.name}</span>
                        <ChevronsUpDown className="cbx-trigger-chevron" size={14} strokeWidth={1.8} aria-hidden />
                    </button>
                    {(
                        <Popover open={overlay === 'org'} anchor={org} label={organization.label} onClose={close}>
                            <OrganizationMenu level={organization} />
                        </Popover>
                    )}
                    {rest.length > 0 && (
                        <>
                            <span className="cbx-separator" aria-hidden="true">/</span>
                            <button ref={second} type="button" className={`cbx-trigger ${overlay === 'context' ? 'is-open' : ''}`} aria-haspopup="dialog" aria-expanded={overlay === 'context'} aria-label={rest.map(level => t('{level}: {name}', { level: level.label, name: level.current.name })).join(', ')} onClick={() => setOverlay(overlay === 'context' ? null : 'context')} onKeyDown={event => triggerKeyDown(event, 'context')}>
                                <CascadeLabel levels={rest} />
                                <ChevronsUpDown className="cbx-trigger-chevron" size={14} strokeWidth={1.8} aria-hidden />
                            </button>
                            {(
                                <Popover open={overlay === 'context'} anchor={second} label={rest.map(level => level.label).join(' / ')} onClose={close}>
                                    <CascadeMenu levels={rest} parent={organization.current.id} />
                                </Popover>
                            )}
                        </>
                    )}
                </div>
            )}
            <div className="cbx-tools">
                <button type="button" className="cbx-search-button" onClick={() => setOverlay('palette')} aria-label={t('Search or ask…')} aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}>
                    <Search size={16} strokeWidth={1.8} aria-hidden />
                    <span className="cbx-search-label">{t('Search or ask…')}</span>
                    <kbd className="cbx-kbd">{mac ? '⌘K' : 'Ctrl K'}</kbd>
                </button>
                <button type="button" className={`cbx-tool ${helpOpen ? 'is-on' : ''}`} onClick={() => toggleHelp()} aria-pressed={helpOpen} aria-controls="cbx-help" aria-label={unread > 0 ? t('Help, {count} unread', { count: unread }) : t('Help')}>
                    <CircleHelp size={16} strokeWidth={1.8} aria-hidden />
                    <span className="cbx-tool-label">{t('Help')}</span>
                    {unread > 0 && <span className="cbx-count" aria-hidden="true">{unread}</span>}
                </button>
                {shell.notifications.enabled && (
                    <Link href={shell.notifications.url} className="cbx-tool cbx-tool-icon cbx-only-desktop" aria-label={shell.notifications.unread > 0 ? t('Notifications, {count} unread', { count: shell.notifications.unread }) : t('Notifications')}>
                        <Bell size={16} strokeWidth={1.8} aria-hidden />
                        {shell.notifications.unread > 0 && <span className="cbx-count" aria-hidden="true">{shell.notifications.unread}</span>}
                    </Link>
                )}
                <button ref={apps} type="button" className={`cbx-tool cbx-tool-icon cbx-only-desktop ${overlay === 'apps' ? 'is-on' : ''}`} onClick={() => setOverlay(overlay === 'apps' ? null : 'apps')} aria-haspopup="dialog" aria-expanded={overlay === 'apps'} aria-label={t('Switch app')} title={t('Switch app')}>
                    <LayoutGrid size={16} strokeWidth={1.8} aria-hidden />
                </button>
                {(
                    <Popover open={overlay === 'apps'} anchor={apps} placement="bottom-end" label={t('Switch app')} onClose={close}>
                        <AppGrid />
                    </Popover>
                )}
            </div>
        </header>
    );
}
