import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CboxAppCatalog, authorizeHref, parseAppCatalog } from './app-catalog';

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
        expect(state).toEqual({ status: 'ready', refreshAfter: 60, apps: [{ key: 'id', name: 'Cbox · ID', launch_url: 'https://id.cbox.dk/', icon_url: null, description: null }] });
    });
    it('defaults the refresh interval and tolerates an empty list', () => {
        expect(parseAppCatalog(true, { apps: [] })).toEqual({ status: 'ready', apps: [], refreshAfter: 60 });
        expect(parseAppCatalog(true, { nope: true })).toEqual({ status: 'unavailable' });
    });
    it('recognises both spellings of a missing grant', () => {
        expect(parseAppCatalog(false, { authorize_url: '/acme/apps/authorize' })).toEqual({ status: 'authorization_required', authorizeUrl: '/acme/apps/authorize' });
        expect(parseAppCatalog(false, { state: 'authorization_required' })).toEqual({ status: 'authorization_required', authorizeUrl: null });
        expect(parseAppCatalog(false, { error: 'catalog_unavailable' })).toEqual({ status: 'unavailable' });
        expect(parseAppCatalog(false, null)).toEqual({ status: 'unavailable' });
    });
    it('sends the person back to where they were, on this origin only', () => {
        const here = { origin: 'https://infra.test', pathname: '/acme/projects', search: '?page=2' };
        expect(authorizeHref('/acme/apps/authorize', here)).toBe('/acme/apps/authorize?return_to=%2Facme%2Fprojects%3Fpage%3D2');
        expect(authorizeHref('https://evil.test/authorize', here)).toBeNull();
        expect(authorizeHref(null, here)).toBeNull();
    });
    it('renders a labelled trigger, disabled without an endpoint', () => {
        expect(renderToStaticMarkup(<CboxAppCatalog endpoint="/acme/apps/catalog" currentAppKey="infra" />)).toContain('aria-label="Switch app"');
        expect(renderToStaticMarkup(<CboxAppCatalog endpoint={null} currentAppKey="infra" />)).toContain('disabled=""');
    });
});
