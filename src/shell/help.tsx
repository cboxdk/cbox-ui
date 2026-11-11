import { ArrowLeft, ArrowUp, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, CircleAlert, FileText, LifeBuoy, MessageSquare, Search, Sparkles, Ticket, UserRound, X } from 'lucide-react';
import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { requestJson, withQuery } from './data';
import { helpVisible, parseArticles, parseUpdates, type HelpArticle, type HelpState, type HelpStore, type SupportUpdate } from './help-store';
import { useShell } from './context';
import { environmentLevel } from './data';
import { canAutofocus } from './media';
import { trapTab } from './popover';
import { useScrollLock } from './scroll-lock';
import { scrimHandlers, useSheetDrag } from './sheet-drag';
import { DEBOUNCE_MS } from './use-list';
import type { Shell } from './types';

export const DEFAULT_SUPPORT_SCRIPT = '/ai-assistant/support.js';
const SUPPORT_TAG = 'cbox-support';

export function useHelpState<T>(store: HelpStore, select: (state: HelpState) => T): T {
    return useSyncExternalStore(store.subscribe, () => select(store.get()), () => select(store.get()));
}

/** Unread support replies: the loaded updates once they are in, else the count sent with the page. */
export function useUnreadCount(store: HelpStore, sent: number | undefined): number {
    const loaded = useHelpState(store, state => (state.updatesStatus === 'ready' ? state.updates.filter(update => update.unread).length : null));
    return loaded ?? sent ?? 0;
}

/** What Help is about here: the page title, else the area, else the app. */
export function helpTopicName(shell: Shell): string {
    const area = shell.nav.areas.find(item => item.key === shell.nav.activeArea);
    return shell.page?.title ?? area?.label ?? shell.app.name;
}

/** The page intent the chat is given (§7.2.4): route, title and context. */
export type PageIntent = { route?: string; title?: string; context: string; url?: string };

export function contextTrail(shell: Shell): string {
    return shell.context.levels.map(level => level.current.name).join(' / ');
}

export function pageIntent(shell: Shell): PageIntent {
    const intent: PageIntent = { context: contextTrail(shell) };
    if (shell.page?.route !== undefined) intent.route = shell.page.route;
    if (shell.page?.title !== undefined) intent.title = shell.page.title;
    if (typeof window !== 'undefined') intent.url = window.location.pathname;
    return intent;
}

/** The Assistant SDK's element, with the methods a newer SDK may add. */
type SupportElement = HTMLElement & {
    open?: () => unknown;
    ask?: (question: string, intent?: PageIntent) => unknown;
    handover?: () => unknown;
    intent?: PageIntent;
};

function ensureScript(src: string): void {
    if (typeof document === 'undefined' || customElements.get(SUPPORT_TAG) !== undefined) return;
    if (Array.from(document.scripts).some(script => script.getAttribute('src') === src)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    document.head.append(script);
}

/** Wait for the SDK's element to be defined and in place, up to `timeoutMs`. */
function whenSupportReady(host: HTMLElement | null, timeoutMs = 6000): Promise<SupportElement | null> {
    return new Promise(resolve => {
        const started = Date.now();
        const attempt = () => {
            const element = host?.querySelector<SupportElement>(SUPPORT_TAG) ?? null;
            if (element !== null && typeof element.open === 'function') {
                resolve(element);
                return;
            }
            if (Date.now() - started >= timeoutMs) {
                resolve(null);
                return;
            }
            setTimeout(attempt, 150);
        };
        attempt();
    });
}

/**
 * The Help column (§7): support updates, docs search, articles for this page, Ask Cbox and a way
 * to a person. Docked beside the page from 1280px, a full-screen dialog below. It is always
 * mounted while the shell is, so its state and the conversation survive page changes.
 */
export function HelpColumn({ docked, mobile = false }: { docked: boolean; mobile?: boolean }) {
    const { shell, t, help: store, toggleHelp, navigate, preferences } = useShell();
    const formatDate = useShortDate(preferences.regionalFormat ?? preferences.locale, preferences.timeZone);
    const open = useHelpState(store, state => helpVisible(state, docked));
    const restored = useHelpState(store, state => state.open && state.restored);
    const article = useHelpState(store, state => state.article);
    const query = useHelpState(store, state => state.query);
    const updates = useHelpState(store, state => state.updates);
    const updatesStatus = useHelpState(store, state => state.updatesStatus);
    const pendingQuestion = useHelpState(store, state => state.pendingQuestion);
    const [articles, setArticles] = useState<{ topic: string | undefined; items: HelpArticle[]; status: 'loading' | 'ready' | 'unavailable' }>({ topic: undefined, items: [], status: 'loading' });
    const [results, setResults] = useState<{ q: string; items: HelpArticle[]; status: 'loading' | 'ready' | 'unavailable' } | null>(null);
    const [question, setQuestion] = useState('');
    const [chatProblem, setChatProblem] = useState(false);
    // The phone's sheet: a question was sent to Ask Cbox, so "Talk to a person" is offered.
    const [asked, setAsked] = useState(false);
    const [followUp, setFollowUp] = useState('');
    const column = useRef<HTMLDivElement>(null);
    const body = useRef<HTMLDivElement>(null);
    const chatHost = useRef<HTMLDivElement>(null);
    const searchField = useRef<HTMLInputElement>(null);
    const opener = useRef<HTMLElement | null>(null);
    const scrim = useRef<HTMLDivElement>(null);
    const { help } = shell;
    // The phone's Help is a bottom sheet: the page behind holds still, and it drags like one.
    useScrollLock(mobile && open);
    const closeSheet = useCallback(() => toggleHelp(false), [toggleHelp]);
    useSheetDrag({ panel: column, scrim, size: 'tall', onClose: closeSheet, enabled: mobile && open });
    const portal = help.portalUrl;

    // Support updates are per person per organization (§7.3). They feed the button's count, so
    // they load after the first paint, open or not, and again when the URL or organization
    // changes: the store outlives Inertia visits, so an org switch must not keep the old count.
    const updatesKey = help.enabled && help.updatesUrl !== undefined ? `${help.updatesUrl}|${shell.context.levels[0]?.current.id ?? ''}` : null;
    const loadUpdates = useCallback(() => {
        if (updatesKey === null || help.updatesUrl === undefined) return;
        const current = () => store.get().updatesKey === updatesKey;
        store.set({ updatesStatus: 'loading', updatesKey });
        requestJson(help.updatesUrl)
            .then(answer => {
                if (current()) store.set({ updates: parseUpdates(answer), updatesStatus: 'ready' });
            })
            .catch(() => {
                if (current()) store.set({ updatesStatus: 'unavailable' });
            });
    }, [updatesKey, help.updatesUrl, store]);
    useEffect(() => {
        const state = store.get();
        if (state.updatesKey !== updatesKey) {
            store.set({ updates: [], updatesStatus: 'idle', updatesKey });
            loadUpdates();
        } else if (state.updatesStatus === 'idle') loadUpdates();
    }, [updatesKey, loadUpdates, store]);
    useEffect(() => {
        if (open && store.get().updatesStatus !== 'loading') loadUpdates();
    }, [open]);

    // Articles for this page's topic.
    useEffect(() => {
        if (!open || !help.enabled || help.articlesUrl === undefined || help.topic === undefined) return;
        if (articles.topic === help.topic && articles.status === 'ready') return;
        const controller = new AbortController();
        setArticles({ topic: help.topic, items: [], status: 'loading' });
        requestJson(help.articlesUrl.split('{topic}').join(encodeURIComponent(help.topic)), { signal: controller.signal })
            .then(answer => setArticles({ topic: help.topic, items: parseArticles(answer).slice(0, 4), status: 'ready' }))
            .catch((error: unknown) => {
                if ((error as { name?: string })?.name !== 'AbortError') setArticles({ topic: help.topic, items: [], status: 'unavailable' });
            });
        return () => controller.abort();
    }, [open, help.enabled, help.articlesUrl, help.topic]);

    // Docs search, debounced like the palette.
    useEffect(() => {
        const q = query.trim();
        if (!help.enabled || help.searchUrl === undefined || q === '') {
            setResults(null);
            return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setResults(current => ({ q, items: current?.items ?? [], status: 'loading' }));
            requestJson(withQuery(help.searchUrl!, { q, topic: help.topic }), { signal: controller.signal })
                .then(answer => setResults({ q, items: parseArticles(answer), status: 'ready' }))
                .catch((error: unknown) => {
                    if ((error as { name?: string })?.name !== 'AbortError') setResults({ q, items: [], status: 'unavailable' });
                });
        }, DEBOUNCE_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, help.enabled, help.searchUrl, help.topic]);

    // The SDK script loads once Help is first opened: never before the page has painted.
    useEffect(() => {
        if (open && help.enabled && help.sessionUrl !== undefined) ensureScript(help.scriptUrl ?? DEFAULT_SUPPORT_SCRIPT);
    }, [open, help.enabled, help.sessionUrl, help.scriptUrl]);

    // The page intent follows navigation.
    const intent = pageIntent(shell);
    const intentJson = JSON.stringify(intent);
    useEffect(() => {
        const element = chatHost.current?.querySelector<SupportElement>(SUPPORT_TAG);
        if (element !== null && element !== undefined) element.intent = JSON.parse(intentJson) as PageIntent;
    }, [intentJson]);

    const openChat = useCallback(
        async (ask?: string, handover = false) => {
            setChatProblem(false);
            if (help.sessionUrl === undefined) {
                setChatProblem(true);
                return;
            }
            ensureScript(help.scriptUrl ?? DEFAULT_SUPPORT_SCRIPT);
            const element = await whenSupportReady(chatHost.current);
            if (element === null) {
                setChatProblem(true);
                return;
            }
            element.intent = JSON.parse(intentJson) as PageIntent;
            if (handover && typeof element.handover === 'function') void element.handover();
            else if (ask !== undefined && ask !== '' && typeof element.ask === 'function') void element.ask(ask, element.intent);
            else void element.open?.();
        },
        [help.sessionUrl, help.scriptUrl, intentJson],
    );

    useEffect(() => {
        if (pendingQuestion === null || !open) return;
        store.set({ pendingQuestion: null });
        setQuestion(pendingQuestion);
        void openChat(pendingQuestion);
    }, [pendingQuestion, open, openChat, store]);

    // Scroll position survives page changes.
    useLayoutEffect(() => {
        if (open && body.current !== null) body.current.scrollTop = store.get().scrollTop;
    }, [open, article, store]);

    // When the person opens Help, its search takes focus on a desktop. Help that was simply left
    // open never takes focus on a page load, unless it is the modal overlay, which must hold it.
    // When it closes, focus goes back to what opened it (the Help button or a page's `?`).
    const wasOpen = useRef(open);
    useEffect(() => {
        const opened = open && !wasOpen.current;
        const closed = !open && wasOpen.current;
        wasOpen.current = open;
        if (closed) {
            const active = document.activeElement;
            if (active === null || active === document.body || column.current?.contains(active)) {
                const back = opener.current?.isConnected ? opener.current : document.querySelector<HTMLElement>('[aria-controls="cbx-help"]');
                back?.focus({ preventScroll: true });
            }
            opener.current = null;
            return;
        }
        if (!open) return;
        if (opened) {
            const active = document.activeElement;
            opener.current = active instanceof HTMLElement && active !== document.body && !column.current?.contains(active) ? active : null;
        }
        if (opened && canAutofocus() && store.get().article === null) searchField.current?.focus();
        else if (!docked && !column.current?.contains(document.activeElement)) column.current?.focus();
    }, [open, docked, store]);

    const markRead = (update: SupportUpdate) => {
        if (!update.unread) return;
        store.set(state => ({ updates: state.updates.map(item => (item.id === update.id ? { ...item, unread: false } : item)) }));
        if (help.updatesUrl !== undefined) requestJson(`${help.updatesUrl.replace(/\/$/, '')}/${encodeURIComponent(update.id)}/read`, { method: 'POST' }).catch(() => undefined);
    };
    const openUpdate = (update: SupportUpdate) => {
        markRead(update);
        if (update.kind === 'chat') void openChat();
        else if (update.url !== undefined) navigate(update.url, { newTab: true });
        else if (portal !== undefined) navigate(portal, { newTab: true });
    };

    const unread = updates.filter(update => update.unread);
    const unavailable = !help.enabled || updatesStatus === 'unavailable' || articles.status === 'unavailable' || results?.status === 'unavailable';
    const trail = contextTrail(shell);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        void openChat(question.trim());
        if (question.trim() !== '') setAsked(true);
    };

    // Articles for this page: loaded from `articlesUrl`, else the ones sent with the page.
    const pageArticles: HelpArticle[] = help.articlesUrl !== undefined ? articles.items : (help.articles ?? []).slice(0, 4);

    if (mobile) {
        const topic = helpTopicName(shell);
        const environment = environmentLevel(shell.context.levels)?.current;
        const where = shell.context.levels.map(level => level.current.name).join(' · ');
        const chatReady = help.enabled && help.sessionUrl !== undefined;
        const close = () => toggleHelp(false);
        return (
            <div ref={scrim} className="cbx-overlay cbx-sheet-backdrop" hidden={!open} {...scrimHandlers(close)}>
                <div
                    ref={column}
                    id="cbx-help"
                    className="cbx-sheet cbx-sheet-bottom is-tall cbx-help-sheet"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('Help with {page}', { page: topic })}
                    tabIndex={-1}
                    onKeyDown={event => {
                        if (event.key === 'Escape' && !event.defaultPrevented) {
                            event.preventDefault();
                            close();
                        }
                        trapTab(event, column.current);
                    }}
                >
                    <div className="cbx-sheet-handle cbx-sheet-grab" aria-hidden="true" />
                    <div className={`cbx-sheet-head cbx-sheet-grab ${article !== null ? 'has-back' : ''}`}>
                        {article !== null && (
                            <button type="button" className="cbx-sheet-back" onClick={() => store.set({ article: null })} aria-label={t('Back to Help')}>
                                <ChevronLeft size={20} strokeWidth={1.8} aria-hidden />
                            </button>
                        )}
                        <strong className="cbx-sheet-title cbx-truncate">{article !== null ? t('Article') : t('Help with {page}', { page: topic })}</strong>
                        <button type="button" className="cbx-icon-button" onClick={close} aria-label={t('Close Help')}>
                            <X size={18} strokeWidth={1.8} aria-hidden />
                        </button>
                    </div>
                    <div ref={body} className="cbx-sheet-body" data-cbx-sheet-scroll="" onScroll={event => store.set({ scrollTop: event.currentTarget.scrollTop })}>
                        {article !== null ? (
                            <article className="cbx-help-article">
                                <h2 className="cbx-help-article-title">{article.title}</h2>
                                {(article.body ?? article.excerpt ?? '').split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                                {article.url !== undefined && (
                                    <a className="cbx-link" href={article.url} target="_blank" rel="noopener">
                                        {t('Open the full article')} <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden />
                                    </a>
                                )}
                                <p className="cbx-eyebrow">{t('Still stuck?')}</p>
                                <form
                                    className="cbx-askbar"
                                    onSubmit={event => {
                                        event.preventDefault();
                                        const text = followUp.trim();
                                        if (text === '') return;
                                        store.set({ article: null });
                                        setQuestion(text);
                                        setAsked(true);
                                        void openChat(text);
                                    }}
                                >
                                    <input type="text" value={followUp} onChange={event => setFollowUp(event.target.value)} placeholder={t('Ask a follow-up…')} aria-label={t('Ask a follow-up')} disabled={!chatReady} />
                                    <button type="submit" className="cbx-askbar-send" aria-label={t('Ask')} disabled={!chatReady}><ArrowUp size={16} strokeWidth={2.2} aria-hidden /></button>
                                </form>
                            </article>
                        ) : (
                            <>
                                {unavailable && (
                                    <div className="cbx-help-notice" role="status">
                                        <CircleAlert size={16} strokeWidth={1.8} aria-hidden />
                                        <span>{help.enabled ? t('Help is not available right now. The rest of the app works as usual.') : t('Help is not available here yet.')}</span>
                                    </div>
                                )}
                                <form className="cbx-askbar" onSubmit={submit}>
                                    <input ref={searchField} type="text" value={question} onChange={event => setQuestion(event.target.value)} placeholder={t('Ask about {page}…', { page: topic })} aria-label={t('Ask Cbox')} disabled={!chatReady} />
                                    <button type="submit" className="cbx-askbar-send" aria-label={t('Ask')} disabled={!chatReady}><ArrowUp size={16} strokeWidth={2.2} aria-hidden /></button>
                                </form>
                                <p className="cbx-ctxnote">
                                    {environment !== undefined && <span className={`cbx-tone cbx-tone-${environment.tone ?? 'neutral'}`} aria-hidden="true" />}
                                    {t('Cbox sees this page: {page} in {where}', { page: topic, where })}
                                </p>
                                {chatProblem && <p className="cbx-create-error" role="alert">{t('The chat could not be opened. Try again, or use the support portal.')}</p>}
                                {asked && chatReady && (
                                    <button type="button" className="cbx-pbtn" onClick={() => void openChat(t('I would like to talk to a person.'), true)}>
                                        <UserRound size={16} strokeWidth={1.8} aria-hidden /> {t('Talk to a person')}
                                    </button>
                                )}
                                {updates.length > 0 && (
                                    <section aria-labelledby="cbx-help-threads">
                                        <h2 id="cbx-help-threads" className="cbx-eyebrow">{t('Your conversations')}</h2>
                                        <div className="cbx-group">
                                            {updates.map(update => (
                                                <button key={update.id} type="button" className={`cbx-grow is-tall ${update.unread ? 'is-unread' : ''}`} onClick={() => openUpdate(update)}>
                                                    <span className="cbx-tile is-plain" aria-hidden="true">{update.kind === 'chat' ? <MessageSquare size={16} strokeWidth={1.8} /> : <Ticket size={16} strokeWidth={1.8} />}</span>
                                                    <span className="cbx-grow-text">
                                                        <span className="cbx-grow-strong cbx-truncate">{update.title}</span>
                                                        {update.excerpt !== undefined && <span className="cbx-grow-sub cbx-truncate">{update.excerpt}</span>}
                                                    </span>
                                                    {update.unread && <span className="cbx-badge">{t('{count} new', { count: 1 })}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                )}
                                {pageArticles.length > 0 && (
                                    <section aria-labelledby="cbx-help-for">
                                        <h2 id="cbx-help-for" className="cbx-eyebrow">{t('For {page}', { page: topic })}</h2>
                                        <div className="cbx-group">
                                            {pageArticles.map(item => (
                                                <button key={item.id} type="button" className="cbx-grow" onClick={() => store.set({ article: item })}>
                                                    <FileText className="cbx-grow-icon" size={18} strokeWidth={1.7} aria-hidden />
                                                    <span className="cbx-grow-label">{item.title}</span>
                                                    <ChevronRight className="cbx-grow-trail" size={16} strokeWidth={1.8} aria-hidden />
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                )}
                                <div className="cbx-pbtns">
                                    <button type="button" className="cbx-pbtn" onClick={() => void openChat(t('I would like to talk to a person.'), true)} disabled={!chatReady}>{t('Chat with support')}</button>
                                    {portal !== undefined && (
                                        <a className="cbx-pbtn" href={portal} target="_blank" rel="noopener">
                                            {t('Help center')} <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden />
                                        </a>
                                    )}
                                </div>
                            </>
                        )}
                        {help.enabled && help.sessionUrl !== undefined && (
                            <div ref={chatHost} className="cbx-chat-host" data-view={article !== null ? 'article' : 'home'}>
                                {createElement(SUPPORT_TAG, { 'session-url': help.sessionUrl, intent: intentJson })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={column}
            id="cbx-help"
            className={`cbx-help ${docked ? 'is-docked' : 'is-overlay'}`}
            hidden={!open}
            data-restored={restored ? 'true' : undefined}
            aria-label={t('Help')}
            role={docked ? 'complementary' : 'dialog'}
            aria-modal={docked ? undefined : true}
            tabIndex={-1}
            onKeyDown={event => {
                if (event.key === 'Escape' && !event.defaultPrevented) {
                    event.preventDefault();
                    toggleHelp(false);
                }
                if (!docked) trapTab(event, column.current);
            }}
        >
            <div className="cbx-help-head">
                {article !== null ? (
                    <button type="button" className="cbx-icon-button" onClick={() => store.set({ article: null })} aria-label={t('Back to Help')}>
                        <ArrowLeft size={18} strokeWidth={1.8} aria-hidden />
                    </button>
                ) : (
                    <LifeBuoy className="cbx-help-mark" size={18} strokeWidth={1.8} aria-hidden />
                )}
                <h2 className="cbx-help-title">{t('Help')}</h2>
                {portal !== undefined && (
                    <a className="cbx-icon-button" href={portal} target="_blank" rel="noopener" aria-label={t('Support portal (opens in a new tab)')} title={t('Support portal')}>
                        <ArrowUpRight size={18} strokeWidth={1.8} aria-hidden />
                    </a>
                )}
                <button type="button" className="cbx-icon-button" onClick={() => toggleHelp(false)} aria-label={t('Close Help')}>
                    <X size={18} strokeWidth={1.8} aria-hidden />
                </button>
            </div>
            <p className="cbx-help-page">
                <span className="cbx-help-page-label">{t('On this page')}</span>
                <span className="cbx-truncate" title={[shell.page?.title, trail].filter(Boolean).join(' · ')}>
                    {shell.page?.title !== undefined && <strong>{shell.page.title}</strong>}
                    {shell.page?.title !== undefined && trail !== '' && ' · '}
                    {trail}
                </span>
            </p>
            <div ref={body} className="cbx-help-body" onScroll={event => store.set({ scrollTop: event.currentTarget.scrollTop })}>
                {article !== null ? (
                    <article className="cbx-help-article">
                        <h3>{article.title}</h3>
                        {(article.body ?? article.excerpt ?? '').split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                        {article.url !== undefined && (
                            <a className="cbx-link" href={article.url} target="_blank" rel="noopener">
                                {t('Open the full article')} <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden />
                            </a>
                        )}
                    </article>
                ) : (
                    <>
                        {unavailable && (
                            <div className="cbx-help-notice" role="status">
                                <CircleAlert size={16} strokeWidth={1.8} aria-hidden />
                                <span>{help.enabled ? t('Help is not available right now. The rest of the app works as usual.') : t('Help is not available here yet.')}</span>
                                {help.enabled && <button type="button" className="cbx-link" onClick={() => { loadUpdates(); setArticles(current => ({ ...current, status: 'loading', topic: undefined })); }}>{t('Try again')}</button>}
                            </div>
                        )}
                        {unread.length > 0 || updates.length > 0 ? (
                            <section className="cbx-help-section" aria-labelledby="cbx-help-updates">
                                <div className="cbx-pane-heading">
                                    <span id="cbx-help-updates">{t('Support updates')}</span>
                                    {unread.length > 0 && <button type="button" className="cbx-pane-all" onClick={() => unread.forEach(markRead)}>{t('Mark all read')}</button>}
                                </div>
                                <ul className="cbx-list" role="list">
                                    {updates.map(update => (
                                        <li key={update.id}>
                                            <button type="button" className={`cbx-update ${update.unread ? 'is-unread' : ''}`} onClick={() => openUpdate(update)}>
                                                {update.kind === 'chat' ? <MessageSquare size={16} strokeWidth={1.8} aria-hidden /> : <Ticket size={16} strokeWidth={1.8} aria-hidden />}
                                                <span className="cbx-update-text">
                                                    <span className="cbx-update-title cbx-truncate" title={update.title}>{update.title}</span>
                                                    {update.excerpt !== undefined && <span className="cbx-update-excerpt">{update.excerpt}</span>}
                                                </span>
                                                <span className="cbx-update-meta">
                                                    {update.at !== undefined && <time dateTime={update.at}>{formatDate(update.at)}</time>}
                                                    {update.unread && <span className="cbx-unread-dot" aria-label={t('Unread')} />}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ) : null}
                        <section className="cbx-help-section" aria-label={t('Search docs and knowledge base')}>
                            <div className="cbx-help-search">
                                <Search size={16} strokeWidth={1.8} aria-hidden />
                                <input
                                    ref={searchField}
                                    type="search"
                                    value={query}
                                    onChange={event => store.set({ query: event.target.value })}
                                    placeholder={t('Search docs and knowledge base')}
                                    aria-label={t('Search docs and knowledge base')}
                                    disabled={!help.enabled || help.searchUrl === undefined}
                                />
                            </div>
                            {results !== null && (
                                <ul className="cbx-list" role="list" aria-live="polite">
                                    {results.items.map(item => (
                                        <li key={item.id}><ArticleRow article={item} /></li>
                                    ))}
                                    {results.status === 'ready' && results.items.length === 0 && <li className="cbx-list-note">{t('Nothing matches “{query}”.', { query: results.q })}</li>}
                                    {results.status === 'loading' && results.items.length === 0 && <li className="cbx-list-note">{t('Searching…')}</li>}
                                </ul>
                            )}
                        </section>
                        {help.topic !== undefined && pageArticles.length > 0 && (
                            <section className="cbx-help-section" aria-labelledby="cbx-help-topic">
                                <div className="cbx-pane-heading"><span id="cbx-help-topic">{t('For this page')}</span></div>
                                <ul className="cbx-list" role="list">
                                    {pageArticles.slice(0, 3).map(item => <li key={item.id}><ArticleRow article={item} /></li>)}
                                </ul>
                            </section>
                        )}
                        <section className="cbx-help-section" aria-labelledby="cbx-help-ask">
                            <div className="cbx-pane-heading"><span id="cbx-help-ask">{t('Ask Cbox')}</span></div>
                            <form className="cbx-ask" onSubmit={submit}>
                                <textarea
                                    className="cbx-input"
                                    rows={3}
                                    value={question}
                                    onChange={event => setQuestion(event.target.value)}
                                    placeholder={t('Ask about this page…')}
                                    aria-label={t('Ask Cbox')}
                                    disabled={!help.enabled || help.sessionUrl === undefined}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit(event);
                                    }}
                                />
                                <button type="submit" className="cbx-button cbx-button-primary" disabled={!help.enabled || help.sessionUrl === undefined}>
                                    <Sparkles size={15} strokeWidth={1.8} aria-hidden /> {t('Ask')}
                                </button>
                            </form>
                            {chatProblem && <p className="cbx-create-error" role="alert">{t('The chat could not be opened. Try again, or use the support portal.')}</p>}
                        </section>
                    </>
                )}
                {/* The chat element sits outside the home/article switch, so opening an article
                    (from the palette, "For this page" or a search) never unmounts it and the
                    conversation survives (§7.1). */}
                {help.enabled && help.sessionUrl !== undefined && (
                    <div ref={chatHost} className="cbx-chat-host" data-view={article !== null ? 'article' : 'home'}>
                        {createElement(SUPPORT_TAG, { 'session-url': help.sessionUrl, intent: intentJson })}
                    </div>
                )}
            </div>
            <div className="cbx-help-foot">
                <button type="button" className="cbx-row cbx-row-action" onClick={() => void openChat(t('I would like to talk to a person.'), true)} disabled={!help.enabled || help.sessionUrl === undefined}>
                    <UserRound size={16} strokeWidth={1.8} aria-hidden />
                    <span className="cbx-row-name">{t('Talk to a person')}</span>
                </button>
                {portal !== undefined && (
                    <a className="cbx-row cbx-row-action" href={portal} target="_blank" rel="noopener">
                        <BookOpen size={16} strokeWidth={1.8} aria-hidden />
                        <span className="cbx-row-name">{t('Support portal')}</span>
                        <ArrowUpRight className="cbx-row-trail" size={14} strokeWidth={1.8} aria-hidden />
                    </a>
                )}
            </div>
        </div>
    );
}

/** "10 Nov, 10:12" in the person's regional format and time zone (Cbox ID's preferences). */
export function useShortDate(locale: string | undefined, timeZone: string | undefined): (iso: string) => string {
    const format = useMemo(() => {
        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
        try {
            return new Intl.DateTimeFormat(locale, { ...options, timeZone });
        } catch {
            return new Intl.DateTimeFormat(undefined, options);
        }
    }, [locale, timeZone]);
    return useCallback((iso: string) => {
        const date = new Date(iso);
        return Number.isNaN(date.getTime()) ? iso : format.format(date);
    }, [format]);
}

function ArticleRow({ article }: { article: HelpArticle }) {
    const { openArticle } = useShell();
    return (
        <button type="button" className="cbx-update" onClick={() => openArticle(article)}>
            <BookOpen size={16} strokeWidth={1.8} aria-hidden />
            <span className="cbx-update-text">
                <span className="cbx-update-title cbx-truncate" title={article.title}>{article.title}</span>
                {article.excerpt !== undefined && <span className="cbx-update-excerpt">{article.excerpt}</span>}
            </span>
        </button>
    );
}
