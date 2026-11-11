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
            if (isMobile) {
                await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'More' }).click();
                await page.getByRole('button', { name: /^Settings/ }).click();
            }
            await expect(page.getByRole('link', { name: 'Single sign-on (locked)' })).toBeVisible();
            await audit(page);
        });

        test('banners beside the sandbox strip and a locked rail area', async ({ page, isMobile }) => {
            await open(page, theme, '&sandbox=1&banners=1&locked=1');
            await expect(page.getByRole('status')).toHaveCount(2);
            await audit(page);
            if (isMobile) {
                await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'More' }).click();
                await expect(page.getByRole('button', { name: /Analytics \(locked\)/ })).toBeVisible();
            } else {
                await page.getByRole('link', { name: 'Analytics (locked)' }).hover();
                await expect(page.getByRole('link', { name: 'Analytics (locked)' })).toBeVisible();
            }
            await audit(page);
        });

        test('palette', async ({ page, isMobile }) => {
            await open(page, theme);
            await page.getByRole('button', { name: isMobile ? 'Search and commands' : 'Search or ask…' }).click();
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
            const more = (page: Page) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'More' }).click();

            test('context sheet, its levels and every environment', async ({ page }) => {
                await open(page, theme, '&fixture=billing');
                await page.getByRole('button', { name: /Where you work/ }).click();
                await expect(page.getByRole('button', { name: 'All 7 environments' })).toBeVisible();
                await audit(page);
                await page.getByRole('button', { name: 'All 7 environments' }).click();
                await expect(page.getByText('Dev · sylvester')).toBeVisible();
                await audit(page);
                await page.getByRole('button', { name: 'Back' }).click();
                await page.getByRole('button', { name: /Organization Cbox/ }).click();
                await expect(page.getByRole('option', { name: /Sheila/ })).toBeVisible();
                await audit(page);
            });

            test('more, an area and the account', async ({ page }) => {
                await open(page, theme, '&fixture=billing&env=env_sandbox');
                await audit(page);
                await more(page);
                await audit(page);
                await page.getByRole('button', { name: /^Developers/ }).click();
                await audit(page);
                await more(page);
                await page.getByRole('button', { name: /Sylvester Damgaard/ }).click();
                await audit(page);
            });

            test('help sheet and an article', async ({ page }) => {
                await open(page, theme, '&fixture=billing');
                await page.getByRole('button', { name: /^Help with Invoices/ }).click();
                await expect(page.getByText('How dunning retries work')).toBeVisible();
                await audit(page);
                await page.getByRole('button', { name: 'Send an invoice and get paid' }).click();
                await audit(page);
            });

            test('palette sheet and the create sheet', async ({ page }) => {
                await open(page, theme, '&fixture=billing');
                await page.getByRole('button', { name: 'Search and commands' }).click();
                await expect(page.getByRole('option', { name: /Switch to Staging/ })).toBeVisible();
                await audit(page);
                await page.getByRole('button', { name: 'Cancel' }).click();
                await page.getByRole('button', { name: 'New invoice' }).click();
                await audit(page);
                await page.getByRole('button', { name: 'New customer' }).click();
                await audit(page);
                await page.getByRole('button', { name: 'Back to Invoice' }).click();
                await page.getByRole('button', { name: 'Back to Create' }).click();
                await audit(page);
            });
        });
    });
}
