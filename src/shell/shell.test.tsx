// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://app.test/orgs/cbox/projects/webshop/environments/production/deployments"}
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { PageHeader } from '../primitives/page-header';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderShell, reset, supportCalls } from './testing/harness';
import { ENVIRONMENTS, makeShell } from './testing/fixture';
import { createHelpStore } from './help-store';
import { CboxShell, applyTheme, themeBootScript } from './shell';
import { hueFor, parseShellCatalog } from './app-grid';

afterEach(reset);

describe('header (§4.3)', () => {
    it('puts Search, Help, the bell and Switch app on the right, in that order', () => {
        const shell = makeShell({ notifications: { enabled: true, unread: 3, url: '/orgs/cbox/notifications' } });
        renderShell({ shell });
        const tools = document.querySelector('.cbx-tools')!;
        const labels = Array.from(tools.querySelectorAll('button, a')).map(el => el.getAttribute('aria-label'));
        expect(labels).toEqual(['Search or ask…', 'Help', 'Notifications, 3 unread', 'Switch app']);
    });

    it('renders no bell at all without a notification source (§8)', () => {
        renderShell();
        expect(screen.queryByRole('link', { name: /Notifications/ })).toBeNull();
        expect(document.querySelector('[aria-label*="Notifications"]')).toBeNull();
    });

    it('styles both context triggers the same, with a light separator between them', () => {
        renderShell();
        const triggers = document.querySelectorAll('.cbx-context .cbx-trigger');
        expect(triggers).toHaveLength(2);
        expect(triggers[0]!.className).toBe(triggers[1]!.className);
        expect(document.querySelector('.cbx-separator')?.textContent).toBe('/');
    });

    it('shows only the level 2 name for an app without level 3, and the environment for Tax', () => {
        const brain = makeShell();
        brain.context.levels = brain.context.levels.slice(0, 2);
        renderShell({ shell: brain });
        expect(screen.getByRole('button', { name: 'Project: Webshop' })).toBeTruthy();
        reset();
        const tax = makeShell();
        tax.context.levels = [tax.context.levels[0]!, tax.context.levels[2]!];
        renderShell({ shell: tax });
        const trigger = screen.getByRole('button', { name: 'Environment: Production' });
        expect(trigger.querySelector('.cbx-tone-production')).not.toBeNull();
    });

    it('counts unread support updates on the Help button', async () => {
        renderShell();
        expect(await screen.findByRole('button', { name: 'Help, 2 unread' })).toBeTruthy();
    });
});

describe('Help column (§7)', () => {
    it('persists across a simulated Inertia visit: open, search, scroll and the chat element', async () => {
        const store = createHelpStore();
        const { user, rerender } = renderShell({ store });
        await user.click(screen.getByRole('button', { name: /^Help/ }));
        const column = screen.getByRole('complementary', { name: 'Help' });
        await user.type(within(column).getByRole('searchbox', { name: 'Search docs and knowledge base' }), 'roll');
        expect(await within(column).findByRole('button', { name: /Roll back a deployment/ })).toBeTruthy();
        const chat = column.querySelector('cbox-support');
        expect(chat).not.toBeNull();
        store.set({ scrollTop: 120 });

        const next = makeShell({ page: { title: 'Servers', route: 'servers.index' } });
        next.nav.activeArea = 'servers';
        rerender(next, 'Servers');

        const after = screen.getByRole('complementary', { name: 'Help' });
        expect(after.hidden).toBe(false);
        expect(within(after).getByRole('searchbox', { name: 'Search docs and knowledge base' })).toHaveProperty('value', 'roll');
        expect(after.querySelector('cbox-support')).toBe(chat);
        expect(within(after).getByText('Servers')).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Servers' })).toBeTruthy();
    });

    it('keeps its state when the shell is mounted again (a layout that is not persistent)', async () => {
        const store = createHelpStore();
        const first = renderShell({ store });
        await first.user.click(screen.getByRole('button', { name: /^Help/ }));
        await first.user.type(screen.getByRole('searchbox', { name: 'Search docs and knowledge base' }), 'deploy');
        first.unmount();
        renderShell({ store });
        expect(screen.getByRole('complementary', { name: 'Help' }).hidden).toBe(false);
        expect(screen.getByRole('searchbox', { name: 'Search docs and knowledge base' })).toHaveProperty('value', 'deploy');
    });

    it('starts open when the person left it open, and stores the choice', async () => {
        const preference = vi.fn();
        const shell = makeShell();
        shell.preferences.helpOpen = true;
        const { user } = renderShell({ shell, onPreferenceChange: preference });
        expect(screen.getByRole('complementary', { name: 'Help' }).hidden).toBe(false);
        await user.click(screen.getByRole('button', { name: 'Close Help' }));
        expect(preference).toHaveBeenCalledWith('helpOpen', false);
        expect(document.getElementById('cbx-help')?.hidden).toBe(true);
    });

    it('closes with the same button, and never takes focus on a load where it was left open', async () => {
        const shell = makeShell();
        shell.preferences.helpOpen = true;
        const { user } = renderShell({ shell });
        expect(screen.getByRole('complementary', { name: 'Help' }).contains(document.activeElement)).toBe(false);
        const button = screen.getByRole('button', { name: /^Help/ });
        expect(button.getAttribute('aria-pressed')).toBe('true');
        await user.click(button);
        expect(document.getElementById('cbx-help')?.hidden).toBe(true);
        await user.click(button);
        expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search docs and knowledge base' }));
    });

    it('shows support updates, marks one read when opened, and offers articles for this page', async () => {
        const { user, calls, navigate } = renderShell();
        await user.click(screen.getByRole('button', { name: /^Help/ }));
        const column = screen.getByRole('complementary', { name: 'Help' });
        const ticket = await within(column).findByRole('button', { name: /Deploy stuck/ });
        expect(within(column).getByText('On this page')).toBeTruthy();
        expect(within(column).getByText(/Cbox \/ Webshop \/ Production/)).toBeTruthy();
        await user.click(ticket);
        expect(navigate).toHaveBeenCalledWith('https://support.cbox.dk/tickets/1042', { newTab: true });
        expect(calls.some(call => call.method === 'POST' && call.url === '/orgs/cbox/help/updates/upd_1/read')).toBe(true);
        expect(await screen.findByRole('button', { name: 'Help, 1 unread' })).toBeTruthy();
        const article = await within(column).findByRole('button', { name: /Deploy a project/ });
        await user.click(article);
        expect(within(column).getByRole('heading', { name: 'Deploy a project' })).toBeTruthy();
        expect(within(column).getByText('Every environment follows one branch.')).toBeTruthy();
        await user.click(within(column).getByRole('button', { name: 'Back to Help' }));
        expect(within(column).getByRole('searchbox', { name: 'Search docs and knowledge base' })).toBeTruthy();
    });

    it('has the support portal in the header and the footer, and Talk to a person', async () => {
        const { user } = renderShell();
        await user.click(screen.getByRole('button', { name: /^Help/ }));
        const column = screen.getByRole('complementary', { name: 'Help' });
        expect(within(column).getByRole('link', { name: 'Support portal (opens in a new tab)' }).getAttribute('href')).toBe('https://support.cbox.dk');
        expect(within(column).getByRole('link', { name: 'Support portal' }).getAttribute('target')).toBe('_blank');
        expect(within(column).getByRole('button', { name: 'Talk to a person' })).toBeTruthy();
    });

    it('says Help is unavailable when Assistant is down, and the shell still works', async () => {
        const { user } = renderShell({ fetch: { fail: ['/orgs/cbox/help/updates', '/orgs/cbox/help/topics/deployments/articles'] } });
        await user.click(screen.getByRole('button', { name: /^Help/ }));
        expect(await screen.findByText(/Help is not available right now/)).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Organization: Cbox' }));
        expect(await screen.findByRole('option', { name: /Acme/ })).toBeTruthy();
    });

    it('docks from 1280px and is a modal full-screen dialog below it', async () => {
        const { user } = renderShell({ environment: { width: 1100 } });
        await user.click(screen.getByRole('button', { name: /^Help/ }));
        const dialog = screen.getByRole('dialog', { name: 'Help' });
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog', { name: 'Help' })).toBeNull();
    });

    it('gives the chat the page intent and sends a question to it', async () => {
        const { user } = renderShell();
        await user.click(screen.getByRole('button', { name: /^Help/ }));
        await user.type(screen.getByRole('textbox', { name: 'Ask Cbox' }), 'Why did it fail?');
        await user.click(screen.getByRole('button', { name: 'Ask' }));
        await waitFor(() => expect(supportCalls).toHaveLength(1));
        expect(supportCalls[0]).toMatchObject({ method: 'ask', question: 'Why did it fail?', intent: { route: 'deployments.index', title: 'Deployments', context: 'Cbox / Webshop / Production' } });
        await user.click(screen.getByRole('button', { name: 'Talk to a person' }));
        await waitFor(() => expect(supportCalls).toHaveLength(2));
        expect(supportCalls[1]!.method).toBe('handover');
    });

    it('sends “Ask Cbox” from the palette to the chat with the page as context', async () => {
        const { user } = renderShell();
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox', { name: 'Search or ask…' }), 'how do I roll back');
        await user.click(await screen.findByRole('option', { name: /Ask Cbox: “how do I roll back”/ }));
        expect(screen.getByRole('complementary', { name: 'Help' }).hidden).toBe(false);
        await waitFor(() => expect(supportCalls[0]).toMatchObject({ method: 'ask', question: 'how do I roll back' }));
    });
});

describe('app switcher (§9)', () => {
    it('shows the organization’s apps with the current one marked, and the rest under More from Cbox', async () => {
        const { user, calls } = renderShell();
        expect(calls.some(call => call.url.includes('/apps/catalog'))).toBe(false);
        await user.click(screen.getByRole('button', { name: 'Switch app' }));
        const mine = await screen.findByRole('region', { name: 'In Cbox' });
        expect(within(mine).getByRole('link', { name: /Infra/ }).getAttribute('aria-current')).toBe('page');
        expect(within(mine).getByText('Identity and sign-in')).toBeTruthy();
        const more = screen.getByRole('region', { name: 'More from Cbox' });
        expect(within(more).getByRole('link', { name: /Engage/ }).getAttribute('href')).toBe('https://app.cboxengage.com/orgs/cbox/join');
        expect(screen.getByRole('link', { name: /All products/ })).toBeTruthy();
    });

    it('reads purpose, hue and admission from the catalog', () => {
        const state = parseShellCatalog(true, { apps: [{ key: 'x', name: 'X', launch_url: 'https://x.test', description: 'Fallback', hue: 400 }, { key: 'y', name: 'Y', in_organization: false, admission_url: 'javascript:alert(1)' }] });
        expect(state).toEqual({ status: 'ready', apps: [expect.objectContaining({ key: 'x', purpose: 'Fallback', hue: 40, inOrganization: true })] });
        expect(hueFor('billing')).toBe(145);
        expect(hueFor('unknown')).toBe(hueFor('unknown'));
    });
});

describe('account menu (§10)', () => {
    it('opens from the rail with profile, language, format, time zone, theme, switch account and sign out', async () => {
        const { user, navigate, preference } = renderShell();
        await user.click(screen.getByRole('button', { name: 'Account and preferences' }));
        const menu = screen.getByRole('menu', { name: 'Account' });
        expect(within(menu).getByText('Signed in with Cbox ID')).toBeTruthy();
        expect(within(menu).getByRole('menuitem', { name: /Profile and security/ }).getAttribute('href')).toBe('https://app.cboxid.com/settings');
        expect(within(menu).getByRole('menuitem', { name: /Time zone.*Europe\/Copenhagen/ })).toBeTruthy();
        await user.click(within(menu).getByRole('menuitemradio', { name: 'Dark' }));
        expect(preference).toHaveBeenCalledWith('theme', 'dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
        await user.click(within(menu).getByRole('menuitem', { name: /Language/ }));
        await user.click(screen.getByRole('option', { name: 'Dansk' }));
        expect(preference).toHaveBeenCalledWith('locale', 'da');
        await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
        expect(navigate).toHaveBeenCalledWith('/logout', { method: 'post' });
    });

    it('follows a theme that changes on the server without saving it back, and keeps local choices', async () => {
        const shell = makeShell();
        const preference = vi.fn();
        const { user, rerender } = renderShell({ shell, onPreferenceChange: preference });
        // A choice made here that the server prop does not carry yet.
        await user.click(screen.getByRole('button', { name: 'Pin navigation' }));
        expect(preference).toHaveBeenCalledWith('railPinned', true);
        preference.mockClear();
        // The theme changed elsewhere (another device, Cbox ID's shared preferences): only it is new.
        rerender({ ...shell, preferences: { ...shell.preferences, theme: 'dark' } });
        expect(document.documentElement.dataset.theme).toBe('dark');
        expect(document.documentElement.dataset.themePreference).toBe('dark');
        await user.click(screen.getByRole('button', { name: 'Account and preferences' }));
        expect(screen.getByRole('menuitemradio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');
        expect(screen.getByRole('button', { name: 'Unpin navigation' })).toBeTruthy();
        expect(preference).not.toHaveBeenCalled();
    });

    it('moves through items with the arrow keys', async () => {
        const { user } = renderShell();
        await user.click(screen.getByRole('button', { name: 'Account and preferences' }));
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Profile and security/ }));
        await user.keyboard('{ArrowDown}');
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Language/ }));
        await user.keyboard('{End}');
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Sign out' }));
    });
});

describe('rail and subnav (§4.1, §4.2)', () => {
    it('pins through the host’s preference callback and renders pinned from the prop', async () => {
        const { user, preference } = renderShell();
        await user.hover(document.querySelector('.cbx-rail')!);
        await user.click(screen.getByRole('button', { name: 'Pin navigation' }));
        expect(preference).toHaveBeenCalledWith('railPinned', true);
        expect(document.querySelector('.cbx-rail-slot')?.getAttribute('data-pinned')).toBe('true');
    });

    it('marks the active area with aria-current and shows the subnav for an area with pages', () => {
        renderShell();
        expect(screen.getByRole('link', { name: 'Deploy' }).getAttribute('aria-current')).toBe('page');
        const subnav = screen.getByRole('navigation', { name: 'Deploy' });
        expect(within(subnav).getByRole('link', { name: 'Deployments' }).getAttribute('aria-current')).toBe('page');
    });

    it('collapses the subnav with ⌘.', async () => {
        const { user, preference } = renderShell();
        await user.keyboard('{Meta>}.{/Meta}');
        expect(preference).toHaveBeenCalledWith('subnavCollapsed', true);
        expect(screen.getByRole('button', { name: 'Expand Deploy' })).toBeTruthy();
    });
});

describe('page header ? (§7.1)', () => {
    it('toggles Help from a page header inside the shell, and renders nothing outside it', async () => {
        const { user } = renderShell({ page: <PageHeader title="Deployments" help /> });
        await user.click(screen.getByRole('button', { name: 'Help for this page' }));
        expect(screen.getByRole('complementary', { name: 'Help' }).hidden).toBe(false);
        reset();
        render(<PageHeader title="Alone" help />);
        expect(screen.queryByRole('button', { name: 'Help for this page' })).toBeNull();
    });
});

describe('keyboard (§12.2)', () => {
    it('leaves a menu with Tab and hands focus to its trigger', async () => {
        const { user } = renderShell();
        await user.click(screen.getByRole('button', { name: 'Organization: Cbox' }));
        await screen.findByRole('option', { name: /Acme/ });
        await user.keyboard('{Tab}');
        expect(screen.queryByRole('dialog', { name: 'Organization' })).toBeNull();
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Organization: Cbox' }));
    });

    it('keeps Tab inside a modal sheet', async () => {
        const { user } = renderShell({ environment: { width: 390, pointer: 'coarse' } });
        const pill = screen.getByRole('button', { name: /Where you work/ });
        await user.click(pill);
        const sheet = screen.getByRole('dialog', { name: 'Where you work' });
        await within(sheet).findByRole('button', { name: /Sandbox/ });
        for (let i = 0; i < 25; i++) {
            await user.tab();
            expect(sheet.contains(document.activeElement)).toBe(true);
        }
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog', { name: 'Where you work' })).toBeNull();
        expect(document.activeElement).toBe(pill);
    });
});

describe('sandbox strip and banner (§5.1a)', () => {
    it('shows the app’s sandbox text only while the environment has test data', () => {
        const shell = makeShell({ banner: { kind: 'sandbox', text: 'Sandbox: test data only, nothing is charged.' } });
        renderShell({ shell });
        expect(screen.queryByText(/Sandbox: test data only/)).toBeNull();
        reset();
        const sandbox = makeShell({ banner: { kind: 'sandbox', text: 'Sandbox: test data only, nothing is charged.' } });
        sandbox.context.levels[2]!.current = ENVIRONMENTS.prj_webshop![1]!;
        renderShell({ shell: sandbox });
        expect(screen.getByRole('status').textContent).toContain('Sandbox: test data only');
    });

    it('shows every banner, the sandbox strip beside an app banner, and prefers `banners` to `banner`', () => {
        const strip = { kind: 'sandbox' as const, text: 'Sandbox: test data only, nothing is charged.' };
        const hold = { kind: 'notice' as const, text: 'Invoices are on hold.', action: { label: 'See what is held', url: '/orgs/cbox/tax' } };
        const sandbox = makeShell({ banner: hold, banners: [strip, hold, { kind: 'impersonation', text: 'You are acting as Ada' }] });
        sandbox.context.levels[2]!.current = ENVIRONMENTS.prj_webshop![1]!;
        renderShell({ shell: sandbox });
        const strips = screen.getAllByRole('status');
        expect(strips.map(element => element.className)).toEqual(['cbx-banner cbx-banner-sandbox', 'cbx-banner cbx-banner-notice', 'cbx-banner cbx-banner-impersonation']);
        expect(within(strips[1]!).getByRole('link', { name: 'See what is held' }).getAttribute('href')).toBe('/orgs/cbox/tax');
        reset();
        // Without test data the strip stays hidden; the app's banners show.
        renderShell({ shell: makeShell({ banners: [strip, hold] }) });
        expect(screen.getAllByRole('status').map(element => element.textContent)).toEqual(['Invoices are on hold.See what is held']);
    });
});

describe('first paint (§12.1)', () => {
    it('renders on the server with the saved rail and Help state, without touching the network', () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        const shell = makeShell();
        shell.preferences.railPinned = true;
        shell.preferences.helpOpen = true;
        const html = renderToString(<CboxShell shell={shell} helpStore={createHelpStore()}><p>Page</p></CboxShell>);
        expect(html).toContain('data-pinned="true"');
        expect(html).toMatch(/<div[^>]*id="cbx-help"(?![^>]*hidden)/);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('applies a theme the way the tokens read it and offers a boot script', () => {
        stubMediaDark();
        applyTheme('system');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.dataset.themePreference).toBe('system');
        applyTheme('light');
        expect(document.documentElement.dataset.theme).toBe('light');
        expect(themeBootScript('dark')).toContain("var t='dark'");
        expect(themeBootScript('evil\'</script>' as never)).toContain("var t='system'");
    });
});

function stubMediaDark() {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('dark'), addEventListener() {}, removeEventListener() {} }));
}

describe('a visit closes menus', () => {
    it('closes an open menu when the page changes', async () => {
        const { user, rerender } = renderShell();
        await user.click(screen.getByRole('button', { name: 'Organization: Cbox' }));
        expect(screen.getByRole('dialog', { name: 'Organization' })).toBeTruthy();
        act(() => rerender(makeShell({ page: { title: 'Servers' } }), 'Servers'));
        expect(screen.queryByRole('dialog', { name: 'Organization' })).toBeNull();
    });
});

describe('Help keeps the conversation and follows the organization (§7.1, §7.3)', () => {
    it('keeps the same chat element when an article opens and when the person goes back', async () => {
        const { user } = renderShell();
        await user.click(screen.getByRole('button', { name: /^Help/ }));
        const column = screen.getByRole('complementary', { name: 'Help' });
        const chat = column.querySelector('cbox-support');
        expect(chat).not.toBeNull();
        await user.click(await within(column).findByRole('button', { name: /Deploy a project/ }));
        expect(within(column).getByRole('heading', { name: 'Deploy a project' })).toBeTruthy();
        expect(column.querySelector('cbox-support')).toBe(chat);
        await user.click(within(column).getByRole('button', { name: 'Back to Help' }));
        expect(column.querySelector('cbox-support')).toBe(chat);
    });

    it('keeps the chat when the palette opens a docs article', async () => {
        const { user } = renderShell();
        await user.click(screen.getByRole('button', { name: /^Help/ }));
        const chat = document.querySelector('#cbx-help cbox-support');
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox', { name: 'Search or ask…' }), 'roll back');
        await user.click(await screen.findByRole('option', { name: /Roll back a deployment/ }));
        expect(screen.getByRole('heading', { name: 'Roll back a deployment' })).toBeTruthy();
        expect(document.querySelector('#cbx-help cbox-support')).toBe(chat);
    });

    it('reloads support updates after an organization switch, and drops the old count', async () => {
        const store = createHelpStore();
        const { calls, rerender } = renderShell({ store });
        expect(await screen.findByRole('button', { name: 'Help, 2 unread' })).toBeTruthy();
        const loads = () => calls.filter(call => call.method === 'GET' && call.url.includes('/help/updates')).length;
        expect(loads()).toBe(1);

        const acme = makeShell();
        acme.context.levels[0]!.current = { id: 'org_acme', name: 'Acme ApS' };
        rerender(acme);
        await waitFor(() => expect(loads()).toBe(2));
        expect(await screen.findByRole('button', { name: 'Help, 2 unread' })).toBeTruthy();

        // Another organization's list that is unavailable: the old count must not stay.
        const other = makeShell();
        other.context.levels[0]!.current = { id: 'org_nordic', name: 'Nordic' };
        other.help.updatesUrl = '/orgs/nordic/help/updates';
        rerender(other);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Help' })).toBeTruthy());
        expect(store.get().updates).toEqual([]);
    });
});

describe('Help left open, on a narrow window (§7.1)', () => {
    it('does not cover the page below 1280px until the person opens it', async () => {
        const shell = makeShell();
        shell.preferences.helpOpen = true;
        const { user, preference } = renderShell({ shell, environment: { width: 1100 } });
        expect(document.getElementById('cbx-help')?.hidden).toBe(true);
        expect(screen.queryByRole('dialog', { name: 'Help' })).toBeNull();
        const button = screen.getByRole('button', { name: /^Help/ });
        expect(button.getAttribute('aria-pressed')).toBe('false');
        await user.click(button);
        expect(screen.getByRole('dialog', { name: 'Help' })).toBeTruthy();
        expect(preference).toHaveBeenCalledWith('helpOpen', true);
    });

    it('still opens docked from 1280px', () => {
        const shell = makeShell();
        shell.preferences.helpOpen = true;
        renderShell({ shell, environment: { width: 1280 } });
        expect(screen.getByRole('complementary', { name: 'Help' }).hidden).toBe(false);
    });

    it('marks restored Help for the CSS, so a narrow first paint never shows it', () => {
        const shell = makeShell();
        shell.preferences.helpOpen = true;
        const html = renderToString(<CboxShell shell={shell} helpStore={createHelpStore()}><p>Page</p></CboxShell>);
        expect(html).toMatch(/<div[^>]*id="cbx-help"[^>]*data-restored="true"/);
    });
});

describe('Help gives focus back on close (§12.2)', () => {
    it('returns focus to the Help button from the Close button', async () => {
        const { user } = renderShell();
        const button = screen.getByRole('button', { name: /^Help/ });
        await user.click(button);
        await user.click(screen.getByRole('button', { name: 'Close Help' }));
        expect(document.activeElement).toBe(button);
    });

    it('returns focus to the overlay’s opener on Escape', async () => {
        const { user } = renderShell({ environment: { width: 1100 } });
        const button = screen.getByRole('button', { name: /^Help/ });
        await user.click(button);
        expect(screen.getByRole('dialog', { name: 'Help' })).toBeTruthy();
        await user.keyboard('{Escape}');
        expect(document.activeElement).toBe(button);
    });

    it('returns focus to a page header’s ?', async () => {
        const { user } = renderShell({ page: <PageHeader title="Deployments" help /> });
        const ask = screen.getByRole('button', { name: 'Help for this page' });
        await user.click(ask);
        await user.click(screen.getByRole('button', { name: 'Close Help' }));
        expect(document.activeElement).toBe(ask);
    });
});

describe('account and app grid details', () => {
    it('makes Switch account a plain link, a full page load to Cbox ID', async () => {
        const { user, navigate } = renderShell();
        await user.click(screen.getByRole('button', { name: 'Account and preferences' }));
        const item = screen.getByRole('menuitem', { name: 'Switch account' });
        expect(item.tagName).toBe('A');
        expect(item.getAttribute('href')).toBe('/switch-account');
        expect(navigate).not.toHaveBeenCalled();
    });

    it('reaches All products with the arrow keys', async () => {
        const { user } = renderShell();
        await user.click(screen.getByRole('button', { name: 'Switch app' }));
        await screen.findByRole('region', { name: 'More from Cbox' });
        await waitFor(() => expect(document.activeElement?.getAttribute('data-app')).toBe('infra'));
        await user.keyboard('{End}');
        const all = screen.getByRole('link', { name: /All products/ });
        expect(document.activeElement).toBe(all);
        await user.keyboard('{ArrowUp}');
        expect(document.activeElement?.getAttribute('data-app')).toBe('status');
        await user.keyboard('{ArrowDown}');
        expect(document.activeElement).toBe(all);
    });

    it('gives the page header ? a 32px hit area, 44px on touch', () => {
        renderShell({ page: <PageHeader title="Deployments" help /> });
        const ask = screen.getByRole('button', { name: 'Help for this page' });
        expect(ask.className).toContain('h-8');
        expect(ask.className).toContain('[@media(pointer:coarse)]:h-11');
    });
});
