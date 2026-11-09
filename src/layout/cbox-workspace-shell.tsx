import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, Pin, PinOff, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { CboxBrand } from './cbox-brand';
import type { CboxNavItem, LinkComponent } from './cbox-app-sidebar';
import { useCboxLocalization } from '../context/localization';

export type CboxNavArea = CboxNavItem & { items?: CboxNavItem[] };
export type CboxWorkspaceShellProps = {
    appKey: string;
    brandSubmark: string;
    areas: CboxNavArea[];
    currentPath: string;
    LinkComponent: LinkComponent;
    context: ReactNode;
    tools: ReactNode;
    account: ReactNode;
    children: ReactNode;
    /** Where the brand row links. Default `/`. */
    brandHref?: string;
    /** `id` of the `<main>` landmark, so a host's skip link can target it. Default `main-content`. */
    mainId?: string;
    /**
     * Rail pinned open. Pass `pinned` + `onPinnedChange` to control it (the host persists the
     * preference, in a cookie or Cbox ID), or `defaultPinned` to seed the shell's own state.
     */
    pinned?: boolean;
    defaultPinned?: boolean;
    onPinnedChange?: (pinned: boolean) => void;
    /** Contextual subnav collapsed to its strip. Controlled and uncontrolled as `pinned`. */
    collapsed?: boolean;
    defaultCollapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
};

/**
 * How well `href` matches `path`: the href's length when the path is the href or beneath it,
 * -1 otherwise. `/` matches only itself, so a home item never claims every page.
 */
export function navMatchLength(path: string, href: string): number {
    if (href === '/') {
        return path === '/' ? 1 : -1;
    }

    return path === href || path.startsWith(href + '/') ? href.length : -1;
}

/** The item whose href is the most specific match for `path`, or undefined. */
export function activeNavItem<T extends CboxNavItem>(path: string, items: readonly T[]): T | undefined {
    let best: T | undefined;
    let length = -1;
    for (const item of items) {
        const match = navMatchLength(path, item.href);
        if (match > length) {
            best = item;
            length = match;
        }
    }

    return best;
}

/**
 * The area `path` is in: the one holding the most specific match among its own href and its
 * items' hrefs. A first-match would put every page beneath an area at `/` (an overview, a
 * dashboard) under that area and never show another area's subnav.
 */
export function activeNavArea<T extends CboxNavArea>(path: string, areas: readonly T[]): T | undefined {
    let best: T | undefined;
    let length = -1;
    for (const area of areas) {
        const candidates = [area.href, ...(area.items ?? []).map(item => item.href)];
        const match = Math.max(...candidates.map(href => navMatchLength(path, href)));
        if (match > length) {
            best = area;
            length = match;
        }
    }

    return best;
}

function useControllable(value: boolean | undefined, fallback: boolean, onChange: ((next: boolean) => void) | undefined): [boolean, (next: boolean | ((current: boolean) => boolean)) => void] {
    const [own, setOwn] = useState(fallback);
    const current = value ?? own;
    const ref = useRef(current);
    ref.current = current;
    const set = useCallback((next: boolean | ((current: boolean) => boolean)) => {
        const resolved = typeof next === 'function' ? next(ref.current) : next;
        if (value === undefined) setOwn(resolved);
        onChange?.(resolved);
    }, [value, onChange]);

    return [current, set];
}

/** Two-tier workspace navigation. Route ownership and preference persistence stay with the host. */
export function CboxWorkspaceShell({ appKey, brandSubmark, areas, currentPath, LinkComponent: Link, context, tools, account, children, brandHref = '/', mainId = 'main-content', pinned: pinnedProp, defaultPinned = false, onPinnedChange, collapsed: collapsedProp, defaultCollapsed = false, onCollapsedChange }: CboxWorkspaceShellProps) {
    const { t } = useCboxLocalization();
    const [pinned, setPinned] = useControllable(pinnedProp, defaultPinned, onPinnedChange);
    const [collapsed, setCollapsed] = useControllable(collapsedProp, defaultCollapsed, onCollapsedChange);
    const [expanded, setExpanded] = useState(false);
    const [mobile, setMobile] = useState(false);
    const dialog = useRef<HTMLDialogElement>(null);
    const path = currentPath.split(/[?#]/)[0] ?? '/';
    const area = activeNavArea(path, areas);
    const subnav = area?.items && area.items.length > 1 ? area : undefined;
    useEffect(() => { setMobile(false); }, [currentPath]);
    useEffect(() => {
        const el = dialog.current;
        if (mobile && el && !el.open) el.showModal();
        if (!mobile && el?.open) el.close();
    }, [mobile]);
    useEffect(() => {
        const key = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === '.') {
                event.preventDefault(); setCollapsed(value => !value);
            }
        };
        addEventListener('keydown', key);
        return () => removeEventListener('keydown', key);
    }, [setCollapsed]);
    const open = pinned || expanded;
    const links = (items: CboxNavItem[]) => {
        const active = activeNavItem(path, items);
        return items.map(item => <Link key={item.href} href={item.href} className={`cbx-workspace-link ${item === active ? 'is-active' : ''}`} aria-label={item.label} aria-current={item === active ? 'page' : undefined}><item.icon className="h-4 w-4 shrink-0" strokeWidth={1.7} /><span>{item.label}</span></Link>);
    };
    return <div className="cbx-workspace">
        <div className="cbx-rail-slot" data-pinned={pinned}>
            <aside className="cbx-rail" data-open={open} onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)} onFocusCapture={() => setExpanded(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false); }}>
                <div className="cbx-rail-brand"><Link href={brandHref} aria-label={t('Home')}><span className="dark:hidden"><CboxBrand appKey={appKey} submark={brandSubmark} collapsed={!open} /></span><span className="hidden dark:block"><CboxBrand appKey={appKey} submark={brandSubmark} collapsed={!open} tone="light" /></span></Link>{open && <button type="button" onClick={() => setPinned(value => !value)} aria-label={t(pinned ? 'Unpin navigation' : 'Pin navigation')} aria-pressed={pinned}>{pinned ? <PinOff size={16} /> : <Pin size={16} />}</button>}</div>
                <nav aria-label={brandSubmark}>{areas.map(item => <Link key={item.href} href={item.href} aria-label={item.label} aria-current={area === item ? 'page' : undefined} title={open ? undefined : item.label} className={`cbx-workspace-link ${area === item ? 'is-active' : ''}`}><item.icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />{open && <span>{item.label}</span>}</Link>)}</nav>
                <div className="cbx-rail-account">{account}</div>
            </aside>
        </div>
        <div className="cbx-workspace-column">
            <header className="cbx-workspace-header"><button className="cbx-mobile-trigger" type="button" onClick={() => setMobile(true)} aria-label={t('Open navigation')}><Menu size={18} /></button><div className="cbx-workspace-context">{context}</div><div className="cbx-workspace-tools">{tools}</div></header>
            <div className="cbx-workspace-body">
                {subnav && <aside className="cbx-subnav" data-collapsed={collapsed}>{collapsed ? <button className="cbx-subnav-strip" type="button" onClick={() => setCollapsed(false)} aria-label={t('Expand sidebar')}><PanelLeftOpen size={16} /><span>{subnav.label}</span></button> : <><div className="cbx-subnav-header"><strong>{subnav.label}</strong><button type="button" onClick={() => setCollapsed(true)} aria-label={t('Collapse sidebar')} title="⌘."><PanelLeftClose size={16} /></button></div><nav aria-label={subnav.label}>{links(subnav.items ?? [])}</nav></>}</aside>}
                <main id={mainId} className="canvas-gradient cbx-workspace-main">{children}</main>
            </div>
        </div>
        <dialog ref={dialog} className="cbx-workspace-mobile" onClose={() => setMobile(false)} onClick={event => { if (event.target === event.currentTarget) setMobile(false); }}><div className="cbx-subnav-header"><strong>{brandSubmark}</strong><button type="button" onClick={() => setMobile(false)} aria-label={t('Close navigation')}><X size={18} /></button></div><nav aria-label={t('Navigation')}>{areas.map(item => <section key={item.href}>{links([item])}{item.items && <div className="pl-4">{links(item.items)}</div>}</section>)}</nav><div className="cbx-rail-account">{account}</div></dialog>
    </div>;
}
