import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

type KeyValueProps = {
    label: string;
    children: ReactNode;
    /** Render the value in monospace. Default true — most values are technical. */
    mono?: boolean;
    className?: string;
};

/**
 * Two-column read-only field row. Label in mono caps, value in mono
 * by default (for slugs/IDs/dates) — pass `mono={false}` for prose.
 */
export function KeyValue({
    label,
    children,
    mono = true,
    className,
}: KeyValueProps) {
    return (
        <div
            className={cn(
                'grid grid-cols-[140px_1fr] items-baseline gap-x-6 border-b border-border py-3 last:border-b-0',
                className,
            )}
        >
            <dt className="text-eyebrow text-muted-foreground">{label}</dt>
            <dd
                className={cn(
                    'text-sm break-all text-foreground',
                    mono && 'text-mono text-[13px]',
                )}
            >
                {children}
            </dd>
        </div>
    );
}

export function KeyValueList({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return <dl className={cn('px-6', className)}>{children}</dl>;
}
