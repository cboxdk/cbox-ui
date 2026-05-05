import { cn } from '../utils/cn';

type Tone =
    | 'neutral'
    | 'info'
    | 'success'
    | 'warning'
    | 'destructive'
    | 'muted';

const toneStyles: Record<Tone, string> = {
    neutral: 'border-border bg-secondary text-secondary-foreground',
    info: 'border-info/20 bg-info-soft text-info',
    success: 'border-success/20 bg-success-soft text-success',
    warning: 'border-warning/20 bg-warning-soft text-warning',
    destructive: 'border-destructive/20 bg-destructive-soft text-destructive',
    muted: 'border-border bg-card text-muted-foreground',
};

const dotStyles: Record<Tone, string> = {
    neutral: 'bg-muted-foreground',
    info: 'bg-info',
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive',
    muted: 'bg-muted-foreground/60',
};

type StatusPillProps = {
    children: React.ReactNode;
    tone?: Tone;
    className?: string;
    /** Show a small dot before the label for "live status" feel. */
    dot?: boolean;
};

/**
 * Compact pill for plan tier, role, status, etc. Rounded-full like
 * Cortex's "Running"/"Production" tags. Sized for tabular density,
 * not editorial impact.
 */
export function StatusPill({
    children,
    tone = 'neutral',
    className,
    dot = false,
}: StatusPillProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] leading-none font-medium',
                toneStyles[tone],
                className,
            )}
        >
            {dot ? (
                <span
                    className={cn('h-1.5 w-1.5 rounded-full', dotStyles[tone])}
                />
            ) : null}
            {children}
        </span>
    );
}
