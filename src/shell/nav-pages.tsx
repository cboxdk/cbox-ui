import { Lock } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useShell } from './context';
import type { NavPage } from './types';

/** A nav entry's URL: `url`, or `href` as laravel-console-kit 0.2 sends it. */
export function navUrl(entry: { url?: string; href?: string }): string {
    return entry.url ?? entry.href ?? '#';
}

export type NavPageGroup = { group?: string; pages: NavPage[] };

/**
 * An area's pages in runs under their group heading. Pages of one group are kept together,
 * in the order each group first appears; pages without a group form a run of their own.
 */
export function groupPages(pages: readonly NavPage[]): NavPageGroup[] {
    const runs = new Map<string, NavPageGroup>();
    for (const page of pages) {
        const key = page.group === undefined || page.group === '' ? '' : `g:${page.group}`;
        const run = runs.get(key) ?? { group: key === '' ? undefined : page.group, pages: [] };
        run.pages.push(page);
        runs.set(key, run);
    }
    return Array.from(runs.values());
}

/** The marks after a nav page's label: a lock (with "(locked)" for screen readers) and the count. */
export function NavPageMarks({ page }: { page: NavPage }) {
    const { t } = useShell();
    return (
        <>
            {page.locked === true && (
                <span className="cbx-nav-lock" title={t('Not in your plan')}>
                    <Lock size={13} strokeWidth={1.9} aria-hidden />
                    <span className="cbx-sr-only">{t('(locked)')}</span>
                </span>
            )}
            {page.locked !== true && page.count !== undefined && page.count > 0 && <span className="cbx-nav-count">{page.count > 999 ? '999+' : page.count}</span>}
        </>
    );
}

/**
 * An area's pages, under their group headings when they have any. `renderPage` draws one link;
 * each group is an ARIA group named by its heading.
 */
export function NavPageList({ pages, renderPage }: { pages: readonly NavPage[]; renderPage: (page: NavPage) => ReactNode }) {
    const id = useId();
    const runs = groupPages(pages);
    if (runs.every(run => run.group === undefined)) return <>{pages.map(renderPage)}</>;
    return (
        <>
            {runs.map((run, index) =>
                run.group === undefined ? (
                    <div key={`run-${index}`} className="cbx-nav-run">{run.pages.map(renderPage)}</div>
                ) : (
                    <div key={`run-${index}`} role="group" aria-labelledby={`${id}-${index}`} className="cbx-nav-run">
                        <div id={`${id}-${index}`} className="cbx-nav-group">{run.group}</div>
                        {run.pages.map(renderPage)}
                    </div>
                ),
            )}
        </>
    );
}
