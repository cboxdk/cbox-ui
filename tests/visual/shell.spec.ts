import { expect, test, type Page } from '@playwright/test';

/**
 * Every open state of the shell (spec §12.3), in light and dark. Desktop opens menus from their
 * triggers; the phone opens the same content from its sheets.
 */

type Theme = 'light' | 'dark';

async function open(page: Page, theme: Theme, query = ''): Promise<void> {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto(`/?theme=${theme}${query}`);
    await page.locator('.cbx-shell').waitFor();
    await page.evaluate(() => document.fonts.ready);
}

async function settle(page: Page): Promise<void> {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

for (const theme of ['light', 'dark'] as const) {
    test.describe(`${theme}`, () => {
        test('closed', async ({ page }) => {
            await open(page, theme);
            await settle(page);
            await expect(page).toHaveScreenshot(`${theme}-closed.png`);
        });

        test('sandbox strip', async ({ page, isMobile }) => {
            await open(page, theme, '&sandbox=1');
            // The phone says it once, in the environment banner under the title.
            await expect(page.getByRole('status').filter({ hasText: isMobile ? 'Sandbox. Not production' : 'Sandbox: test data only' })).toBeVisible();
            await settle(page);
            await expect(page).toHaveScreenshot(`${theme}-sandbox-strip.png`);
        });

        test('banners and a locked area', async ({ page, isMobile }) => {
            await open(page, theme, '&sandbox=1&banners=1&locked=1');
            await expect(page.getByRole('status')).toHaveCount(2);
            if (!isMobile) await expect(page.getByRole('link', { name: 'Analytics (locked)' })).toBeVisible();
            await settle(page);
            await expect(page).toHaveScreenshot(`${theme}-banners-locked-area.png`);
        });

        test('palette', async ({ page }, info) => {
            await open(page, theme);
            await page.getByRole('button', { name: info.project.name === 'mobile' ? 'Search and commands' : 'Search or ask…' }).click();
            await page.getByRole('combobox', { name: 'Search or ask…' }).fill('deploy');
            await expect(page.getByRole('option', { name: /Deploy a project/ })).toBeVisible();
            await expect(page.getByRole('option', { name: /Deployment 3f9c21a/ })).toBeVisible();
            if (info.project.name === 'mobile') await page.getByRole('combobox', { name: 'Search or ask…' }).blur();
            await settle(page);
            await expect(page).toHaveScreenshot(`${theme}-palette.png`);
        });

        test('skip link focused', async ({ page }) => {
            await open(page, theme);
            await page.keyboard.press('Tab');
            await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
            await settle(page);
            await expect(page).toHaveScreenshot(`${theme}-skip-link.png`);
        });

        test('help with updates', async ({ page }) => {
            await open(page, theme);
            await page.getByRole('button', { name: /^Help/ }).click();
            await expect(page.getByRole('button', { name: /Deploy stuck/ })).toBeVisible();
            await expect(page.getByRole('button', { name: /Roll back a deployment/ })).toBeVisible();
            await page.locator('#cbx-help input').first().blur();
            await settle(page);
            await expect(page).toHaveScreenshot(`${theme}-help.png`);
        });

        test.describe('desktop menus', () => {
            test.skip(({ isMobile }) => isMobile, 'The phone opens these as sheets.');

            test('organization menu', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('button', { name: 'Organization: Cbox' }).click();
                await expect(page.getByRole('option', { name: /Acme ApS/ })).toBeVisible();
                await page.getByRole('option', { name: /Acme ApS/ }).hover();
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-org-menu.png`);
            });

            test('cascade', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('button', { name: /Project: Webshop/ }).click();
                await page.getByRole('option', { name: /Status page/ }).hover();
                await expect(page.getByText('Environments in Status page')).toBeVisible();
                await expect(page.getByRole('option', { name: /Staging/ })).toBeVisible();
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-cascade.png`);
            });

            test('app switcher', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('button', { name: 'Switch app' }).click();
                await expect(page.getByRole('region', { name: 'More from Cbox' })).toBeVisible();
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-app-switcher.png`);
            });

            test('account menu', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('button', { name: 'Account and preferences' }).click();
                await expect(page.getByRole('menu', { name: 'Account' })).toBeVisible();
                await page.mouse.move(700, 450);
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-account-menu.png`);
            });

            test('subnav with groups, a count and a locked page', async ({ page }) => {
                await open(page, theme, '&nav=settings');
                await expect(page.getByRole('link', { name: 'Single sign-on (locked)' })).toBeVisible();
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-subnav-groups.png`);
            });

            test('help left open on load', async ({ page }) => {
                // Another page than the "help with updates" state: Help is docked, untouched (no
                // focus, no search), and "On this page" follows the page.
                await open(page, theme, '&help=1&page=releases');
                await expect(page.getByRole('complementary', { name: 'Help' })).toBeVisible();
                await expect(page.getByRole('complementary', { name: 'Help' }).getByText('Releases')).toBeVisible();
                await expect(page.getByRole('button', { name: /Deploy stuck/ })).toBeVisible();
                await page.mouse.move(700, 450);
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-help-open-on-load.png`);
            });

            test('help left open, on a narrow window', async ({ page }) => {
                // Below 1280px Help left open waits for the person: the page is not covered.
                await page.setViewportSize({ width: 1100, height: 800 });
                await open(page, theme, '&help=1');
                await expect(page.getByRole('button', { name: /^Help/ })).toHaveAttribute('aria-pressed', 'false');
                await expect(page.locator('#cbx-help')).toBeHidden();
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-help-left-open-narrow.png`);
            });
        });

        test.describe('phone (V6)', () => {
            test.skip(({ isMobile }) => !isMobile, 'Desktop opens these as menus.');

            test('context sheet', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('button', { name: /Where you work/ }).click();
                const sheet = page.getByRole('dialog', { name: 'Where you work' });
                await expect(sheet.getByRole('button', { name: /All 3 environments/ })).toBeVisible();
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-context-sheet.png`);
            });

            test('more', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'More' }).click();
                await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-more.png`);
            });

            test('more with a locked area and grouped settings', async ({ page }) => {
                await open(page, theme, '&nav=settings&locked=1');
                await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'More' }).click();
                await page.getByRole('button', { name: /^Settings/ }).click();
                await expect(page.getByRole('link', { name: 'Single sign-on (locked)' })).toBeVisible();
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-more-settings.png`);
            });

            test('app switcher', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'More' }).click();
                await page.getByRole('button', { name: 'Switch app' }).click();
                await expect(page.getByRole('region', { name: 'More from Cbox' })).toBeVisible();
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-app-switcher.png`);
            });
        });

        // The Billing-shaped app of the V6/V7 mockups: about sixty pages, seven environments, create.
        test.describe('billing (V6, V7)', () => {
            const billing = (query = '') => `&fixture=billing${query}`;
            const more = (page: Page) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'More' }).click();
            const states: Array<{ name: string; query?: string; mobile?: boolean; act: (page: Page) => Promise<void> }> = [
                { name: 'area', act: async page => { await expect(page.getByText('INV-2026-0142')).toBeVisible(); } },
                { name: 'area-not-live', query: '&env=env_sandbox', mobile: true, act: async page => { await expect(page.getByRole('status')).toContainText('Not production'); } },
                { name: 'more-root', mobile: true, act: async page => { await more(page); await page.evaluate(() => window.scrollTo(0, 10000)); await expect(page.getByRole('button', { name: /Sylvester Damgaard/ })).toBeInViewport(); } },
                { name: 'more-area', mobile: true, act: async page => { await more(page); await page.getByRole('button', { name: /^Developers/ }).click(); await expect(page.getByRole('heading', { name: 'Developers' })).toBeVisible(); } },
                { name: 'account', mobile: true, act: async page => { await more(page); await page.getByRole('button', { name: /Sylvester Damgaard/ }).click(); await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible(); } },
                { name: 'context-root', mobile: true, act: async page => { await page.getByRole('button', { name: /Where you work/ }).click(); await expect(page.getByRole('button', { name: 'All 7 environments' })).toBeVisible(); } },
                { name: 'environments', mobile: true, act: async page => { await page.getByRole('button', { name: /Where you work/ }).click(); await page.getByRole('button', { name: 'All 7 environments' }).click(); await expect(page.getByText('Dev · sylvester')).toBeVisible(); } },
                { name: 'help-sheet', mobile: true, act: async page => { await page.getByRole('button', { name: /^Help with Invoices/ }).click(); await expect(page.getByText('How dunning retries work')).toBeVisible(); await expect(page.getByText('Dunning on Hubhus ApS')).toBeVisible(); } },
                { name: 'palette-empty', act: async page => { await page.keyboard.press('Control+k'); await expect(page.getByRole('option', { name: /Switch to Staging/ })).toBeVisible(); await page.locator('.cbx-palette input').blur(); } },
                { name: 'palette-inv', act: async page => { await page.keyboard.press('Control+k'); await page.getByRole('combobox').fill('inv'); await expect(page.getByRole('option', { name: /INV-2026-0142/ }).first()).toBeVisible(); await expect(page.getByRole('option', { name: /Send an invoice/ })).toBeVisible(); await page.getByRole('combobox').blur(); } },
                { name: 'create-invoice', query: '&env=env_sandbox', act: async page => { await page.keyboard.press('Control+k'); await page.getByRole('option', { name: /New invoice/ }).click(); await expect(page.getByRole('button', { name: 'Create draft' })).toBeVisible(); } },
                { name: 'create-tree', act: async page => { await page.keyboard.press('Control+k'); await page.getByRole('option', { name: /New invoice/ }).click(); await page.getByRole('button', { name: 'Back to Create' }).click(); await expect(page.getByRole('searchbox', { name: 'Search what to create' })).toBeVisible(); } },
                { name: 'create-stacked', act: async page => { await page.keyboard.press('Control+k'); await page.getByRole('option', { name: /New invoice/ }).click(); await page.getByRole('button', { name: 'New customer' }).click(); await expect(page.getByRole('button', { name: 'Create and use in invoice' })).toBeVisible(); } },
            ];
            for (const state of states) {
                test(state.name, async ({ page, isMobile }) => {
                    test.skip(state.mobile === true && !isMobile, 'A phone screen.');
                    await open(page, theme, billing(state.query));
                    await state.act(page);
                    await settle(page);
                    await expect(page).toHaveScreenshot(`${theme}-billing-${state.name}.png`);
                });
            }
        });
    });
}
