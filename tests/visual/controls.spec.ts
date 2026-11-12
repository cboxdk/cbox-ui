import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The form controls in every state and the Dialog over them, light and dark, at 1440 and 390:
 * snapshots, axe, and the Dialog's keyboard (focus in, Tab kept inside, Escape, focus back).
 */

async function open(page: Page, theme: 'light' | 'dark', query = ''): Promise<void> {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto(`/?theme=${theme}&controls=1${query}`);
    await page.locator('.fixture-controls').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle');
}

async function audit(page: Page): Promise<void> {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).include('.fixture-controls').analyze();
    const found = result.violations.map(violation => `${violation.id}: ${violation.help}\n  ${violation.nodes.map(node => node.target.join(' ')).join('\n  ')}`);
    expect(found, found.join('\n')).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
    test.describe(`controls ${theme}`, () => {
        test('every state', async ({ page }) => {
            await open(page, theme);
            await audit(page);
            // The sticky header (the phone's bar too) and the skip link would be drawn over a capture that scrolls.
            await page.addStyleTag({ content: '.cbx-header, .cbx-m-bar, .cbx-skip-link { visibility: hidden; }' });
            await expect(page.locator('.fixture-controls')).toHaveScreenshot(`${theme}-controls.png`);
        });

        test('dialog', async ({ page }) => {
            await open(page, theme, '&dialog=1');
            const dialog = page.getByRole('dialog', { name: 'Delete project' });
            await expect(dialog).toBeVisible();
            await expect(page.getByRole('textbox', { name: 'Type the project name to confirm' })).toBeFocused();
            await audit(page);
            await expect(page).toHaveScreenshot(`${theme}-dialog.png`);
        });
    });
}

test('dialog keyboard: Tab stays inside, Escape closes and focus goes back', async ({ page }) => {
    await open(page, 'light');
    const opener = page.getByRole('button', { name: 'New project' });
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Delete project' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Type the project name to confirm' })).toBeFocused();
    // Field, Cancel, Delete project, Close, and round again.
    for (let step = 0; step < 6; step++) {
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
});
