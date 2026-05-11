import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

/**
 * Width policy for `<PageShell>` — the single horizontal-rhythm
 * primitive every Cbox-family app shares. Pick the policy that
 * matches the page's content density:
 *
 *   comfortable   max-w-6xl (~1152px) — the default. Reading-friendly
 *                 column for prose-heavy pages: profile, security,
 *                 billing forms, audit row detail.
 *   wide          max-w-7xl (~1280px) — for tables / lists / member
 *                 rosters where horizontal real estate matters more
 *                 than reading line length. Audit log, member roster,
 *                 plan comparison.
 *   full          no max-width, only the standard horizontal padding —
 *                 for canvas-heavy pages (flow diagrams, dashboards)
 *                 where every pixel of viewport should be usable. Use
 *                 sparingly: raw width without column rules feels
 *                 chaotic on monitors past 1600px.
 *   bleed         no max-width AND no horizontal padding. Strict edge
 *                 -to-edge for content that draws its own padding (a
 *                 flow canvas with its own pan/zoom region, a fullscreen
 *                 iframe, an embedded preview environment).
 */
export type PageWidth = 'comfortable' | 'wide' | 'full' | 'bleed';

const widthClass: Record<PageWidth, string> = {
    comfortable: 'max-w-6xl px-6 py-8 lg:px-10 lg:py-10',
    wide: 'max-w-7xl px-6 py-8 lg:px-10 lg:py-10',
    full: 'max-w-none px-6 py-8 lg:px-10 lg:py-10',
    bleed: 'max-w-none p-0',
};

type Props = {
    children: ReactNode;
    width?: PageWidth;
    className?: string;
};

/**
 * The page-level container. Picks one of four width policies (see
 * PageWidth) and applies the canonical Cbox padding / vertical
 * rhythm. Every authenticated page in every Cbox app composes
 * through this — directly via `<PageShell>` or, more usually, via
 * the per-app `<Page>` wrapper that combines PageShell + PageHeader
 * + PageTabs.
 *
 * Width policy is the only knob exposed here. Padding, max-width,
 * gutter, vertical spacing between blocks — those are baked in so
 * the eye never has to track horizontal jitter between sibling
 * pages.
 */
export function PageShell({
    children,
    width = 'comfortable',
    className,
}: Props) {
    return (
        <div
            className={cn(
                'mx-auto w-full space-y-6',
                widthClass[width],
                className,
            )}
        >
            {children}
        </div>
    );
}
