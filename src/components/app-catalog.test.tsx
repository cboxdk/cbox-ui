import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CboxAppCatalog, authorizeHref, parseAppCatalog, signInTarget } from './app-catalog';

describe('app catalog contract', () => {
    it('reads apps and clamps the refresh interval', () => {
        const state = parseAppCatalog(true, {
            apps: [
                { key: 'id', name: 'Cbox · ID', launch_url: 'https://id.cbox.dk/', icon_url: null },
                { key: 'bad', name: 'Nope', launch_url: 'javascript:alert(1)' },
                { key: 'half' },
            ],
            refresh_after: 600,
        });
        expect(state).toEqual({ status: 'ready', refreshAfter: 60, apps: [{ key: 'id', name: 'Cbox · ID', launch_url: 'https://id.cbox.dk/', icon_url: null, icon_dark_url: null, description: null }] });
    });
    it('passes both catalog icons through', () => {
        const state = parseAppCatalog(true, { apps: [{ key: 'signals', name: 'Cbox · Signals', launch_url: 'https://app.cboxsignals.com', icon_url: 'https://cbox.cboxid.com/app-icons/signals.png', icon_dark_url: 'https://cbox.cboxid.com/app-icons/signals-dark.png' }] });
        expect(state.status === 'ready' && state.apps[0]).toMatchObject({ icon_url: 'https://cbox.cboxid.com/app-icons/signals.png', icon_dark_url: 'https://cbox.cboxid.com/app-icons/signals-dark.png' });
    });
    it('defaults the refresh interval and tolerates an empty list', () => {
        expect(parseAppCatalog(true, { apps: [] })).toEqual({ status: 'ready', apps: [], refreshAfter: 60 });
        expect(parseAppCatalog(true, { nope: true })).toEqual({ status: 'unavailable' });
    });
    it('reads signin_url, and both legacy spellings of a missing grant', () => {
        expect(parseAppCatalog(false, { signin_url: '/auth/cbox' })).toEqual({ status: 'signin_required', signinUrl: '/auth/cbox', authorizeUrl: null });
        expect(parseAppCatalog(false, { authorize_url: '/acme/apps/authorize' })).toEqual({ status: 'signin_required', signinUrl: null, authorizeUrl: '/acme/apps/authorize' });
        expect(parseAppCatalog(false, { state: 'authorization_required' })).toEqual({ status: 'signin_required', signinUrl: null, authorizeUrl: null });
        expect(parseAppCatalog(false, { error: 'catalog_unavailable' })).toEqual({ status: 'unavailable' });
        expect(parseAppCatalog(false, null)).toEqual({ status: 'unavailable' });
    });
    it('sends the person back to where they were, on this origin only', () => {
        const here = { origin: 'https://infra.test', pathname: '/acme/projects', search: '?page=2' };
        expect(authorizeHref('/acme/apps/authorize', here)).toBe('/acme/apps/authorize?return_to=%2Facme%2Fprojects%3Fpage%3D2');
        expect(authorizeHref('https://evil.test/authorize', here)).toBeNull();
        expect(authorizeHref(null, here)).toBeNull();
    });
    it('resolves where to sign in: signin_url on this origin, else the legacy link with return_to', () => {
        const here = { origin: 'https://infra.test', pathname: '/acme/projects', search: '' };
        expect(signInTarget({ signinUrl: 'https://id.cbox.dk/authorize?x=1', authorizeUrl: null }, here)).toBeNull();
        expect(signInTarget({ signinUrl: 'https://infra.test/login/launch', authorizeUrl: null }, here)).toBe('https://infra.test/login/launch');
        expect(signInTarget({ signinUrl: '/auth/cbox', authorizeUrl: '/ignored' }, here)).toBe('https://infra.test/auth/cbox');
        expect(signInTarget({ signinUrl: 'javascript:alert(1)', authorizeUrl: null }, here)).toBeNull();
        expect(signInTarget({ signinUrl: 'http://evil.test/', authorizeUrl: null }, here)).toBeNull();
        expect(signInTarget({ signinUrl: null, authorizeUrl: '/acme/apps/authorize' }, here)).toBe('https://infra.test/acme/apps/authorize?return_to=%2Facme%2Fprojects');
        expect(signInTarget({ signinUrl: null, authorizeUrl: null }, here)).toBeNull();
    });
    it('renders the shared <cbox-app-switcher> element with translated labels', () => {
        const html = renderToStaticMarkup(<CboxAppCatalog endpoint="/acme/apps/catalog" currentAppKey="infra" className="ml-1" />);
        expect(html).toMatch(/^<cbox-app-switcher /);
        expect(html).toContain('endpoint="/acme/apps/catalog"');
        expect(html).toContain('current="infra"');
        expect(html).toContain('class="ml-1"');
        expect(html).toContain('&quot;title&quot;:&quot;Switch app&quot;');
        expect(html).not.toMatch(/reconnect|try again/i);
        expect(renderToStaticMarkup(<CboxAppCatalog endpoint={null} currentAppKey="infra" />)).toContain('endpoint=""');
    });
});
