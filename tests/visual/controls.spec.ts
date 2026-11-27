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

        test('confirmation without a body keeps actions at the bottom', async ({ page }) => {
            await open(page, theme, '&dialog=1&confirmation=1');
            const dialog = page.getByRole('dialog', { name: 'Delete project' });
            const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
            const remove = dialog.getByRole('button', { name: 'Delete project', exact: true });
            await expect(cancel).toBeVisible();
            await expect(remove).toBeVisible();
            const panel = (await dialog.boundingBox())!;
            for (const button of [cancel, remove]) {
                const box = (await button.boundingBox())!;
                expect(panel.y + panel.height - box.y - box.height).toBeLessThan(24);
                expect(box.y).toBeGreaterThan(panel.y);
            }
            await cancel.click();
            await expect(dialog).toHaveCount(0);
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

test('a stacked sheet dims the xl sheet underneath it, not only the page', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'a phone shows one sheet at a time');
    await page.emulateMedia({ reducedMotion: 'reduce' }); // measure the panels where they rest, not mid-slide
    await page.goto('/?theme=light&controls=1&stacked=1');
    const under = page.getByRole('dialog', { name: 'Transform' });
    const top = page.getByRole('dialog', { name: 'Focal point' });
    await expect(top).toBeVisible();
    const wide = (await under.boundingBox())!;
    const narrow = (await top.boundingBox())!;
    expect(wide.width).toBeGreaterThan(narrow.width + 300);
    // The part of the wide sheet left uncovered must be dimmed by the top sheet's scrim; the snapshot
    // shows it (a hit test cannot: the sheet underneath is inert, so it is skipped either way).
    await expect(page).toHaveScreenshot('light-stacked-sheets.png');
});
