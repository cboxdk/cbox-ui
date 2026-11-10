import { ArrowRight, BookOpen, Building2, CornerDownLeft, FileText, Search, Sparkles, Zap } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { initialsOf, requestJson, safeUrl, withQuery } from './data';
import { parseArticles, type HelpArticle } from './help-store';
import { resolveIcon } from './icons';
import { canAutofocus } from './media';
import { revealInList, trapTab } from './popover';
import { useShell } from './context';
import { DEBOUNCE_MS } from './use-list';
import type { Shell } from './types';

export const GROUP_LIMIT = 5;

export type PaletteGroupKey = 'pages' | 'records' | 'actions' | 'goto' | 'docs' | 'ask';

/** One result. `run` does what Enter does; `href` is what ⌘Enter opens in a new tab. */
export type PaletteItem = {
    id: string;
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    href?: string;
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

function localPages(shell: Shell, query: string, open: (url: string, newTab: boolean) => void): PaletteItem[] {
    const entries: Array<{ id: string; title: string; subtitle?: string; url: string; icon?: string }> = [];
    for (const area of shell.nav.areas) {
        entries.push({ id: `area:${area.key}`, title: area.label, url: area.url, icon: area.icon });
        for (const page of area.pages ?? []) {
            if (page.url === area.url) continue;
            entries.push({ id: `page:${area.key}:${page.key}`, title: page.label, subtitle: area.label, url: page.url, icon: page.icon ?? area.icon });
        }
    }
    return entries
        .map(entry => ({ entry, score: matchScore(`${entry.title} ${entry.subtitle ?? ''}`, query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ entry }) => {
            const Icon = resolveIcon(entry.icon);
            return { id: entry.id, title: entry.title, subtitle: entry.subtitle, href: entry.url, icon: <Icon size={16} strokeWidth={1.8} aria-hidden />, run: (newTab: boolean) => open(entry.url, newTab) };
        });
}

function rows(body: unknown): Array<Record<string, unknown>> {
    const data = Array.isArray(body) ? body : typeof body === 'object' && body !== null ? (body as { data?: unknown }).data : null;
    return Array.isArray(data) ? data.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null) : [];
}

/**
 * ⌘K (§6): Pages, Records, Actions, Go to, Docs and Ask Cbox, in that order. Typing is
 * debounced 120 ms; the server groups load in parallel, each on its own, so a slow group never
 * holds up the others. ↑↓ move, Enter opens, ⌘Enter opens in a new tab, Esc closes.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
    const { shell, t, navigate, switchTo, openArticle, ask } = useShell();
    const [input, setInput] = useState('');
    const [query, setQuery] = useState('');
    const [groups, setGroups] = useState<Partial<Record<PaletteGroupKey, GroupState>>>({});
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
        if (q === '') {
            setGroups({});
            return () => controller.abort();
        }
        if (shell.palette.searchUrl !== undefined) {
            run('records', async () =>
                rows(await requestJson(withQuery(shell.palette.searchUrl!, { q }), { signal })).flatMap(row => {
                    const url = safeUrl(row.url);
                    if (typeof row.title !== 'string' || url === undefined) return [];
                    return [{ id: `record:${String(row.id ?? url)}`, title: row.title, subtitle: typeof row.subtitle === 'string' ? row.subtitle : undefined, href: url, icon: <FileText size={16} strokeWidth={1.8} aria-hidden />, run: (newTab: boolean) => open(url, newTab) }];
                }),
            );
        }
        const organization = shell.context.levels[0];
        run('goto', async () => {
            const loads: Array<Promise<PaletteItem[]>> = [];
            if (organization !== undefined) {
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
    }, [query, shell]);

    const q = input.trim();
    const pages = useMemo(() => localPages(shell, q, open), [shell, q]);
    const actions = useMemo<PaletteItem[]>(
        () =>
            shell.palette.actions
                .filter(action => matchScore(`${action.label} ${(action.keywords ?? []).join(' ')}`, q) > 0)
                .map(action => {
                    const Icon = action.icon !== undefined ? resolveIcon(action.icon) : Zap;
                    return {
                        id: `action:${action.id}`,
                        title: action.label,
                        href: action.method === 'post' ? undefined : action.url,
                        icon: <Icon size={16} strokeWidth={1.8} aria-hidden />,
                        run: (newTab: boolean) => {
                            if (!newTab) onClose();
                            navigate(action.url, { method: action.method ?? 'get', newTab: newTab && action.method !== 'post' });
                        },
                    };
                }),
        [shell, q],
    );

    const sections: Array<{ key: PaletteGroupKey; label: string; state: GroupState }> = [
        { key: 'pages' as const, label: t('Pages'), state: { status: 'ready' as const, items: pages } },
        { key: 'records' as const, label: t('Records'), state: groups.records ?? { status: 'idle' as const, items: [] } },
        { key: 'actions' as const, label: t('Actions'), state: { status: 'ready' as const, items: actions } },
        { key: 'goto' as const, label: t('Go to'), state: groups.goto ?? { status: 'idle' as const, items: [] } },
        { key: 'docs' as const, label: t('Docs and help'), state: groups.docs ?? { status: 'idle' as const, items: [] } },
    ];
    if (q !== '') {
        sections.push({
            key: 'ask',
            label: t('Ask Cbox'),
            state: {
                status: 'ready',
                items: [{ id: 'ask', title: t('Ask Cbox: “{query}”', { query: q }), subtitle: t('About this page'), icon: <Sparkles size={16} strokeWidth={1.8} aria-hidden />, run: () => { onClose(); ask(q); } }],
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
    const found = activeKey === null ? -1 : options.findIndex(option => keyOf(option) === activeKey);
    const active = found >= 0 ? found : 0;
    const setActive = (next: number | ((index: number) => number)) => {
        const index = typeof next === 'function' ? next(active) : next;
        const option = options[index];
        setActiveKey(option === undefined ? null : keyOf(option));
    };

    useEffect(() => {
        setActiveKey(null);
    }, [q]);
    // Pin the first result once there is one, so a group arriving above does not take its place.
    const firstKey = options[0] === undefined ? null : keyOf(options[0]);
    useEffect(() => {
        if (activeKey === null && firstKey !== null) setActiveKey(firstKey);
    }, [activeKey, firstKey]);
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
    return (
        <div className="cbx-overlay cbx-palette-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
            <div ref={dialog} className="cbx-palette" role="dialog" aria-modal="true" aria-label={t('Search')} tabIndex={-1} onKeyDown={onKeyDown}>
                <div className="cbx-palette-search">
                    <Search size={18} strokeWidth={1.8} aria-hidden />
                    <input
                        ref={field}
                        type="search"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls={`${id}-list`}
                        aria-activedescendant={activeOption !== undefined ? `${id}-${active}` : undefined}
                        aria-autocomplete="list"
                        aria-label={t('Search or ask…')}
                        placeholder={t('Search or ask…')}
                        value={input}
                        onChange={event => setInput(event.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <kbd className="cbx-kbd">Esc</kbd>
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
                                                    <span className="cbx-row-name" title={option.item.title}>{option.item.title}</span>
                                                    {option.item.subtitle !== undefined && <span className="cbx-row-label cbx-truncate">{option.item.subtitle}</span>}
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
