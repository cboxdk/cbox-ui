// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://app.test/orgs/cbox/projects/webshop/environments/production/deployments"}
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderShell, reset } from './testing/harness';
import { makeShell } from './testing/fixture';
import { groupPages, navUrl } from './nav-pages';
import type { NavArea, Shell } from './types';

afterEach(reset);

/** A shell whose active area is Settings, with the pages given. */
function settingsShell(pages: NonNullable<NavArea['pages']>, activePage?: string): Shell {
    const shell = makeShell();
    shell.nav = {
        areas: [...shell.nav.areas.filter(area => area.key !== 'settings'), { key: 'settings', label: 'Settings', url: pages[0]!.url, icon: 'settings', pages }],
        activeArea: 'settings',
        activePage,
    };
    return shell;
}

const PAGES: NonNullable<NavArea['pages']> = [
    { key: 'settings.general', label: 'General', url: '/orgs/cbox/settings', group: 'Organization' },
    { key: 'settings.members', label: 'Members', url: '/orgs/cbox/settings/members', group: 'Organization', count: 4 },
    { key: 'settings.project', label: 'Project', url: '/orgs/cbox/projects/webshop/settings', group: 'Project' },
    { key: 'settings.sso', label: 'Single sign-on', url: '/orgs/cbox/upgrade?feature=sso', group: 'Organization', locked: true },
    { key: 'settings.keys', label: 'API keys', url: '/orgs/cbox/projects/webshop/environments/production/keys', group: 'Environment' },
];

describe('skip link (§12.2)', () => {
    it('is the first focusable element, and moves focus to <main>', async () => {
        const { user } = renderShell();
        const skip = screen.getByRole('link', { name: 'Skip to content' });
        await user.tab();
        expect(document.activeElement).toBe(skip);
        expect(skip.getAttribute('href')).toBe('#main-content');
        await user.keyboard('{Enter}');
        const main = screen.getByRole('main');
        expect(main.id).toBe('main-content');
        expect(document.activeElement).toBe(main);
    });

    it('comes first in the shell', () => {
        const shell = makeShell();
        const { container } = renderShell({ shell });
        expect(container.querySelector('.cbx-shell')!.firstElementChild!.classList.contains('cbx-skip-link')).toBe(true);
    });
});

describe('rail lock', () => {
    const allLocked: NonNullable<NavArea['pages']> = [
        { key: 'analytics.mrr', label: 'MRR', url: '/orgs/cbox/upgrade?feature=analytics', locked: true },
        { key: 'analytics.churn', label: 'Churn', url: '/orgs/cbox/upgrade?feature=analytics', locked: true },
    ];

    function lockedShell(pages: NonNullable<NavArea['pages']>): Shell {
        const shell = makeShell();
        shell.nav.areas = [...shell.nav.areas, { key: 'analytics', label: 'Analytics', url: pages[0]!.url, icon: 'chart', pages }];
        return shell;
    }

    it('locks a rail area whose pages are all locked, with an accessible label', () => {
        renderShell({ shell: lockedShell(allLocked) });
        const rail = screen.getByRole('complementary', { name: 'Main navigation' });
        const link = within(rail).getByRole('link', { name: 'Analytics (locked)' });
        expect(link.getAttribute('data-locked')).toBe('true');
        expect(link.querySelector('.cbx-rail-lock svg')).not.toBeNull();
        expect(within(rail).getByRole('link', { name: 'Overview' }).getAttribute('data-locked')).toBeNull();
    });

    it('leaves the rail item unlocked while one page is open', () => {
        renderShell({ shell: lockedShell([allLocked[0]!, { key: 'analytics.usage', label: 'Usage', url: '/orgs/cbox/usage' }]) });
        const rail = screen.getByRole('complementary', { name: 'Main navigation' });
        expect(within(rail).getByRole('link', { name: 'Analytics' }).getAttribute('data-locked')).toBeNull();
        expect(within(rail).queryByRole('link', { name: 'Analytics (locked)' })).toBeNull();
    });

    it('shows the lock on the area in the phone nav too', async () => {
        const { user } = renderShell({ shell: lockedShell(allLocked), environment: { width: 390, pointer: 'coarse' } });
        await user.click(screen.getByRole('button', { name: 'Open navigation' }));
        const sheet = screen.getByRole('dialog', { name: 'Cbox · Infra' });
        expect(within(sheet).getByRole('link', { name: 'Analytics (locked)' })).toBeTruthy();
    });
});

describe('nav pages: locked, counts and groups', () => {
    it('marks a locked page with a lock and an accessible "(locked)", leading to its upgrade url', () => {
        renderShell({ shell: settingsShell(PAGES, 'settings.general') });
        const subnav = screen.getByRole('navigation', { name: 'Settings' });
        const locked = within(subnav).getByRole('link', { name: 'Single sign-on (locked)' });
        expect(locked.getAttribute('href')).toBe('/orgs/cbox/upgrade?feature=sso');
        expect(locked.getAttribute('data-locked')).toBe('true');
        expect(locked.querySelector('.cbx-nav-lock svg')).not.toBeNull();
        expect(within(subnav).getByRole('link', { name: 'General' }).getAttribute('data-locked')).toBeNull();
    });

    it('shows a count badge, never on a locked page and never for 0', () => {
        const pages = [...PAGES, { key: 'settings.drafts', label: 'Drafts', url: '/orgs/cbox/drafts', count: 0 }];
        renderShell({ shell: settingsShell(pages, 'settings.general') });
        const subnav = screen.getByRole('navigation', { name: 'Settings' });
        expect(within(subnav).getByRole('link', { name: 'Members 4' }).querySelector('.cbx-nav-count')!.textContent).toBe('4');
        expect(within(subnav).getByRole('link', { name: 'Drafts' }).querySelector('.cbx-nav-count')).toBeNull();
    });

    it('puts the pages under their group headings, each group together', () => {
        renderShell({ shell: settingsShell(PAGES, 'settings.general') });
        const subnav = screen.getByRole('navigation', { name: 'Settings' });
        const groups = within(subnav).getAllByRole('group');
        expect(groups.map(group => group.getAttribute('aria-labelledby')).map(id => document.getElementById(id!)!.textContent)).toEqual(['Organization', 'Project', 'Environment']);
        expect(within(groups[0]!).getAllByRole('link').map(link => link.textContent)).toEqual(['General', 'Members4', 'Single sign-on(locked)']);
    });

    it('renders the same marks and groups in the phone nav', async () => {
        const { user } = renderShell({ shell: settingsShell(PAGES, 'settings.general'), environment: { width: 390, pointer: 'coarse' } });
        await user.click(screen.getByRole('button', { name: 'Open navigation' }));
        const sheet = screen.getByRole('dialog');
        expect(within(sheet).getByRole('link', { name: 'Single sign-on (locked)' }).getAttribute('href')).toBe('/orgs/cbox/upgrade?feature=sso');
        expect(within(sheet).getByRole('link', { name: 'Members 4' })).toBeTruthy();
        expect(within(sheet).getByRole('group', { name: 'Project' })).toBeTruthy();
    });

    it('renders no group markup for an area without groups', () => {
        renderShell();
        const subnav = screen.getByRole('navigation', { name: 'Deploy' });
        expect(within(subnav).queryAllByRole('group')).toHaveLength(0);
        expect(within(subnav).getAllByRole('link')).toHaveLength(3);
    });

    it('finds a locked page in the palette, and says it is locked', async () => {
        const { user } = renderShell({ shell: settingsShell(PAGES, 'settings.general') });
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        await user.type(screen.getByRole('combobox'), 'sign-on');
        const option = await screen.findByRole('option', { name: /Single sign-on/ });
        expect(option.textContent).toContain('Settings · Locked');
    });

    it('groups pages in the order each group first appears', () => {
        expect(groupPages(PAGES).map(run => `${run.group}: ${run.pages.map(page => page.label).join(', ')}`)).toEqual([
            'Organization: General, Members, Single sign-on',
            'Project: Project',
            'Environment: API keys',
        ]);
    });
});

describe('laravel-console-kit 0.2 links', () => {
    it('reads `href` when a nav entry or the banner action has no `url`', () => {
        const shell = makeShell({ banner: { kind: 'notice', text: 'Trial ends soon', action: { label: 'Upgrade', href: '/orgs/cbox/upgrade' } as unknown as { label: string; url: string } } });
        shell.nav.areas = shell.nav.areas.map(area => ({ ...area, url: undefined, href: area.url, pages: area.pages?.map(page => ({ ...page, url: undefined, href: page.url })) }) as unknown as NavArea);
        renderShell({ shell });
        expect(screen.getByRole('link', { name: 'Servers' }).getAttribute('href')).toBe('/orgs/cbox/servers');
        expect(within(screen.getByRole('navigation', { name: 'Deploy' })).getByRole('link', { name: 'Releases' }).getAttribute('href')).toBe('/orgs/cbox/projects/webshop/environments/production/releases');
        expect(screen.getByRole('link', { name: 'Upgrade' }).getAttribute('href')).toBe('/orgs/cbox/upgrade');
        expect(navUrl({})).toBe('#');
    });
});

describe('palette placeholder', () => {
    it('uses the app\'s placeholder, else "Search or ask…"', async () => {
        const shell = makeShell();
        shell.palette.placeholder = 'Search customers, invoices… or pages';
        const { user } = renderShell({ shell });
        await user.click(screen.getByRole('button', { name: 'Search or ask…' }));
        const field = screen.getByRole('combobox', { name: 'Search customers, invoices… or pages' });
        expect(field.getAttribute('placeholder')).toBe('Search customers, invoices… or pages');
    });
});

describe('account menu without links (laravel-console-kit 0.2.2)', () => {
    it('opens with only the preferences when `account` is absent', async () => {
        const shell = makeShell();
        delete (shell as Partial<Shell>).account;
        const { user } = renderShell({ shell });
        await user.click(screen.getByRole('button', { name: 'Account and preferences' }));
        const menu = screen.getByRole('menu', { name: 'Account' });
        expect(within(menu).getByRole('menuitem', { name: /Language/ })).toBeTruthy();
        expect(within(menu).queryByRole('menuitem', { name: /Profile and security/ })).toBeNull();
        expect(within(menu).queryByRole('menuitem', { name: 'Switch account' })).toBeNull();
        expect(within(menu).queryByRole('menuitem', { name: 'Sign out' })).toBeNull();
        expect(within(menu).getByText('Signed in with Cbox ID')).toBeTruthy();
    });

    it('shows only the rows whose URL it has', async () => {
        const shell = makeShell({ account: { signOutUrl: '/logout' } });
        const { user, navigate } = renderShell({ shell });
        await user.click(screen.getByRole('button', { name: 'Account and preferences' }));
        const menu = screen.getByRole('menu', { name: 'Account' });
        expect(within(menu).queryByRole('menuitem', { name: 'Switch account' })).toBeNull();
        await user.click(within(menu).getByRole('menuitem', { name: 'Sign out' }));
        expect(navigate).toHaveBeenCalledWith('/logout', { method: 'post' });
    });
});
