// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://app.test/orgs/cbox/projects/webshop/environments/production/deployments"}
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderShell, reset, supportCalls } from './testing/harness';
import { makeShell } from './testing/fixture';
import { matchScore } from './palette';

afterEach(reset);

function groupNames(): string[] {
    return screen.getAllByRole('group').map(group => group.getAttribute('aria-labelledby')).map(id => document.getElementById(id!)!.textContent!.trim());
}

describe('command palette (§6)', () => {
    it('opens with ⌘K and Ctrl+K, closes with Esc and gives focus back', async () => {
        const { user } = renderShell();
        const search = screen.getByRole('button', { name: 'Search or ask…' });
        search.focus();
        await user.keyboard('{Meta>}k{/Meta}');
        expect(screen.getByRole('dialog', { name: 'Search' })).toBeTruthy();
        expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Search or ask…' }));
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();
        expect(document.activeElement).toBe(search);
        await user.keyboard('{Control>}k{/Control}');
        expect(screen.getByRole('dialog', { name: 'Search' })).toBeTruthy();
    });

    it('does not focus its field on touch', async () => {
        const { user } = renderShell({ environment: { pointer: 'coarse' } });
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Search' }));
    });

    it('shows its groups in order, with Ask Cbox last', async () => {
        const { user } = renderShell();
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox'), 'deploy');
        await screen.findByRole('option', { name: /Deployment 3f9c21a/ });
        await screen.findByRole('option', { name: /Deploy a project/ });
        expect(groupNames()).toEqual(['Pages', 'Records', 'Actions', 'Docs and help', 'Ask Cbox']);
        await user.clear(screen.getByRole('combobox'));
        await user.type(screen.getByRole('combobox'), 'sandbox');
        await screen.findByRole('option', { name: /Webshop · Sandbox/ });
        expect(groupNames()).toContain('Go to');
    });

    it('debounces typing by 120ms', async () => {
        const { user, calls } = renderShell();
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        const field = screen.getByRole('combobox');
        fireEvent.change(field, { target: { value: 'd' } });
        fireEvent.change(field, { target: { value: 'de' } });
        fireEvent.change(field, { target: { value: 'dep' } });
        await waitFor(() => expect(calls.some(call => call.url.includes('/shell/search'))).toBe(true));
        const searches = calls.filter(call => call.url.includes('/shell/search'));
        expect(searches).toHaveLength(1);
        expect(searches[0]!.url).toContain('q=dep');
    });

    it('never lets a slow group hold up the fast ones', async () => {
        const { user } = renderShell({ fetch: { delays: { '/orgs/cbox/help/search': 5000 } } });
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox'), 'deploy');
        expect(await screen.findByRole('option', { name: /Deployment 3f9c21a/ })).toBeTruthy();
        expect(screen.getByText('Searching…')).toBeTruthy();
        expect(screen.queryByRole('option', { name: /Deploy a project/ })).toBeNull();
    });

    it('moves with ↑↓, opens with Enter and in a new tab with ⌘Enter', async () => {
        const { user, navigate } = renderShell();
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox'), 'releases');
        const option = await screen.findByRole('option', { name: /Releases/ });
        expect(option.getAttribute('aria-selected')).toBe('true');
        await user.keyboard('{Meta>}{Enter}{/Meta}');
        expect(navigate).toHaveBeenCalledWith('/orgs/cbox/projects/webshop/environments/production/releases', { newTab: true });
        await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');
        expect(navigate).toHaveBeenLastCalledWith('/orgs/cbox/projects/webshop/environments/production/releases', { newTab: false });
        expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();
    });

    it('shows five per group, then “Show all in {group}”', async () => {
        const shell = makeShell();
        shell.palette.actions = Array.from({ length: 8 }, (_, index) => ({ id: `a${index}`, label: `Run task ${index}`, url: `/run/${index}` }));
        const { user } = renderShell({ shell });
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox'), 'run task');
        const actions = screen.getAllByRole('group').find(group => group.textContent!.startsWith('Actions'))!;
        expect(within(actions).getAllByRole('option')).toHaveLength(6);
        await user.click(within(actions).getByRole('option', { name: 'Show all in Actions' }));
        expect(within(actions).getAllByRole('option')).toHaveLength(8);
    });

    it('opens a docs result in the Help column', async () => {
        const { user } = renderShell();
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox'), 'roll back');
        await user.click(await screen.findByRole('option', { name: /Roll back a deployment/ }));
        const help = screen.getByRole('complementary', { name: 'Help' });
        expect(within(help).getByRole('heading', { name: 'Roll back a deployment' })).toBeTruthy();
    });

    it('switches context from Go to, across organizations', async () => {
        const { user, navigate } = renderShell();
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox'), 'acme');
        await user.click(await screen.findByRole('option', { name: /Acme ApS/ }));
        expect(navigate).toHaveBeenCalledWith('/shell/switch', expect.objectContaining({ method: 'post', data: expect.objectContaining({ organization: 'org_acme' }) }));
    });

    it('reads records and Go to from console-kit\'s grouped search answer', async () => {
        const shell = makeShell();
        shell.palette = { ...shell.palette, searchUrl: '/shell/search?context%5Borganization%5D=org_cbox', gotoUrl: undefined };
        const { user } = renderShell({ shell });
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox'), 'fjord');
        expect(await screen.findByRole('option', { name: /Fjord Studio/ })).toBeTruthy();
        expect(await screen.findByRole('option', { name: /Fjord · Production/ })).toBeTruthy();
        expect(groupNames()).toEqual(expect.arrayContaining(['Records', 'Go to']));
    });

    it('matches every word and ranks a prefix first', () => {
        expect(matchScore('Invite members', 'inv mem')).toBeGreaterThan(matchScore('Reinvite old members', 'inv mem'));
        expect(matchScore('Servers', 'deploy')).toBe(0);
    });
});

describe('palette keeps its place (§12.1)', () => {
    it('keeps the highlighted result when a slow group arrives above it', async () => {
        const { user, navigate } = renderShell({ fetch: { delays: { '/orgs/cbox/shell/search': 400 } } });
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox'), 'deploy');
        const target = await screen.findByRole('option', { name: /New deployment/ });
        for (let i = 0; i < 12 && target.getAttribute('aria-selected') !== 'true'; i++) await user.keyboard('{ArrowDown}');
        expect(target.getAttribute('aria-selected')).toBe('true');
        expect(screen.queryByRole('option', { name: /Deployment 3f9c21a/ })).toBeNull();
        expect(await screen.findByRole('option', { name: /Deployment 3f9c21a/ }, { timeout: 2000 })).toBeTruthy();
        expect(screen.getByRole('option', { name: /New deployment/ }).getAttribute('aria-selected')).toBe('true');
        await user.keyboard('{Enter}');
        expect(navigate).toHaveBeenCalledWith('/orgs/cbox/deployments/create', { method: 'get', newTab: false });
    });

    it('does not make Ask Cbox the active row while results load: a pasted id opens its record', async () => {
        const { user, navigate } = renderShell({ fetch: { delays: { '/orgs/cbox/shell/search': 400 } } });
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox'), '3f9c21a');
        const ask = await screen.findByRole('option', { name: /Ask Cbox: “3f9c21a”/ });
        await screen.findAllByText('Searching…');
        expect(ask.getAttribute('aria-selected')).toBe('false');
        // Enter while it loads does not send the id to the chat.
        await user.keyboard('{Enter}');
        expect(supportCalls).toHaveLength(0);
        expect(screen.getByRole('dialog', { name: 'Search' })).toBeTruthy();
        const record = await screen.findByRole('option', { name: /Deployment 3f9c21a/ }, { timeout: 2000 });
        expect(record.getAttribute('aria-selected')).toBe('true');
        expect(screen.getByRole('option', { name: /Ask Cbox/ }).getAttribute('aria-selected')).toBe('false');
        await user.keyboard('{Enter}');
        expect(navigate).toHaveBeenCalledWith('/orgs/cbox/deployments/dep_1', { newTab: false });
        expect(supportCalls).toHaveLength(0);
    });

    it('keeps Ask Cbox when the person chose it while results load', async () => {
        const { user, navigate } = renderShell({ fetch: { delays: { '/orgs/cbox/shell/search': 400 } } });
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox'), '3f9c21a');
        const ask = await screen.findByRole('option', { name: /Ask Cbox: “3f9c21a”/ });
        await user.keyboard('{ArrowUp}');
        expect(ask.getAttribute('aria-selected')).toBe('true');
        await screen.findByRole('option', { name: /Deployment 3f9c21a/ }, { timeout: 2000 });
        expect(screen.getByRole('option', { name: /Ask Cbox/ }).getAttribute('aria-selected')).toBe('true');
        await user.keyboard('{Enter}');
        await waitFor(() => expect(supportCalls[0]).toMatchObject({ method: 'ask', question: '3f9c21a' }));
        expect(navigate).not.toHaveBeenCalled();
    });

    it('makes Ask Cbox the active row once every group has answered with nothing', async () => {
        const { user } = renderShell();
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox'), 'zzqx nothing');
        await waitFor(() => expect(screen.queryByText('Searching…')).toBeNull());
        await waitFor(() => expect(screen.getByRole('option', { name: /Ask Cbox/ }).getAttribute('aria-selected')).toBe('true'));
        await user.keyboard('{Enter}');
        await waitFor(() => expect(supportCalls[0]).toMatchObject({ method: 'ask', question: 'zzqx nothing' }));
    });

    it('drops a server link that is not http(s) or a path', async () => {
        const { user } = renderShell();
        vi.stubGlobal('fetch', async (input: string) => {
            if (input.includes('/shell/search')) return new Response(JSON.stringify({ data: [{ id: 'x', title: 'Evil record', url: 'javascript:alert(1)' }, { id: 'y', title: 'Good record', url: '/orgs/cbox/y' }] }), { status: 200 });
            return new Response('{"data":[]}', { status: 200 });
        });
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox'), 'record');
        expect(await screen.findByRole('option', { name: /Good record/ })).toBeTruthy();
        expect(screen.queryByRole('option', { name: /Evil record/ })).toBeNull();
    });
});
