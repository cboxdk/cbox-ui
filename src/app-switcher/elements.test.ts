// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://billing.test/plans"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LABELS, SIGNIN_EVENT, defineCboxAppSwitcher } from './elements';
import { SWITCHER_CSS } from './styles';

const LIGHT = 'https://cbox.cboxid.com/app-icons/signals.png';
const DARK = 'https://cbox.cboxid.com/app-icons/signals-dark.png';

const CATALOG = {
    apps: [
        { key: 'billing', name: 'Cbox · Billing', launch_url: 'https://billing.cbox.dk/', icon_url: 'https://cbox.cboxid.com/app-icons/billing.png', icon_dark_url: 'https://cbox.cboxid.com/app-icons/billing-dark.png' },
        { key: 'signals', name: 'Cbox · Signals', launch_url: 'https://app.cboxsignals.com/', icon_url: LIGHT, icon_dark_url: null },
        { key: 'brain', name: 'Brain', launch_url: 'https://brain.cbox.dk/', icon_url: null },
    ],
    refresh_after: 30,
};

function respond(status: number, body: unknown) {
    return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

async function settle(): Promise<void> {
    for (let i = 0; i < 6; i += 1) await new Promise(resolve => setTimeout(resolve, 0));
}

function mount(attributes: Record<string, string>): HTMLElement {
    const element = document.createElement('cbox-app-switcher');
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    document.body.append(element);
    return element;
}

function parts(element: HTMLElement) {
    const root = element.shadowRoot!;
    return {
        root,
        trigger: root.querySelector<HTMLButtonElement>('button.trigger')!,
        panel: root.querySelector<HTMLDivElement>('.panel')!,
        tiles: () => [...root.querySelectorAll<HTMLAnchorElement>('a.tile')],
        text: () => root.querySelector('.panel')!.textContent ?? '',
    };
}

/** Node 22+ ships its own (disabled) `localStorage` global, which hides happy-dom's: give each test a real one. */
function memoryStorage(): Storage {
    const items = new Map<string, string>();
    return {
        get length() { return items.size; },
        clear: () => items.clear(),
        getItem: key => items.get(key) ?? null,
        key: index => [...items.keys()][index] ?? null,
        removeItem: key => { items.delete(key); },
        setItem: (key, value) => { items.set(key, String(value)); },
    };
}

beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
    defineCboxAppSwitcher();
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('<cbox-app-switcher>', () => {
    it('draws everything in its own shadow root, out of reach of the host stylesheet', () => {
        vi.stubGlobal('fetch', respond(200, CATALOG));
        const element = mount({ endpoint: '/acme/apps/catalog', current: 'billing' });
        const { root, trigger } = parts(element);
        expect(root.mode).toBe('open');
        expect(element.children).toHaveLength(0);
        expect(trigger.getAttribute('aria-label')).toBe('Switch app');
        expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
        expect(trigger.querySelectorAll('circle')).toHaveLength(9);
        // The trigger resets every UA button style itself, so a host without a preflight still gets a clean icon button.
        expect(SWITCHER_CSS).toContain('all: unset');
        expect(SWITCHER_CSS).toContain(':host { all: initial;');
    });

    it('lists the catalog with Cbox ID icons, initials without one, and marks the current app', async () => {
        const fetch = respond(200, CATALOG);
        vi.stubGlobal('fetch', fetch);
        const element = mount({ endpoint: '/acme/apps/catalog', current: 'billing' });
        await settle();
        const { trigger, tiles } = parts(element);
        expect(fetch).toHaveBeenCalledOnce();
        const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(`${location.origin}/acme/apps/catalog`);
        expect(init).toMatchObject({ credentials: 'same-origin', redirect: 'error' });

        trigger.click();
        const [billing, signals, brain] = tiles();
        expect(tiles()).toHaveLength(3);
        expect(billing!.getAttribute('href')).toBe('https://billing.cbox.dk/');
        expect(billing!.getAttribute('aria-current')).toBe('true');
        expect(billing!.textContent).toContain('Billing');
        expect([...billing!.querySelectorAll('img')].map(img => [img.className, img.getAttribute('src')])).toEqual([
            ['on-light', 'https://cbox.cboxid.com/app-icons/billing.png'],
            ['on-dark', 'https://cbox.cboxid.com/app-icons/billing-dark.png'],
        ]);
        expect(billing!.querySelector('.check svg')).not.toBeNull();
        expect([...signals!.querySelectorAll('img')].map(img => img.className)).toEqual(['single']);
        expect(signals!.hasAttribute('aria-current')).toBe(false);
        expect(brain!.querySelector('img')).toBeNull();
        expect(brain!.querySelector('.icon.initials')?.textContent).toBe('Br');
        // Only an app without an icon gets the tile behind its initials.
        expect(billing!.querySelector('.icon')!.classList.contains('initials')).toBe(false);
    });

    it('swaps to initials when an icon fails to load', async () => {
        vi.stubGlobal('fetch', respond(200, CATALOG));
        const element = mount({ endpoint: '/acme/apps/catalog', current: 'billing' });
        await settle();
        const icon = parts(element).tiles()[1]!.querySelector<HTMLElement>('.icon')!;
        icon.querySelector('img')!.dispatchEvent(new Event('error'));
        expect(icon.classList.contains('initials')).toBe(true);
        expect(icon.textContent).toBe('Si');
    });

    it('keeps the catalog in this browser and paints it at once on the next page', async () => {
        vi.stubGlobal('fetch', respond(200, CATALOG));
        mount({ endpoint: '/acme/apps/catalog', current: 'billing' });
        await settle();
        const kept = JSON.parse(window.localStorage.getItem('cbox-app-catalog') ?? '[]') as Array<Record<string, unknown>>;
        expect(kept.map(app => app.key)).toEqual(['billing', 'signals', 'brain']);
        expect(kept[0]).toMatchObject({ icon_url: 'https://cbox.cboxid.com/app-icons/billing.png', launch_url: 'https://billing.cbox.dk/' });

        document.body.replaceChildren();
        vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
        const next = mount({ endpoint: '/acme/apps/catalog', current: 'billing' });
        expect(parts(next).tiles()).toHaveLength(3);
    });

    it('takes translated labels from the attribute and ignores what it does not know', async () => {
        vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
        const element = mount({ endpoint: '/x', current: 'billing', labels: JSON.stringify({ title: 'Skift app', loading: 'Henter apps…', reconnect: 'Forbind igen', retry: 'Prøv igen' }) });
        const { trigger, text } = parts(element);
        expect(trigger.getAttribute('aria-label')).toBe('Skift app');
        expect(text()).toContain('Skift app');
        expect(text()).toContain('Henter apps…');
        element.setAttribute('labels', '{not json');
        expect(trigger.getAttribute('aria-label')).toBe(DEFAULT_LABELS.title);
    });

    it('is disabled without an endpoint', () => {
        const element = mount({ endpoint: '', current: 'billing' });
        expect(parts(element).trigger.disabled).toBe(true);
    });

    it('sends the person straight to signin_url on a 401, with no button and no reconnect link', async () => {
        vi.stubGlobal('fetch', respond(401, { signin_url: 'https://billing.cbox.dk/auth/cbox?return_to=%2Fplans' }));
        const element = mount({ endpoint: '/acme/apps/catalog', current: 'billing' });
        await settle();
        const sent: string[] = [];
        element.addEventListener(SIGNIN_EVENT, event => { sent.push((event as CustomEvent<{ url: string }>).detail.url); event.preventDefault(); });
        const { trigger, root } = parts(element);
        // Loading in the background never moves the page; opening the control does.
        expect(sent).toEqual([]);
        trigger.click();
        expect(sent).toEqual(['https://billing.cbox.dk/auth/cbox?return_to=%2Fplans']);
        expect(root.querySelector('.panel button, .panel a')).toBeNull();
        expect(root.textContent).not.toMatch(/reconnect|try again/i);
    });

    it('navigates when the 401 arrives while the panel is open', async () => {
        let answer: (value: Response) => void = () => undefined;
        vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { answer = resolve; })));
        const element = mount({ endpoint: '/acme/apps/catalog', current: 'billing' });
        const sent: string[] = [];
        element.addEventListener(SIGNIN_EVENT, event => { sent.push((event as CustomEvent<{ url: string }>).detail.url); event.preventDefault(); });
        parts(element).trigger.click();
        answer(new Response(JSON.stringify({ signin_url: '/auth/cbox' }), { status: 401 }));
        await settle();
        expect(sent).toEqual([`${location.origin}/auth/cbox`]);
    });

    it('accepts the legacy authorize_url the same way, with return_to set to where the person is', async () => {
        history.replaceState(null, '', '/acme/plans?page=2');
        vi.stubGlobal('fetch', respond(401, { authorize_url: '/acme/apps/authorize' }));
        const element = mount({ endpoint: '/acme/apps/catalog', current: 'billing' });
        await settle();
        const sent: string[] = [];
        element.addEventListener(SIGNIN_EVENT, event => { sent.push((event as CustomEvent<{ url: string }>).detail.url); event.preventDefault(); });
        parts(element).trigger.click();
        expect(sent).toEqual([`${location.origin}/acme/apps/authorize?return_to=%2Facme%2Fplans%3Fpage%3D2`]);
    });

    it('never loops: sent to the same sign-in moments ago, it says the apps could not be loaded instead', async () => {
        window.sessionStorage.setItem('cbox-app-switcher-signin', JSON.stringify({ url: `${location.origin}/auth/cbox`, at: Date.now() }));
        vi.stubGlobal('fetch', respond(401, { signin_url: '/auth/cbox' }));
        const element = mount({ endpoint: '/acme/apps/catalog', current: 'billing' });
        await settle();
        const sent: string[] = [];
        element.addEventListener(SIGNIN_EVENT, event => { sent.push('x'); event.preventDefault(); });
        parts(element).trigger.click();
        expect(sent).toEqual([]);
        expect(parts(element).text()).toContain('Apps could not be loaded.');
    });

    it('says quietly that the apps could not be loaded, and tries again by itself', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
        const fetch = vi.fn(async (): Promise<Response> => { throw new TypeError('offline'); });
        vi.stubGlobal('fetch', fetch);
        const element = mount({ endpoint: '/acme/apps/catalog', current: 'billing' });
        await vi.advanceTimersByTimeAsync(0);
        const { root, text, tiles } = parts(element);
        expect(text()).toContain('Apps could not be loaded.');
        expect(root.querySelector('.panel button')).toBeNull();
        expect(fetch).toHaveBeenCalledTimes(1);

        fetch.mockImplementation(async () => new Response(JSON.stringify(CATALOG), { status: 200 }));
        await vi.advanceTimersByTimeAsync(2100);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(tiles()).toHaveLength(3);
        expect(text()).not.toContain('Apps could not be loaded.');
    });

    it('refuses a catalog endpoint on another origin', async () => {
        const fetch = respond(200, CATALOG);
        vi.stubGlobal('fetch', fetch);
        const element = mount({ endpoint: 'https://evil.test/catalog', current: 'billing' });
        await settle();
        expect(fetch).not.toHaveBeenCalled();
        expect(parts(element).text()).toContain('Apps could not be loaded.');
    });

    it('follows the host theme: class, data-theme, and the system scheme', async () => {
        vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
        const element = mount({ endpoint: '/x', current: 'billing' });
        const frame = element.shadowRoot!.querySelector('.root')!;
        expect(frame.classList.contains('dark')).toBe(false);
        document.documentElement.classList.add('dark');
        await settle();
        expect(frame.classList.contains('dark')).toBe(true);
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        await settle();
        expect(frame.classList.contains('dark')).toBe(true);
        element.setAttribute('theme', 'light');
        expect(frame.classList.contains('dark')).toBe(false);
    });

    it('moves focus with the arrow keys, traps Tab and gives focus back on Escape', async () => {
        vi.stubGlobal('fetch', respond(200, CATALOG));
        const element = mount({ endpoint: '/acme/apps/catalog', current: 'billing' });
        await settle();
        const { trigger, panel, tiles, root } = parts(element);
        trigger.click();
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(root.activeElement).toBe(tiles()[0]);
        panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(root.activeElement).toBe(tiles()[1]);
        panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        expect(root.activeElement).toBe(tiles()[2]);
        panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(root.activeElement).toBe(tiles()[0]);
        panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(root.activeElement).toBe(trigger);
    });
});

describe('<cbox-service-mark>', () => {
    it('paints the app mark from the kept catalog and repaints when it changes', async () => {
        const mark = document.createElement('cbox-service-mark');
        mark.setAttribute('service', 'signals');
        document.body.append(mark);
        expect(mark.shadowRoot!.querySelector('img')).toBeNull();

        vi.stubGlobal('fetch', respond(200, CATALOG));
        mount({ endpoint: '/acme/apps/catalog', current: 'billing' });
        await settle();
        expect(mark.shadowRoot!.querySelector('img')?.getAttribute('src')).toBe(LIGHT);
        expect(mark.shadowRoot!.querySelector('.initials')).toBeNull();
    });

    it('renders both uploads for the theme to choose from', () => {
        window.localStorage.setItem('cbox-app-catalog', JSON.stringify([{ key: 'signals', name: 'Signals', icon_url: LIGHT, icon_dark_url: DARK }]));
        const mark = document.createElement('cbox-service-mark');
        mark.setAttribute('service', 'signals');
        document.body.append(mark);
        expect([...mark.shadowRoot!.querySelectorAll('img')].map(img => img.className)).toEqual(['on-light', 'on-dark']);
    });
});
