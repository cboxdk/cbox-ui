import { Check, ChevronRight, Plus, Search, Settings } from 'lucide-react';
import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { createItem, environmentFor, initialsOf, pluralOf, settingsHref, ShellRequestError } from './data';
import { canAutofocus } from './media';
import { revealInList } from './popover';
import { useShell } from './context';
import { fetchList, forgetLists, useContextList } from './use-list';
import type { ContextItem, ContextLevel, ContextTone } from './types';

/** The initials chip of an organization, project or site. */
export function Chip({ item, tone = 'soft' }: { item: Pick<ContextItem, 'name' | 'initials'>; tone?: 'solid' | 'soft' }) {
    return <span className={`cbx-chip cbx-chip-${tone}`} aria-hidden="true">{item.initials ?? initialsOf(item.name)}</span>;
}

/** The coloured square of an environment (§5.4): production green, sandbox amber, neutral grey. */
export function ToneSquare({ tone }: { tone?: ContextTone }) {
    return <span className={`cbx-tone cbx-tone-${tone ?? 'neutral'}`} aria-hidden="true" />;
}

/** True for the third level, whose rows carry a tone square instead of a chip. */
export function isEnvironmentLevel(level: ContextLevel): boolean {
    return level.key === 'environment';
}

export type PaneHandle = { focus: () => void };

type PaneProps = {
    level: ContextLevel;
    /** Id of the item one level up, for `?parent=` and inline create. */
    parent?: string;
    /** The item marked with a check. */
    currentId?: string;
    heading: string;
    /** Show "View all". */
    viewAll?: boolean;
    /** A search field heads the pane. */
    searchable?: boolean;
    /** Take focus when the pane mounts (only on a desktop pointer). */
    autoFocus?: boolean;
    /** Rows show a chevron: the pane previews the next level. */
    chevron?: boolean;
    createLabel?: string;
    onPick: (item: ContextItem) => void;
    /** Hover or keyboard focus on a row, without switching anything. */
    onPreview?: (item: ContextItem) => void;
    /** → on a row. Return true when it was handled. */
    onArrowRight?: () => boolean;
    onArrowLeft?: () => void;
    handle?: Ref<PaneHandle>;
    /** Where the pane hands focus when it has no search (the cascade's right pane). */
    className?: string;
};

type Option = { kind: 'item'; item: ContextItem } | { kind: 'more' };

/**
 * One pane of a context menu: search, heading with View all, the lazily loaded rows, and
 * "New …". Keyboard: ↑↓ Home End move, Enter picks, → and ← cross panes, Esc closes (the
 * popover), Tab leaves. Focus stays in the search field and the active row is announced with
 * `aria-activedescendant`.
 */
export function LevelPane({ level, parent, currentId, heading, viewAll = true, searchable = true, autoFocus = false, chevron = false, createLabel, onPick, onPreview, onArrowRight, onArrowLeft, handle, className }: PaneProps) {
    const { t, Link } = useShell();
    const [q, setQ] = useState('');
    const [active, setActive] = useState(-1);
    const [creating, setCreating] = useState(false);
    const list = useContextList(level.listUrl, { q, parent });
    const id = useId();
    const input = useRef<HTMLInputElement>(null);
    const box = useRef<HTMLDivElement>(null);
    const plural = pluralOf(level);
    const environment = isEnvironmentLevel(level);

    const options: Option[] = list.items.map(item => ({ kind: 'item' as const, item }));
    if (list.hasMore) options.push({ kind: 'more' });

    // The current item is active when the rows arrive; a new search starts at the top.
    useEffect(() => {
        if (list.status !== 'ready') return;
        setActive(previous => {
            if (previous >= 0 && previous < options.length && q === '') return previous;
            const current = list.items.findIndex(item => item.id === currentId);
            return q === '' && current >= 0 ? current : options.length > 0 ? 0 : -1;
        });
    }, [list.status, list.items, q, currentId]);

    useEffect(() => {
        if (autoFocus && searchable && canAutofocus()) input.current?.focus();
    }, [autoFocus, searchable]);

    const focusSelf = useCallback(() => {
        if (searchable) input.current?.focus();
        else box.current?.focus();
        setActive(index => (index < 0 && options.length > 0 ? 0 : index));
    }, [searchable, options.length]);
    useImperativeHandle(handle, () => ({ focus: focusSelf }), [focusSelf]);

    const optionId = (index: number) => `${id}-option-${index}`;
    useEffect(() => {
        if (active < 0) return;
        revealInList(optionId(active));
        const option = options[active];
        if (option?.kind === 'item') onPreview?.(option.item);
    }, [active]);

    const choose = (option: Option | undefined) => {
        if (option === undefined) return;
        if (option.kind === 'more') list.loadMore();
        else onPick(option.item);
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.target instanceof HTMLElement && event.target.closest('.cbx-create')) return;
        const last = options.length - 1;
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                setActive(index => (index >= last ? 0 : index + 1));
                break;
            case 'ArrowUp':
                event.preventDefault();
                setActive(index => (index <= 0 ? last : index - 1));
                break;
            case 'Home':
                if (!searchable || q === '') {
                    event.preventDefault();
                    setActive(options.length > 0 ? 0 : -1);
                }
                break;
            case 'End':
                if (!searchable || q === '') {
                    event.preventDefault();
                    setActive(last);
                }
                break;
            case 'Enter':
                event.preventDefault();
                choose(options[active]);
                break;
            case 'ArrowRight': {
                if (searchable && input.current !== null && input.current.selectionStart !== q.length) break;
                if (onArrowRight?.()) {
                    event.preventDefault();
                    break;
                }
                const gear = document.getElementById(`${optionId(active)}-settings`);
                if (gear !== null) {
                    event.preventDefault();
                    gear.focus();
                }
                break;
            }
            case 'ArrowLeft':
                if (onArrowLeft !== undefined && (!searchable || input.current?.selectionStart === 0)) {
                    event.preventDefault();
                    onArrowLeft();
                }
                break;
        }
    };

    const listboxId = `${id}-listbox`;
    const activeId = active >= 0 && active < options.length ? optionId(active) : undefined;

    return (
        <div className={`cbx-pane ${className ?? ''}`} onKeyDown={onKeyDown}>
            {searchable && (
                <div className="cbx-pane-search">
                    <Search size={16} strokeWidth={1.8} aria-hidden />
                    <input
                        ref={input}
                        type="search"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls={listboxId}
                        aria-activedescendant={activeId}
                        aria-autocomplete="list"
                        aria-label={t('Search {things}', { things: plural.toLowerCase() })}
                        placeholder={t('Search {things}…', { things: plural.toLowerCase() })}
                        value={q}
                        onChange={event => setQ(event.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>
            )}
            <div className="cbx-pane-heading">
                <span className="cbx-truncate" title={heading}>{heading}</span>
                {viewAll && <Link href={level.allUrl} className="cbx-pane-all" tabIndex={-1}>{t('View all')}</Link>}
            </div>
            <div
                ref={box}
                id={listboxId}
                role="listbox"
                aria-label={heading}
                tabIndex={searchable ? -1 : 0}
                aria-activedescendant={searchable ? undefined : activeId}
                className="cbx-list"
                onScroll={event => {
                    const el = event.currentTarget;
                    if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) list.loadMore();
                }}
            >
                {options.map((option, index) => {
                    if (option.kind === 'more') {
                        return (
                            <div key="more" id={optionId(index)} role="option" aria-selected={index === active} className={`cbx-row cbx-row-more ${index === active ? 'is-active' : ''}`} onMouseEnter={() => setActive(index)} onClick={() => list.loadMore()}>
                                <span className="cbx-row-name">{list.loadingMore ? t('Loading…') : t('Show more')}</span>
                            </div>
                        );
                    }
                    const { item } = option;
                    const current = item.id === currentId;
                    const settings = settingsHref(level, item.id);
                    return (
                        <div key={item.id} className={`cbx-row ${index === active ? 'is-active' : ''} ${current ? 'is-current' : ''}`} onMouseEnter={() => setActive(index)}>
                            <div id={optionId(index)} role="option" aria-selected={index === active} aria-current={current ? 'true' : undefined} className="cbx-row-main" onClick={() => onPick(item)}>
                                {environment ? <ToneSquare tone={item.tone} /> : <Chip item={item} />}
                                <span className="cbx-row-name" title={item.name}>{item.name}</span>
                                {item.label !== undefined && <span className="cbx-row-label">{item.label}</span>}
                                {current && <Check className="cbx-row-check" size={16} strokeWidth={2} aria-label={t('Current')} />}
                            </div>
                            {settings !== null && (
                                <Link
                                    href={settings}
                                    id={`${optionId(index)}-settings`}
                                    className="cbx-row-gear"
                                    tabIndex={-1}
                                    aria-label={t('Settings for {name}', { name: item.name })}
                                    title={t('Settings')}
                                    onKeyDown={event => {
                                        if (event.key === 'ArrowLeft') {
                                            event.preventDefault();
                                            focusSelf();
                                        }
                                    }}
                                >
                                    <Settings size={15} strokeWidth={1.8} aria-hidden />
                                </Link>
                            )}
                            {chevron && <ChevronRight className="cbx-row-chevron" size={16} strokeWidth={1.8} aria-hidden />}
                        </div>
                    );
                })}
                <ListStatus status={list.status} empty={options.length === 0} query={q} plural={plural} onRetry={list.retry} />
            </div>
            {level.createUrl !== undefined && createLabel !== undefined && (
                <div className="cbx-pane-foot">
                    {creating ? (
                        <InlineCreate level={level} parent={parent} label={createLabel} onCancel={() => { setCreating(false); focusSelf(); }} />
                    ) : (
                        <button type="button" className="cbx-row cbx-row-action" onClick={() => setCreating(true)}>
                            <Plus size={16} strokeWidth={1.8} aria-hidden />
                            <span className="cbx-row-name">{createLabel}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function ListStatus({ status, empty, query, plural, onRetry }: { status: 'loading' | 'ready' | 'error'; empty: boolean; query: string; plural: string; onRetry: () => void }) {
    const { t } = useShell();
    if (status === 'error') {
        return (
            <div className="cbx-list-note" role="alert">
                {t('{things} could not be loaded.', { things: plural })}{' '}
                <button type="button" className="cbx-link" onClick={onRetry}>{t('Try again')}</button>
            </div>
        );
    }
    if (status === 'loading' && empty) return <div className="cbx-list-note" aria-live="polite">{t('Loading…')}</div>;
    if (status === 'ready' && empty) {
        return <div className="cbx-list-note" aria-live="polite">{query.trim() === '' ? t('No {things} yet.', { things: plural.toLowerCase() }) : t('Nothing matches “{query}”.', { query: query.trim() })}</div>;
    }
    return null;
}

/**
 * "New …" (§5.7): a name, inline. Create makes it, and the person lands on its details page
 * where the rest is set up. Never a dead end: a refusal shows its reason under the field.
 */
export function InlineCreate({ level, parent, label, onCancel }: { level: ContextLevel; parent?: string; label: string; onCancel: () => void }) {
    const { t, navigate } = useShell();
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const field = useRef<HTMLInputElement>(null);
    const errorId = useId();

    useEffect(() => {
        field.current?.focus();
    }, []);

    const submit = async () => {
        const value = name.trim();
        if (value === '' || busy || level.createUrl === undefined) return;
        setBusy(true);
        setError(null);
        try {
            const created = await createItem(level.createUrl, value, parent);
            forgetLists();
            navigate(created.detailsUrl);
        } catch (failure) {
            setBusy(false);
            setError(failure instanceof ShellRequestError && failure.detail !== null ? failure.detail : t('It could not be created. Try again.'));
        }
    };

    return (
        <form
            className="cbx-create"
            onSubmit={event => {
                event.preventDefault();
                void submit();
            }}
            onKeyDown={event => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    onCancel();
                }
                if (event.key === 'Tab') event.stopPropagation();
            }}
        >
            <label className="cbx-create-label" htmlFor={`${errorId}-name`}>{label}</label>
            <div className="cbx-create-row">
                <input
                    ref={field}
                    id={`${errorId}-name`}
                    className="cbx-input"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    placeholder={t('Name')}
                    aria-invalid={error !== null}
                    aria-describedby={error !== null ? errorId : undefined}
                    disabled={busy}
                    autoComplete="off"
                />
                <button type="submit" className="cbx-button cbx-button-primary" disabled={busy || name.trim() === ''}>
                    {busy ? t('Creating…') : t('Create')}
                </button>
            </div>
            {error !== null && <p id={errorId} className="cbx-create-error" role="alert">{error}</p>}
        </form>
    );
}

/**
 * A project click (§5.4): switch to it and keep the environment of the same name when it has
 * one, else its first. Its environments come from the kept list, or are loaded first.
 */
export async function pickKeepingEnvironment(outer: ContextLevel, inner: ContextLevel | undefined, item: ContextItem, switchTo: (chosen: Record<string, string>) => void): Promise<void> {
    if (inner === undefined) {
        switchTo({ [outer.key]: item.id });
        return;
    }
    let environment: ContextItem | undefined;
    try {
        environment = environmentFor(await fetchList(inner.listUrl, item.id), inner.current.name);
    } catch {
        environment = undefined;
    }
    switchTo(environment === undefined ? { [outer.key]: item.id } : { [outer.key]: item.id, [inner.key]: environment.id });
}

/** The organization menu (§5.3). */
export function OrganizationMenu({ level }: { level: ContextLevel }) {
    const { t, switchTo } = useShell();
    return (
        <div className="cbx-menu cbx-menu-org">
            <LevelPane
                level={level}
                currentId={level.current.id}
                heading={pluralOf(level)}
                autoFocus
                createLabel={t('New {thing}', { thing: level.label.toLowerCase() })}
                onPick={item => switchTo({ [level.key]: item.id })}
            />
        </div>
    );
}

/**
 * The second trigger's menu (§5.4). With two levels it is the cascade: hovering or focusing a
 * project previews its environments on the right without switching; an environment switches
 * both; a project keeps the environment of the same name, else its first. With one level it
 * is a single pane.
 */
export function CascadeMenu({ levels }: { levels: ContextLevel[] }) {
    const { t, switchTo } = useShell();
    const [outer, inner] = levels as [ContextLevel, ContextLevel | undefined];
    const [preview, setPreview] = useState<ContextItem>(outer.current);
    const left = useRef<PaneHandle>(null);
    const right = useRef<PaneHandle>(null);

    if (inner === undefined) {
        return (
            <div className="cbx-menu cbx-menu-single">
                <LevelPane
                    level={outer}
                    currentId={outer.current.id}
                    heading={pluralOf(outer)}
                    autoFocus
                    createLabel={t('New {thing}', { thing: outer.label.toLowerCase() })}
                    onPick={item => switchTo({ [outer.key]: item.id })}
                />
            </div>
        );
    }

    const pickOuter = (item: ContextItem) => pickKeepingEnvironment(outer, inner, item, switchTo);

    return (
        <div className="cbx-menu cbx-menu-cascade">
            <LevelPane
                handle={left}
                level={outer}
                currentId={outer.current.id}
                heading={pluralOf(outer)}
                autoFocus
                chevron
                createLabel={t('New {thing}', { thing: outer.label.toLowerCase() })}
                onPick={item => void pickOuter(item)}
                onPreview={setPreview}
                onArrowRight={() => {
                    right.current?.focus();
                    return true;
                }}
            />
            <LevelPane
                key={preview.id}
                handle={right}
                className="cbx-pane-inner"
                level={inner}
                parent={preview.id}
                currentId={preview.id === outer.current.id ? inner.current.id : undefined}
                heading={t('{things} in {name}', { things: pluralOf(inner), name: preview.name })}
                viewAll={false}
                searchable={false}
                createLabel={t('New {thing} in {name}', { thing: inner.label.toLowerCase(), name: preview.name })}
                onPick={item => switchTo({ [outer.key]: preview.id, [inner.key]: item.id })}
                onArrowLeft={() => left.current?.focus()}
            />
        </div>
    );
}

/** The trigger text of the second trigger: `Webshop · ■ Production`. */
export function CascadeLabel({ levels }: { levels: ContextLevel[] }): ReactNode {
    const [outer, inner] = levels as [ContextLevel, ContextLevel | undefined];
    const outerIsEnvironment = isEnvironmentLevel(outer);
    return (
        <>
            {outerIsEnvironment ? <ToneSquare tone={outer.current.tone} /> : <Chip item={outer.current} />}
            <span className="cbx-trigger-text" title={outer.current.name}>{outer.current.name}</span>
            {inner !== undefined && (
                <>
                    <span className="cbx-trigger-dot" aria-hidden="true">·</span>
                    <span className="cbx-trigger-env">
                        <ToneSquare tone={inner.current.tone} />
                        <span className="cbx-trigger-text" title={inner.current.name}>{inner.current.name}</span>
                    </span>
                </>
            )}
        </>
    );
}
