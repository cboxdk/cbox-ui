// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://app.test/orgs/cbox/projects/webshop/environments/production/deployments"}
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanArticleHtml } from './help-api';
import { parseArticles } from './help-store';
import { makeShell } from './testing/fixture';
import { renderShell, reset, supportAnswers, supportCalls, type Answer } from './testing/harness';

afterEach(reset);

const API = 'https://assistant.test/api/v1';

/** The shell prop as console-kit sends it: a session URL, and no URL for search, articles or updates. */
function kitShell() {
    const shell = makeShell();
    delete shell.help.searchUrl;
    delete shell.help.articlesUrl;
    delete shell.help.updatesUrl;
    return shell;
}

/** Cbox Assistant behind the app's session route, as laravel-assistant-client's `SupportSession::forUser()` names it. */
function assistant({ endpoints = true, expired = [] as string[] } = {}): { answer: Answer; sessions: () => number } {
    let sessions = 0;
    const answer: Answer = ({ method, url, headers, credentials }) => {
        const { pathname, searchParams, origin } = new URL(url, 'https://app.test');
        if (pathname === '/orgs/cbox/help/session') {
            sessions += 1;
            const session = { url: 'https://assistant.test/embed/w', identity: `identity-${sessions}`, expires_at: Math.floor(Date.now() / 1000) + 180 };
            return { status: 200, body: endpoints ? { ...session, search_url: `${API}/help/search`, topics_url: `${API}/help/topics/{topic}/articles`, article_url: `${API}/help/articles/{id}`, updates_url: `${API}/support/updates` } : session };
        }
        if (origin !== 'https://assistant.test') return undefined;
        // Assistant takes the identity as a bearer token and nothing else: no cookies cross origins.
        if (credentials !== 'omit' || !/^Bearer identity-\d+$/.test(headers.Authorization ?? '') || expired.includes(headers.Authorization ?? '')) return { status: 401, body: { status: 401 } };
        if (pathname === '/api/v1/support/updates' && method === 'GET') return { status: 200, body: { object: 'list', data: [{ id: 'supd_1', kind: 'chat', title: 'Reply from Mia', read_at: null, created_at: '2026-11-20T10:12:00Z' }] } };
        if (pathname === '/api/v1/help/topics/deployments/articles') return { status: 200, body: { object: 'list', data: [{ id: 'hart_1', object: 'help_article', source: 'help_centre', title: 'Deploy from Git', excerpt: 'Connect a repository.', url: 'https://support.cbox.dk/c/deploy/git' }] } };
        if (pathname === '/api/v1/help/search') {
            return {
                status: 200,
                body: {
                    object: 'help_search',
                    query: searchParams.get('q'),
                    groups: [
                        { object: 'help_result_group', source: 'docs', data: [{ id: 'dpg_1', object: 'help_article', source: 'docs', title: 'Roll back a deployment', excerpt: 'Pick an earlier release.', url: 'https://docs.cbox.dk/rollback' }], has_more: false },
                        { object: 'help_result_group', source: 'help_centre', data: [], has_more: false },
                        { object: 'help_result_group', source: 'knowledge_base', data: [{ id: 'kart_9', object: 'help_article', source: 'knowledge_base', title: 'Rollback checklist', excerpt: null, url: 'https://support.cbox.dk/kb/9' }], has_more: false },
                    ],
                },
            };
        }
        if (pathname === '/api/v1/help/articles/dpg_1') return { status: 200, body: { id: 'dpg_1', object: 'help_article', title: 'Roll back a deployment', body_html: '<h2>Steps</h2><p onclick="steal()">Open <a href="/orgs/cbox/deployments">Deployments</a> and pick <strong>Roll back</strong>.</p><script>steal()</script><a href="javascript:steal()">bad</a>' } };
        return { status: 404, body: null };
    };
    return { answer, sessions: () => sessions };
}

describe('Help reads Cbox Assistant through the support session (§7.3)', () => {
    it('searches, lists the page articles and the support updates without a URL from the app', async () => {
        const { answer } = assistant();
        const { user, calls } = renderShell({ shell: kitShell(), fetch: { answer } });
        // The unread count is there before Help is opened.
        expect(await screen.findByRole('button', { name: 'Help, 1 unread' })).toBeTruthy();
        await user.click(screen.getByRole('button', { name: /^Help/ }));
        const column = screen.getByRole('complementary', { name: 'Help' });
        expect(await within(column).findByRole('button', { name: /Deploy from Git/ })).toBeTruthy();

        const search = within(column).getByRole('textbox', { name: 'Search or ask…' });
        expect(search).toHaveProperty('disabled', false);
        await user.type(search, 'roll');
        // Every source's results, in Assistant's order.
        expect(await within(column).findByRole('button', { name: /Roll back a deployment/ })).toBeTruthy();
        expect(within(column).getByRole('button', { name: /Rollback checklist/ })).toBeTruthy();
        const searched = calls.filter(call => call.url.startsWith(`${API}/help/search`)).at(-1)!;
        expect(new URL(searched.url).searchParams.get('q')).toBe('roll');
        expect(new URL(searched.url).searchParams.get('topic')).toBe('deployments');

        // A result opens in the column, with the body Assistant rendered and nothing unsafe in it.
        await user.click(within(column).getByRole('button', { name: /Roll back a deployment/ }));
        const article = await waitFor(() => {
            const prose = column.querySelector('.cbx-help-prose');
            expect(prose).not.toBeNull();
            return prose!;
        });
        expect(article.querySelector('h4')?.textContent).toBe('Steps');
        expect(article.querySelector('a')?.getAttribute('href')).toBe('/orgs/cbox/deployments');
        expect(article.innerHTML).not.toMatch(/script|onclick|javascript:/);
        expect(article.textContent).toContain('bad');
    });

    it('draws no search field when neither the app nor the session has a search', async () => {
        const { answer } = assistant({ endpoints: false });
        const { user } = renderShell({ shell: kitShell(), fetch: { answer } });
        await user.click(screen.getByRole('button', { name: /^Help/ }));
        const column = screen.getByRole('complementary', { name: 'Help' });
        // The one field no longer promises a search: it asks Cbox, and nothing is reported as broken.
        const field = await within(column).findByRole('textbox', { name: 'Ask Cbox' });
        expect(field.getAttribute('placeholder')).toBe('Ask about Deployments…');
        expect(within(column).queryByRole('textbox', { name: 'Search or ask…' })).toBeNull();
        expect(within(column).queryByText(/Help is not available/)).toBeNull();
    });

    it('fetches a new identity once when Assistant says the old one ran out', async () => {
        const { answer, sessions } = assistant({ expired: ['Bearer identity-1'] });
        renderShell({ shell: kitShell(), fetch: { answer } });
        expect(await screen.findByRole('button', { name: 'Help, 1 unread' })).toBeTruthy();
        expect(sessions()).toBe(2);
    });

    it('reads Assistant\'s grouped search answer and the plain list alike', () => {
        expect(parseArticles({ groups: [{ source: 'docs', data: [{ id: 'a', title: 'A' }] }, { source: 'help_centre', data: [{ id: 'b', title: 'B', source: 'faq' }] }] })).toEqual([
            { id: 'a', title: 'A', source: 'docs' },
            { id: 'b', title: 'B', source: 'faq' },
        ]);
        expect(parseArticles({ data: [{ id: 'c', title: 'C' }] })).toEqual([{ id: 'c', title: 'C' }]);
    });

    it('keeps only plain structure and safe links from an article body', () => {
        const clean = cleanArticleHtml('<h1>Title</h1><p style="x" onmouseover="x()">Text <img src="http://plain.test/a.png"><img src="https://img.test/a.png" onerror="x()" alt="Shot"></p><form action="/x"><input name="q"></form><a href="//evil.test">scheme-relative</a><a href="https://docs.cbox.dk/x">docs</a><svg><script>x()</script></svg>');
        expect(clean).toBe('<h4>Title</h4><p>Text <img src="https://img.test/a.png" alt="Shot" loading="lazy" referrerpolicy="no-referrer"></p>scheme-relative<a href="https://docs.cbox.dk/x" target="_blank" rel="noopener noreferrer">docs</a>');
    });
});

describe('Ask Cbox in the column (§7.2.4)', () => {
    const open = async () => {
        const view = renderShell();
        await view.user.click(screen.getByRole('button', { name: /^Help/ }));
        const column = screen.getByRole('complementary', { name: 'Help' });
        return { ...view, column, chat: column.querySelector('cbox-support')! };
    };

    it('keeps the question when the chat could not open, and clears it once the chat has it', async () => {
        const { user, column } = await open();
        const field = within(column).getByRole('textbox', { name: 'Search or ask…' });
        supportAnswers.ask = Promise.resolve(false);
        await user.type(field, 'How do I add email?');
        await user.click(within(column).getByRole('button', { name: 'Ask' }));
        expect(await within(column).findByRole('alert')).toBeTruthy();
        expect(field).toHaveProperty('value', 'How do I add email?');

        supportAnswers.ask = Promise.resolve(true);
        await user.click(within(column).getByRole('button', { name: 'Ask' }));
        await waitFor(() => expect(field).toHaveProperty('value', ''));
        expect(within(column).queryByRole('alert')).toBeNull();
        expect(supportCalls.map(call => call.question)).toEqual(['How do I add email?', 'How do I add email?']);

        // The way back to that conversation is on Help's first screen, and opens it without asking again.
        await user.click(await within(column).findByRole('button', { name: /^Continue the conversation/ }));
        await waitFor(() => expect(supportCalls.at(-1)!.method).toBe('open'));
    });

    it('has the chat one press away, and offers what is typed as a question before any article', async () => {
        const { user, column } = await open();
        // Nobody has to type, or find an article first, to talk to Cbox.
        await user.click(within(column).getByRole('button', { name: /^Ask Cbox Answers with what you see on Deployments/ }));
        await waitFor(() => expect(supportCalls.map(call => call.method)).toEqual(['open']));

        // With text in the field the row is the question itself; pressing it sends it once.
        const field = within(column).getByRole('textbox', { name: 'Search or ask…' });
        await user.type(field, 'How do I add email?');
        expect(within(column).queryByRole('button', { name: /^(Ask Cbox|Continue the conversation) Answers/ })).toBeNull();
        await user.click(within(column).getByRole('button', { name: /^Ask Cbox: “How do I add email\?”/ }));
        await waitFor(() => expect(supportCalls.map(call => call.question)).toEqual([undefined, 'How do I add email?']));
        await waitFor(() => expect(field).toHaveProperty('value', ''));
    });

    it('Enter sends, Shift+Enter and an Enter that commits a dead key do not', async () => {
        const { user, column } = await open();
        const field = within(column).getByRole('textbox', { name: 'Search or ask…' });
        await user.type(field, 'Hvem er du?');
        fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
        fireEvent.keyDown(field, { key: 'Enter', keyCode: 229 });
        await user.keyboard('{Shift>}{Enter}{/Shift}');
        expect(supportCalls).toHaveLength(0);
        await user.keyboard('{Backspace}{Enter}');
        await waitFor(() => expect(supportCalls.map(call => call.question)).toEqual(['Hvem er du?']));
    });

    it('shows the chat inside the column, and Back returns to Help with the conversation kept', async () => {
        const { user, column, chat } = await open();
        expect(chat.hasAttribute('inline')).toBe(true);
        act(() => void chat.dispatchEvent(new CustomEvent('cbox-support:open', { detail: { inline: true }, bubbles: true, composed: true })));
        expect(within(column).getByRole('heading', { name: 'Ask Cbox' })).toBeTruthy();
        expect(chat.parentElement?.classList.contains('is-open')).toBe(true);
        // The chat is the only place to type and the only way to a person while it is open,
        // and it still says which page the answers are about.
        expect(within(column).queryByRole('textbox')).toBeNull();
        expect(within(column).queryByRole('button', { name: 'Talk to a person' })).toBeNull();
        expect(within(column).getByText(/^Cbox sees this page: Deployments in /)).toBeTruthy();

        await user.click(within(column).getByRole('button', { name: 'Back to Help' }));
        expect(within(column).getByRole('textbox', { name: 'Search or ask…' })).toBeTruthy();
        expect(column.querySelector('cbox-support')).toBe(chat);
        // Nothing was asked yet, so there is no conversation to go back to: the row starts one.
        expect(within(column).queryByRole('button', { name: /^Continue the conversation/ })).toBeNull();
        expect(within(column).getByRole('button', { name: /^Ask Cbox Answers/ })).toBeTruthy();

        // The chat lost its session: Help is back, and says so.
        act(() => void chat.dispatchEvent(new CustomEvent('cbox-support:open', { detail: { inline: true }, bubbles: true })));
        act(() => void chat.dispatchEvent(new CustomEvent('cbox-support:close', { detail: { reason: 'unavailable' }, bubbles: true })));
        expect(within(column).getByRole('alert').textContent).toMatch(/could not be opened/);
    });

    it('an older SDK that opens its own dialog leaves the column as it is', async () => {
        const { column, chat } = await open();
        act(() => void chat.dispatchEvent(new CustomEvent('cbox-support:open', { detail: { inline: false }, bubbles: true })));
        expect(within(column).getByRole('textbox', { name: 'Search or ask…' })).toBeTruthy();
    });

    it('follows a link from an answer as an app visit, with the chat still open beside the page', async () => {
        const { column, chat, navigate } = await open();
        act(() => void chat.dispatchEvent(new CustomEvent('cbox-support:open', { detail: { inline: true }, bubbles: true })));
        const link = new CustomEvent('cbox-support:navigate', { detail: { url: 'https://app.test/orgs/cbox/deliver/integrations?tab=email#relay' }, bubbles: true, cancelable: true });
        act(() => void fireEvent(chat, link));
        // Handled here, so the SDK does not reload the page.
        expect(link.defaultPrevented).toBe(true);
        expect(navigate).toHaveBeenCalledWith('/orgs/cbox/deliver/integrations?tab=email#relay');
        expect(column.hidden).toBe(false);
        expect(within(column).getByRole('heading', { name: 'Ask Cbox' })).toBeTruthy();

        // Another site is not this app's to visit.
        const elsewhere = new CustomEvent('cbox-support:navigate', { detail: { url: 'https://evil.test/' }, bubbles: true, cancelable: true });
        act(() => void fireEvent(chat, elsewhere));
        expect(elsewhere.defaultPrevented).toBe(false);
        expect(navigate).toHaveBeenCalledTimes(1);
    });

    it('below 1280px Help steps aside for the page a link opens', async () => {
        const { user, navigate } = renderShell({ environment: { width: 1100 } });
        await user.click(screen.getByRole('button', { name: /^Help/ }));
        const chat = screen.getByRole('dialog', { name: 'Help' }).querySelector('cbox-support')!;
        act(() => void fireEvent(chat, new CustomEvent('cbox-support:navigate', { detail: { url: '/orgs/cbox/inbox' }, bubbles: true, cancelable: true })));
        expect(navigate).toHaveBeenCalledWith('/orgs/cbox/inbox');
        expect(screen.queryByRole('dialog', { name: 'Help' })).toBeNull();
    });
});
