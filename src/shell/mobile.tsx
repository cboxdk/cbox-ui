import { ArrowLeft, Bell, LayoutGrid, Lock, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccountMenu } from './account-menu';
import { AppGrid } from './app-grid';
import { LevelPane, pickKeepingEnvironment } from './context-menus';
import { useShell } from './context';
import { pluralOf } from './data';
import { resolveIcon } from './icons';
import { areaLocked, NavPageList, NavPageMarks, navUrl } from './nav-pages';
import { trapTab } from './popover';

/**
 * A modal sheet for the phone layout (§4.5): it traps focus, closes on Escape and on the scrim,
 * and gives focus back to what opened it.
 */
export function Sheet({ label, side, onClose, children, head }: { label: string; side: 'left' | 'bottom'; onClose: () => void; children: ReactNode; head?: ReactNode }) {
    const { t } = useShell();
    const panel = useRef<HTMLDivElement>(null);
    const opener = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);
    useEffect(() => {
        panel.current?.focus();
        const back = opener.current;
        return () => {
            if (back instanceof HTMLElement) back.focus();
        };
    }, []);
    return (
        <div className="cbx-overlay cbx-sheet-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
            <div
                ref={panel}
                className={`cbx-sheet cbx-sheet-${side}`}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                tabIndex={-1}
                onKeyDown={event => {
                    if (event.key === 'Escape' && !event.defaultPrevented) {
                        event.preventDefault();
                        onClose();
                    }
                    trapTab(event, panel.current);
                }}
            >
                <div className="cbx-sheet-head">
                    {head ?? <strong className="cbx-sheet-title">{label}</strong>}
                    <button type="button" className="cbx-icon-button" onClick={onClose} aria-label={t('Close')}>
                        <X size={18} strokeWidth={1.8} aria-hidden />
                    </button>
                </div>
                <div className="cbx-sheet-body">{children}</div>
            </div>
        </div>
    );
}

/** ☰: areas with their pages, Switch app, notifications when the app has them, and the account. */
export function NavSheet({ onClose }: { onClose: () => void }) {
    const { shell, t, Link, icons } = useShell();
    const [view, setView] = useState<'nav' | 'apps'>('nav');
    if (view === 'apps') {
        return (
            <Sheet
                label={t('Switch app')}
                side="left"
                onClose={onClose}
                head={
                    <button type="button" className="cbx-row cbx-row-action cbx-back" onClick={() => setView('nav')}>
                        <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
                        <span className="cbx-row-name">{t('Switch app')}</span>
                    </button>
                }
            >
                <AppGrid autoFocus={false} />
            </Sheet>
        );
    }
    return (
        <Sheet label={shell.app.name} side="left" onClose={onClose}>
            <nav aria-label={t('Navigation')} className="cbx-list">
                {shell.nav.areas.map(area => {
                    const Icon = resolveIcon(area.icon, icons);
                    const activeArea = area.key === shell.nav.activeArea;
                    return (
                        <div key={area.key} className="cbx-sheet-area">
                            <Link href={navUrl(area)} className={`cbx-row cbx-row-action ${activeArea ? ((area.pages ?? []).length > 1 ? 'is-open' : 'is-current') : ''}`} aria-current={activeArea && (area.pages ?? []).length <= 1 ? 'page' : undefined} onClick={onClose}>
                                <Icon size={16} strokeWidth={1.8} aria-hidden />
                                <span className="cbx-row-name">{area.label}</span>
                                {areaLocked(area) && (
                                    <span className="cbx-nav-lock" title={t('Not in your plan')}>
                                        <Lock size={13} strokeWidth={1.9} aria-hidden />
                                        <span className="cbx-sr-only">{t('(locked)')}</span>
                                    </span>
                                )}
                            </Link>
                            {(area.pages ?? []).length > 1 && (
                                <div className="cbx-sheet-pages">
                                    <NavPageList
                                        pages={area.pages ?? []}
                                        renderPage={page => {
                                            const on = activeArea && page.key === shell.nav.activePage;
                                            return (
                                                <Link key={page.key} href={navUrl(page)} className={`cbx-row cbx-row-action ${on ? 'is-current' : ''} ${page.locked === true ? 'is-locked' : ''}`} aria-current={on ? 'page' : undefined} data-locked={page.locked === true ? 'true' : undefined} onClick={onClose}>
                                                    <span className="cbx-row-name">{page.label}</span>
                                                    <NavPageMarks page={page} />
                                                </Link>
                                            );
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>
            <div className="cbx-list cbx-list-foot">
                <button type="button" className="cbx-row cbx-row-action" onClick={() => setView('apps')}>
                    <LayoutGrid size={16} strokeWidth={1.8} aria-hidden />
                    <span className="cbx-row-name">{t('Switch app')}</span>
                </button>
                {shell.notifications.enabled && (
                    <Link href={shell.notifications.url} className="cbx-row cbx-row-action" onClick={onClose}>
                        <Bell size={16} strokeWidth={1.8} aria-hidden />
                        <span className="cbx-row-name">{t('Notifications')}</span>
                        {shell.notifications.unread > 0 && <span className="cbx-count is-inline">{shell.notifications.unread}</span>}
                    </Link>
                )}
            </div>
            <AccountMenu inline onDone={onClose} />
        </Sheet>
    );
}

/** The one context button's sheet: every level stacked, each with search and "New …" (§4.5). */
export function ContextSheet({ onClose }: { onClose: () => void }) {
    const { shell, t, switchTo } = useShell();
    const [organization, outer, inner] = shell.context.levels;
    return (
        <Sheet label={t('Where you are')} side="bottom" onClose={onClose}>
            {organization !== undefined && (
                <section className="cbx-sheet-level" aria-label={organization.label}>
                    <LevelPane
                        level={organization}
                        currentId={organization.current.id}
                        heading={pluralOf(organization)}
                        createLabel={t('New {thing}', { thing: organization.label.toLowerCase() })}
                        onPick={item => switchTo({ [organization.key]: item.id })}
                    />
                </section>
            )}
            {outer !== undefined && (
                <section className="cbx-sheet-level" aria-label={outer.label}>
                    <LevelPane
                        level={outer}
                        parent={organization?.current.id}
                        currentId={outer.current.id}
                        heading={pluralOf(outer)}
                        createLabel={t('New {thing}', { thing: outer.label.toLowerCase() })}
                        onPick={item => void pickKeepingEnvironment(outer, inner, item, switchTo)}
                    />
                </section>
            )}
            {outer !== undefined && inner !== undefined && (
                <section className="cbx-sheet-level" aria-label={inner.label}>
                    <LevelPane
                        level={inner}
                        parent={outer.current.id}
                        currentId={inner.current.id}
                        heading={t('{things} in {name}', { things: pluralOf(inner), name: outer.current.name })}
                        createLabel={t('New {thing} in {name}', { thing: inner.label.toLowerCase(), name: outer.current.name })}
                        onPick={item => switchTo({ [outer.key]: outer.current.id, [inner.key]: item.id })}
                    />
                </section>
            )}
        </Sheet>
    );
}
