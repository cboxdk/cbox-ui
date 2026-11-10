import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CboxAppIcon, CboxServiceMark, readKnownAppCatalog, rememberAppCatalog, secureIconUrl } from './app-icon';
import { CboxBrand } from '../layout/cbox-brand';

const LIGHT = 'https://cbox.cboxid.com/app-icons/signals.png';
const DARK = 'https://cbox.cboxid.com/app-icons/signals-dark.png';

function browser() {
    const store = new Map<string, string>();
    const events: string[] = [];
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } } });
    vi.stubGlobal('document', { dispatchEvent: (event: Event) => { events.push(event.type); return true; } });
    vi.stubGlobal('CustomEvent', class { constructor(public type: string) {} });
    return { store, events };
}

afterEach(() => vi.unstubAllGlobals());

describe('app icons from the catalog', () => {
    it('renders the light and the dark upload, swapped by the theme stylesheet', () => {
        const html = renderToStaticMarkup(<CboxAppIcon name="Cbox · Signals" iconUrl={LIGHT} iconDarkUrl={DARK} />);
        expect(html).toContain(`src="${LIGHT}"`);
        expect(html).toContain(`src="${DARK}"`);
        expect(html).toContain('cbx-app-icon cbx-app-icon-light');
        expect(html).toContain('cbx-app-icon cbx-app-icon-dark');
    });
    it('renders one image when only the light upload exists', () => {
        const html = renderToStaticMarkup(<CboxAppIcon name="Signals" iconUrl={LIGHT} />);
        expect(html).toContain('cbx-app-icon-single');
        expect(html).not.toContain('cbx-app-icon-dark');
    });
    it('shows initials without an icon and never renders a non-https URL', () => {
        expect(renderToStaticMarkup(<CboxAppIcon name="Cbox · Signals" iconUrl={null} />)).toContain('>Si</span>');
        expect(renderToStaticMarkup(<CboxAppIcon name="Signals" iconUrl="http://evil.test/x.png" />)).not.toContain('<img');
        expect(secureIconUrl('javascript:alert(1)')).toBeNull();
        expect(secureIconUrl(LIGHT)).toBe(LIGHT);
    });
    it('the token stylesheet hides the light icon under both dark switches', () => {
        const css = readFileSync(new URL('../../tokens/cbox.css', import.meta.url), 'utf8');
        expect(css).toContain(":is(.dark,[data-theme='dark']) .cbx-app-icon-light{display:none}");
        expect(css).toContain(":is(.dark,[data-theme='dark']) .cbx-app-icon-dark{display:block}");
        expect(css).toContain('.cbx-app-icon-dark{display:none}');
    });
    it('keeps the last catalog, with both icons, and tells the marks on the page', () => {
        const { store, events } = browser();
        rememberAppCatalog([{ key: 'signals', name: 'Cbox · Signals', icon_url: LIGHT, icon_dark_url: DARK }, { key: 'brain', name: 'Brain' }]);
        expect(JSON.parse(store.get('cbox-app-catalog') ?? '[]')).toEqual([
            { key: 'signals', name: 'Cbox · Signals', icon_url: LIGHT, icon_dark_url: DARK },
            { key: 'brain', name: 'Brain', icon_url: null, icon_dark_url: null },
        ]);
        expect(events).toEqual(['cbox-app-catalog']);
        expect(readKnownAppCatalog()[0]).toEqual({ key: 'signals', name: 'Cbox · Signals', icon_url: LIGHT, icon_dark_url: DARK });
    });
    it('ignores a kept catalog it cannot read', () => {
        const { store } = browser();
        store.set('cbox-app-catalog', '{not json');
        expect(readKnownAppCatalog()).toEqual([]);
        store.set('cbox-app-catalog', JSON.stringify([{ key: 'x', name: 'X', icon_url: 'http://insecure.test/x.png' }, { nope: 1 }]));
        expect(readKnownAppCatalog()).toEqual([{ key: 'x', name: 'X', icon_url: null, icon_dark_url: null }]);
    });
    it('the brand mark falls back to the Cbox icon until the catalog is known', () => {
        expect(renderToStaticMarkup(<CboxServiceMark appKey="signals" fallback={<i>f</i>} />)).toBe('<i>f</i>');
        expect(renderToStaticMarkup(<CboxBrand appKey="signals" collapsed />)).toContain('/brand/cbox-icon.png');
    });
});
