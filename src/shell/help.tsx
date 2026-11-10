import { ArrowLeft, ArrowUpRight, BookOpen, CircleAlert, LifeBuoy, MessageSquare, Search, Sparkles, Ticket, UserRound, X } from 'lucide-react';
import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { requestJson, withQuery } from './data';
import { parseArticles, parseUpdates, type HelpArticle, type HelpState, type HelpStore, type SupportUpdate } from './help-store';
import { useShell } from './context';
import { canAutofocus } from './media';
import { trapTab } from './popover';
import { DEBOUNCE_MS } from './use-list';
import type { Shell } from './types';

export const DEFAULT_SUPPORT_SCRIPT = '/ai-assistant/support.js';
const SUPPORT_TAG = 'cbox-support';

export function useHelpState<T>(store: HelpStore, select: (state: HelpState) => T): T {
    return useSyncExternalStore(store.subscribe, () => select(store.get()), () => select(store.get()));
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
export function HelpColumn({ docked }: { docked: boolean }) {
    const { shell, t, help: store, toggleHelp, navigate, preferences } = useShell();
    const formatDate = useShortDate(preferences.regionalFormat ?? preferences.locale, preferences.timeZone);
    const open = useHelpState(store, state => state.open);
    const article = useHelpState(store, state => state.article);
    const query = useHelpState(store, state => state.query);
    const updates = useHelpState(store, state => state.updates);
    const updatesStatus = useHelpState(store, state => state.updatesStatus);
    const pendingQuestion = useHelpState(store, state => state.pendingQuestion);
    const [articles, setArticles] = useState<{ topic: string | undefined; items: HelpArticle[]; status: 'loading' | 'ready' | 'unavailable' }>({ topic: undefined, items: [], status: 'loading' });
    const [results, setResults] = useState<{ q: string; items: HelpArticle[]; status: 'loading' | 'ready' | 'unavailable' } | null>(null);
    const [question, setQuestion] = useState('');
    const [chatProblem, setChatProblem] = useState(false);
    const column = useRef<HTMLElement>(null);
    const body = useRef<HTMLDivElement>(null);
    const chatHost = useRef<HTMLDivElement>(null);
    const searchField = useRef<HTMLInputElement>(null);
    const { help } = shell;
    const portal = help.portalUrl;

    // Support updates feed the button's count, so they load after the first paint, open or not.
    const loadUpdates = useCallback(() => {
        if (!help.enabled || help.updatesUrl === undefined) return;
        store.set({ updatesStatus: 'loading' });
        requestJson(help.updatesUrl)
            .then(answer => store.set({ updates: parseUpdates(answer), updatesStatus: 'ready' }))
            .catch(() => store.set({ updatesStatus: 'unavailable' }));
    }, [help.enabled, help.updatesUrl, store]);
    useEffect(() => {
        if (store.get().updatesStatus === 'idle') loadUpdates();
    }, [loadUpdates, store]);
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
            .then(answer => setArticles({ topic: help.topic, items: parseArticles(answer).slice(0, 3), status: 'ready' }))
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
    const wasOpen = useRef(open);
    useEffect(() => {
        const opened = open && !wasOpen.current;
        wasOpen.current = open;
        if (!open) return;
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
    };

    return (
        <aside
            ref={column}
            id="cbx-help"
            className={`cbx-help ${docked ? 'is-docked' : 'is-overlay'}`}
            hidden={!open}
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
            <header className="cbx-help-head">
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
            </header>
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
                        {help.topic !== undefined && articles.items.length > 0 && (
                            <section className="cbx-help-section" aria-labelledby="cbx-help-topic">
                                <div className="cbx-pane-heading"><span id="cbx-help-topic">{t('For this page')}</span></div>
                                <ul className="cbx-list" role="list">
                                    {articles.items.map(item => <li key={item.id}><ArticleRow article={item} /></li>)}
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
                            {help.enabled && help.sessionUrl !== undefined && (
                                <div ref={chatHost} className="cbx-chat-host">
                                    {createElement(SUPPORT_TAG, { 'session-url': help.sessionUrl, intent: intentJson })}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>
            <footer className="cbx-help-foot">
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
            </footer>
        </aside>
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
