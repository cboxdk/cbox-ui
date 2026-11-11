import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../utils/cn';

/**
 * Generic panel container — soft border, card surface, subtle shadow.
 * The default building block for every section on a page.
 */
export function DataPanel({
    className,
    children,
    ...rest
}: ComponentProps<'section'>) {
    return (
        <section
            className={cn(
                'rounded-lg border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_12px_rgb(0_0_0/0.03)]',
                className,
            )}
            {...rest}
        >
            {children}
        </section>
    );
}

type SectionHeaderProps = {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
};

/**
 * Section header that sits inside a DataPanel. Title in semibold sans,
 * optional muted lead, right-aligned actions slot. The actions stay beside
 * the title while there is room (also on a phone) and wrap under it, left
 * aligned, when there is not; several actions wrap among themselves.
 */
export function SectionHeader({
    title,
    description,
    actions,
    className,
}: SectionHeaderProps) {
    return (
        <header
            className={cn(
                'flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border px-5 py-4',
                className,
            )}
        >
            <div className="min-w-0 flex-[1_1_12rem] space-y-1">
                <h2 className="text-[15px] leading-none font-semibold text-foreground">
                    {title}
                </h2>
                {description ? (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                ) : null}
            </div>
            {actions ? (
                <div className="flex max-w-full flex-wrap items-center gap-2">
                    {actions}
                </div>
            ) : null}
        </header>
    );
}

/**
 * Vertically padded content body for a DataPanel.
 */
export function PanelBody({
    className,
    children,
    ...rest
}: ComponentProps<'div'>) {
    return (
        <div className={cn('px-5 py-4', className)} {...rest}>
            {children}
        </div>
    );
}
