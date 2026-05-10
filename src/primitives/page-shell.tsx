import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

/**
 * Container width policy for PageShell.
 * - `narrow`  — prose / form pages; ~2xl max-width
 * - `wide`    — dashboards / data tables; ~7xl max-width
 * - `full`    — edge-to-edge; no max-width cap
 */
export type PageWidth = 'narrow' | 'wide' | 'full';

const widthClass: Record<PageWidth, string> = {
    narrow: 'max-w-2xl',
    wide: 'max-w-7xl',
    full: 'max-w-none',
};

type Props = {
    children: ReactNode;
    className?: string;
    /** Override the default container width. Defaults to the design-system max (max-w-6xl). */
    width?: PageWidth;
};

/**
 * Single-source-of-truth container for every page in the app shell.
 * Pixel-perfect identical width on every page — no per-page widths,
 * no per-page padding, no width prop. If a page needs a different
 * column width, that decision lives here, not on the page. Every
 * page in the app stretches to exactly the same column so the eye
 * never has to track horizontal jitter between Privacy, Login
 * history, Audit log, Dashboard, etc.
 */
export function PageShell({ children, className, width }: Props) {
    return (
        <div
            className={cn(
                'mx-auto w-full space-y-6 px-6 py-8 lg:px-10 lg:py-10',
                width ? widthClass[width] : 'max-w-6xl',
                className,
            )}
        >
            {children}
        </div>
    );
}
