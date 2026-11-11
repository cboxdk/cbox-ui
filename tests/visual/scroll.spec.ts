import { expect, test } from '@playwright/test';

/**
 * The document scrolls, not a box inside the shell, so Inertia resets the scroll on a new page and
 * restores it on back and forward, and a full-page screenshot shows the whole page. The rail, the
 * header and the subnav stay in view while the page scrolls.
 */
for (const theme of ['light', 'dark'] as const) {
    test(`${theme}: the document scrolls under a sticky header and rail`, async ({ page, isMobile }) => {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.goto(`/?theme=${theme}&long=1`);
        await page.locator('.cbx-shell').waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForLoadState('networkidle');

        const scrolls = await page.evaluate(() => ({
            document: document.documentElement.scrollHeight > window.innerHeight,
            main: getComputedStyle(document.querySelector('main')!).overflowY,
        }));
        expect(scrolls).toEqual({ document: true, main: 'visible' });

        await page.evaluate(() => window.scrollTo(0, 900));
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(900);
        expect((await page.locator(isMobile ? '.cbx-m-chrome > .cbx-m-bar' : '.cbx-header').boundingBox())!.y).toBe(0);
        if (!isMobile) {
            expect((await page.locator('.cbx-rail').boundingBox())!.y).toBe(6);
            expect((await page.locator('.cbx-subnav').boundingBox())!.y).toBe(56);
        }
        await expect(page).toHaveScreenshot(`${theme}-scrolled.png`);

        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(page).toHaveScreenshot(`${theme}-long-page.png`, { fullPage: true });
    });
}
