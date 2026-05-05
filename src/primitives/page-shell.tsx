import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

type Props = {
    children: ReactNode;
    className?: string;
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
export function PageShell({ children, className }: Props) {
    return (
        <div
            className={cn(
                'mx-auto w-full max-w-6xl space-y-6 px-6 py-8 lg:px-10 lg:py-10',
                className,
            )}
        >
            {children}
        </div>
    );
}
