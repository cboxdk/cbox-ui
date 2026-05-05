import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

type Props = {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
};

/**
 * Title block at the top of every page. Big bold title, muted lead,
 * optional right-aligned actions slot. Cortex-style — no italics, no
 * brackets — so it carries across many sibling apps cleanly.
 */
export function PageHeader({ title, description, actions, className }: Props) {
    return (
        <header
            className={cn(
                'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
                className,
            )}
        >
            <div className="space-y-1.5">
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
