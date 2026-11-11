import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { ReactNode } from 'react';
import { CboxShell, type CboxShellProps } from '../shell';
import { createHelpStore, type HelpStore } from '../help-store';
import { forgetLists } from '../use-list';
import { forgetShellCatalog } from '../app-grid';
import { fixtureAnswer, makeShell } from './fixture';
import type { Shell } from '../types';

export type Environment = { pointer?: 'fine' | 'coarse'; width?: number; dark?: boolean };

/** `matchMedia` for a desktop with a mouse, or a phone, at a given width. */
export function stubMedia({ pointer = 'fine', width = 1440, dark = false }: Environment = {}): void {
    const evaluate = (query: string): boolean => {
        if (query.includes('pointer: fine')) return pointer === 'fine';
        if (query.includes('prefers-color-scheme: dark')) return dark;
        const min = /min-width:\s*(\d+)px/.exec(query);
        if (min !== null) return width >= Number(min[1]);
        const max = /max-width:\s*(\d+)px/.exec(query);
        if (max !== null) return width <= Number(max[1]);
        return false;
    };
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: evaluate(query),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
    }));
}

/** What the stand-in for the Assistant SDK's `<cbox-support>` element was asked to do. */
export const supportCalls: Array<{ method: 'open' | 'ask' | 'handover'; question?: string; intent?: unknown }> = [];

/** Define a stand-in `<cbox-support>`, so no SDK script is loaded in a test. */
export function defineFakeSupport(): void {
    if (typeof customElements === 'undefined' || customElements.get('cbox-support') !== undefined) return;
    class FakeSupport extends HTMLElement {
        intent: unknown;
        open() {
            supportCalls.push({ method: 'open', intent: this.intent });
        }
        ask(question: string, intent: unknown) {
            supportCalls.push({ method: 'ask', question, intent });
        }
        handover() {
            supportCalls.push({ method: 'handover', intent: this.intent });
        }
    }
    customElements.define('cbox-support', FakeSupport);
}

export type Call = { method: string; url: string; body: unknown };

/**
 * `fetch` answering from the fixture. `delays` holds paths that answer late (ms) and `fail`
 * paths that answer 503, so a test can make one group slow or one service unavailable.
 */
export function stubFetch({ delays = {}, fail = [] }: { delays?: Record<string, number>; fail?: string[] } = {}): Call[] {
    const calls: Call[] = [];
    vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
        const method = (init.method ?? 'GET').toUpperCase();
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
        calls.push({ method, url: input, body });
        const path = new URL(input, 'https://app.test').pathname;
        const delay = delays[path] ?? 0;
        if (delay > 0) {
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(resolve, delay);
                init.signal?.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
                });
            });
        }
        if (fail.includes(path)) return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
        const answer = fixtureAnswer(method, input, body);
        if (answer === undefined) return new Response('{"message":"Not found"}', { status: 404 });
        return new Response(answer.body === null ? '' : JSON.stringify(answer.body), { status: answer.status, headers: { 'Content-Type': 'application/json' } });
    });
    return calls;
}

export function renderShell({ shell = makeShell(), environment = {}, store = createHelpStore(), fetch: fetchOptions = {}, onPreferenceChange, page, renderCreate, searchRecords }: { shell?: Shell; environment?: Environment; store?: HelpStore; fetch?: Parameters<typeof stubFetch>[0]; onPreferenceChange?: Parameters<typeof CboxShell>[0]['onPreferenceChange']; page?: ReactNode; renderCreate?: CboxShellProps['renderCreate']; searchRecords?: CboxShellProps['searchRecords'] } = {}) {
    stubMedia(environment);
    defineFakeSupport();
    const calls = stubFetch(fetchOptions);
    const navigate = vi.fn();
    const preference = onPreferenceChange ?? vi.fn();
    const user = userEvent.setup();
    const view = render(
        <CboxShell shell={shell} navigate={navigate} helpStore={store} onPreferenceChange={preference} renderCreate={renderCreate} searchRecords={searchRecords}>
            {page ?? <h1>Deployments</h1>}
        </CboxShell>,
    );
    const rerender = (next: Shell, page = 'Deployments') =>
        view.rerender(
            <CboxShell shell={next} navigate={navigate} helpStore={store} onPreferenceChange={preference} renderCreate={renderCreate} searchRecords={searchRecords}>
                <h1>{page}</h1>
            </CboxShell>,
        );
    return { ...view, rerender, calls, navigate, user, store, preference };
}

export function reset(): void {
    cleanup();
    supportCalls.length = 0;
    forgetLists();
    forgetShellCatalog();
    vi.unstubAllGlobals();
    try {
        localStorage.clear();
    } catch {
        // No storage in this environment.
    }
}
