import { ArrowUpRight, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, LayoutGrid, Lock, MoreHorizontal, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Avatar } from './account-menu';
import { AppGrid, hueFor } from './app-grid';
import { createLabel } from './create';
import { Chip, InlineCreate, LevelPane, pickKeepingEnvironment, ToneSquare } from './context-menus';
import { sameTitle, useShell, useShellPageTitle, type ContextStep } from './context';
import { environmentLevel, groupItems, isLive, pluralOf, quickEnvironments } from './data';
import { helpTopicName, useUnreadCount } from './help';
import { resolveIcon } from './icons';
import { areaLocked, groupPages, NavPageMarks, navUrl } from './nav-pages';
import { OptionList } from './option-list';
import { matchScore } from './palette';
import { Sheet } from './sheet';
import { useContextList } from './use-list';
import type { ContextItem, ContextLevel, NavArea, ShellOption, ShellTheme } from './types';

/** The phone's bottom tab bar holds at most this many areas, then More. */
export const MAX_TABS = 4;

/** The areas in the tab bar: `nav.tabs` (known keys, at most four), else the first four. */
export function tabAreas(areas: readonly NavArea[], tabs: readonly string[] | undefined): NavArea[] {
    const chosen = tabs === undefined ? areas.slice(0, MAX_TABS) : tabs.map(key => areas.find(area => area.key === key)).filter((area): area is NavArea => area !== undefined);
    return chosen.slice(0, MAX_TABS);
}

/** The pill's two lines (V6): the levels above the deepest, small, and the deepest with its dot. */
export function pillLines(levels: readonly ContextLevel[]): { top: string; main: ContextLevel | undefined } {
    const main = levels[levels.length - 1];
    if (levels.length <= 1) return { top: main?.label ?? '', main };
    return { top: levels.slice(0, -1).map(level => level.current.name).join(' · '), main };
}

/** The current environment when the app declared it is not live: the banner shows. */
export function notLiveEnvironment(levels: readonly ContextLevel[]): ContextItem | null {
    const environment = environmentLevel(levels)?.current;
    return environment !== undefined && isLive(environment) === false ? environment : null;
}

function useUnread(): number {
    const { shell, help } = useShell();
    return useUnreadCount(help, shell.help.unread);
}

/** The phone's top bar (V6): the context pill, then Help, Search and the page's "+". */
export function MobileTopBar() {
    const { shell, t, openContext, toggleHelp, setOverlay, openCreate, canCreate } = useShell();
    const levels = shell.context.levels;
    const organization = levels[0];
    const { top, main } = pillLines(levels);
    const unread = useUnread();
    const topic = helpTopicName(shell);
    const trail = levels.map(level => level.current.name).join(', ');
    return (
        <div className="cbx-m-bar">
            {organization !== undefined && (
                <button type="button" className="cbx-m-pill" onClick={() => openContext('root')} aria-haspopup="dialog" aria-label={t('Where you work: {trail}', { trail })}>
                    <Chip item={organization.current} tone="solid" />
                    <span className="cbx-m-pill-text">
                        <span className="cbx-m-pill-top">{top}</span>
                        <span className="cbx-m-pill-main">
                            {main?.key === 'environment' && <ToneSquare tone={main.current.tone} />}
                            <span className="cbx-truncate">{main?.current.name}</span>
                        </span>
                    </span>
                    <ChevronDown className="cbx-m-pill-chevron" size={14} strokeWidth={2} aria-hidden />
                </button>
            )}
            <span className="cbx-m-spacer" />
            <button type="button" className="cbx-m-icon" onClick={() => toggleHelp(true)} aria-controls="cbx-help" aria-label={unread > 0 ? t('Help with {page}, {count} unread', { page: topic, count: unread }) : t('Help with {page}', { page: topic })}>
                <CircleHelp size={21} strokeWidth={1.8} aria-hidden />
                {unread > 0 && <span className="cbx-m-dot" aria-hidden="true" />}
            </button>
            <button type="button" className="cbx-m-icon" onClick={() => setOverlay('palette')} aria-label={t('Search and commands')} aria-haspopup="dialog">
                <Search size={21} strokeWidth={1.8} aria-hidden />
            </button>
            {canCreate && (
                <button type="button" className="cbx-m-icon is-primary" onClick={() => openCreate()} aria-haspopup="dialog" aria-label={createLabel(shell, t)}>
                    <Plus size={22} strokeWidth={2} aria-hidden />
                </button>
            )}
        </div>
    );
}

/** Under the top bar: the area's name, large, the environment banner, and the area's pages as chips. */
export function MobileAreaHead() {
    const { shell, t, Link } = useShell();
    const area = shell.nav.areas.find(item => item.key === shell.nav.activeArea);
    const pages = area?.pages ?? [];
    const environment = notLiveEnvironment(shell.context.levels);
    const strip = useRef<HTMLElement>(null);
    useEffect(() => {
        const list = strip.current;
        const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
        if (list === null || list === undefined || current === null || current === undefined) return;
        const overflow = current.offsetLeft + current.offsetWidth - list.clientWidth;
        if (overflow > 0) list.scrollLeft = overflow + 32;
    }, [shell.nav.activePage, shell.nav.activeArea]);
    return (
        <div className="cbx-m-head">
            {area !== undefined && <p className="cbx-m-title">{area.label}</p>}
            {environment !== null && (
                <div className={`cbx-m-env cbx-env-${environment.tone ?? 'neutral'}`} role="status">
                    <ToneSquare tone={environment.tone} />
                    <span>{t('{environment}. Not production, nothing here touches live customers.', { environment: environment.name })}</span>
                </div>
            )}
            {area !== undefined && pages.length > 1 ? (
                <nav ref={strip} className="cbx-m-chips" aria-label={t('{area} pages', { area: area.label })}>
                    {pages.map(page => {
                        const on = page.key === shell.nav.activePage;
                        return (
                            <Link key={page.key} href={navUrl(page)} className={`cbx-m-chip ${on ? 'is-on' : ''}`} aria-current={on ? 'page' : undefined}>
                                {page.label}
                                {page.locked === true && <NavPageMarks page={page} />}
                            </Link>
                        );
                    })}
                </nav>
            ) : (
                <div className="cbx-m-chips-gap" />
            )}
        </div>
    );
}

/** The bottom tab bar: up to four areas, then More. More is on while it is open or the area is not a tab. */
export function TabBar({ onMore }: { onMore: () => void }) {
    const { shell, t, Link, icons, overlay, setOverlay } = useShell();
    const tabs = tabAreas(shell.nav.areas, shell.nav.tabs);
    const moreOpen = overlay === 'more';
    const inTabs = tabs.some(area => area.key === shell.nav.activeArea);
    return (
        <nav className="cbx-tabbar" aria-label={t('Main')}>
            {tabs.map(area => {
                const Icon = resolveIcon(area.icon, icons);
                const on = !moreOpen && area.key === shell.nav.activeArea;
                return (
                    <Link key={area.key} href={navUrl(area)} className={`cbx-tab ${on ? 'is-on' : ''}`} aria-current={on ? 'page' : undefined} onClick={() => { if (moreOpen) setOverlay(null); }}>
                        <Icon size={23} strokeWidth={1.7} aria-hidden />
                        <span>{area.label}</span>
                    </Link>
                );
            })}
            <button type="button" className={`cbx-tab ${moreOpen || !inTabs ? 'is-on' : ''}`} aria-expanded={moreOpen} aria-controls="cbx-more" onClick={onMore}>
                <MoreHorizontal size={23} strokeWidth={1.7} aria-hidden />
                <span>{t('More')}</span>
            </button>
        </nav>
    );
}

type MoreView = { kind: 'root' } | { kind: 'area'; key: string } | { kind: 'account' } | { kind: 'option'; which: 'locale' | 'regionalFormat' | 'timeZone' };

function BackBar({ label, onBack }: { label: string; onBack: () => void }) {
    return (
        <div className="cbx-m-bar">
            <button type="button" className="cbx-m-back" onClick={onBack}>
                <ChevronLeft size={22} strokeWidth={2} aria-hidden />
                {label}
            </button>
        </div>
    );
}

function Row({ children, onClick, href, className, ...rest }: { children: ReactNode; onClick?: () => void; href?: string; className?: string; 'aria-current'?: 'page'; 'aria-haspopup'?: 'dialog'; target?: string; rel?: string }) {
    const { Link } = useShell();
    if (href !== undefined) {
        if (rest.target !== undefined) return <a href={href} className={`cbx-grow ${className ?? ''}`} onClick={onClick} {...rest}>{children}</a>;
        return <Link href={href} className={`cbx-grow ${className ?? ''}`} onClick={onClick} {...rest}>{children}</Link>;
    }
    return <button type="button" className={`cbx-grow ${className ?? ''}`} onClick={onClick} {...rest}>{children}</button>;
}

const Trail = () => <ChevronRight className="cbx-grow-trail" size={16} strokeWidth={1.8} aria-hidden />;

/**
 * More (V6): a full screen with push navigation. Search all pages; the app's areas (each opens
 * its grouped pages); where you work (each level opens the context sheet at that step); Help;
 * Switch app; and the profile last (the account screen). Tapping More again goes back to the top.
 */
export function MoreScreen({ view, setView }: { view: MoreView; setView: (view: MoreView) => void }) {
    const { t } = useShell();
    const top = useRef<HTMLElement>(null);
    useEffect(() => {
        if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
            try {
                window.scrollTo(0, 0);
            } catch {
                // happy-dom and old engines
            }
        }
        top.current?.focus({ preventScroll: true });
    }, [view]);
    let body: ReactNode;
    if (view.kind === 'area') body = <MoreArea areaKey={view.key} onBack={() => setView({ kind: 'root' })} />;
    else if (view.kind === 'account') body = <MoreAccount onBack={() => setView({ kind: 'root' })} onOption={which => setView({ kind: 'option', which })} />;
    else if (view.kind === 'option') body = <MoreOption which={view.which} onBack={() => setView({ kind: 'account' })} />;
    else body = <MoreRoot onArea={key => setView({ kind: 'area', key })} onAccount={() => setView({ kind: 'account' })} />;
    return (
        <section id="cbx-more" className="cbx-more" aria-label={t('More')} ref={top} tabIndex={-1}>
            {body}
        </section>
    );
}

function MoreRoot({ onArea, onAccount }: { onArea: (key: string) => void; onAccount: () => void }) {
    const { shell, t, icons, Link, setOverlay, openContext, toggleHelp } = useShell();
    const [q, setQ] = useState('');
    const unread = useUnread();
    const topic = helpTopicName(shell);
    const hits = useMemo(() => {
        const query = q.trim();
        if (query === '') return [];
        const found: Array<{ key: string; label: string; area: string; url: string; score: number }> = [];
        for (const area of shell.nav.areas) {
            const pages = area.pages ?? [];
            if (pages.length === 0) {
                const score = matchScore(area.label, query);
                if (score > 0) found.push({ key: area.key, label: area.label, area: area.label, url: navUrl(area), score });
            }
            for (const page of pages) {
                const score = Math.max(matchScore(page.label, query), matchScore(`${area.label} ${page.group ?? ''}`, query) > 0 ? 1 : 0);
                if (score > 0) found.push({ key: `${area.key}:${page.key}`, label: page.label, area: area.label, url: navUrl(page), score });
            }
        }
        return found.sort((a, b) => b.score - a.score);
    }, [q, shell]);
    const appName = shell.app.name.replace(/^Cbox\s*·?\s*/i, '');
    const account = shell.account ?? {};

    return (
        <div className="cbx-more-page">
            <div className="cbx-m-bar" />
            <h1 className="cbx-m-big">{t('More')}</h1>
            <label className="cbx-field-search">
                <Search size={18} strokeWidth={1.8} aria-hidden />
                <input type="search" value={q} onChange={event => setQ(event.target.value)} placeholder={t('Search all pages')} aria-label={t('Search all pages')} autoComplete="off" />
            </label>
            {q.trim() !== '' ? (
                <div className="cbx-group" role="group" aria-label={t('Pages')}>
                    {hits.map(hit => (
                        <Link key={hit.key} href={hit.url} className="cbx-grow" onClick={() => setOverlay(null)}>
                            <span className="cbx-grow-label">{hit.label}</span>
                            <span className="cbx-grow-count">{hit.area}</span>
                        </Link>
                    ))}
                    {hits.length === 0 && (
                        <button type="button" className="cbx-grow is-muted" onClick={() => setOverlay('palette')}>
                            <span className="cbx-grow-label">{t('No page matches. Search finds records too.')}</span>
                            <Trail />
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <h2 className="cbx-eyebrow">{appName}</h2>
                    <div className="cbx-group">
                        {shell.nav.areas.map(area => {
                            const Icon = resolveIcon(area.icon, icons);
                            const pages = area.pages ?? [];
                            const tile = (
                                <span className="cbx-tile" style={{ '--cbx-hue': String(hueFor(area.key)) } as Record<string, string>} aria-hidden="true">
                                    <Icon size={16} strokeWidth={1.8} aria-hidden />
                                </span>
                            );
                            const lock = areaLocked(area) ? (
                                <span className="cbx-nav-lock" title={t('Not in your plan')}>
                                    <Lock size={13} strokeWidth={1.9} aria-hidden />
                                    <span className="cbx-sr-only">{t('(locked)')}</span>
                                </span>
                            ) : null;
                            if (pages.length <= 1) {
                                return (
                                    <Row key={area.key} href={navUrl(area)} onClick={() => setOverlay(null)} aria-current={area.key === shell.nav.activeArea ? 'page' : undefined}>
                                        {tile}
                                        <span className="cbx-grow-label">{area.label}</span>
                                        {lock}
                                        <Trail />
                                    </Row>
                                );
                            }
                            return (
                                <Row key={area.key} onClick={() => onArea(area.key)}>
                                    {tile}
                                    <span className="cbx-grow-label">{area.label}</span>
                                    {lock}
                                    <span className="cbx-grow-count">{pages.length}</span>
                                    <Trail />
                                </Row>
                            );
                        })}
                    </div>
                    <WhereYouWork onStep={step => openContext(step, true)} />
                    <h2 className="cbx-eyebrow">{t('Help')}</h2>
                    <div className="cbx-group">
                        <Row className="is-tall" onClick={() => toggleHelp(true)} aria-haspopup="dialog">
                            <span className="cbx-tile is-accent" aria-hidden="true"><CircleHelp size={17} strokeWidth={1.8} /></span>
                            <span className="cbx-grow-text">
                                <span className="cbx-grow-strong">{t('Help with {page}', { page: topic })}</span>
                                <span className="cbx-grow-sub">{t('Articles, Ask Cbox, chat with support')}</span>
                            </span>
                            {unread > 0 && <span className="cbx-badge">{t('{count} new', { count: unread })}</span>}
                            <Trail />
                        </Row>
                    </div>
                    <div className="cbx-group">
                        {shell.notifications.enabled && (
                            <Row href={shell.notifications.url} onClick={() => setOverlay(null)}>
                                <span className="cbx-tile is-plain" aria-hidden="true"><Bell size={16} strokeWidth={1.8} /></span>
                                <span className="cbx-grow-label">{t('Notifications')}</span>
                                {shell.notifications.unread > 0 && <span className="cbx-badge">{shell.notifications.unread}</span>}
                                <Trail />
                            </Row>
                        )}
                        <Row onClick={() => setOverlay('apps-sheet')} aria-haspopup="dialog">
                            <span className="cbx-tile is-primary" aria-hidden="true"><LayoutGrid size={16} strokeWidth={2} /></span>
                            <span className="cbx-grow-label">{t('Switch app')}</span>
                            <Trail />
                        </Row>
                    </div>
                    <div className="cbx-group">
                        <Row className="is-tall" onClick={onAccount}>
                            <Avatar size={40} />
                            <span className="cbx-grow-text">
                                <span className="cbx-grow-strong">{shell.person.name}</span>
                                <span className="cbx-grow-sub">{account.signedInWith !== undefined ? account.signedInWith : t('Profile, language, theme')}</span>
                            </span>
                            <Trail />
                        </Row>
                    </div>
                </>
            )}
        </div>
    );
}

/** "Where you work": one row per level with its current value; each opens the context sheet there. */
function WhereYouWork({ onStep }: { onStep: (step: ContextStep['step']) => void }) {
    const { shell, t } = useShell();
    const levels = shell.context.levels;
    const environment = environmentLevel(levels);
    const parentOfEnvironment = environment !== undefined ? levels[levels.indexOf(environment) - 1]?.current.id : undefined;
    const list = useContextList(environment?.listUrl, { parent: parentOfEnvironment, enabled: environment !== undefined });
    if (levels.length === 0) return null;
    return (
        <>
            <h2 className="cbx-eyebrow">{t('Where you work')}</h2>
            <div className="cbx-group">
                {levels.map((level, index) => {
                    const env = level.key === 'environment';
                    return (
                        <Row key={level.key} onClick={() => onStep(env ? 'environments' : level.key)} aria-haspopup="dialog">
                            {index === 0 ? <Chip item={level.current} tone="soft" /> : env ? <span className="cbx-tile is-plain" aria-hidden="true"><ToneSquare tone={level.current.tone} /></span> : <span className="cbx-tile is-plain" aria-hidden="true">{level.current.initials ?? level.current.name.slice(0, 2)}</span>}
                            <span className="cbx-grow-text">
                                <span className="cbx-grow-sub">{level.label}</span>
                                <span className="cbx-grow-strong">{level.current.name}</span>
                            </span>
                            {env && list.status === 'ready' && !list.hasMore && <span className="cbx-grow-count">{list.items.length}</span>}
                            <Trail />
                        </Row>
                    );
                })}
            </div>
        </>
    );
}

function MoreArea({ areaKey, onBack }: { areaKey: string; onBack: () => void }) {
    const { shell, t, setOverlay } = useShell();
    const area = shell.nav.areas.find(item => item.key === areaKey);
    if (area === undefined) return null;
    return (
        <div className="cbx-more-page">
            <BackBar label={t('More')} onBack={onBack} />
            <h1 className="cbx-m-big">{area.label}</h1>
            <div className="cbx-m-gap" />
            {groupPages(area.pages ?? []).map((run, index) => (
                <section key={index} role="group" aria-label={run.group ?? area.label}>
                    {run.group !== undefined && <h2 className="cbx-eyebrow" aria-hidden="true">{run.group}</h2>}
                    <div className="cbx-group">
                        {run.pages.map(page => {
                            const on = area.key === shell.nav.activeArea && page.key === shell.nav.activePage;
                            return (
                                <Row key={page.key} href={navUrl(page)} onClick={() => setOverlay(null)} aria-current={on ? 'page' : undefined} className={page.locked === true ? 'is-locked' : ''}>
                                    <span className="cbx-grow-label">{page.label}</span>
                                    <NavPageMarks page={page} />
                                    <Trail />
                                </Row>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}

const DEFAULT_LANGUAGES: ShellOption[] = [
    { code: 'en', label: 'English' },
    { code: 'da', label: 'Dansk' },
];
const DEFAULT_FORMATS: ShellOption[] = [
    { code: 'en-GB', label: 'English (United Kingdom)' },
    { code: 'en-US', label: 'English (United States)' },
    { code: 'da-DK', label: 'Dansk (Danmark)' },
    { code: 'de-DE', label: 'Deutsch (Deutschland)' },
    { code: 'sv-SE', label: 'Svenska (Sverige)' },
    { code: 'nb-NO', label: 'Norsk bokmål (Norge)' },
];

function zones(): ShellOption[] {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    const list = typeof supported === 'function' ? supported('timeZone') : ['UTC', 'Europe/Copenhagen', 'Europe/London', 'Europe/Berlin', 'America/New_York'];
    return list.map(zone => ({ code: zone, label: zone.replace(/_/g, ' ') }));
}

/** The account screen (V6): profile and security, language, format, time zone, theme, switch account, sign out. */
function MoreAccount({ onBack, onOption }: { onBack: () => void; onOption: (which: 'locale' | 'regionalFormat' | 'timeZone') => void }) {
    const { shell, t, preferences, setPreference, navigate } = useShell();
    const account = shell.account ?? {};
    const languages = account.languages ?? DEFAULT_LANGUAGES;
    const formats = account.formats ?? DEFAULT_FORMATS;
    const label = (options: ShellOption[], code: string | undefined, fallback: string) => options.find(option => option.code === code)?.label ?? code ?? fallback;
    const themes: Array<{ value: ShellTheme; label: string }> = [
        { value: 'system', label: t('System') },
        { value: 'light', label: t('Light') },
        { value: 'dark', label: t('Dark') },
    ];
    return (
        <div className="cbx-more-page">
            <BackBar label={t('More')} onBack={onBack} />
            <h1 className="cbx-m-big">{t('Account')}</h1>
            <div className="cbx-m-gap" />
            <div className="cbx-group">
                <div className="cbx-grow is-tall is-static">
                    <Avatar size={40} />
                    <span className="cbx-grow-text">
                        <span className="cbx-grow-strong">{shell.person.name}</span>
                        <span className="cbx-grow-sub">{account.signedInWith ?? t('Signed in with Cbox ID')}</span>
                    </span>
                </div>
                {account.profileUrl !== undefined && (
                    <a className="cbx-grow" href={account.profileUrl}>
                        <span className="cbx-grow-label">{t('Profile and security')}</span>
                        <ArrowUpRight className="cbx-grow-trail" size={16} strokeWidth={1.8} aria-hidden />
                    </a>
                )}
            </div>
            <div className="cbx-group">
                <Row onClick={() => onOption('locale')}>
                    <span className="cbx-grow-label">{t('Language')}</span>
                    <span className="cbx-grow-value">{label(languages, preferences.locale, 'English')}</span>
                </Row>
                <Row onClick={() => onOption('regionalFormat')}>
                    <span className="cbx-grow-label">{t('Regional format')}</span>
                    <span className="cbx-grow-value">{label(formats, preferences.regionalFormat, t('Automatic'))}</span>
                </Row>
                <Row onClick={() => onOption('timeZone')}>
                    <span className="cbx-grow-label">{t('Time zone')}</span>
                    <span className="cbx-grow-value">{(preferences.timeZone ?? t('Automatic')).replace(/_/g, ' ')}</span>
                </Row>
            </div>
            <h2 className="cbx-eyebrow" id="cbx-theme-label">{t('Theme')}</h2>
            <div className="cbx-seg" role="radiogroup" aria-labelledby="cbx-theme-label">
                {themes.map(theme => (
                    <button key={theme.value} type="button" role="radio" aria-checked={preferences.theme === theme.value} className={preferences.theme === theme.value ? 'is-on' : ''} onClick={() => setPreference('theme', theme.value)}>
                        {theme.label}
                    </button>
                ))}
            </div>
            {(account.switchAccountUrl !== undefined || account.signOutUrl !== undefined) && (
                <div className="cbx-group">
                    {account.switchAccountUrl !== undefined && (
                        <a className="cbx-grow" href={account.switchAccountUrl}>
                            <span className="cbx-grow-label">{t('Switch account')}</span>
                        </a>
                    )}
                    {account.signOutUrl !== undefined && (
                        <button type="button" className="cbx-grow is-danger" onClick={() => navigate(account.signOutUrl!, { method: account.signOutMethod ?? 'post' })}>
                            <span className="cbx-grow-label">{t('Sign out')}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function MoreOption({ which, onBack }: { which: 'locale' | 'regionalFormat' | 'timeZone'; onBack: () => void }) {
    const { shell, t, preferences, setPreference } = useShell();
    const account = shell.account ?? {};
    const options = which === 'locale' ? (account.languages ?? DEFAULT_LANGUAGES) : which === 'regionalFormat' ? (account.formats ?? DEFAULT_FORMATS) : zones();
    const title = which === 'locale' ? t('Language') : which === 'regionalFormat' ? t('Regional format') : t('Time zone');
    return (
        <div className="cbx-more-page">
            <BackBar label={t('Account')} onBack={onBack} />
            <h1 className="cbx-m-big">{title}</h1>
            <div className="cbx-m-gap" />
            <OptionList
                label={title}
                options={options}
                current={preferences[which]}
                autoFocus={false}
                onPick={code => {
                    setPreference(which, code);
                    onBack();
                }}
            />
        </div>
    );
}

/** The phone layout's own state: which More screen is showing. */
export function useMoreView(): [MoreView, (view: MoreView) => void] {
    const [view, setView] = useState<MoreView>({ kind: 'root' });
    return [view, setView];
}
export type { MoreView };

/**
 * The context sheet (V6). Its root lists the organization and project rows (each opens its own
 * list), then the environment quick picks (current, a live one, a test one) and "All N
 * environments", grouped by the app's environment groups. Every list has search; "New …" when
 * the app can create. Opened at a step from More, Back closes it and picking closes it.
 */
export function ContextSheet({ onClose }: { onClose: () => void }) {
    const { shell, t, switchTo, contextStep } = useShell();
    const [step, setStep] = useState<ContextStep['step']>(contextStep.step);
    const direct = contextStep.direct;
    const levels = shell.context.levels;
    const back = () => (direct ? onClose() : setStep('root'));

    if (step === 'environments') {
        const environment = environmentLevel(levels);
        if (environment !== undefined) {
            const index = levels.indexOf(environment);
            const parent = levels[index - 1];
            return (
                <Sheet label={parent !== undefined && index > 0 ? t('{things} in {name}', { things: pluralOf(environment), name: parent.current.name }) : pluralOf(environment)} size="tall" onClose={onClose} back={{ label: t('Back'), onBack: back }}>
                    <EnvironmentList level={environment} parent={index > 0 ? parent?.current.id : undefined} parentName={index > 0 ? parent?.current.name : undefined} onPick={item => switchTo(parent !== undefined && index > 0 ? { [parent.key]: parent.current.id, [environment.key]: item.id } : { [environment.key]: item.id })} />
                </Sheet>
            );
        }
    }

    const level = levels.find(item => item.key === step);
    if (step !== 'root' && level !== undefined) {
        const index = levels.indexOf(level);
        const parent = index > 0 ? levels[index - 1] : undefined;
        const inner = levels[index + 1];
        return (
            <Sheet label={level.label} size="tall" onClose={onClose} back={{ label: t('Back'), onBack: back }}>
                <div className="cbx-sheet-level">
                    <LevelPane
                        level={level}
                        parent={parent?.current.id}
                        currentId={level.current.id}
                        heading={pluralOf(level)}
                        createLabel={t('New {thing}', { thing: level.label.toLowerCase() })}
                        onPick={item => (index === 0 ? switchTo({ [level.key]: item.id }) : void pickKeepingEnvironment(level, inner, item, switchTo))}
                    />
                </div>
            </Sheet>
        );
    }

    return (
        <Sheet label={t('Where you work')} onClose={onClose}>
            <ContextRoot onStep={setStep} />
        </Sheet>
    );
}

function ContextRoot({ onStep }: { onStep: (step: ContextStep['step']) => void }) {
    const { shell, t, switchTo } = useShell();
    const levels = shell.context.levels;
    const environment = environmentLevel(levels);
    const above = levels.filter(level => level !== environment);
    const envIndex = environment !== undefined ? levels.indexOf(environment) : -1;
    const parent = envIndex > 0 ? levels[envIndex - 1] : undefined;
    const list = useContextList(environment?.listUrl, { parent: parent?.current.id, enabled: environment !== undefined });
    const picks = environment !== undefined ? quickEnvironments(list.items, environment.current) : [];
    const pick = (item: ContextItem) => {
        if (environment === undefined) return;
        switchTo(parent !== undefined ? { [parent.key]: parent.current.id, [environment.key]: item.id } : { [environment.key]: item.id });
    };
    return (
        <>
            <div className="cbx-group">
                {above.map((level, index) => (
                    <Row key={level.key} onClick={() => onStep(level.key)}>
                        {index === 0 && <Chip item={level.current} tone="soft" />}
                        <span className="cbx-grow-text">
                            <span className="cbx-grow-sub">{level.label}</span>
                            <span className="cbx-grow-strong">{level.current.name}</span>
                        </span>
                        <Trail />
                    </Row>
                ))}
            </div>
            {environment !== undefined && (
                <>
                    <h2 className="cbx-eyebrow">{environment.label}</h2>
                    <div className="cbx-group" role="group" aria-label={environment.label}>
                        {picks.map(item => {
                            const current = item.id === environment.current.id;
                            return (
                                <button key={item.id} type="button" className="cbx-grow" aria-current={current ? 'true' : undefined} onClick={() => (current ? undefined : pick(item))}>
                                    <ToneSquare tone={item.tone} />
                                    <span className="cbx-grow-label cbx-grow-strong">{item.name}</span>
                                    {current && <Check className="cbx-grow-check" size={18} strokeWidth={2} aria-label={t('Current')} />}
                                </button>
                            );
                        })}
                        <button type="button" className="cbx-grow is-accent" onClick={() => onStep('environments')}>
                            <span className="cbx-grow-label">{list.status === 'ready' && !list.hasMore ? t('All {count} {things}', { count: list.items.length, things: pluralOf(environment).toLowerCase() }) : t('All {things}', { things: pluralOf(environment).toLowerCase() })}</span>
                            <Trail />
                        </button>
                    </div>
                </>
            )}
        </>
    );
}

/** Every environment, searchable, under the app's groups, with a check on the current one. */
export function EnvironmentList({ level, parent, parentName, onPick }: { level: ContextLevel; parent?: string; parentName?: string; onPick: (item: ContextItem) => void }) {
    const { t } = useShell();
    const [q, setQ] = useState('');
    const [creating, setCreating] = useState(false);
    const list = useContextList(level.listUrl, { q, parent });
    const plural = pluralOf(level);
    return (
        <div className="cbx-env-list">
            <label className="cbx-field-search">
                <Search size={18} strokeWidth={1.8} aria-hidden />
                <input type="search" value={q} onChange={event => setQ(event.target.value)} placeholder={t('Search {things}', { things: plural.toLowerCase() })} aria-label={t('Search {things}', { things: plural.toLowerCase() })} autoComplete="off" />
            </label>
            {groupItems(list.items).map((run, index) => (
                <section key={run.group ?? `run-${index}`} aria-label={run.group ?? plural}>
                    {run.group !== undefined && <h2 className="cbx-eyebrow">{run.group}</h2>}
                    <div className="cbx-group">
                        {run.items.map(item => {
                            const current = item.id === level.current.id;
                            return (
                                <button key={item.id} type="button" className="cbx-grow" aria-current={current ? 'true' : undefined} onClick={() => (current ? undefined : onPick(item))}>
                                    <ToneSquare tone={item.tone} />
                                    <span className="cbx-grow-text">
                                        <span className="cbx-grow-strong">{item.name}</span>
                                        {(item.description ?? item.label) !== undefined && <span className="cbx-grow-sub">{item.description ?? item.label}</span>}
                                    </span>
                                    {current && <Check className="cbx-grow-check" size={18} strokeWidth={2} aria-label={t('Current')} />}
                                </button>
                            );
                        })}
                    </div>
                </section>
            ))}
            {list.hasMore && (
                <div className="cbx-group">
                    <button type="button" className="cbx-grow is-accent" onClick={list.loadMore}>
                        <span className="cbx-grow-label">{list.loadingMore ? t('Loading…') : t('Show more')}</span>
                    </button>
                </div>
            )}
            {list.status === 'loading' && list.items.length === 0 && <p className="cbx-list-note" aria-live="polite">{t('Loading…')}</p>}
            {list.status === 'error' && (
                <p className="cbx-list-note" role="alert">
                    {t('{things} could not be loaded.', { things: plural })} <button type="button" className="cbx-link" onClick={list.retry}>{t('Try again')}</button>
                </p>
            )}
            {list.status === 'ready' && list.items.length === 0 && <p className="cbx-list-note" aria-live="polite">{q.trim() === '' ? t('No {things} yet.', { things: plural.toLowerCase() }) : t('Nothing matches “{query}”.', { query: q.trim() })}</p>}
            {level.createUrl !== undefined && (
                <div className="cbx-group">
                    {creating ? (
                        <div className="cbx-grow is-static">
                            <InlineCreate level={level} parent={parent} label={parentName !== undefined ? t('New {thing} in {name}', { thing: level.label.toLowerCase(), name: parentName }) : t('New {thing}', { thing: level.label.toLowerCase() })} onCancel={() => setCreating(false)} />
                        </div>
                    ) : (
                        <button type="button" className="cbx-grow is-accent" onClick={() => setCreating(true)}>
                            <Plus size={16} strokeWidth={1.8} aria-hidden />
                            <span className="cbx-grow-label">{t('New {thing}', { thing: level.label.toLowerCase() })}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

/** Switch app, as a sheet from More. */
export function AppsSheet({ onClose }: { onClose: () => void }) {
    const { t } = useShell();
    return (
        <Sheet label={t('Switch app')} onClose={onClose}>
            <AppGrid autoFocus={false} />
        </Sheet>
    );
}

/**
 * The page under the phone chrome. It stays mounted under More, so its state survives. A heading
 * the app marks `data-cbx-page-title` that says what the top bar already shows large is hidden
 * on the phone (kept for screen readers), so the title is not there twice.
 */
export function MobilePage({ hidden, children }: { hidden: boolean; children: ReactNode }) {
    const box = useRef<HTMLDivElement>(null);
    const title = useShellPageTitle();
    useEffect(() => {
        const page = box.current;
        if (page === null) return;
        const mark = () => {
            for (const heading of page.querySelectorAll<HTMLElement>('[data-cbx-page-title]')) {
                const same = title !== null && sameTitle(heading.textContent ?? '', title);
                if (same !== heading.hasAttribute('data-cbx-same-title')) heading.toggleAttribute('data-cbx-same-title', same);
            }
        };
        mark();
        if (typeof MutationObserver === 'undefined') return;
        const observer = new MutationObserver(mark);
        observer.observe(page, { childList: true, subtree: true, characterData: true });
        return () => observer.disconnect();
    }, [title]);
    return (
        <div ref={box} className="cbx-m-page" hidden={hidden}>
            {children}
        </div>
    );
}
