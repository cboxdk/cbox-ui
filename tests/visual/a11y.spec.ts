import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * axe on every open state of the shell (spec §12.2), light and dark: the menus, the palette,
 * Help, the app grid, the account menu and the phone sheets. A violation fails the run.
 */

async function open(page: Page, theme: 'light' | 'dark', query = ''): Promise<void> {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto(`/?theme=${theme}${query}`);
    await page.locator('.cbx-shell').waitFor();
    await page.waitForLoadState('networkidle');
}

async function audit(page: Page): Promise<void> {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).exclude('.fixture-page').analyze();
    const found = result.violations.map(violation => `${violation.id}: ${violation.help}\n  ${violation.nodes.map(node => node.target.join(' ')).join('\n  ')}`);
    expect(found, found.join('\n')).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
    test.describe(`axe ${theme}`, () => {
        test('closed', async ({ page }) => {
            await open(page, theme);
            await audit(page);
        });

        test('skip link and a subnav with groups, a count and a locked page', async ({ page, isMobile }) => {
            await open(page, theme, '&nav=settings');
            await page.keyboard.press('Tab');
            await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
            await audit(page);
            await page.getByRole('link', { name: 'Skip to content' }).blur();
            if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click();
            await expect(page.getByRole('link', { name: 'Single sign-on (locked)' })).toBeVisible();
            await audit(page);
        });

        test('banners beside the sandbox strip and a locked rail area', async ({ page, isMobile }) => {
            await open(page, theme, '&sandbox=1&banners=1&locked=1');
            await expect(page.getByRole('status')).toHaveCount(2);
            await audit(page);
            if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click();
            else await page.getByRole('link', { name: 'Analytics (locked)' }).hover();
            await expect(page.getByRole('link', { name: 'Analytics (locked)' })).toBeVisible();
            await audit(page);
        });

        test('palette', async ({ page }) => {
            await open(page, theme);
            await page.getByRole('button', { name: 'Search or ask…' }).click();
            await page.getByRole('combobox', { name: 'Search or ask…' }).fill('deploy');
            await expect(page.getByRole('option', { name: /Deployment 3f9c21a/ })).toBeVisible();
            await audit(page);
        });

        test('help', async ({ page }) => {
            await open(page, theme);
            await page.getByRole('button', { name: /^Help/ }).click();
            await expect(page.getByRole('button', { name: /Deploy stuck/ })).toBeVisible();
            await audit(page);
        });

        test.describe('desktop', () => {
            test.skip(({ isMobile }) => isMobile, 'The phone opens these as sheets.');

            test('organization menu', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('button', { name: 'Organization: Cbox' }).click();
                await expect(page.getByRole('option', { name: /Acme ApS/ })).toBeVisible();
                await audit(page);
            });

            test('cascade', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('button', { name: /Project: Webshop/ }).click();
                await expect(page.getByRole('option', { name: /Preview/ })).toBeVisible();
                await audit(page);
            });

            test('app switcher', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('button', { name: 'Switch app' }).click();
                await expect(page.getByRole('region', { name: 'More from Cbox' })).toBeVisible();
                await audit(page);
            });

            test('account menu', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('button', { name: 'Account and preferences' }).click();
                await expect(page.getByRole('menu', { name: 'Account' })).toBeVisible();
                await audit(page);
            });
        });

        test.describe('phone', () => {
            test.skip(({ isMobile }) => !isMobile, 'Desktop opens these as menus.');

            test('context sheet', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('button', { name: /Where you are/ }).click();
                await expect(page.getByRole('dialog', { name: 'Where you are' }).getByRole('option', { name: /Sandbox/ })).toBeVisible();
                await audit(page);
            });

            test('navigation sheet', async ({ page }) => {
                await open(page, theme);
                await page.getByRole('button', { name: 'Open navigation' }).click();
                await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeAttached();
                await audit(page);
            });
        });
    });
}
