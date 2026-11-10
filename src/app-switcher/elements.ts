import {
    displayName,
    initials,
    parseAppCatalog,
    readKnownAppCatalog,
    rememberAppCatalog,
    secureIconUrl,
    signInTarget,
    subscribeKnownAppCatalog,
    type CboxCatalogApp,
    type CboxKnownApp,
} from './catalog';
import { isDark, subscribeTheme, themeMode } from './theme';
import { adopt, MARK_CSS, SWITCHER_CSS } from './styles';

/** The words the control shows. Pass a translation as the `labels` attribute (JSON). */
export type CboxAppSwitcherLabels = { title: string; loading: string; empty: string; unavailable: string };

export const DEFAULT_LABELS: CboxAppSwitcherLabels = {
    title: 'Switch app',
    loading: 'Loading apps…',
    empty: 'No apps available',
    unavailable: 'Apps could not be loaded.',
};

/**
 * Fired on `<cbox-app-switcher>` (bubbling, composed, cancelable) just before it sends the
 * person to sign in again; `detail.url` is where. `preventDefault()` keeps the page where it is.
 */
export const SIGNIN_EVENT = 'cbox-app-switcher:signin';

const SIGNIN_GUARD = 'cbox-app-switcher-signin';
/** Sent to the same sign-in URL this recently and still refused: stop, so it never loops. */
const LOOP_WINDOW_MS = 30_000;
const REFRESH_INTERVAL_MS = 60_000;
const SVG = 'http://www.w3.org/2000/svg';

type View =
    | { kind: 'loading' }
    | { kind: 'empty' }
    | { kind: 'unavailable' }
    | { kind: 'apps'; apps: ReadonlyArray<CboxKnownApp | CboxCatalogApp>; live: boolean; failed: boolean };

function svg(viewBox: string, build: (node: SVGSVGElement) => void, attributes: Record<string, string> = {}): SVGSVGElement {
    const node = document.createElementNS(SVG, 'svg');
    node.setAttribute('viewBox', viewBox);
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('focusable', 'false');
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    build(node);
    return node;
}

function gridIcon(): SVGSVGElement {
    return svg('0 0 18 18', node => {
        for (const y of [3, 9, 15]) {
            for (const x of [3, 9, 15]) {
                const dot = document.createElementNS(SVG, 'circle');
                dot.setAttribute('cx', String(x));
                dot.setAttribute('cy', String(y));
                dot.setAttribute('r', '1.65');
                node.append(dot);
            }
        }
    });
}

function checkIcon(): SVGSVGElement {
    return svg('0 0 24 24', node => {
        const path = document.createElementNS(SVG, 'path');
        path.setAttribute('d', 'm5 12 4 4L19 6');
        node.append(path);
    }, { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' });
}

/**
 * One app's icon: both catalog uploads (the shadow stylesheet shows the one for the theme), or
 * its initials when it has no `https:` icon or the icon fails to load. A service mark shows
 * nothing instead of initials.
 */
function appIcon(app: { name: string; icon_url?: string | null; icon_dark_url?: string | null }, missing: 'initials' | 'nothing'): HTMLSpanElement {
    const box = document.createElement('span');
    box.className = 'icon';
    box.setAttribute('aria-hidden', 'true');
    const fallback = () => {
        box.replaceChildren();
        if (missing === 'initials') {
            box.classList.add('initials');
            box.textContent = initials(app.name);
        }
    };
    const light = secureIconUrl(app.icon_url);
    const dark = secureIconUrl(app.icon_dark_url);
    if (light === null) {
        fallback();
        return box;
    }
    for (const [url, variant] of [[light, dark === null ? 'single' : 'on-light'], [dark, 'on-dark']] as const) {
        if (url === null) continue;
        const image = document.createElement('img');
        image.alt = '';
        image.decoding = 'async';
        image.className = variant;
        image.addEventListener('error', fallback, { once: true });
        image.src = url;
        box.append(image);
    }
    return box;
}

function readLabels(value: string | null): CboxAppSwitcherLabels {
    try {
        const parsed: unknown = JSON.parse(value ?? '{}');
        if (typeof parsed !== 'object' || parsed === null) return DEFAULT_LABELS;
        const labels = { ...DEFAULT_LABELS };
        for (const key of Object.keys(DEFAULT_LABELS) as Array<keyof CboxAppSwitcherLabels>) {
            const text = (parsed as Record<string, unknown>)[key];
            if (typeof text === 'string' && text !== '') labels[key] = text;
        }
        return labels;
    } catch {
        return DEFAULT_LABELS;
    }
}

function recentlySentTo(url: string): boolean {
    try {
        const kept: unknown = JSON.parse(window.sessionStorage.getItem(SIGNIN_GUARD) ?? 'null');
        if (typeof kept !== 'object' || kept === null) return false;
        const { url: sent, at } = kept as { url?: unknown; at?: unknown };
        return sent === url && typeof at === 'number' && Date.now() - at < LOOP_WINDOW_MS;
    } catch {
        return false;
    }
}

function markSentTo(url: string | null): void {
    try {
        if (url === null) window.sessionStorage.removeItem(SIGNIN_GUARD);
        else window.sessionStorage.setItem(SIGNIN_GUARD, JSON.stringify({ url, at: Date.now() }));
    } catch {
        // Blocked storage: the guard is best effort.
    }
}

/** Navigate the top window (the element may sit in a same-app iframe), else this one. */
function navigateTop(url: string): void {
    try {
        if (window.top !== null && window.top !== window) {
            window.top.location.href = url;
            return;
        }
    } catch {
        // A cross-origin parent that refuses: navigate this frame instead.
    }
    window.location.href = url;
}

let uid = 0;

// Private state uses names no attribute shares (`endpoint`, `current`, `labels`, `theme`,
// `service`): React 19 sets a custom element's property instead of its attribute when the
// element has one by that name, and these elements read attributes only.
function defineSwitcher(): CustomElementConstructor {
    return class CboxAppSwitcherElement extends HTMLElement {
        static observedAttributes = ['endpoint', 'current', 'labels', 'theme'];

        private readonly frame: HTMLDivElement;
        private readonly button: HTMLButtonElement;
        private readonly panel: HTMLDivElement;
        private readonly heading: HTMLHeadingElement;
        private readonly body: HTMLDivElement;
        private readonly native: boolean;
        private copy: CboxAppSwitcherLabels = DEFAULT_LABELS;
        private view: View = { kind: 'loading' };
        private flight: AbortController | null = null;
        private expires = 0;
        private failures = 0;
        private retry: ReturnType<typeof setTimeout> | undefined;
        private ticker: ReturnType<typeof setInterval> | undefined;
        private signin: string | null = null;
        private mounted = false;
        private restoreFocus = false;
        private stopTheme: (() => void) | null = null;

        private readonly syncTheme = () => { this.frame.classList.toggle('dark', isDark(themeMode(this.getAttribute('theme')))); };
        private readonly refresh = () => { if (document.visibilityState !== 'hidden' && Date.now() >= this.expires) void this.load(); };
        private readonly place = () => { if (this.isOpen()) this.position(); };
        private readonly outside = (event: Event) => { if (!event.composedPath().includes(this)) this.close(); };

        constructor() {
            super();
            const shadow = this.attachShadow({ mode: 'open' });
            adopt(shadow, SWITCHER_CSS);
            const id = `cbox-app-switcher-${++uid}`;

            this.frame = document.createElement('div');
            this.frame.className = 'root';

            this.button = document.createElement('button');
            this.button.type = 'button';
            this.button.className = 'trigger';
            this.button.setAttribute('aria-haspopup', 'dialog');
            this.button.setAttribute('aria-expanded', 'false');
            this.button.setAttribute('aria-controls', `${id}-panel`);
            this.button.append(gridIcon());

            this.panel = document.createElement('div');
            this.panel.id = `${id}-panel`;
            this.panel.className = 'panel';
            this.panel.tabIndex = -1;
            this.panel.setAttribute('role', 'dialog');
            this.panel.setAttribute('aria-labelledby', `${id}-title`);
            this.native = typeof this.panel.togglePopover === 'function';
            if (this.native) {
                this.panel.popover = 'auto';
                // The button is the popover's invoker, so light dismiss never reopens it on the same click.
                const invoker: HTMLButtonElement = this.button;
                if ('popoverTargetElement' in invoker) invoker.popoverTargetElement = this.panel;
                else (invoker as HTMLElement).setAttribute('popovertarget', this.panel.id);
                this.panel.addEventListener('toggle', event => { this.toggled((event as ToggleEvent).newState === 'open'); });
            } else {
                this.panel.hidden = true;
                this.button.addEventListener('click', () => { if (this.isOpen()) this.close(); else this.open(); });
            }

            this.heading = document.createElement('h2');
            this.heading.id = `${id}-title`;
            this.body = document.createElement('div');
            this.body.setAttribute('aria-live', 'polite');
            this.panel.append(this.heading, this.body);
            this.panel.addEventListener('keydown', event => { this.key(event); });

            this.frame.append(this.button, this.panel);
            shadow.append(this.frame);
        }

        connectedCallback(): void {
            if (this.mounted) return;
            this.mounted = true;
            this.applyLabels();
            this.applyEndpoint();
            this.syncTheme();
            this.stopTheme = subscribeTheme(this.syncTheme);
            this.paintKept();
            this.ticker = setInterval(this.refresh, REFRESH_INTERVAL_MS);
            window.addEventListener('focus', this.refresh);
            document.addEventListener('visibilitychange', this.refresh);
            window.addEventListener('resize', this.place);
            window.addEventListener('scroll', this.place, true);
            this.refresh();
        }

        disconnectedCallback(): void {
            this.mounted = false;
            this.flight?.abort();
            this.flight = null;
            clearInterval(this.ticker);
            clearTimeout(this.retry);
            this.retry = undefined;
            this.stopTheme?.();
            this.stopTheme = null;
            window.removeEventListener('focus', this.refresh);
            document.removeEventListener('visibilitychange', this.refresh);
            window.removeEventListener('resize', this.place);
            window.removeEventListener('scroll', this.place, true);
            document.removeEventListener('pointerdown', this.outside, true);
        }

        attributeChangedCallback(name: string, before: string | null, after: string | null): void {
            if (!this.mounted || before === after) return;
            if (name === 'labels') { this.applyLabels(); this.render(); }
            if (name === 'current') this.render();
            if (name === 'theme') this.syncTheme();
            if (name === 'endpoint') {
                this.flight?.abort();
                this.flight = null;
                clearTimeout(this.retry);
                this.retry = undefined;
                this.expires = 0;
                this.failures = 0;
                this.signin = null;
                this.view = { kind: 'loading' };
                this.applyEndpoint();
                this.paintKept();
                this.refresh();
            }
        }

        private applyLabels(): void {
            this.copy = readLabels(this.getAttribute('labels'));
            this.button.title = this.copy.title;
            this.button.setAttribute('aria-label', this.copy.title);
            this.heading.textContent = this.copy.title;
        }

        private applyEndpoint(): void {
            this.button.disabled = !this.getAttribute('endpoint');
            if (this.button.disabled) this.close();
        }

        /** The last catalog this browser kept paints the grid at once; the live answer replaces it. */
        private paintKept(): void {
            if (this.view.kind === 'apps' && this.view.live) return;
            const kept = readKnownAppCatalog().filter(app => typeof app.launch_url === 'string');
            this.view = kept.length > 0 ? { kind: 'apps', apps: kept, live: false, failed: false } : { kind: 'loading' };
            this.render();
        }

        private isOpen(): boolean {
            if (!this.native) return !this.panel.hidden;
            try {
                return this.panel.matches(':popover-open');
            } catch {
                return false;
            }
        }

        private open(): void {
            if (this.button.disabled || this.isOpen()) return;
            if (this.native) { this.panel.showPopover(); return; }
            this.panel.hidden = false;
            document.addEventListener('pointerdown', this.outside, true);
            this.toggled(true);
        }

        private close(): void {
            if (!this.isOpen()) return;
            if (this.native) { this.panel.hidePopover(); return; }
            this.panel.hidden = true;
            document.removeEventListener('pointerdown', this.outside, true);
            this.toggled(false);
        }

        private toggled(open: boolean): void {
            this.button.setAttribute('aria-expanded', String(open));
            if (!open) {
                if (this.restoreFocus && this.isConnected) this.button.focus();
                this.restoreFocus = false;
                return;
            }
            this.position();
            if (this.signin !== null) { this.goSignIn(this.signin); return; }
            this.focusFirst();
            this.refresh();
        }

        private position(): void {
            const box = this.button.getBoundingClientRect();
            const width = Math.min(292, window.innerWidth - 16);
            this.panel.style.width = `${width}px`;
            this.panel.style.left = `${Math.max(8, Math.min(box.right - width, window.innerWidth - width - 8))}px`;
            this.panel.style.top = `${box.bottom + 6}px`;
            this.panel.style.maxHeight = `${Math.max(60, window.innerHeight - box.bottom - 14)}px`;
        }

        private tiles(): HTMLAnchorElement[] {
            return [...this.body.querySelectorAll<HTMLAnchorElement>('a[href]')];
        }

        private focusFirst(): void {
            (this.tiles()[0] ?? this.panel).focus();
        }

        private key(event: KeyboardEvent): void {
            if (event.key === 'Escape') {
                this.restoreFocus = true;
                if (!this.native) { event.preventDefault(); this.close(); }
                return;
            }
            const tiles = this.tiles();
            const active = this.shadowRoot?.activeElement ?? null;
            if (event.key === 'Tab') {
                const first = tiles[0];
                const last = tiles.at(-1);
                if (first === undefined || last === undefined) { event.preventDefault(); return; }
                if (event.shiftKey && (active === first || active === this.panel)) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && (active === last || active === this.panel)) { event.preventDefault(); first.focus(); }
                return;
            }
            const at = tiles.indexOf(active as HTMLAnchorElement);
            const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
            let next: number | null = null;
            if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = tiles.length - 1;
            else if (event.key in step) next = at === -1 ? 0 : Math.max(0, Math.min(tiles.length - 1, at + (step[event.key] ?? 0)));
            if (next === null || tiles.length === 0) return;
            event.preventDefault();
            tiles[next]?.focus();
        }

        private render(): void {
            const view = this.view;
            if (view.kind !== 'apps') {
                const text = view.kind === 'empty' ? this.copy.empty : view.kind === 'unavailable' ? this.copy.unavailable : this.copy.loading;
                const message = document.createElement('p');
                message.className = 'message';
                message.textContent = text;
                if (view.kind === 'unavailable') message.setAttribute('role', 'status');
                this.body.replaceChildren(message);
                return;
            }
            const hadFocus = this.shadowRoot?.activeElement instanceof HTMLAnchorElement;
            const nav = document.createElement('nav');
            nav.className = 'grid';
            nav.setAttribute('aria-label', this.copy.title);
            const current = this.getAttribute('current');
            for (const app of view.apps) {
                if (typeof app.launch_url !== 'string') continue;
                const tile = document.createElement('a');
                tile.className = 'tile';
                tile.href = app.launch_url;
                const description = 'description' in app && typeof app.description === 'string' ? app.description : null;
                tile.title = description ?? displayName(app.name);
                const label = document.createElement('span');
                label.className = 'label';
                label.textContent = displayName(app.name);
                tile.append(appIcon(app, 'initials'), label);
                if (app.key === current) {
                    tile.setAttribute('aria-current', 'true');
                    const check = document.createElement('span');
                    check.className = 'check';
                    check.append(checkIcon());
                    tile.append(check);
                }
                tile.addEventListener('click', () => { this.close(); });
                nav.append(tile);
            }
            const parts: Node[] = [];
            if (view.failed) {
                const message = document.createElement('p');
                message.className = 'message';
                message.setAttribute('role', 'status');
                message.textContent = this.copy.unavailable;
                parts.push(message);
            }
            parts.push(nav);
            this.body.replaceChildren(...parts);
            if (hadFocus || (this.isOpen() && this.shadowRoot?.activeElement === this.panel)) this.focusFirst();
        }

        private async load(): Promise<void> {
            const endpoint = this.getAttribute('endpoint');
            if (!endpoint || this.flight !== null) return;
            let source: URL;
            try {
                source = new URL(endpoint, window.location.href);
            } catch {
                this.fail(false);
                return;
            }
            // The endpoint is the host's own proxy, under the person's session.
            if (source.origin !== window.location.origin) { this.fail(false); return; }
            const request = new AbortController();
            this.flight = request;
            try {
                const response = await fetch(source.href, {
                    credentials: 'same-origin',
                    cache: 'no-store',
                    redirect: 'error',
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    signal: request.signal,
                });
                const body: unknown = await response.json().catch(() => null);
                if (request.signal.aborted || !this.isConnected) return;
                const state = parseAppCatalog(response.ok, body);
                if (state.status === 'ready') {
                    this.failures = 0;
                    clearTimeout(this.retry);
                    this.retry = undefined;
                    this.signin = null;
                    markSentTo(null);
                    this.expires = Date.now() + state.refreshAfter * 1000;
                    this.view = state.apps.length > 0 ? { kind: 'apps', apps: state.apps, live: true, failed: false } : { kind: 'empty' };
                    rememberAppCatalog(state.apps);
                    this.render();
                    return;
                }
                const target = state.status === 'signin_required' ? signInTarget(state, window.location) : null;
                if (target === null) { this.fail(true); return; }
                this.signin = target;
                this.expires = 0;
                if (this.isOpen()) this.goSignIn(target);
            } catch {
                if (!request.signal.aborted) this.fail(true);
            } finally {
                if (this.flight === request) this.flight = null;
            }
        }

        /** Quietly say the apps could not be loaded, keep any grid, and try again by itself. */
        private fail(again: boolean): void {
            this.expires = 0;
            this.view = this.view.kind === 'apps' ? { ...this.view, failed: true } : { kind: 'unavailable' };
            this.render();
            if (!again) return;
            this.failures += 1;
            clearTimeout(this.retry);
            const delay = Math.min(REFRESH_INTERVAL_MS, 2000 * 2 ** (this.failures - 1));
            this.retry = setTimeout(() => { this.retry = undefined; this.refresh(); }, delay);
        }

        /** The person has to sign in again: go there, no question asked (but never in a loop). */
        private goSignIn(url: string): void {
            if (recentlySentTo(url)) {
                this.signin = null;
                this.fail(true);
                return;
            }
            const event = new CustomEvent(SIGNIN_EVENT, { detail: { url }, bubbles: true, composed: true, cancelable: true });
            if (!this.dispatchEvent(event)) return;
            markSentTo(url);
            navigateTop(url);
        }
    };
}

function defineServiceMark(): CustomElementConstructor {
    return class CboxServiceMarkElement extends HTMLElement {
        static observedAttributes = ['service', 'theme'];

        private readonly frame: HTMLSpanElement;
        private stops: Array<() => void> = [];
        private readonly paint = () => {
            const app = readKnownAppCatalog().find(entry => entry.key === this.getAttribute('service'));
            this.frame.replaceChildren(...(app !== undefined && secureIconUrl(app.icon_url) !== null ? [appIcon(app, 'nothing')] : []));
        };
        private readonly syncTheme = () => { this.frame.classList.toggle('dark', isDark(themeMode(this.getAttribute('theme')))); };

        constructor() {
            super();
            const shadow = this.attachShadow({ mode: 'open' });
            adopt(shadow, MARK_CSS);
            this.frame = document.createElement('span');
            this.frame.className = 'root';
            shadow.append(this.frame);
        }

        connectedCallback(): void {
            this.stops.forEach(stop => stop());
            this.stops = [subscribeKnownAppCatalog(this.paint), subscribeTheme(this.syncTheme)];
            this.syncTheme();
            this.paint();
        }

        disconnectedCallback(): void {
            this.stops.forEach(stop => stop());
            this.stops = [];
        }

        attributeChangedCallback(name: string): void {
            if (!this.isConnected) return;
            if (name === 'theme') this.syncTheme();
            else this.paint();
        }
    };
}

/** Define `<cbox-app-switcher>` and `<cbox-service-mark>` once. A no-op outside a browser. */
export function defineCboxAppSwitcher(): void {
    if (typeof window === 'undefined' || typeof customElements === 'undefined') return;
    if (customElements.get('cbox-service-mark') === undefined) customElements.define('cbox-service-mark', defineServiceMark());
    if (customElements.get('cbox-app-switcher') === undefined) customElements.define('cbox-app-switcher', defineSwitcher());
}
