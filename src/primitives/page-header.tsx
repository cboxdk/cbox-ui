import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

type Props = {
    title: ReactNode;
    /**
     * Tiny uppercase lead-in above the title (sections, breadcrumb-light
     * disambiguation). Shown in mono-tracking caps so it reads as
     * meta, not as a competing heading.
     */
    eyebrow?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
};

/**
 * Title block at the top of every page. Big bold title, optional mono
 * eyebrow lead-in, muted lead, optional right-aligned actions slot.
 * Cortex-style — no italics, no brackets — so it carries across many
 * sibling apps cleanly.
 */
export function PageHeader({
    title,
    eyebrow,
    description,
    actions,
    className,
}: Props) {
    return (
        <header
            className={cn(
                'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
                className,
            )}
        >
            <div className="space-y-1.5">
                {eyebrow !== undefined ? (
                    <p className="text-mono text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                        {eyebrow}
                    </p>
                ) : null}
                <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
                    {title}
                </h1>
                {description ? (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                ) : null}
            </div>
            {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {actions}
                </div>
            ) : null}
        </header>
    );
}
