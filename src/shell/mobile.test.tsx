// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://app.test/b/billing/invoices"}
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderShell, reset, supportCalls } from './testing/harness';
import { makeShell } from './testing/fixture';
import { BILLING_ENVIRONMENTS, makeBillingShell } from './testing/billing';
import { renderBillingCreate } from './testing/billing-forms';
import { pillLines, tabAreas } from './mobile';
import { quickEnvironments, isLive } from './data';
import { scrollLockCount } from './scroll-lock';
import { PageHeader } from '../primitives/page-header';

afterEach(reset);

const PHONE = { width: 390, pointer: 'coarse' as const };

function phone(options: Parameters<typeof renderShell>[0] = {}) {
    return renderShell({ shell: makeBillingShell(), environment: PHONE, renderCreate: renderBillingCreate, ...options });
}

function headings(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll('.cbx-eyebrow')).map(node => node.textContent ?? '');
}

describe('phone top bar (V6)', () => {
    it('shows the context pill, Help, Search and the page’s “+”, in that order', () => {
        phone();
        const bar = document.querySelector('.cbx-m-bar')!;
        const labels = Array.from(bar.querySelectorAll('button')).map(button => button.getAttribute('aria-label'));
        expect(labels).toEqual(['Where you work: Cbox, Cbox, Production', 'Help with Invoices', 'Search and commands', 'New invoice']);
        expect(bar.querySelector('.cbx-m-pill-top')!.textContent).toBe('Cbox · Cbox');
        expect(bar.querySelector('.cbx-m-pill-main')!.textContent).toBe('Production');
        expect(bar.querySelector('.cbx-m-pill-main .cbx-tone-production')).not.toBeNull();
    });

    it('never renders a dead “+”: none without create forms, “Create” on a page without its own target', () => {
        renderShell({ shell: makeBillingShell(), environment: PHONE });
        expect(screen.queryByRole('button', { name: /New invoice|Create/ })).toBeNull();
        reset();
        phone({ shell: makeBillingShell({ area: 'tax', page: 'Overview' }) });
        expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
    });

    it('names the levels the app declares: project without environments, the organization alone', () => {
        const [org, project] = makeBillingShell().context.levels;
        expect(pillLines([org!, project!])).toEqual({ top: 'Cbox', main: project });
        expect(pillLines([org!])).toEqual({ top: 'Organization', main: org });
    });

    it('marks unread support replies with a dot, from the prop before the updates load', async () => {
        const shell = makeBillingShell();
        shell.help.updatesUrl = undefined;
        shell.help.unread = 2;
        phone({ shell });
        expect(screen.getByRole('button', { name: 'Help with Invoices, 2 unread' })).toBeTruthy();
    });
});

describe('phone area head (V6)', () => {
    it('shows the area large and its pages as chips, the current one marked', () => {
        phone();
        expect(document.querySelector('.cbx-m-title')!.textContent).toBe('Billing');
        const chips = screen.getByRole('navigation', { name: 'Billing pages' });
        expect(within(chips).getAllByRole('link')).toHaveLength(7);
        expect(within(chips).getByRole('link', { name: 'Invoices' }).getAttribute('aria-current')).toBe('page');
    });

    it('shows no chips for an area with one page', () => {
        phone({ shell: makeBillingShell({ area: 'home', page: 'Dashboard' }) });
        expect(screen.queryByRole('navigation', { name: 'Home pages' })).toBeNull();
    });

    it('shows the “not production” banner from the app’s live flag, never from the name', () => {
        phone({ shell: makeBillingShell({ environment: 'env_staging' }) });
        expect(screen.getByRole('status').textContent).toBe('Staging. Not production, nothing here touches live customers.');
        reset();
        const named = makeBillingShell();
        named.context.levels[2]!.current = { id: 'x', name: 'Production', tone: 'production', live: false };
        phone({ shell: named });
        expect(screen.getByRole('status').textContent).toContain('Production. Not production');
        reset();
        const live = makeBillingShell();
        live.context.levels[2]!.current = { id: 'y', name: 'Sandbox', tone: 'sandbox', live: true };
        phone({ shell: live });
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('reads `testData` and `tone` when the app sends no live flag, and says nothing without either', () => {
        expect(isLive({ testData: true })).toBe(false);
        expect(isLive({ tone: 'production' })).toBe(true);
        expect(isLive({ tone: 'preview' })).toBe(false);
        expect(isLive({})).toBeUndefined();
    });
});

describe('phone tab bar (V6)', () => {
    it('holds the app’s tabs, at most four, then More', () => {
        phone();
        const bar = screen.getByRole('navigation', { name: 'Main' });
        expect(Array.from(bar.querySelectorAll('.cbx-tab')).map(tab => tab.textContent)).toEqual(['Home', 'Customers', 'Billing', 'Catalog', 'More']);
        expect(within(bar).getByRole('link', { name: 'Billing' }).getAttribute('aria-current')).toBe('page');
        const areas = makeBillingShell().nav.areas;
        expect(tabAreas(areas, ['tax', 'nope', 'home', 'billing', 'catalog', 'customers']).map(area => area.key)).toEqual(['tax', 'home', 'billing', 'catalog']);
        expect(tabAreas(areas, undefined).map(area => area.key)).toEqual(['home', 'customers', 'billing', 'catalog']);
    });

    it('lights More on an area that is not a tab', () => {
        phone({ shell: makeBillingShell({ area: 'tax', page: 'Returns' }) });
        expect(screen.getByRole('button', { name: 'More' }).className).toContain('is-on');
    });
});

describe('More (V6)', () => {
    it('lists the app’s areas, where you work, Help, Switch app and the profile last', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: 'More' }));
        const more = screen.getByRole('region', { name: 'More' });
        expect(headings(more)).toEqual(['Billing', 'Where you work', 'Help']);
        const rows = Array.from(more.querySelectorAll('.cbx-grow')).map(row => row.textContent);
        expect(rows.at(-2)).toBe('Switch app');
        expect(rows.at(-1)).toContain('Sylvester Damgaard');
        expect(within(more).getByRole('button', { name: /Help with Invoices.*1 new/ })).toBeTruthy();
        expect((document.querySelector('.cbx-m-page') as HTMLElement).hidden).toBe(true);
    });

    it('searches every page', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: 'More' }));
        await user.type(screen.getByRole('searchbox', { name: 'Search all pages' }), 'web');
        const hits = screen.getByRole('group', { name: 'Pages' });
        expect(within(hits).getByRole('link', { name: /Webhooks/ }).getAttribute('href')).toBe('/b/developers/webhooks');
        await user.clear(screen.getByRole('searchbox', { name: 'Search all pages' }));
        await user.type(screen.getByRole('searchbox', { name: 'Search all pages' }), 'zzz');
        expect(screen.getByText('No page matches. Search finds records too.')).toBeTruthy();
    });

    it('pushes an area’s grouped pages, and More again goes back to the top', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: 'More' }));
        await user.click(screen.getByRole('button', { name: /^Developers/ }));
        const more = screen.getByRole('region', { name: 'More' });
        expect(within(more).getByRole('heading', { name: 'Developers' })).toBeTruthy();
        expect(within(more).getAllByRole('group').map(group => group.getAttribute('aria-label'))).toEqual(['API', 'Environments', 'Data']);
        await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'More' }));
        expect(within(screen.getByRole('region', { name: 'More' })).getByRole('heading', { name: 'More' })).toBeTruthy();
    });

    it('opens the context sheet at a level from “Where you work”, and Back closes it', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: 'More' }));
        await user.click(screen.getByRole('button', { name: /Organization Cbox/ }));
        const sheet = screen.getByRole('dialog', { name: 'Organization' });
        expect(await within(sheet).findByRole('option', { name: /Sheila’s MixBix/ })).toBeTruthy();
        await user.click(within(sheet).getByRole('button', { name: 'Back' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByRole('region', { name: 'More' })).toBeTruthy();
    });

    it('has the account screen: profile, language, format, time zone, theme, switch account, sign out', async () => {
        const { user, preference, navigate } = phone();
        await user.click(screen.getByRole('button', { name: 'More' }));
        await user.click(screen.getByRole('button', { name: /Sylvester Damgaard/ }));
        const more = screen.getByRole('region', { name: 'More' });
        expect(within(more).getByRole('link', { name: 'Profile and security' })).toBeTruthy();
        expect(within(more).getByRole('button', { name: /Language/ })).toBeTruthy();
        expect(within(more).getByRole('button', { name: /Regional format/ })).toBeTruthy();
        expect(within(more).getByRole('button', { name: /Time zone/ })).toBeTruthy();
        await user.click(within(more).getByRole('radio', { name: 'Dark' }));
        expect(preference).toHaveBeenCalledWith('theme', 'dark');
        expect(within(more).getByRole('link', { name: 'Switch account' })).toBeTruthy();
        await user.click(within(more).getByRole('button', { name: 'Sign out' }));
        expect(navigate).toHaveBeenCalledWith('/logout', { method: 'post' });
        await user.click(within(more).getByRole('button', { name: /Language/ }));
        await user.click(await screen.findByRole('option', { name: 'Dansk' }));
        expect(preference).toHaveBeenCalledWith('locale', 'da');
    });
});

describe('context sheet (V6)', () => {
    it('offers organization and project, then the environment quick picks and “All N environments”', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: /Where you work/ }));
        const sheet = screen.getByRole('dialog', { name: 'Where you work' });
        expect(within(sheet).getByRole('button', { name: /Organization Cbox/ })).toBeTruthy();
        expect(within(sheet).getByRole('button', { name: /Project Cbox/ })).toBeTruthy();
        await within(sheet).findByRole('button', { name: /All 7 environments/ });
        expect(within(within(sheet).getByRole('group', { name: 'Environment' })).getAllByRole('button').map(item => item.textContent)).toEqual(['Production', 'Staging', 'All 7 environments']);
    });

    it('picks the current, a live and a test environment', () => {
        const staging = BILLING_ENVIRONMENTS[1]!;
        expect(quickEnvironments(BILLING_ENVIRONMENTS, staging).map(item => item.name)).toEqual(['Staging', 'Production', 'Sandbox']);
    });

    it('lists every environment under the app’s groups, searchable, and switches on a pick', async () => {
        const { user, navigate } = phone();
        await user.click(screen.getByRole('button', { name: /Where you work/ }));
        await user.click(await screen.findByRole('button', { name: /All 7 environments/ }));
        const sheet = screen.getByRole('dialog', { name: 'Environments in Cbox' });
        await within(sheet).findByText('Dev · sylvester');
        expect(headings(sheet)).toEqual(['Live', 'Test', 'Preview', 'Development']);
        expect(within(sheet).getByRole('button', { name: /Production/ }).getAttribute('aria-current')).toBe('true');
        expect(within(sheet).getByRole('button', { name: 'New environment' })).toBeTruthy();
        await user.type(within(sheet).getByRole('searchbox', { name: 'Search environments' }), 'preview');
        await waitFor(() => expect(headings(sheet)).toEqual(['Preview']));
        await user.click(within(sheet).getByRole('button', { name: /pr-418/ }));
        expect(navigate.mock.calls[0]![1].data).toMatchObject({ select: { organization: 'org_cbox', project: 'prj_cbox', environment: 'env_pr418' } });
    });
});

describe('Help on the phone (V6)', () => {
    it('is a sheet about the page: ask, the shared context, conversations, articles, chat and the help center', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: /^Help with Invoices/ }));
        const sheet = screen.getByRole('dialog', { name: 'Help with Invoices' });
        expect(within(sheet).getByText('Cbox sees this page: Invoices in Cbox · Cbox · Production')).toBeTruthy();
        expect(await within(sheet).findByRole('button', { name: /Dunning on Hubhus ApS.*1 new/ })).toBeTruthy();
        expect(await within(sheet).findByRole('button', { name: 'How dunning retries work' })).toBeTruthy();
        expect(headings(sheet)).toEqual(['Your conversations', 'For Invoices']);
        expect(within(sheet).getByRole('link', { name: /Help center/ }).getAttribute('href')).toBe('https://support.cbox.dk');
        expect(within(sheet).queryByRole('button', { name: 'Talk to a person' })).toBeNull();
        await user.type(within(sheet).getByRole('textbox', { name: 'Ask Cbox' }), 'Why is it overdue?');
        await user.click(within(sheet).getByRole('button', { name: 'Ask' }));
        await waitFor(() => expect(supportCalls[0]).toMatchObject({ method: 'ask', question: 'Why is it overdue?' }));
        // An AI answer always offers a person.
        await user.click(within(sheet).getByRole('button', { name: 'Talk to a person' }));
        await waitFor(() => expect(supportCalls.at(-1)).toMatchObject({ method: 'handover' }));
    });

    it('opens an article with a follow-up question', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: /^Help with Invoices/ }));
        const sheet = screen.getByRole('dialog', { name: 'Help with Invoices' });
        await user.click(await within(sheet).findByRole('button', { name: 'Send an invoice and get paid' }));
        expect(within(sheet).getByRole('heading', { name: 'Send an invoice and get paid' })).toBeTruthy();
        await user.type(within(sheet).getByRole('textbox', { name: 'Ask a follow-up' }), 'And partly paid?');
        await user.keyboard('{Enter}');
        await waitFor(() => expect(supportCalls[0]).toMatchObject({ method: 'ask', question: 'And partly paid?' }));
    });
});

describe('palette on the phone (V6)', () => {
    it('is a sheet with Cancel and scope chips; empty, it offers the page’s actions, Recent and Switch', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: 'Search and commands' }));
        const palette = screen.getByRole('dialog', { name: 'Search' });
        expect(palette.className).toContain('is-sheet');
        expect(within(palette).getAllByRole('radio').map(radio => radio.textContent)).toEqual(['All', 'Actions', 'Records', 'Pages', 'Help']);
        await within(palette).findByRole('option', { name: /Switch to Staging/ });
        const groups = within(palette).getAllByRole('group').map(group => document.getElementById(group.getAttribute('aria-labelledby')!)!.textContent);
        expect(groups).toEqual(['On Invoices', 'Recent', 'Switch']);
        expect(within(palette).getAllByRole('option').slice(0, 4).map(option => option.querySelector('.cbx-row-name')!.textContent)).toEqual(['New invoice', 'New credit note', 'Show overdue invoices', 'Export invoices']);
        await user.click(within(palette).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();
    });

    it('with a query: Actions, Records, Pages, Help, then Ask Cbox; a scope keeps one kind', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: 'Search and commands' }));
        const palette = screen.getByRole('dialog', { name: 'Search' });
        await user.type(within(palette).getByRole('combobox'), 'inv');
        await within(palette).findByRole('option', { name: /INV-2026-0142/ });
        await within(palette).findByRole('option', { name: /Send an invoice/ });
        const names = () => within(palette).getAllByRole('group').map(group => document.getElementById(group.getAttribute('aria-labelledby')!)!.textContent);
        expect(names()).toEqual(['Actions', 'Records', 'Pages', 'Help', 'Ask Cbox']);
        expect(within(palette).getByRole('option', { name: /Ask Cbox: “inv”/ })).toBeTruthy();
        await user.click(within(palette).getByRole('radio', { name: 'Records' }));
        expect(names()).toEqual(['Records', 'Ask Cbox']);
    });

    it('uses the app’s records search when it has one', async () => {
        const searchRecords = vi.fn(async (q: string) => [{ id: 'r1', title: `Record for ${q}`, url: '/b/r1' }]);
        const { user } = phone({ searchRecords });
        await user.click(screen.getByRole('button', { name: 'Search and commands' }));
        await user.type(screen.getByRole('combobox'), 'abc');
        expect(await screen.findByRole('option', { name: /Record for abc/ })).toBeTruthy();
        expect(searchRecords).toHaveBeenCalledWith('abc', expect.any(AbortSignal));
    });
});

describe('create sheet (V7)', () => {
    it('opens the page’s own form from “+”, with the non-production note', async () => {
        const { user } = phone({ shell: makeBillingShell({ environment: 'env_sandbox' }) });
        await user.click(screen.getByRole('button', { name: 'New invoice' }));
        const sheet = screen.getByRole('dialog', { name: 'New invoice' });
        expect(within(sheet).getByText('Creating in Sandbox, not production')).toBeTruthy();
        expect(within(sheet).getByRole('button', { name: 'Create draft' })).toBeTruthy();
        expect(within(sheet).getByRole('button', { name: 'Back to Create' })).toBeTruthy();
    });

    it('goes up to a searchable tree of everything the app can create, by area, the current one first', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: 'New invoice' }));
        await user.click(screen.getByRole('button', { name: 'Back to Create' }));
        const sheet = screen.getByRole('dialog', { name: 'Create' });
        expect(headings(sheet)).toEqual(['Billing', 'Customers', 'Catalog', 'Developers', 'Settings']);
        await user.type(within(sheet).getByRole('searchbox', { name: 'Search what to create' }), 'coup');
        expect(headings(sheet)).toEqual(['Catalog']);
        await user.click(within(sheet).getByRole('button', { name: 'Coupon' }));
        expect(screen.getByRole('dialog', { name: 'New coupon' })).toBeTruthy();
    });

    it('stacks “New customer” from the invoice, uses it there, and keeps what was typed', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: 'New invoice' }));
        let sheet = screen.getByRole('dialog', { name: 'New invoice' });
        await user.type(within(sheet).getByRole('textbox', { name: 'Due' }), 'Net 30');
        await user.click(within(sheet).getByRole('button', { name: 'New customer' }));
        sheet = screen.getByRole('dialog', { name: 'New customer' });
        expect(within(sheet).getByRole('button', { name: 'Back to Invoice' })).toBeTruthy();
        await user.click(within(sheet).getByRole('button', { name: 'Create and use in invoice' }));
        sheet = screen.getByRole('dialog', { name: 'New invoice' });
        expect(within(sheet).getByRole('button', { name: 'Hubhus ApS' })).toBeTruthy();
        expect((within(sheet).getByRole('textbox', { name: 'Due' }) as HTMLInputElement).value).toBe('Net 30');
        await user.click(within(sheet).getByRole('button', { name: 'Create draft' }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens from the palette on a desktop too, as a panel from the right', async () => {
        const { user } = renderShell({ shell: makeBillingShell(), renderCreate: renderBillingCreate });
        await user.keyboard('{Meta>}k{/Meta}');
        await user.click(await screen.findByRole('option', { name: /New credit note/ }));
        const sheet = screen.getByRole('dialog', { name: 'New credit note' });
        expect(sheet.className).toContain('cbx-sheet-right');
    });
});

describe('desktop keeps its layout (V6 shared parts)', () => {
    it('shows the environment banner only when the app says it is not live and no sandbox strip shows', () => {
        renderShell({ shell: makeBillingShell({ environment: 'env_staging' }) });
        expect(screen.getByRole('status').className).toContain('cbx-banner-env');
        reset();
        renderShell({ shell: makeShell() });
        expect(screen.queryByRole('status')).toBeNull();
    });
});

describe('phone feel: the page holds still under a sheet', () => {
    const locked = () => document.documentElement.hasAttribute('data-cbx-scroll-locked');

    it('locks while Switch app is open over More, and lets go when it closes', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: 'More' }));
        expect(locked()).toBe(false);
        await user.click(screen.getByRole('button', { name: 'Switch app' }));
        const sheet = screen.getByRole('dialog', { name: 'Switch app' });
        expect(locked()).toBe(true);
        expect(sheet.querySelector('.cbx-sheet-handle.cbx-sheet-grab')).not.toBeNull();
        expect(sheet.querySelector('.cbx-sheet-head.cbx-sheet-grab')).not.toBeNull();
        expect(sheet.querySelector('[data-cbx-sheet-scroll]')?.className).toContain('cbx-sheet-body');
        await user.click(within(sheet).getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog', { name: 'Switch app' })).toBeNull();
        expect(locked()).toBe(false);
        expect(scrollLockCount()).toBe(0);
    });

    it('holds one lock across the context sheet’s steps', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: /^Where you work/ }));
        expect(scrollLockCount()).toBe(1);
        await user.click(await screen.findByRole('button', { name: /All \d+ environments/ }));
        const step = screen.getByRole('dialog');
        expect(scrollLockCount()).toBe(1);
        await user.click(within(step).getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(scrollLockCount()).toBe(0);
    });

    it('locks for Help and the palette, and a tap on the scrim closes', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: /^Help with Invoices/ }));
        expect(locked()).toBe(true);
        await user.click(within(screen.getByRole('dialog', { name: 'Help with Invoices' })).getByRole('button', { name: 'Close Help' }));
        expect(locked()).toBe(false);
        await user.click(screen.getByRole('button', { name: 'Search and commands' }));
        expect(locked()).toBe(true);
        const scrim = document.querySelector('.cbx-palette-backdrop')!;
        await user.click(scrim);
        expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();
        expect(locked()).toBe(false);
    });

    it('does not close when a press starts in the sheet and ends on the scrim', async () => {
        const { user } = phone();
        await user.click(screen.getByRole('button', { name: 'Search and commands' }));
        const scrim = document.querySelector('.cbx-palette-backdrop')!;
        const field = screen.getByRole('combobox', { name: 'Search or ask…' });
        await user.pointer([{ keys: '[MouseLeft>]', target: field }, { target: scrim }, { keys: '[/MouseLeft]', target: scrim }]);
        expect(screen.getByRole('dialog', { name: 'Search' })).toBeTruthy();
    });
});

describe('phone: the page title is not shown twice', () => {
    it('PageHeader keeps a title equal to the top bar’s for screen readers only, and shows a different one', () => {
        phone({ page: <PageHeader title="billing " help /> });
        const shown = document.querySelector('.cbx-m-title')!.textContent!;
        expect(shown).toBe('Billing');
        const row = screen.getByRole('heading', { level: 1, name: 'billing' }).parentElement!;
        expect(row.hasAttribute('data-cbx-same-title')).toBe(true);
        reset();
        phone({ page: <PageHeader title="Invoices" /> });
        expect(screen.getByRole('heading', { level: 1, name: 'Invoices' }).parentElement!.hasAttribute('data-cbx-same-title')).toBe(false);
    });

    it('marks an app’s own heading that opts in with data-cbx-page-title', async () => {
        phone({ page: <><h1 data-cbx-page-title="">Billing</h1><h2 data-cbx-page-title="">Overdue</h2></> });
        await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Billing' }).hasAttribute('data-cbx-same-title')).toBe(true));
        expect(screen.getByRole('heading', { level: 2, name: 'Overdue' }).hasAttribute('data-cbx-same-title')).toBe(false);
    });

    it('leaves the desktop heading alone', () => {
        renderShell({ shell: makeBillingShell(), page: <PageHeader title="Billing" /> });
        expect(screen.getByRole('heading', { level: 1, name: 'Billing' }).parentElement!.hasAttribute('data-cbx-same-title')).toBe(false);
    });
});
