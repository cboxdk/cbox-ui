import { expect, test } from '@playwright/test';

/** The bar, stacked-bar and waterfall charts in the chart tokens, light and dark. */
for (const theme of ['light', 'dark'] as const) {
    test(`${theme} charts`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.goto(`/?theme=${theme}&charts=1`);
        await page.locator('.cbx-shell').waitFor();
        await expect(page.locator('.fixture-chart svg')).toHaveCount(4);
        // Every chart has drawn its bars.
        for (const chart of await page.locator('.fixture-chart').all()) {
            await expect(chart.locator('path').first()).toBeAttached();
        }
        await page.evaluate(() => document.fonts.ready);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(300);
        await expect(page.locator('.fixture-charts')).toHaveScreenshot(`${theme}-charts.png`);
    });
}
