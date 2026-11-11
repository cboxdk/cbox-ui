// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://app.test/orgs/cbox/projects/webshop/environments/production/deployments?status=failed"}
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderShell, reset } from './testing/harness';
import { makeShell } from './testing/fixture';
import { environmentFor, formFields, parseListPage, safeUrl, settingsHref, switchBody, switchPayload, withQuery } from './data';
import { parseUpdates } from './help-store';

afterEach(reset);

const RETURN_TO = '/orgs/cbox/projects/webshop/environments/production/deployments?status=failed';

function orgTrigger() {
    return screen.getByRole('button', { name: 'Organization: Cbox' });
}
function cascadeTrigger() {
    return screen.getByRole('button', { name: /Project: Webshop, Environment: Production/ });
}

describe('switching semantics (§5.6)', () => {
    it('switches organization with a POST to switchUrl, carrying where the person is', async () => {
        const { user, navigate } = renderShell();
        await user.click(orgTrigger());
        await user.click(await screen.findByRole('option', { name: /Acme ApS/ }));
        expect(navigate).toHaveBeenCalledWith('/shell/switch', { method: 'post', data: { select: { organization: 'org_acme' }, from: RETURN_TO } });
    });

    it('switches project and environment in one step when an environment is clicked', async () => {
        const { user, navigate } = renderShell();
        await user.click(cascadeTrigger());
        await user.hover(await screen.findByRole('option', { name: /Status page/ }));
        await user.click(await screen.findByRole('option', { name: /Staging/ }));
        expect(navigate).toHaveBeenCalledWith('/shell/switch', {
            method: 'post',
            data: { select: { organization: 'org_cbox', project: 'prj_status', environment: 'env_status_staging' }, from: RETURN_TO },
        });
    });

    it('keeps the environment with the same name when a project is clicked', async () => {
        const { user, navigate } = renderShell();
        await user.click(cascadeTrigger());
        await user.click(await screen.findByRole('option', { name: /Status page/ }));
        await waitFor(() => expect(navigate).toHaveBeenCalled());
        expect(navigate.mock.calls[0]![1].data).toMatchObject({ select: { project: 'prj_status', environment: 'env_status_prod' } });
    });

    it("falls back to the project's first environment when the name is not there", async () => {
        const { user, navigate } = renderShell();
        await user.click(cascadeTrigger());
        await user.click(await screen.findByRole('option', { name: /Billing API/ }));
        await waitFor(() => expect(navigate).toHaveBeenCalled());
        expect(navigate.mock.calls[0]![1].data).toMatchObject({ select: { project: 'prj_billing', environment: 'env_billing_dev' } });
    });

    it('posts the body as form fields PHP reads as select[] and from', () => {
        const { context } = makeShell();
        expect(formFields({ ...switchBody(context.levels, { project: 'prj_x' }, '/orgs/cbox?tab=a'), _token: 't' })).toEqual([
            ['select[organization]', 'org_cbox'],
            ['select[project]', 'prj_x'],
            ['from', '/orgs/cbox?tab=a'],
            ['_token', 't'],
        ]);
        expect(formFields({ a: undefined, b: null, c: ['x', 'y'] })).toEqual([['c[0]', 'x'], ['c[1]', 'y']]);
    });

    it('keeps the levels above the chosen one and leaves the ones below to the server', () => {
        const { context } = makeShell();
        expect(switchBody(context.levels, { project: 'prj_x' }, '/here')).toEqual({ select: { organization: 'org_cbox', project: 'prj_x' }, from: '/here' });
        expect(switchBody(context.levels, { organization: 'org_y' }, '/here')).toEqual({ select: { organization: 'org_y' }, from: '/here' });
        // Deprecated flat shape, kept for one minor.
        expect(switchPayload(context.levels, { project: 'prj_x' }, '/here')).toEqual({ organization: 'org_cbox', project: 'prj_x', return_to: '/here' });
        expect(environmentFor([{ id: 'a', name: 'Staging' }, { id: 'b', name: ' production ' }], 'Production')?.id).toBe('b');
        expect(environmentFor([], 'Production')).toBeUndefined();
    });
});

describe('cascade (§5.4)', () => {
    it('previews a hovered project’s environments without switching anything', async () => {
        const { user, navigate } = renderShell();
        await user.click(cascadeTrigger());
        expect(await screen.findByText('Environments in Webshop')).toBeTruthy();
        expect(await screen.findByRole('option', { name: /Production/ })).toBeTruthy();
        await user.hover(screen.getByRole('option', { name: /Status page/ }));
        expect(await screen.findByText('Environments in Status page')).toBeTruthy();
        expect(await screen.findByRole('option', { name: /Staging/ })).toBeTruthy();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('previews with the keyboard, crosses panes with → and ←, and switches with Enter', async () => {
        const { user, navigate } = renderShell();
        await user.click(cascadeTrigger());
        await screen.findByRole('option', { name: /Webshop/ });
        const search = screen.getByRole('combobox', { name: 'Search projects' });
        search.focus();
        await user.keyboard('{ArrowDown}');
        expect(await screen.findByText('Environments in Status page')).toBeTruthy();
        await screen.findByRole('option', { name: /Staging/ });
        // The first → reaches the project's gear, the second crosses to the environments.
        await user.keyboard('{ArrowRight}');
        expect(search.getAttribute('aria-activedescendant')).toMatch(/-settings$/);
        await user.keyboard('{ArrowRight}');
        const environments = screen.getByRole('listbox', { name: 'Environments in Status page' });
        expect(document.activeElement).toBe(environments);
        await user.keyboard('{ArrowDown}{Enter}');
        expect(navigate.mock.calls[0]![1].data).toMatchObject({ select: { project: 'prj_status', environment: 'env_status_prod' } });
    });

    it('marks tone, label and the current environment, in the order the app sent', async () => {
        const { user } = renderShell();
        await user.click(cascadeTrigger());
        const list = await screen.findByRole('listbox', { name: 'Environments in Webshop' });
        await within(list).findByText('Sandbox');
        const rows = within(list).getAllByRole('option').filter(option => option.getAttribute('aria-label') !== 'Settings');
        const names = rows.map(option => option.textContent);
        expect(names[0]).toContain('Production');
        expect(names[1]).toContain('Sandbox');
        expect(names[1]).toContain('test data');
        expect(rows[0]!.getAttribute('aria-current')).toBe('true');
        expect(list.querySelector('.cbx-tone-sandbox')).not.toBeNull();
    });
});

describe('organization menu (§5.3) and lazy lists (§11.2)', () => {
    it('loads nothing until the menu opens, then searches with ?q=', async () => {
        const { user, calls } = renderShell();
        expect(calls.some(call => call.url.startsWith('/shell/organizations'))).toBe(false);
        await user.click(orgTrigger());
        await screen.findByRole('option', { name: /Acme/ });
        await user.type(screen.getByRole('combobox', { name: 'Search organizations' }), 'nord');
        await waitFor(() => expect(screen.queryByRole('option', { name: /Acme/ })).toBeNull());
        expect(screen.getByRole('option', { name: /Nordic/ })).toBeTruthy();
        expect(calls.some(call => call.url.includes('q=nord'))).toBe(true);
    });

    it('has View all, a check on the current one, a gear per row and New organization', async () => {
        const { user } = renderShell();
        await user.click(orgTrigger());
        const current = await screen.findByRole('option', { name: /Cbox/ });
        expect(current.getAttribute('aria-current')).toBe('true');
        expect(screen.getByRole('link', { name: 'View all' }).getAttribute('href')).toBe('/orgs');
        expect(screen.getByRole('option', { name: 'Settings', description: /Acme ApS/ }).getAttribute('href')).toBe('/orgs/org_acme/settings');
        expect(screen.getByRole('button', { name: 'New organization' })).toBeTruthy();
        const long = screen.getByText(/Nordic Logistics/);
        expect(long.getAttribute('title')).toBe('Nordic Logistics Holding A/S with a very long legal name');
    });

    it('pages with the cursor when the list has more', async () => {
        const shell = makeShell();
        shell.context.levels[0]!.listUrl = '/shell/organizations?limit=2';
        const { user, calls } = renderShell({ shell });
        await user.click(orgTrigger());
        await screen.findByRole('option', { name: /Acme/ });
        expect(screen.queryByRole('option', { name: /Nordic/ })).toBeNull();
        await user.click(screen.getByRole('option', { name: 'Show more' }));
        expect(await screen.findByRole('option', { name: /Nordic/ })).toBeTruthy();
        expect(calls.some(call => call.url.includes('cursor=2'))).toBe(true);
    });

    it('closes on Escape and gives focus back to the trigger', async () => {
        const { user } = renderShell();
        await user.click(orgTrigger());
        await screen.findByRole('option', { name: /Acme/ });
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog', { name: 'Organization' })).toBeNull();
        expect(document.activeElement).toBe(orgTrigger());
    });

    it('opens on ↓ from the trigger with focus in the search, and Esc on the trigger closes it', async () => {
        const { user } = renderShell();
        orgTrigger().focus();
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('dialog', { name: 'Organization' })).toBeTruthy();
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Search organizations' })));

        orgTrigger().focus();
        expect(orgTrigger().getAttribute('aria-expanded')).toBe('true');
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog', { name: 'Organization' })).toBeNull();
        expect(document.activeElement).toBe(orgTrigger());
    });

    it('moves focus to the list, not the search, on a touch screen', async () => {
        const { user } = renderShell({ environment: { pointer: 'coarse', width: 1024 } });
        await user.click(orgTrigger());
        const list = await screen.findByRole('listbox', { name: 'Organizations' });
        await waitFor(() => expect(document.activeElement).toBe(list));
        await screen.findByRole('option', { name: /Acme/ });
        await waitFor(() => expect(list.getAttribute('aria-activedescendant')).toBeTruthy());
        await user.keyboard('{Escape}');
        expect(document.activeElement).toBe(orgTrigger());
    });

    it('moves with ↑↓ Home End and picks with Enter', async () => {
        const { user, navigate } = renderShell();
        await user.click(orgTrigger());
        await screen.findByRole('option', { name: /Nordic/ });
        await user.keyboard('{End}');
        expect(screen.getByRole('option', { name: /Nordic/ }).getAttribute('aria-selected')).toBe('true');
        await user.keyboard('{Home}{ArrowDown}{Enter}');
        expect(navigate.mock.calls[0]![1].data).toMatchObject({ select: { organization: 'org_acme' } });
    });

    it('makes the gear the active option with →, goes back with ←, and opens settings with Enter', async () => {
        const { user, navigate } = renderShell();
        await user.click(orgTrigger());
        await screen.findByRole('option', { name: /Acme/ });
        const search = screen.getByRole('combobox', { name: 'Search organizations' });
        const gear = screen.getByRole('option', { name: 'Settings', description: /Cbox/ });
        await user.keyboard('{ArrowRight}');
        expect(search.getAttribute('aria-activedescendant')).toBe(gear.id);
        expect(gear.getAttribute('aria-selected')).toBe('true');
        expect(document.activeElement).toBe(search);
        await user.keyboard('{ArrowLeft}');
        expect(screen.getByRole('option', { name: /^Cbox/ }).getAttribute('aria-selected')).toBe('true');
        await user.keyboard('{ArrowDown}{ArrowRight}{Enter}');
        expect(navigate).toHaveBeenCalledWith('/orgs/org_acme/settings');
    });
});

describe('inline create (§5.7)', () => {
    it('asks only for a name, creates it, and lands on its details page', async () => {
        const { user, navigate, calls } = renderShell();
        await user.click(cascadeTrigger());
        await user.click(await screen.findByRole('button', { name: 'New project' }));
        const name = screen.getByRole('textbox', { name: 'New project' });
        expect(document.activeElement).toBe(name);
        await user.type(name, 'Checkout{Enter}');
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/orgs/cbox/projects/new-project'));
        expect(calls.find(call => call.method === 'POST')).toMatchObject({ url: '/orgs/cbox/shell/projects', body: { name: 'Checkout' } });
    });

    it('creates an environment in the previewed project', async () => {
        const { user, navigate, calls } = renderShell();
        await user.click(cascadeTrigger());
        await user.hover(await screen.findByRole('option', { name: /Status page/ }));
        await user.click(await screen.findByRole('button', { name: 'New environment in Status page' }));
        await user.type(screen.getByRole('textbox', { name: 'New environment in Status page' }), 'QA{Enter}');
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/orgs/cbox/environments/new-env'));
        expect(calls.find(call => call.method === 'POST')?.body).toEqual({ name: 'QA', parent: 'prj_status' });
    });

    it('shows the reason when the name is refused, and Escape only leaves the field', async () => {
        const { user, navigate } = renderShell();
        await user.click(orgTrigger());
        await user.click(await screen.findByRole('button', { name: 'New organization' }));
        await user.type(screen.getByRole('textbox', { name: 'New organization' }), 'Taken{Enter}');
        expect(await screen.findByText('That name is taken.')).toBeTruthy();
        expect(navigate).not.toHaveBeenCalled();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('textbox', { name: 'New organization' })).toBeNull();
        expect(screen.getByRole('dialog', { name: 'Organization' })).toBeTruthy();
    });
});

describe('autofocus only with a fine pointer (§4.5)', () => {
    it('focuses the search on a desktop', async () => {
        const { user } = renderShell({ environment: { pointer: 'fine' } });
        await user.click(orgTrigger());
        await screen.findByRole('option', { name: /Acme/ });
        expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Search organizations' }));
    });

    it('never focuses a search field on touch', async () => {
        const { user } = renderShell({ environment: { pointer: 'coarse' } });
        await user.click(orgTrigger());
        await screen.findByRole('option', { name: /Acme/ });
        expect(document.activeElement).not.toBe(screen.getByRole('combobox', { name: 'Search organizations' }));
    });
});

describe('data helpers', () => {
    it('reads the list envelope and drops rows without an id and a name', () => {
        expect(parseListPage({ data: [{ id: 1, name: 'A', test_data: true, tone: 'sandbox' }, { name: 'no id' }, { id: 'x', name: 'B', tone: 'loud' }], has_more: true, next_cursor: 'c2' })).toEqual({
            items: [{ id: '1', name: 'A', testData: true, tone: 'sandbox' }, { id: 'x', name: 'B' }],
            hasMore: true,
            nextCursor: 'c2',
        });
        expect(parseListPage([{ id: 'a', name: 'A' }]).hasMore).toBe(false);
        expect(withQuery('/x?a=1#h', { q: 'b c', parent: undefined })).toBe('/x?a=1&q=b+c#h');
        expect(settingsHref({ settingsUrl: '/orgs/{id}/settings' }, 'a b')).toBe('/orgs/a%20b/settings');
        expect(settingsHref({}, 'a')).toBeNull();
    });
});

describe('keyboard reaches every action in a menu (§12.2)', () => {
    it('goes from the last row to New organization with ↓, and creates without a mouse', async () => {
        const { user, navigate, calls } = renderShell();
        await user.click(orgTrigger());
        await screen.findByRole('option', { name: /Nordic/ });
        await user.keyboard('{End}{ArrowDown}');
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'New organization' }));
        await user.keyboard('{Enter}');
        const name = screen.getByRole('textbox', { name: 'New organization' });
        expect(document.activeElement).toBe(name);
        await user.keyboard('Studio{Enter}');
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/orgs/new-org'));
        expect(calls.find(call => call.method === 'POST')).toMatchObject({ url: '/shell/organizations', body: { name: 'Studio' } });
    });

    it('goes from the first row to View all with ↑, and round the ring back into the rows', async () => {
        const { user } = renderShell();
        await user.click(orgTrigger());
        await screen.findByRole('option', { name: /Acme/ });
        const viewAll = screen.getByRole('link', { name: 'View all' });
        await user.keyboard('{Home}{ArrowUp}');
        expect(document.activeElement).toBe(viewAll);
        await user.keyboard('{ArrowUp}');
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'New organization' }));
        await user.keyboard('{ArrowDown}');
        expect(document.activeElement).toBe(viewAll);
        await user.keyboard('{ArrowDown}');
        expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Search organizations' }));
        expect(screen.getByRole('option', { name: /Cbox/ }).getAttribute('aria-selected')).toBe('true');
    });

    it('reaches “New environment in …” in the cascade’s right pane', async () => {
        const { user } = renderShell();
        await user.click(cascadeTrigger());
        await screen.findByRole('option', { name: /Preview/ });
        await user.keyboard('{ArrowRight}{ArrowRight}{End}{ArrowDown}');
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'New environment in Webshop' }));
        await user.keyboard('{ArrowUp}');
        expect(screen.getByRole('option', { name: /Preview/ }).getAttribute('aria-selected')).toBe('true');
    });
});

describe('lists belong to one context (§11.2)', () => {
    it('lists level 2 with ?parent= the organization', async () => {
        const { user, calls } = renderShell();
        await user.click(cascadeTrigger());
        await screen.findByRole('option', { name: /Status page/ });
        expect(calls.some(call => call.url.startsWith('/orgs/cbox/shell/projects') && call.url.includes('parent=org_cbox'))).toBe(true);
    });

    it('loads again after an organization switch, even when the list URL is the same', async () => {
        const { user, calls, rerender } = renderShell();
        const projectLoads = () => calls.filter(call => call.method === 'GET' && call.url.startsWith('/orgs/cbox/shell/projects')).length;
        const orgLoads = () => calls.filter(call => call.method === 'GET' && call.url.startsWith('/shell/organizations')).length;
        await user.click(orgTrigger());
        await screen.findByRole('option', { name: /Acme/ });
        await user.keyboard('{Escape}');
        await user.click(cascadeTrigger());
        await screen.findByRole('option', { name: /Status page/ });
        await user.keyboard('{Escape}');
        // Opening again on the same page uses the kept answer.
        await user.click(cascadeTrigger());
        await screen.findByRole('option', { name: /Status page/ });
        await user.keyboard('{Escape}');
        expect(projectLoads()).toBe(1);

        const acme = makeShell();
        acme.context.levels[0]!.current = { id: 'org_acme', name: 'Acme ApS' };
        rerender(acme);
        await user.click(cascadeTrigger());
        await screen.findByRole('option', { name: /Status page/ });
        expect(projectLoads()).toBe(2);
        expect(calls.some(call => call.url.includes('parent=org_acme'))).toBe(true);
        await user.keyboard('{Escape}');
        await user.click(screen.getByRole('button', { name: 'Organization: Acme ApS' }));
        await screen.findByRole('option', { name: /Nordic/ });
        expect(orgLoads()).toBe(2);
    });
});

describe('safe links', () => {
    it('keeps only http(s) and same-origin paths from a server answer', () => {
        expect(safeUrl('https://support.cbox.dk/t/1')).toBe('https://support.cbox.dk/t/1');
        expect(safeUrl('/orgs/cbox')).toBe('/orgs/cbox');
        expect(safeUrl('javascript:alert(1)')).toBeUndefined();
        expect(safeUrl(' JavaScript:alert(1)')).toBeUndefined();
        expect(safeUrl('data:text/html,x')).toBeUndefined();
        expect(safeUrl(42)).toBeUndefined();
        expect(parseUpdates({ data: [{ id: 1, title: 'T', url: 'javascript:alert(1)', unread: true }] })[0]).toEqual({ id: '1', kind: 'ticket', title: 'T', unread: true });
    });
});
