import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

type EmptyStateProps = {
    icon?: LucideIcon;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
};

/**
 * Centered empty state with an optional icon block, title, body
 * lede, and a single CTA slot.
 */
export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
                className,
            )}
        >
            {Icon ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                    <Icon className="h-4 w-4" strokeWidth={1.6} />
                </div>
            ) : null}
            <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                    {title}
                </h3>
                {description ? (
                    <p className="max-w-sm text-sm text-muted-foreground">
                        {description}
                    </p>
                ) : null}
            </div>
            {action ? <div className="pt-1">{action}</div> : null}
        </div>
    );
}
