import { ArrowLeftRight, ArrowRight, BookOpen, Building2, Clock, CornerDownLeft, FileText, Plus, Search, Sparkles, Zap } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { environmentLevel, initialsOf, requestJson, safeUrl, withQuery } from './data';
import { findCreatable } from './create';
import { helpTopicName } from './help';
import { recentPages } from './recent';
import { ToneSquare } from './context-menus';
import { DEBOUNCE_MS, useContextList } from './use-list';
import { parseArticles, type HelpArticle } from './help-store';
import { resolveIcon } from './icons';
import { navUrl } from './nav-pages';
import { canAutofocus } from './media';
import { revealInList, trapTab } from './popover';
import { useShell } from './context';
import type { PaletteAction, Shell } from './types';

export const GROUP_LIMIT = 5;

export type PaletteGroupKey = 'page' | 'recent' | 'switch' | 'actions' | 'goto' | 'records' | 'pages' | 'docs' | 'ask';

/** The scope chips (V6): every group, or one kind of result. */
export type PaletteScope = 'all' | 'actions' | 'records' | 'pages' | 'help';
type Kind = Exclude<PaletteScope, 'all'>;

/** Which scope a group's results belong to. Recent mixes records and pages, by item. */
const GROUP_KIND: Record<Exclude<PaletteGroupKey, 'recent' | 'ask'>, Kind> = { page: 'actions', switch: 'actions', actions: 'actions', goto: 'actions', records: 'records', pages: 'pages', docs: 'help' };

/** One result. `run` does what Enter does; `href` is what ⌘Enter opens in a new tab. */
export type PaletteItem = {
    id: string;
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    href?: string;
    kind?: Kind;
    run: (newTab: boolean) => void;
};

type GroupState = { status: 'idle' | 'loading' | 'ready' | 'error'; items: PaletteItem[] };

/** Matches `query` against words: every term must be found. Ranks prefix matches first. */
export function matchScore(text: string, query: string): number {
    const haystack = text.toLowerCase();
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return 1;
    let score = 0;
    for (const term of terms) {
        const at = haystack.indexOf(term);
        if (at < 0) return 0;
        score += at === 0 ? 3 : haystack[at - 1] === ' ' ? 2 : 1;
    }
    return score;
}

function localPages(shell: Shell, query: string, open: (url: string, newTab: boolean) => void, lockedLabel: string): PaletteItem[] {
    const entries: Array<{ id: string; title: string; subtitle?: string; url: string; icon?: string }> = [];
    for (const area of shell.nav.areas) {
        const areaUrl = navUrl(area);
        entries.push({ id: `area:${area.key}`, title: area.label, url: areaUrl, icon: area.icon });
        for (const page of area.pages ?? []) {
            const url = navUrl(page);
            if (url === areaUrl) continue;
            // A locked page is still found, and says so: it leads to the upgrade prompt.
            const subtitle = page.locked === true ? `${area.label} · ${lockedLabel}` : area.label;
            entries.push({ id: `page:${area.key}:${page.key}`, title: page.label, subtitle, url, icon: page.locked === true ? 'lock' : (page.icon ?? area.icon) });
        }
    }
    return entries
        .map(entry => ({ entry, score: matchScore(`${entry.title} ${entry.subtitle ?? ''}`, query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ entry }) => {
            const Icon = resolveIcon(entry.icon);
            return { id: entry.id, title: entry.title, subtitle: entry.subtitle, href: entry.url, kind: 'pages' as const, icon: <Icon size={16} strokeWidth={1.8} aria-hidden />, run: (newTab: boolean) => open(entry.url, newTab) };
        });
}

/**
 * The rows of a list answer: a bare array, `{data: [...]}` (a context list), or console-kit's
 * search answer `{groups: [{key, items}]}`, of which `group`'s items.
 */
function rows(body: unknown, group?: string): Array<Record<string, unknown>> {
    let data: unknown = Array.isArray(body) ? body : typeof body === 'object' && body !== null ? (body as { data?: unknown }).data : null;
    if (data === undefined && group !== undefined && typeof body === 'object' && body !== null) {
        const groups = (body as { groups?: unknown }).groups;
        const match = Array.isArray(groups) ? groups.find((g): g is { items?: unknown } => typeof g === 'object' && g !== null && (g as { key?: unknown }).key === group) : undefined;
        data = match?.items;
    }
    return Array.isArray(data) ? data.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null) : [];
}

/**
 * ⌘K (§6, V6). Before anything is typed: what can be done on this page ("On {page}"), Recent,
 * and Switch (other environments, the organization). With a query: Actions, Go to, Records,
 * Pages, Help and, last, Ask Cbox. Scope chips narrow it to one kind. Typing is debounced
 * 120 ms; the server groups load in parallel, each on its own, so a slow group never holds up
 * the others. ↑↓ move, Enter opens, ⌘Enter opens in a new tab, Esc closes. On the phone it is a
 * near-full-screen sheet with Cancel.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
    const { shell, t, navigate, switchTo, openArticle, ask, mobile, openContext, openCreate, canCreate, searchRecords } = useShell();
    const [scope, setScope] = useState<PaletteScope>('all');
    const [input, setInput] = useState('');
    const [query, setQuery] = useState('');
    const [groups, setGroups] = useState<Partial<Record<PaletteGroupKey, GroupState>>>({});
    // The query the server groups were last started for: until it matches, they are not this
    // query's answer yet, even where they read idle or ready.
    const [groupsFor, setGroupsFor] = useState('');
    const [expanded, setExpanded] = useState<PaletteGroupKey | null>(null);
    // The active row is held by its id, not its place: a slow group arriving above it must not
    // move the highlight onto another result under a fast Enter (§12.1, nothing jumps).
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const field = useRef<HTMLInputElement>(null);
    const dialog = useRef<HTMLDivElement>(null);
    const id = useId();
    const opener = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);

    useEffect(() => {
        if (canAutofocus()) field.current?.focus();
        else dialog.current?.focus();
        const back = opener.current;
        return () => {
            if (back instanceof HTMLElement) back.focus();
        };
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setQuery(input), DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [input]);

    // A new tab leaves the palette open, so the person can open several results.
    const open = (url: string, newTab: boolean) => {
        if (!newTab) onClose();
        navigate(url, { newTab });
    };

    // Server groups: each starts on its own and fills in when it answers.
    useEffect(() => {
        const q = query.trim();
        const controller = new AbortController();
        const run = (key: PaletteGroupKey, load: () => Promise<PaletteItem[]>) => {
            setGroups(current => ({ ...current, [key]: { status: 'loading', items: current[key]?.items ?? [] } }));
            load()
                .then(items => {
                    if (!controller.signal.aborted) setGroups(current => ({ ...current, [key]: { status: 'ready', items } }));
                })
                .catch(() => {
                    if (!controller.signal.aborted) setGroups(current => ({ ...current, [key]: { status: 'error', items: [] } }));
                });
        };
        const signal = controller.signal;
        setGroupsFor(q);
        if (q === '') {
            setGroups({});
            return () => controller.abort();
        }
        if (searchRecords !== undefined) {
            run('records', async () =>
                (await searchRecords(q, signal)).flatMap(row => {
                    const url = safeUrl(row.url);
                    if (url === undefined) return [];
                    return [{ id: `record:${row.id}`, title: row.title, subtitle: row.subtitle, href: url, kind: 'records' as const, icon: <FileText size={16} strokeWidth={1.8} aria-hidden />, run: (newTab: boolean) => open(url, newTab) }];
                }),
            );
        } else if (shell.palette.searchUrl !== undefined) {
            run('records', async () =>
                rows(await requestJson(withQuery(shell.palette.searchUrl!, { q, group: 'records' }), { signal }), 'records').flatMap(row => {
                    const url = safeUrl(row.url);
                    if (typeof row.title !== 'string' || url === undefined) return [];
                    return [{ id: `record:${String(row.id ?? url)}`, title: row.title, subtitle: typeof row.subtitle === 'string' ? row.subtitle : undefined, href: url, kind: 'records' as const, icon: <FileText size={16} strokeWidth={1.8} aria-hidden />, run: (newTab: boolean) => open(url, newTab) }];
                }),
            );
        }
        const organization = shell.context.levels[0];
        run('goto', async () => {
            const loads: Array<Promise<PaletteItem[]>> = [];
            // console-kit answers "Go to" (organizations, and level 2 and 2 · 3 across them) from
            // its search endpoint; a host without one lists the organizations itself.
            const kitGoto = shell.palette.gotoUrl === undefined && shell.palette.searchUrl !== undefined;
            if (kitGoto) {
                loads.push(
                    requestJson(withQuery(shell.palette.searchUrl!, { q, group: 'goto' }), { signal }).then(body =>
                        rows(body, 'goto').flatMap(row => {
                            const url = safeUrl(row.url);
                            if (typeof row.title !== 'string' || url === undefined) return [];
                            return [{ id: `goto:${String(row.id ?? url)}`, title: row.title, subtitle: typeof row.subtitle === 'string' ? row.subtitle : undefined, href: url, icon: <Building2 size={16} strokeWidth={1.8} aria-hidden />, run: (newTab: boolean) => open(url, newTab) }];
                        }),
                    ),
                );
            }
            if (organization !== undefined && !kitGoto) {
                loads.push(
                    requestJson(withQuery(organization.listUrl, { q, limit: '5' }), { signal }).then(body =>
                        rows(body).flatMap(row => {
                            if ((typeof row.id !== 'string' && typeof row.id !== 'number') || typeof row.name !== 'string') return [];
                            const orgId = String(row.id);
                            return [{ id: `org:${orgId}`, title: row.name, subtitle: organization.label, icon: <span className="cbx-chip cbx-chip-soft" aria-hidden="true">{typeof row.initials === 'string' ? row.initials : initialsOf(row.name)}</span>, run: () => { onClose(); switchTo({ [organization.key]: orgId }); } }];
                        }),
                    ),
                );
            }
            if (shell.palette.gotoUrl !== undefined) {
                loads.push(
                    requestJson(withQuery(shell.palette.gotoUrl, { q }), { signal }).then(body =>
                        rows(body).flatMap(row => {
                            if (typeof row.title !== 'string') return [];
                            const levels = typeof row.levels === 'object' && row.levels !== null ? (row.levels as Record<string, string>) : null;
                            const url = safeUrl(row.url);
                            if (levels === null && url === undefined) return [];
                            return [{ id: `goto:${row.title}:${String(row.subtitle ?? '')}`, title: row.title, subtitle: typeof row.subtitle === 'string' ? row.subtitle : undefined, href: url, icon: <Building2 size={16} strokeWidth={1.8} aria-hidden />, run: (newTab: boolean) => { if (levels !== null && !newTab) { onClose(); switchTo(levels); } else if (url !== undefined) open(url, newTab); } }];
                        }),
                    ),
                );
            }
            const settled = await Promise.allSettled(loads);
            if (settled.every(result => result.status === 'rejected') && settled.length > 0) throw new Error('unavailable');
            return settled.flatMap(result => (result.status === 'fulfilled' ? result.value : []));
        });
        if (shell.help.enabled && shell.help.searchUrl !== undefined) {
            run('docs', async () =>
                parseArticles(await requestJson(withQuery(shell.help.searchUrl!, { q, topic: shell.help.topic }), { signal })).map((article: HelpArticle) => ({
                    id: `doc:${article.id}`,
                    title: article.title,
                    subtitle: article.excerpt,
                    href: article.url,
                    kind: 'help' as const,
                    icon: <BookOpen size={16} strokeWidth={1.8} aria-hidden />,
                    run: (newTab: boolean) => {
                        if (newTab && article.url !== undefined) {
                            navigate(article.url, { newTab: true });
                            return;
                        }
                        onClose();
                        openArticle(article);
                    },
                })),
            );
        }
        return () => controller.abort();
    }, [query, shell, searchRecords]);

    const q = input.trim();
    const topic = helpTopicName(shell);
    const organization = shell.context.levels[0];
    const environment = environmentLevel(shell.context.levels);
    const envIndex = environment !== undefined ? shell.context.levels.indexOf(environment) : -1;
    const envParent = envIndex > 0 ? shell.context.levels[envIndex - 1] : undefined;
    const environments = useContextList(environment?.listUrl, { parent: envParent?.current.id, enabled: environment !== undefined });

    const pages = useMemo(() => localPages(shell, q, open, t('Locked')), [shell, q, t]);
    const toItem = (action: PaletteAction, prefix: string): PaletteItem => {
        const Icon = action.icon !== undefined ? resolveIcon(action.icon) : Zap;
        return {
            id: `${prefix}:${action.id}`,
            title: action.label,
            subtitle: action.hint,
            href: action.method === 'post' ? undefined : action.url,
            kind: 'actions',
            icon: <Icon size={16} strokeWidth={1.8} aria-hidden />,
            run: (newTab: boolean) => {
                if (!newTab) onClose();
                if (!newTab && action.create !== undefined && canCreate && findCreatable(shell, action.create) !== undefined) {
                    openCreate(action.create);
                    return;
                }
                navigate(action.url, { method: action.method ?? 'get', newTab: newTab && action.method !== 'post' });
            },
        };
    };
    const matches = (item: { title: string; subtitle?: string }, words: string[] = []) => matchScore(`${item.title} ${item.subtitle ?? ''} ${words.join(' ')}`, q) > 0;
    const createItem = (key: string): PaletteItem | null => {
        const creatable = findCreatable(shell, key);
        if (creatable === undefined || !canCreate) return null;
        return { id: `create:${key}`, title: t('New {thing}', { thing: creatable.label.toLowerCase() }), kind: 'actions', icon: <Plus size={16} strokeWidth={1.8} aria-hidden />, run: () => { onClose(); openCreate(key); } };
    };
    const pageCreate = shell.page?.create !== undefined ? createItem(shell.page.create) : null;
    const pageActions = [...(pageCreate !== null ? [pageCreate] : []), ...(shell.page?.actions ?? []).map(action => toItem(action, 'page'))];
    const globalActions = shell.palette.actions.map(action => toItem(action, 'action'));
    const switchItems: PaletteItem[] = [];
    if (environment !== undefined) {
        environments.items
            .filter(item => item.id !== environment.current.id)
            .slice(0, 3)
            .forEach(item =>
                switchItems.push({
                    id: `switch:${item.id}`,
                    title: t('Switch to {name}', { name: item.name }),
                    subtitle: environment.label,
                    kind: 'actions',
                    icon: <ToneSquare tone={item.tone} />,
                    run: () => {
                        onClose();
                        switchTo(envParent !== undefined ? { [envParent.key]: envParent.current.id, [environment.key]: item.id } : { [environment.key]: item.id });
                    },
                }),
            );
    }
    if (organization !== undefined) {
        switchItems.push({
            id: 'switch:organization',
            title: t('Switch {thing}', { thing: organization.label.toLowerCase() }),
            subtitle: t('Now {name}', { name: organization.current.name }),
            kind: 'actions',
            icon: <ArrowLeftRight size={16} strokeWidth={1.8} aria-hidden />,
            run: () => {
                onClose();
                openContext(organization.key, true);
            },
        });
    }
    const recent: PaletteItem[] = useMemo(() => {
        if (shell.palette.recent !== undefined) {
            return shell.palette.recent.flatMap(row => {
                const url = safeUrl(row.url);
                return url === undefined ? [] : [{ id: `recent:${row.id}`, title: row.title, subtitle: row.subtitle, href: url, kind: 'records' as const, icon: <Clock size={16} strokeWidth={1.8} aria-hidden />, run: (newTab: boolean) => open(url, newTab) }];
            });
        }
        const here = typeof window !== 'undefined' ? window.location.pathname + window.location.search + window.location.hash : '';
        return recentPages(shell.app.key)
            .filter(row => row.url !== here)
            .slice(0, 4)
            .map(row => ({ id: `recent:${row.url}`, title: row.title, subtitle: row.area, href: row.url, kind: 'pages' as const, icon: <Clock size={16} strokeWidth={1.8} aria-hidden />, run: (newTab: boolean) => open(row.url, newTab) }));
    }, [shell]);

    const ready = (items: PaletteItem[]): GroupState => ({ status: 'ready', items });
    const sections: Array<{ key: PaletteGroupKey; label: string; state: GroupState }> =
        q === ''
            ? [
                  pageActions.length > 0 ? { key: 'page' as const, label: t('On {page}', { page: topic }), state: ready(pageActions) } : { key: 'actions' as const, label: t('Actions'), state: ready(globalActions) },
                  { key: 'recent' as const, label: t('Recent'), state: ready(recent) },
                  { key: 'switch' as const, label: t('Switch'), state: ready(switchItems) },
              ]
            : [
                  {
                      key: 'actions' as const,
                      label: t('Actions'),
                      state: ready(
                          [
                              ...pageActions.filter(item => matches(item, (shell.page?.actions ?? []).find(action => `page:${action.id}` === item.id)?.keywords)),
                              ...globalActions.filter(item => matches(item, shell.palette.actions.find(action => `action:${action.id}` === item.id)?.keywords)),
                              ...(shell.create?.items ?? [])
                                  .filter(creatable => creatable.key !== shell.page?.create)
                                  .map(creatable => createItem(creatable.key))
                                  .filter((item): item is PaletteItem => item !== null && matches(item, findCreatable(shell, item.id.slice('create:'.length))?.keywords)),
                              ...switchItems.filter(item => matches(item)),
                          ],
                      ),
                  },
                  { key: 'goto' as const, label: t('Go to'), state: groups.goto ?? { status: 'idle' as const, items: [] } },
                  { key: 'records' as const, label: t('Records'), state: groups.records ?? { status: 'idle' as const, items: [] } },
                  { key: 'pages' as const, label: t('Pages'), state: ready(pages) },
                  { key: 'docs' as const, label: t('Help'), state: groups.docs ?? { status: 'idle' as const, items: [] } },
              ];
    // The scope keeps the items of its kind, and the groups that hold them.
    const scoped = sections
        .map(section => {
            if (scope === 'all') return section;
            const kind = section.key === 'recent' || section.key === 'ask' ? null : GROUP_KIND[section.key];
            if (kind !== null && kind !== scope) return null;
            return { ...section, state: { ...section.state, items: section.state.items.filter(item => item.kind === undefined || item.kind === scope) } };
        })
        .filter((section): section is (typeof sections)[number] => section !== null);
    sections.length = 0;
    sections.push(...scoped);
    if (q !== '') {
        sections.push({
            key: 'ask',
            label: t('Ask Cbox'),
            state: {
                status: 'ready',
                items: [{ id: 'ask', title: t('Ask Cbox: “{query}”', { query: q }), subtitle: t('Answers with what you see on {page}', { page: topic }), icon: <Sparkles size={16} strokeWidth={1.8} aria-hidden />, run: () => { onClose(); ask(q); } }],
            },
        });
    }

    // Flatten into options, with "Show all in {group}" after five.
    type Option = { kind: 'item'; item: PaletteItem; group: PaletteGroupKey } | { kind: 'all'; group: PaletteGroupKey; label: string };
    const options: Option[] = [];
    const rendered = sections.map(section => {
        const all = expanded === section.key;
        const items = all ? section.state.items : section.state.items.slice(0, GROUP_LIMIT);
        const start = options.length;
        items.forEach(item => options.push({ kind: 'item', item, group: section.key }));
        const more = !all && section.state.items.length > GROUP_LIMIT;
        if (more) options.push({ kind: 'all', group: section.key, label: t('Show all in {group}', { group: section.label }) });
        return { ...section, start, count: items.length + (more ? 1 : 0) };
    });

    const keyOf = (option: Option): string => (option.kind === 'item' ? `${option.group}:${option.item.id}` : `all:${option.group}`);
    // Until the person moves the highlight, it goes to the first result. Ask Cbox is never picked
    // for them while results are still on their way (the debounce or a loading group): a pasted
    // id and a fast Enter must open the record, not send the id to the chat. Once every group has
    // answered with nothing, Ask is the only thing left and takes the highlight. A server group's
    // rows count as results only once it has answered this query: until then it may still show
    // the last query's rows.
    const debounced = q === query.trim() && groupsFor === q;
    const current = (group: PaletteGroupKey) => group === 'pages' || group === 'actions' || group === 'page' || group === 'recent' || group === 'switch' || (debounced && sections.find(section => section.key === group)?.state.status === 'ready');
    const busy = !debounced || sections.some(section => section.state.status === 'loading');
    const firstResult = options.find(option => option.group !== 'ask' && current(option.group));
    const autoKey = firstResult !== undefined ? keyOf(firstResult) : !busy && options[0] !== undefined ? keyOf(options[0]) : null;
    const indexOf = (key: string | null) => (key === null ? -1 : options.findIndex(option => keyOf(option) === key));
    const found = indexOf(activeKey);
    const active = found >= 0 ? found : indexOf(autoKey);
    const setActive = (next: number | ((index: number) => number)) => {
        const index = typeof next === 'function' ? next(active) : next;
        const option = options[index];
        setActiveKey(option === undefined ? null : keyOf(option));
    };

    useEffect(() => {
        setActiveKey(null);
    }, [q]);
    // Pin the first result once there is one, so a group arriving above does not take its place.
    useEffect(() => {
        if (activeKey === null && autoKey !== null) setActiveKey(autoKey);
    }, [activeKey, autoKey]);
    useEffect(() => {
        revealInList(`${id}-${active}`);
    }, [active, id]);

    const choose = (option: Option | undefined, newTab: boolean) => {
        if (option === undefined) return;
        if (option.kind === 'all') {
            setExpanded(option.group);
            return;
        }
        if (newTab && option.item.href === undefined) return;
        option.item.run(newTab);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const last = options.length - 1;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive(index => (index >= last ? 0 : index + 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(index => (index <= 0 ? last : index - 1));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            choose(options[active], event.metaKey || event.ctrlKey);
        } else {
            trapTab(event, dialog.current);
        }
    };

    const activeOption = options[active];
    const scopes: Array<{ value: PaletteScope; label: string }> = [
        { value: 'all', label: t('All') },
        { value: 'actions', label: t('Actions') },
        { value: 'records', label: t('Records') },
        { value: 'pages', label: t('Pages') },
        { value: 'help', label: t('Help') },
    ];
    return (
        <div className={`cbx-overlay cbx-palette-backdrop ${mobile ? 'is-sheet' : ''}`} onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
            <div ref={dialog} className={`cbx-palette ${mobile ? 'is-sheet' : ''}`} role="dialog" aria-modal="true" aria-label={t('Search')} tabIndex={-1} onKeyDown={onKeyDown}>
                {mobile && <div className="cbx-sheet-handle" aria-hidden="true" />}
                <div className="cbx-palette-search">
                    <label className="cbx-palette-field">
                    <Search size={18} strokeWidth={1.8} aria-hidden />
                    <input
                        ref={field}
                        type="search"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls={`${id}-list`}
                        aria-activedescendant={activeOption !== undefined ? `${id}-${active}` : undefined}
                        aria-autocomplete="list"
                        aria-label={shell.palette.placeholder ?? t('Search or ask…')}
                        placeholder={shell.palette.placeholder ?? (mobile ? t('Search, act or ask…') : t('Search or ask…'))}
                        value={input}
                        onChange={event => setInput(event.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                    />
                    </label>
                    {mobile ? (
                        <button type="button" className="cbx-palette-cancel" onClick={onClose}>{t('Cancel')}</button>
                    ) : (
                        <kbd className="cbx-kbd">Esc</kbd>
                    )}
                </div>
                <div className="cbx-scopes" role="radiogroup" aria-label={t('Scope')}>
                    {scopes.map(item => (
                        <button key={item.value} type="button" role="radio" aria-checked={scope === item.value} className={`cbx-scope ${scope === item.value ? 'is-on' : ''}`} onClick={() => setScope(item.value)}>
                            {item.label}
                        </button>
                    ))}
                </div>
                <div id={`${id}-list`} role="listbox" aria-label={t('Results')} className="cbx-palette-list">
                    {rendered.map(section => {
                        const loading = section.state.status === 'loading' && section.state.items.length === 0;
                        if (section.count === 0 && !loading) return null;
                        return (
                            <div key={section.key} role="group" aria-labelledby={`${id}-${section.key}`} className="cbx-palette-group">
                                <div id={`${id}-${section.key}`} className="cbx-pane-heading" role="presentation">
                                    <span>{section.label}</span>
                                    {section.state.status === 'loading' && <span className="cbx-palette-busy" aria-hidden="true" />}
                                </div>
                                {loading && <div className="cbx-list-note" aria-live="polite">{t('Searching…')}</div>}
                                {section.count > 0 && <div className="cbx-palette-rows" role="presentation">
                                {options.slice(section.start, section.start + section.count).map((option, offset) => {
                                    const index = section.start + offset;
                                    const on = index === active;
                                    return (
                                        <div
                                            key={option.kind === 'item' ? option.item.id : `all:${option.group}`}
                                            id={`${id}-${index}`}
                                            role="option"
                                            aria-selected={on}
                                            className={`cbx-row ${on ? 'is-active' : ''} ${option.kind === 'all' ? 'cbx-row-more' : ''}`}
                                            onMouseMove={() => setActive(index)}
                                            onClick={event => choose(option, event.metaKey || event.ctrlKey)}
                                        >
                                            {option.kind === 'item' ? (
                                                <>
                                                    <span className="cbx-row-icon">{option.item.icon}</span>
                                                    <span className="cbx-row-text">
                                                        <span className="cbx-row-name" title={option.item.title}>{option.item.title}</span>
                                                        {option.item.subtitle !== undefined && <span className="cbx-row-label cbx-truncate">{option.item.subtitle}</span>}
                                                    </span>
                                                    {on && <CornerDownLeft className="cbx-row-trail" size={14} strokeWidth={1.8} aria-hidden />}
                                                </>
                                            ) : (
                                                <>
                                                    <span className="cbx-row-icon"><ArrowRight size={16} strokeWidth={1.8} aria-hidden /></span>
                                                    <span className="cbx-row-name">{option.label}</span>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                                </div>}
                            </div>
                        );
                    })}
                    {options.length === 0 && q !== '' && <div className="cbx-list-note">{t('Nothing matches “{query}”.', { query: q })}</div>}
                </div>
                <div className="cbx-palette-foot" aria-hidden="true">
                    <span><kbd className="cbx-kbd">↑</kbd><kbd className="cbx-kbd">↓</kbd> {t('move')}</span>
                    <span><kbd className="cbx-kbd">↵</kbd> {t('open')}</span>
                    <span><kbd className="cbx-kbd">⌘↵</kbd> {t('new tab')}</span>
                </div>
            </div>
        </div>
    );
}
