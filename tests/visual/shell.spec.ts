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

        test('sandbox strip', async ({ page }) => {
            await open(page, theme, '&sandbox=1');
            await expect(page.getByRole('status').filter({ hasText: 'Sandbox: test data only' })).toBeVisible();
            await settle(page);
            await expect(page).toHaveScreenshot(`${theme}-sandbox-strip.png`);
        });

        test('palette', async ({ page }, info) => {
            await open(page, theme);
            await page.getByRole('button', { name: 'Search or ask…' }).click();
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
            await page.locator('#cbx-help input[type=search]').blur();
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

        test.describe('phone sheets', () => {
            test.skip(({ isMobile }) => !isMobile, 'Desktop opens these as menus.');

            test('context sheet (organization and cascade)', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('button', { name: /Where you are/ }).click();
                const sheet = page.getByRole('dialog', { name: 'Where you are' });
                await expect(sheet.getByRole('option', { name: /Acme ApS/ })).toBeVisible();
                await expect(sheet.getByRole('option', { name: /Sandbox/ })).toBeVisible();
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-context-sheet.png`);
            });

            test('navigation sheet with the account', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('button', { name: 'Open navigation' }).click();
                await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeAttached();
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-nav-sheet.png`);
                await page.getByRole('menuitem', { name: 'Sign out' }).scrollIntoViewIfNeeded();
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-account-menu.png`);
            });

            test('navigation sheet with groups, a count and a locked page', async ({ page }) => {
                await open(page, theme, '&nav=settings');
                await page.getByRole('button', { name: 'Open navigation' }).click();
                await expect(page.getByRole('link', { name: 'Single sign-on (locked)' })).toBeVisible();
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-nav-sheet-groups.png`);
            });

            test('app switcher', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('button', { name: 'Open navigation' }).click();
                await page.getByRole('button', { name: 'Switch app' }).click();
                await expect(page.getByRole('region', { name: 'More from Cbox' })).toBeVisible();
                await settle(page);
                await expect(page).toHaveScreenshot(`${theme}-app-switcher.png`);
            });
        });
    });
}
