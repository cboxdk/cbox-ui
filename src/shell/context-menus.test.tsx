// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://app.test/orgs/cbox/projects/webshop/environments/production/deployments?status=failed"}
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderShell, reset } from './testing/harness';
import { makeShell } from './testing/fixture';
import { environmentFor, parseListPage, settingsHref, switchPayload, withQuery } from './data';

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
        expect(navigate).toHaveBeenCalledWith('/shell/switch', { method: 'post', data: { organization: 'org_acme', return_to: RETURN_TO } });
    });

    it('switches project and environment in one step when an environment is clicked', async () => {
        const { user, navigate } = renderShell();
        await user.click(cascadeTrigger());
        await user.hover(await screen.findByRole('option', { name: /Status page/ }));
        await user.click(await screen.findByRole('option', { name: /Staging/ }));
        expect(navigate).toHaveBeenCalledWith('/shell/switch', {
            method: 'post',
            data: { organization: 'org_cbox', project: 'prj_status', environment: 'env_status_staging', return_to: RETURN_TO },
        });
    });

    it('keeps the environment with the same name when a project is clicked', async () => {
        const { user, navigate } = renderShell();
        await user.click(cascadeTrigger());
        await user.click(await screen.findByRole('option', { name: /Status page/ }));
        await waitFor(() => expect(navigate).toHaveBeenCalled());
        expect(navigate.mock.calls[0]![1].data).toMatchObject({ project: 'prj_status', environment: 'env_status_prod' });
    });

    it("falls back to the project's first environment when the name is not there", async () => {
        const { user, navigate } = renderShell();
        await user.click(cascadeTrigger());
        await user.click(await screen.findByRole('option', { name: /Billing API/ }));
        await waitFor(() => expect(navigate).toHaveBeenCalled());
        expect(navigate.mock.calls[0]![1].data).toMatchObject({ project: 'prj_billing', environment: 'env_billing_dev' });
    });

    it('keeps the levels above the chosen one and leaves the ones below to the server', () => {
        const { context } = makeShell();
        expect(switchPayload(context.levels, { project: 'prj_x' }, '/here')).toEqual({ organization: 'org_cbox', project: 'prj_x', return_to: '/here' });
        expect(switchPayload(context.levels, { organization: 'org_y' }, '/here')).toEqual({ organization: 'org_y', return_to: '/here' });
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
        await user.keyboard('{ArrowRight}');
        const environments = screen.getByRole('listbox', { name: 'Environments in Status page' });
        expect(document.activeElement).toBe(environments);
        await user.keyboard('{ArrowDown}{Enter}');
        expect(navigate.mock.calls[0]![1].data).toMatchObject({ project: 'prj_status', environment: 'env_status_prod' });
    });

    it('marks tone, label and the current environment, in the order the app sent', async () => {
        const { user } = renderShell();
        await user.click(cascadeTrigger());
        const list = await screen.findByRole('listbox', { name: 'Environments in Webshop' });
        await within(list).findByText('Sandbox');
        const names = within(list).getAllByRole('option').map(option => option.textContent);
        expect(names[0]).toContain('Production');
        expect(names[1]).toContain('Sandbox');
        expect(names[1]).toContain('test data');
        expect(within(list).getAllByRole('option')[0]!.getAttribute('aria-current')).toBe('true');
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
        expect(screen.getByRole('link', { name: 'Settings for Acme ApS' }).getAttribute('href')).toBe('/orgs/org_acme/settings');
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

    it('moves with ↑↓ Home End and picks with Enter', async () => {
        const { user, navigate } = renderShell();
        await user.click(orgTrigger());
        await screen.findByRole('option', { name: /Nordic/ });
        await user.keyboard('{End}');
        expect(screen.getByRole('option', { name: /Nordic/ }).getAttribute('aria-selected')).toBe('true');
        await user.keyboard('{Home}{ArrowDown}{Enter}');
        expect(navigate.mock.calls[0]![1].data).toMatchObject({ organization: 'org_acme' });
    });

    it('focuses the gear with → and goes back with ←', async () => {
        const { user } = renderShell();
        await user.click(orgTrigger());
        await screen.findByRole('option', { name: /Acme/ });
        await user.keyboard('{ArrowRight}');
        expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Settings for Cbox' }));
        await user.keyboard('{ArrowLeft}');
        expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Search organizations' }));
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
