import { expect, test } from '@playwright/test';

/**
 * The context switcher from the keyboard, in a real browser (spec §12.2): focus moves into the
 * menu when it opens, ↓ on a trigger opens it, Esc closes it and gives focus back to the trigger.
 * jsdom ignores `visibility`, so these are checked here and not in the unit tests.
 */
test.describe('context switcher keyboard', () => {
    test.skip(({ isMobile }) => isMobile, 'The phone opens the context sheet instead.');

    test.beforeEach(async ({ page }) => {
        await page.goto('/?theme=light');
        await page.locator('.cbx-shell').waitFor();
    });

    test('focus moves into the organization menu when it opens', async ({ page }) => {
        await page.getByRole('button', { name: 'Organization: Cbox' }).click();
        await expect(page.getByRole('combobox', { name: 'Search organizations' })).toBeFocused();
    });

    test('↓ on a trigger opens its menu with focus inside', async ({ page }) => {
        const trigger = page.getByRole('button', { name: 'Organization: Cbox' });
        await trigger.focus();
        await page.keyboard.press('ArrowDown');
        await expect(page.getByRole('dialog', { name: 'Organization' })).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Search organizations' })).toBeFocused();

        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog', { name: 'Organization' })).toHaveCount(0);
        await expect(trigger).toBeFocused();
    });

    test('the cascade opens on ↓ and Esc returns to its trigger', async ({ page }) => {
        const trigger = page.getByRole('button', { name: /Project: Webshop/ });
        await trigger.focus();
        await page.keyboard.press('ArrowDown');
        await expect(page.getByRole('combobox', { name: 'Search projects' })).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
    });

    test('Esc on the trigger of an open menu closes it', async ({ page }) => {
        const trigger = page.getByRole('button', { name: 'Organization: Cbox' });
        await trigger.click();
        await trigger.focus();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog', { name: 'Organization' })).toHaveCount(0);
        await expect(trigger).toBeFocused();
    });
});
