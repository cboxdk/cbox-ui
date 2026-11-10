import { ArrowLeft, ArrowUpRight, ChevronRight, Globe, LogOut, Monitor, Moon, Sun, UserRound, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShell } from './context';
import { OptionList, rovingKeyDown } from './option-list';
import type { ShellOption, ShellTheme } from './types';

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

const FALLBACK_ZONES = ['UTC', 'Europe/Copenhagen', 'Europe/London', 'Europe/Berlin', 'Europe/Stockholm', 'Europe/Oslo', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo'];

function timeZones(): ShellOption[] {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    const zones = typeof supported === 'function' ? supported('timeZone') : FALLBACK_ZONES;
    return zones.map(zone => ({ code: zone, label: zone.replace(/_/g, ' ') }));
}

export function Avatar({ size = 30 }: { size?: number }) {
    const { shell } = useShell();
    const { person } = shell;
    return (
        <span className="cbx-avatar" style={{ width: size, height: size }} aria-hidden="true">
            {person.avatarUrl !== undefined ? <img src={person.avatarUrl} alt="" width={size} height={size} /> : person.initials}
        </span>
    );
}

type View = 'main' | 'language' | 'format' | 'timeZone';

/**
 * The account menu (§10): who is signed in, Profile and security in Cbox ID, language, regional
 * format and time zone (Cbox ID's shared preferences), theme, Switch account and Sign out.
 * `inline` renders it as a section of the mobile navigation sheet.
 */
export function AccountMenu({ inline = false, onDone }: { inline?: boolean; onDone?: () => void }) {
    const { shell, t, preferences, setPreference, navigate } = useShell();
    const { account, person } = shell;
    const [view, setView] = useState<View>('main');
    const menu = useRef<HTMLDivElement>(null);
    // In the mobile sheet the items are ordinary tab stops; as a popover they rove.
    const tab = inline ? 0 : -1;
    const languages = account.languages ?? DEFAULT_LANGUAGES;
    const formats = account.formats ?? DEFAULT_FORMATS;
    const zones = useMemo(() => (view === 'timeZone' ? timeZones() : []), [view]);

    useEffect(() => {
        if (view !== 'main' || inline) return;
        // The first item takes focus: it is a menu, not a text field, so no keyboard comes up on touch.
        menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }, [view, inline]);

    const label = (options: ShellOption[], code: string | undefined, fallback: string) => options.find(option => option.code === code)?.label ?? code ?? fallback;
    const back = (
        <button type="button" className="cbx-row cbx-row-action cbx-back" onClick={() => setView('main')}>
            <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
            <span className="cbx-row-name">{t('Account')}</span>
        </button>
    );
    const pick = <K extends 'locale' | 'regionalFormat' | 'timeZone'>(key: K) => (code: string) => {
        setPreference(key, code);
        setView('main');
    };

    if (view === 'language') return <div className="cbx-menu cbx-menu-account">{back}<OptionList label={t('Language')} options={languages} current={preferences.locale} onPick={pick('locale')} /></div>;
    if (view === 'format') return <div className="cbx-menu cbx-menu-account">{back}<OptionList label={t('Regional format')} options={formats} current={preferences.regionalFormat} onPick={pick('regionalFormat')} /></div>;
    if (view === 'timeZone') return <div className="cbx-menu cbx-menu-account">{back}<OptionList label={t('Time zone')} options={zones} current={preferences.timeZone} onPick={pick('timeZone')} /></div>;

    const themes: Array<{ value: ShellTheme; label: string; icon: typeof Sun }> = [
        { value: 'system', label: t('System'), icon: Monitor },
        { value: 'light', label: t('Light'), icon: Sun },
        { value: 'dark', label: t('Dark'), icon: Moon },
    ];

    return (
        <div ref={menu} className={`cbx-menu cbx-menu-account ${inline ? 'is-inline' : ''}`} role="menu" aria-label={t('Account')} onKeyDown={event => rovingKeyDown(event, menu.current)}>
            <div className="cbx-account-head">
                <Avatar size={36} />
                <div className="cbx-account-who">
                    <span className="cbx-account-name cbx-truncate" title={person.name}>{person.name}</span>
                    <span className="cbx-account-sub cbx-truncate">{account.signedInWith ?? t('Signed in with Cbox ID')}</span>
                </div>
            </div>
            <div className="cbx-list" role="none">
                <a role="menuitem" tabIndex={tab} className="cbx-row cbx-row-action" href={account.profileUrl} onClick={onDone}>
                    <UserRound size={16} strokeWidth={1.8} aria-hidden />
                    <span className="cbx-row-name">{t('Profile and security')}</span>
                    <ArrowUpRight className="cbx-row-trail" size={14} strokeWidth={1.8} aria-hidden />
                </a>
                <button role="menuitem" tabIndex={tab} type="button" className="cbx-row cbx-row-action" aria-haspopup="listbox" onClick={() => setView('language')}>
                    <Globe size={16} strokeWidth={1.8} aria-hidden />
                    <span className="cbx-row-name">{t('Language')}</span>
                    <span className="cbx-row-value cbx-truncate">{label(languages, preferences.locale, 'English')}</span>
                    <ChevronRight className="cbx-row-trail" size={16} strokeWidth={1.8} aria-hidden />
                </button>
                <button role="menuitem" tabIndex={tab} type="button" className="cbx-row cbx-row-action" aria-haspopup="listbox" onClick={() => setView('format')}>
                    <span className="cbx-row-icon-gap" aria-hidden="true" />
                    <span className="cbx-row-name">{t('Regional format')}</span>
                    <span className="cbx-row-value cbx-truncate">{label(formats, preferences.regionalFormat, t('Automatic'))}</span>
                    <ChevronRight className="cbx-row-trail" size={16} strokeWidth={1.8} aria-hidden />
                </button>
                <button role="menuitem" tabIndex={tab} type="button" className="cbx-row cbx-row-action" aria-haspopup="listbox" onClick={() => setView('timeZone')}>
                    <span className="cbx-row-icon-gap" aria-hidden="true" />
                    <span className="cbx-row-name">{t('Time zone')}</span>
                    <span className="cbx-row-value cbx-truncate">{(preferences.timeZone ?? t('Automatic')).replace(/_/g, ' ')}</span>
                    <ChevronRight className="cbx-row-trail" size={16} strokeWidth={1.8} aria-hidden />
                </button>
                <div className="cbx-theme" role="group" aria-label={t('Theme')}>
                    <span className="cbx-theme-label">{t('Theme')}</span>
                    <div className="cbx-segmented">
                        {themes.map(theme => (
                            <button
                                key={theme.value}
                                type="button"
                                role="menuitemradio"
                                tabIndex={tab}
                                aria-checked={preferences.theme === theme.value}
                                className={preferences.theme === theme.value ? 'is-on' : ''}
                                onClick={() => setPreference('theme', theme.value)}
                            >
                                <theme.icon size={14} strokeWidth={1.8} aria-hidden />
                                {theme.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="cbx-list cbx-list-foot" role="none">
                {/* A plain link, so it is a full page load: switching account goes through Cbox ID,
                    which an Inertia visit could not follow cross-origin. */}
                <a role="menuitem" tabIndex={tab} className="cbx-row cbx-row-action" href={account.switchAccountUrl} onClick={onDone}>
                    <Users size={16} strokeWidth={1.8} aria-hidden />
                    <span className="cbx-row-name">{t('Switch account')}</span>
                </a>
                <button role="menuitem" tabIndex={tab} type="button" className="cbx-row cbx-row-action" onClick={() => { onDone?.(); navigate(account.signOutUrl, { method: account.signOutMethod ?? 'post' }); }}>
                    <LogOut size={16} strokeWidth={1.8} aria-hidden />
                    <span className="cbx-row-name">{t('Sign out')}</span>
                </button>
            </div>
        </div>
    );
}
