import { ArrowLeft, ArrowUp, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, CircleAlert, LifeBuoy, MessageSquare, Ticket, UserRound, X } from 'lucide-react';
import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type Ref } from 'react';
import { withQuery } from './data';
import { cleanArticleHtml, helpEndpointState, helpRequest, helpSessionKey, HelpUnavailableError, loadHelpSession } from './help-api';
import { helpVisible, parseArticleBody, parseArticles, parseUpdates, type HelpArticle, type HelpState, type HelpStore, type SupportUpdate } from './help-store';
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
    /** A newer SDK answers whether the chat opened (`false`: it could not); an older one answers nothing. */
    open?: () => unknown;
    ask?: (question: string, intent?: PageIntent) => unknown;
    handover?: () => unknown;
    /** Hides the chat and keeps its conversation. */
    close?: () => unknown;
    intent?: PageIntent;
};

/** A same-origin address as a path, for the app's own navigation; null for anywhere else. */
function ownPath(url: unknown): string | null {
    if (typeof url !== 'string' || typeof window === 'undefined') return null;
    try {
        const target = new URL(url, window.location.href);
        return target.origin === window.location.origin ? target.pathname + target.search + target.hash : null;
    } catch {
        return null;
    }
}

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
    // The chat fills the column (an SDK that renders it inline says so when it opens).
    const chat = useHelpState(store, state => state.chat);
    const session = useHelpState(store, state => state.session);
    const [loadedArticle, setLoadedArticle] = useState<{ id: string; html: string | null; status: 'loading' | 'ready' } | null>(null);
    const [articles, setArticles] = useState<{ topic: string | undefined; items: HelpArticle[]; status: 'loading' | 'ready' | 'unavailable' }>({ topic: undefined, items: [], status: 'loading' });
    const [results, setResults] = useState<{ q: string; items: HelpArticle[]; status: 'loading' | 'ready' | 'unavailable' } | null>(null);
    const [chatProblem, setChatProblem] = useState(false);
    const [followUp, setFollowUp] = useState('');
    const column = useRef<HTMLDivElement>(null);
    const body = useRef<HTMLDivElement>(null);
    const chatHost = useRef<HTMLDivElement>(null);
    const askField = useRef<HTMLTextAreaElement>(null);
    const opener = useRef<HTMLElement | null>(null);
    const scrim = useRef<HTMLDivElement>(null);
    const { help } = shell;
    // The latest page, for requests and events that outlive the render they started in.
    const latest = useRef({ shell, navigate, toggleHelp, docked });
    latest.current = { shell, navigate, toggleHelp, docked };
    // An endpoint the app has no URL for comes from the support session (help-api.ts). Until the
    // session has answered it may exist, so its control shows; with no endpoint it is not drawn.
    const sessionKey = helpSessionKey(shell);
    const canSearch = helpEndpointState(help, session, sessionKey, 'search') !== 'none';
    const canLoadArticles = helpEndpointState(help, session, sessionKey, 'articles') !== 'none';
    const hasUpdates = helpEndpointState(help, session, sessionKey, 'updates') !== 'none';
    const sentArticles = (help.articles ?? []).slice(0, 4);
    const view: 'article' | 'chat' | 'home' = article !== null ? 'article' : chat ? 'chat' : 'home';
    // The person has a conversation here (this visit or an earlier one), so Help offers the way back to it.
    const [chatKnown, setChatKnown] = useState(false);
    useEffect(() => setChatKnown(knowsChat(sessionKey)), [sessionKey]);
    // The phone's Help is a bottom sheet: the page behind holds still, and it drags like one.
    useScrollLock(mobile && open);
    const closeSheet = useCallback(() => toggleHelp(false), [toggleHelp]);
    useSheetDrag({ panel: column, scrim, size: 'tall', onClose: closeSheet, enabled: mobile && open });
    const portal = help.portalUrl;

    // Support updates are per person per organization (§7.3). They feed the button's count, so
    // they load after the first paint, open or not, and again when the URL or organization
    // changes: the store outlives Inertia visits, so an org switch must not keep the old count.
    const updatesKey = hasUpdates ? `${help.updatesUrl ?? help.sessionUrl}|${shell.context.levels[0]?.current.id ?? ''}` : null;
    const loadUpdates = useCallback(() => {
        if (updatesKey === null) return;
        const current = () => store.get().updatesKey === updatesKey;
        store.set({ updatesStatus: 'loading', updatesKey });
        helpRequest(store, latest.current.shell, 'updates', url => url)
            .then(answer => {
                if (current()) store.set({ updates: parseUpdates(answer), updatesStatus: 'ready' });
            })
            .catch((error: unknown) => {
                // No updates endpoint is not an outage: there is simply nothing to list here.
                if (current()) store.set(error instanceof HelpUnavailableError ? { updates: [], updatesStatus: 'ready' } : { updatesStatus: 'unavailable' });
            });
    }, [updatesKey, store]);
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
        const topic = help.topic;
        // Articles sent with the page are the page's articles; nothing is fetched for them.
        if (!open || !canLoadArticles || topic === undefined || (help.articlesUrl === undefined && sentArticles.length > 0)) return;
        if (articles.topic === topic && articles.status === 'ready') return;
        const controller = new AbortController();
        setArticles({ topic, items: [], status: 'loading' });
        helpRequest(store, latest.current.shell, 'articles', url => url.split('{topic}').join(encodeURIComponent(topic)), { signal: controller.signal })
            .then(answer => setArticles({ topic, items: parseArticles(answer).slice(0, 4), status: 'ready' }))
            .catch((error: unknown) => {
                if ((error as { name?: string })?.name === 'AbortError') return;
                setArticles({ topic, items: [], status: error instanceof HelpUnavailableError ? 'ready' : 'unavailable' });
            });
        return () => controller.abort();
    }, [open, canLoadArticles, help.articlesUrl, help.topic, sessionKey]);

    // Docs search, debounced like the palette.
    useEffect(() => {
        const q = query.trim();
        if (!canSearch || q === '') {
            setResults(null);
            return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setResults(current => ({ q, items: current?.items ?? [], status: 'loading' }));
            helpRequest(store, latest.current.shell, 'search', url => withQuery(url, { q, topic: help.topic }), { signal: controller.signal })
                .then(answer => setResults({ q, items: parseArticles(answer), status: 'ready' }))
                .catch((error: unknown) => {
                    if ((error as { name?: string })?.name === 'AbortError') return;
                    setResults(error instanceof HelpUnavailableError ? null : { q, items: [], status: 'unavailable' });
                });
        }, DEBOUNCE_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, canSearch, help.searchUrl, help.topic, sessionKey, store]);

    // What the app has no URL for comes from the support session: ask for it once Help is open,
    // so a control that turns out to have nothing behind it goes away before it is used.
    const needsSession = help.enabled && sessionKey !== null && (help.searchUrl === undefined || help.updatesUrl === undefined || (help.articlesUrl === undefined && sentArticles.length === 0));
    useEffect(() => {
        if (open && needsSession && sessionKey !== null) void loadHelpSession(store, latest.current.shell.help, sessionKey);
    }, [open, needsSession, sessionKey, store]);

    // An article from a search or a topic list has a title and an excerpt; its body is fetched
    // when it opens, so it is read inside the column.
    const articleId = article?.id;
    const articleHasBody = article !== null && (article.body !== undefined || article.bodyHtml !== undefined);
    useEffect(() => {
        if (articleId === undefined || articleHasBody) return;
        const page = latest.current.shell;
        if (helpEndpointState(page.help, store.get().session, helpSessionKey(page), 'article') === 'none') return;
        const controller = new AbortController();
        setLoadedArticle({ id: articleId, html: null, status: 'loading' });
        helpRequest(store, page, 'article', url => url.split('{id}').join(encodeURIComponent(articleId)), { signal: controller.signal })
            .then(answer => setLoadedArticle({ id: articleId, html: parseArticleBody(answer)?.bodyHtml ?? null, status: 'ready' }))
            .catch((error: unknown) => {
                // The excerpt and the link to the full article are still there.
                if ((error as { name?: string })?.name !== 'AbortError') setLoadedArticle({ id: articleId, html: null, status: 'ready' });
            });
        return () => controller.abort();
    }, [articleId, articleHasBody, sessionKey, store]);

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

    /**
     * Opens the chat, with the person's question or their wish for a person. Answers whether that
     * was handed to the chat: the caller clears what the person typed only then, so a chat that
     * could not open, or an SDK that cannot take a question, never loses their words.
     */
    const openChat = useCallback(
        async (ask?: string, handover = false): Promise<boolean> => {
            setChatProblem(false);
            if (help.sessionUrl === undefined) {
                setChatProblem(true);
                return false;
            }
            ensureScript(help.scriptUrl ?? DEFAULT_SUPPORT_SCRIPT);
            const element = await whenSupportReady(chatHost.current);
            if (element === null) {
                setChatProblem(true);
                return false;
            }
            const intent = JSON.parse(intentJson) as PageIntent;
            element.intent = intent;
            let opened: unknown;
            let handed = false;
            if (handover && typeof element.handover === 'function') {
                opened = element.handover();
                handed = true;
            } else if (ask !== undefined && ask !== '' && typeof element.ask === 'function') {
                opened = element.ask(ask, intent);
                handed = true;
            } else opened = element.open?.();
            if ((await opened) === false) {
                setChatProblem(true);
                return false;
            }
            rememberChat(sessionKey);
            setChatKnown(true);
            return handed;
        },
        [help.sessionUrl, help.scriptUrl, intentJson, sessionKey],
    );
    /** Ask Cbox what the person typed; the field is emptied once the chat has it. */
    const askCbox = useCallback(
        (text: string) => {
            void openChat(text).then(sent => {
                // What the person typed is theirs until the chat has it; anything typed since stays.
                if (sent) store.set(state => (state.query.trim() === text ? { query: '' } : {}));
            });
        },
        [openChat, store],
    );
    const closeChat = useCallback(() => {
        const element = chatHost.current?.querySelector<SupportElement>(SUPPORT_TAG);
        if (typeof element?.close === 'function') void element.close();
        store.set({ chat: false });
    }, [store]);

    useEffect(() => {
        if (pendingQuestion === null || !open) return;
        store.set({ pendingQuestion: null, query: pendingQuestion });
        askCbox(pendingQuestion);
    }, [pendingQuestion, open, askCbox, store]);

    // What the chat element tells the column: it opened inside it, it closed, or the person
    // followed a link to a page of this app.
    useEffect(() => {
        const node = column.current;
        if (node === null) return;
        const onOpen = (event: Event) => {
            if ((event as CustomEvent<{ inline?: boolean } | null>).detail?.inline === true) store.set({ chat: true });
        };
        const onClose = (event: Event) => {
            store.set({ chat: false });
            if ((event as CustomEvent<{ reason?: string | null } | null>).detail?.reason === 'unavailable') setChatProblem(true);
        };
        // The app visits the page itself, so nothing reloads and the conversation stays open
        // beside it. Where Help covers the page, it steps aside; the chat is there on return.
        const onNavigate = (event: Event) => {
            const path = ownPath((event as CustomEvent<{ url?: unknown } | null>).detail?.url);
            if (path === null) return;
            event.preventDefault();
            if (!latest.current.docked) latest.current.toggleHelp(false);
            latest.current.navigate(path);
        };
        node.addEventListener('cbox-support:open', onOpen);
        node.addEventListener('cbox-support:close', onClose);
        node.addEventListener('cbox-support:navigate', onNavigate);
        return () => {
            node.removeEventListener('cbox-support:open', onOpen);
            node.removeEventListener('cbox-support:close', onClose);
            node.removeEventListener('cbox-support:navigate', onNavigate);
        };
    }, [store]);

    // Scroll position survives page changes.
    useLayoutEffect(() => {
        if (open && body.current !== null) body.current.scrollTop = store.get().scrollTop;
    }, [open, view, store]);

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
        if (opened && canAutofocus() && store.get().article === null && !store.get().chat) askField.current?.focus();
        else if (!docked && !column.current?.contains(document.activeElement)) column.current?.focus();
    }, [open, docked, store]);

    const markRead = (update: SupportUpdate) => {
        if (!update.unread) return;
        store.set(state => ({ updates: state.updates.map(item => (item.id === update.id ? { ...item, unread: false } : item)) }));
        helpRequest(store, latest.current.shell, 'updates', url => `${url.replace(/\/$/, '')}/${encodeURIComponent(update.id)}/read`, { method: 'POST' }).catch(() => undefined);
    };
    const openUpdate = (update: SupportUpdate) => {
        markRead(update);
        if (update.kind === 'chat') void openChat();
        else if (update.url !== undefined) navigate(update.url, { newTab: true });
        else if (portal !== undefined) navigate(portal, { newTab: true });
    };

    const unread = updates.filter(update => update.unread);
    const unavailable = !help.enabled || updatesStatus === 'unavailable' || articles.status === 'unavailable' || results?.status === 'unavailable';
    const topic = helpTopicName(shell);
    const where = shell.context.levels.map(level => level.current.name).join(' · ');
    const environment = environmentLevel(shell.context.levels)?.current;
    const chatReady = help.enabled && help.sessionUrl !== undefined;
    const close = () => toggleHelp(false);
    const back = () => (view === 'article' ? store.set({ article: null }) : closeChat());

    // Articles for this page: the ones sent with the page, else loaded for its topic.
    const pageArticles: HelpArticle[] = help.articlesUrl === undefined && sentArticles.length > 0 ? sentArticles : articles.items;

    // One line, in every view: what the answers are about. It follows the person as they navigate.
    const context = (strip: boolean) => (
        <p className={`cbx-ctxnote ${strip ? 'is-strip' : ''}`}>
            {environment !== undefined && <span className={`cbx-tone cbx-tone-${environment.tone ?? 'neutral'}`} aria-hidden="true" />}
            <span className="cbx-truncate" title={t('Cbox sees this page: {page} in {where}', { page: topic, where })}>{t('Cbox sees this page: {page} in {where}', { page: topic, where })}</span>
        </p>
    );

    // Help's first screen, the same on a desktop and a phone: one field that searches while the
    // person types and asks Cbox when they send, then the way back to their conversation, replies
    // from support and the articles for this page.
    const home = (
        <>
            {unavailable && (
                <div className="cbx-help-notice" role="status">
                    <CircleAlert size={16} strokeWidth={1.8} aria-hidden />
                    <span>{help.enabled ? t('Help is not available right now. The rest of the app works as usual.') : t('Help is not available here yet.')}</span>
                    {help.enabled && <button type="button" className="cbx-link" onClick={() => { loadUpdates(); setArticles(current => ({ ...current, status: 'loading', topic: undefined })); }}>{t('Try again')}</button>}
                </div>
            )}
            {(chatReady || canSearch) && (
                <>
                    <AskField
                        field={askField}
                        value={query}
                        onChange={value => store.set({ query: value })}
                        onSubmit={chatReady ? () => askCbox(query.trim()) : undefined}
                        placeholder={!chatReady ? t('Search docs and knowledge base') : canSearch ? t('Search or ask…') : t('Ask about {page}…', { page: topic })}
                        label={!chatReady ? t('Search docs and knowledge base') : canSearch ? t('Search or ask…') : t('Ask Cbox')}
                    />
                    {chatReady && context(false)}
                </>
            )}
            {chatProblem && <p className="cbx-create-error" role="alert">{t('The chat could not be opened. Try again, or use the support portal.')}</p>}
            {results !== null ? (
                <section aria-labelledby="cbx-help-results" aria-live="polite">
                    <h3 id="cbx-help-results" className="cbx-help-heading">{t('Results')}</h3>
                    {results.items.length > 0 && (
                        <div className="cbx-group">
                            {results.items.map(item => <ArticleRow key={item.id} article={item} />)}
                        </div>
                    )}
                    {/* A question is not a failed search: with no article for it, the next step is to send it. */}
                    {results.status === 'ready' && results.items.length === 0 && <p className="cbx-list-note">{chatReady ? t('No articles match. Send it to ask Cbox.') : t('Nothing matches “{query}”.', { query: results.q })}</p>}
                    {results.status === 'loading' && results.items.length === 0 && <p className="cbx-list-note">{t('Searching…')}</p>}
                </section>
            ) : (
                <>
                    {chatKnown && chatReady && (
                        <div className="cbx-group cbx-help-resume">
                            <button type="button" className="cbx-grow" onClick={() => void openChat()}>
                                <span className="cbx-tile is-accent" aria-hidden="true"><MessageSquare size={16} strokeWidth={1.8} /></span>
                                <span className="cbx-grow-label cbx-grow-strong">{t('Continue the conversation')}</span>
                                <ChevronRight className="cbx-grow-trail" size={16} strokeWidth={1.8} aria-hidden />
                            </button>
                        </div>
                    )}
                    {updates.length > 0 && (
                        <section aria-labelledby="cbx-help-updates">
                            <div className="cbx-help-heading">
                                <h3 id="cbx-help-updates">{t('Support updates')}</h3>
                                {unread.length > 0 && <button type="button" className="cbx-pane-all" onClick={() => unread.forEach(markRead)}>{t('Mark all read')}</button>}
                            </div>
                            <div className="cbx-group">
                                {updates.map(update => (
                                    <button key={update.id} type="button" className={`cbx-grow is-tall ${update.unread ? 'is-unread' : ''}`} onClick={() => openUpdate(update)}>
                                        <span className="cbx-tile is-plain" aria-hidden="true">{update.kind === 'chat' ? <MessageSquare size={16} strokeWidth={1.8} /> : <Ticket size={16} strokeWidth={1.8} />}</span>
                                        <span className="cbx-grow-text">
                                            <span className="cbx-grow-strong cbx-truncate" title={update.title}>{update.title}</span>
                                            {update.excerpt !== undefined && <span className="cbx-grow-sub cbx-truncate">{update.excerpt}</span>}
                                        </span>
                                        <span className="cbx-help-meta">
                                            {update.at !== undefined && <time dateTime={update.at}>{formatDate(update.at)}</time>}
                                            {update.unread && <span className="cbx-unread-dot" role="img" aria-label={t('Unread')} />}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}
                    {pageArticles.length > 0 && (
                        <section aria-labelledby="cbx-help-topic">
                            <h3 id="cbx-help-topic" className="cbx-help-heading">{t('For {page}', { page: topic })}</h3>
                            <div className="cbx-group">
                                {pageArticles.map(item => <ArticleRow key={item.id} article={item} />)}
                            </div>
                        </section>
                    )}
                </>
            )}
        </>
    );

    const reading = article !== null && (
        <article className="cbx-help-article">
            <h3 className="cbx-help-article-title">{article.title}</h3>
            <ArticleBody article={article} loaded={loadedArticle !== null && loadedArticle.id === article.id ? loadedArticle : null} />
            {article.url !== undefined && (
                <a className="cbx-link" href={article.url} target="_blank" rel="noopener">
                    {t('Open the full article')} <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden />
                </a>
            )}
            {chatReady && (
                <>
                    <h4 className="cbx-help-heading">{t('Still stuck?')}</h4>
                    <AskField
                        value={followUp}
                        onChange={setFollowUp}
                        onSubmit={() => {
                            const text = followUp.trim();
                            store.set({ article: null, query: text });
                            setFollowUp('');
                            askCbox(text);
                        }}
                        placeholder={t('Ask a follow-up…')}
                        label={t('Ask a follow-up')}
                    />
                </>
            )}
        </article>
    );

    // The chat element sits outside the home/article/chat switch, so opening an article (from
    // the palette, "For this page" or a search) never unmounts it and the conversation survives (§7.1).
    const content = (
        <>
            {view === 'article' ? reading : view === 'home' ? home : null}
            {chatReady && (
                <div ref={chatHost} className={`cbx-chat-host ${view === 'chat' ? 'is-open' : ''}`} data-view={view}>
                    {/* `inline`: an SDK that can renders the chat here, not in a dialog over the page,
                        in the column's measures or the phone sheet's. */}
                    {createElement(SUPPORT_TAG, { 'session-url': help.sessionUrl, intent: intentJson, inline: mobile ? 'sheet' : 'column' })}
                </div>
            )}
        </>
    );

    // One way to a person and one way to the portal. The open chat has its own way to a person,
    // so the footer is not shown beside it.
    const foot = view !== 'chat' && (chatReady || portal !== undefined) && (
        <div className="cbx-help-foot">
            {chatReady && (
                <button type="button" className="cbx-help-action" onClick={() => void openChat(t('I would like to talk to a person.'), true)}>
                    <UserRound size={16} strokeWidth={1.8} aria-hidden /> {t('Talk to a person')}
                </button>
            )}
            {portal !== undefined && (
                <a className="cbx-help-action" href={portal} target="_blank" rel="noopener" aria-label={t('Support portal (opens in a new tab)')}>
                    <BookOpen size={16} strokeWidth={1.8} aria-hidden /> {t('Support portal')} <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden />
                </a>
            )}
        </div>
    );
    const onScroll = (top: number) => {
        if (view !== 'chat') store.set({ scrollTop: top });
    };

    if (mobile) {
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
                    <div className={`cbx-sheet-head cbx-sheet-grab ${view !== 'home' ? 'has-back' : ''}`}>
                        {view !== 'home' && (
                            <button type="button" className="cbx-sheet-back" onClick={back} aria-label={t('Back to Help')}>
                                <ChevronLeft size={20} strokeWidth={1.8} aria-hidden />
                            </button>
                        )}
                        <strong className="cbx-sheet-title cbx-truncate">{view === 'article' ? t('Article') : view === 'chat' ? t('Ask Cbox') : t('Help with {page}', { page: topic })}</strong>
                        <button type="button" className="cbx-icon-button" onClick={close} aria-label={t('Close Help')}>
                            <X size={18} strokeWidth={1.8} aria-hidden />
                        </button>
                    </div>
                    {view === 'chat' && context(true)}
                    <div ref={body} className={`cbx-sheet-body ${view === 'chat' ? 'is-chat' : ''}`} data-cbx-sheet-scroll="" onScroll={event => onScroll(event.currentTarget.scrollTop)}>
                        {content}
                    </div>
                    {foot}
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
                    close();
                }
                if (!docked) trapTab(event, column.current);
            }}
        >
            <div className="cbx-help-head">
                {view !== 'home' ? (
                    <button type="button" className="cbx-icon-button" onClick={back} aria-label={t('Back to Help')}>
                        <ArrowLeft size={18} strokeWidth={1.8} aria-hidden />
                    </button>
                ) : (
                    <LifeBuoy className="cbx-help-mark" size={18} strokeWidth={1.8} aria-hidden />
                )}
                <h2 className="cbx-help-title">{view === 'article' ? t('Article') : view === 'chat' ? t('Ask Cbox') : t('Help')}</h2>
                <button type="button" className="cbx-icon-button" onClick={close} aria-label={t('Close Help')}>
                    <X size={18} strokeWidth={1.8} aria-hidden />
                </button>
            </div>
            {view === 'chat' && context(true)}
            <div ref={body} className={`cbx-help-body ${view === 'chat' ? 'is-chat' : ''}`} onScroll={event => onScroll(event.currentTarget.scrollTop)}>
                {content}
            </div>
            {foot}
        </div>
    );
}

/** Whether the person has had a conversation in this organization on this device. Only a flag is kept. */
const CHAT_FLAG = 'cbx-help-chat:';
function knowsChat(key: string | null): boolean {
    try {
        return key !== null && localStorage.getItem(CHAT_FLAG + key) === '1';
    } catch {
        return false;
    }
}
function rememberChat(key: string | null): void {
    try {
        if (key !== null) localStorage.setItem(CHAT_FLAG + key, '1');
    } catch {
        // No storage: the way back is offered for this visit only.
    }
}

/**
 * Help's one field, wherever the person types to Cbox: it grows with the text, Enter sends and
 * Shift+Enter breaks the line. Enter that commits a dead key or an IME composition is not "send".
 */
function AskField({ value, onChange, onSubmit, placeholder, label, field }: { value: string; onChange: (value: string) => void; /** Absent: the field only searches, and has no send button. */ onSubmit?: () => void; placeholder: string; label: string; field?: Ref<HTMLTextAreaElement> }) {
    const { t } = useShell();
    const own = useRef<HTMLTextAreaElement | null>(null);
    const fit = useCallback(() => {
        const element = own.current;
        if (element === null) return;
        element.style.height = 'auto';
        // Not on screen (Help is closed): there is nothing to measure, so the stylesheet's height stands.
        element.style.height = element.scrollHeight > 0 ? `${Math.min(element.scrollHeight, 120)}px` : '';
    }, []);
    useLayoutEffect(fit, [value, fit]);
    const empty = value.trim() === '';
    const send = () => {
        if (!empty) onSubmit?.();
    };
    return (
        <form
            className="cbx-askfield"
            onSubmit={event => {
                event.preventDefault();
                send();
            }}
        >
            <textarea
                ref={element => {
                    own.current = element;
                    if (typeof field === 'function') field(element);
                    else if (field != null) field.current = element;
                }}
                rows={1}
                value={value}
                onChange={event => onChange(event.target.value)}
                placeholder={placeholder}
                aria-label={label}
                onFocus={fit}
                onKeyDown={event => {
                    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
                    event.preventDefault();
                    send();
                }}
            />
            {onSubmit !== undefined && (
                <button type="submit" className="cbx-askfield-send" aria-label={t('Ask')} disabled={empty}>
                    <ArrowUp size={16} strokeWidth={2.2} aria-hidden />
                </button>
            )}
        </form>
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

/**
 * An article's text: the body Assistant rendered (cleaned again here before it reaches the page),
 * else its plain body or excerpt as paragraphs.
 */
function ArticleBody({ article, loaded }: { article: HelpArticle; loaded: { html: string | null; status: 'loading' | 'ready' } | null }) {
    const { t } = useShell();
    const html = article.bodyHtml ?? loaded?.html ?? null;
    const clean = useMemo(() => (html === null ? '' : cleanArticleHtml(html)), [html]);
    if (clean !== '') return <div className="cbx-help-prose" dangerouslySetInnerHTML={{ __html: clean }} />;
    return (
        <>
            {(article.body ?? article.excerpt ?? '').split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            {loaded?.status === 'loading' && <p className="cbx-list-note" role="status">{t('Loading…')}</p>}
        </>
    );
}

function ArticleRow({ article }: { article: HelpArticle }) {
    const { openArticle } = useShell();
    return (
        <button type="button" className={`cbx-grow ${article.excerpt !== undefined ? 'is-tall' : ''}`} onClick={() => openArticle(article)}>
            <span className="cbx-tile is-plain" aria-hidden="true"><BookOpen size={16} strokeWidth={1.8} /></span>
            <span className="cbx-grow-text">
                <span className="cbx-grow-strong cbx-truncate" title={article.title}>{article.title}</span>
                {article.excerpt !== undefined && <span className="cbx-grow-sub cbx-truncate">{article.excerpt}</span>}
            </span>
            <ChevronRight className="cbx-grow-trail" size={16} strokeWidth={1.8} aria-hidden />
        </button>
    );
}
