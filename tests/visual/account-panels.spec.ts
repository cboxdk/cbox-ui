import { expect, test } from '@playwright/test';

/**
 * The account menu's language, regional format and time zone panels: the back row, the search and
 * the options are all in view when the panel opens, at full height, from the account button at the
 * bottom of the rail.
 */
for (const [row, list] of [['Language', 'Language'], ['Regional format', 'Regional format'], ['Time zone', 'Time zone']] as const) {
    test(`account menu: the ${row} panel shows its back row, search and options`, async ({ page, isMobile }) => {
        test.skip(isMobile, 'the phone opens the account in a sheet');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/?theme=dark');
        await page.locator('.cbx-shell').waitFor();
        await page.getByRole('button', { name: 'Account and preferences' }).click();
        await page.getByRole('menuitem', { name: new RegExp(`^${row}`) }).click();
        const listbox = page.getByRole('listbox', { name: list });
        await expect(listbox).toBeVisible();
        const m = await page.evaluate(() => {
            const menu = document.querySelector<HTMLElement>('.cbx-popover .cbx-menu-account')!;
            const box = (el: Element) => el.getBoundingClientRect();
            const pop = box(document.querySelector('.cbx-popover')!);
            const back = box(menu.querySelector('.cbx-back')!);
            const search = box(menu.querySelector('.cbx-pane-search')!);
            const lb = box(menu.querySelector('[role="listbox"]')!);
            // The active option: the current choice, scrolled into view, or the first one.
            const first = box(menu.querySelector('[role="option"][aria-selected="true"]')!);
            return { scrollTop: menu.scrollTop, scrolls: menu.scrollHeight > menu.clientHeight, pop: [pop.top, pop.bottom], back: [back.top, back.bottom], search: [search.top, search.bottom], lb: [lb.top, lb.bottom, lb.height], first: [first.top, first.bottom] };
        });
        // Nothing is scrolled away inside the panel: the list is the one scroller.
        expect(m.scrollTop).toBe(0);
        expect(m.scrolls).toBe(false);
        // Back row, search and the first option all sit inside the popover.
        for (const part of [m.back, m.search, m.first]) {
            expect(part[0]).toBeGreaterThanOrEqual(m.pop[0]!);
            expect(part[1]).toBeLessThanOrEqual(m.pop[1]!);
        }
        // The active option is inside the list's own scroll box, too.
        expect(m.first[0]).toBeGreaterThanOrEqual(m.lb[0]!);
        expect(m.first[1]).toBeLessThanOrEqual(m.lb[1]!);
        // The list is at least two rows tall (it was collapsed to nothing).
        expect(m.lb[2]).toBeGreaterThanOrEqual(96);
    });
}
