import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

type Tone = 'info' | 'success' | 'warning' | 'destructive' | 'neutral';

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
    info: { bg: 'bg-info-soft', fg: 'text-info' },
    success: { bg: 'bg-success-soft', fg: 'text-success' },
    warning: { bg: 'bg-warning-soft', fg: 'text-warning' },
    destructive: { bg: 'bg-destructive-soft', fg: 'text-destructive' },
    neutral: { bg: 'bg-secondary', fg: 'text-foreground' },
};

type StatTileProps = {
    label: string;
    value: ReactNode;
    /** Small caption under the value. */
    suffix?: ReactNode;
    icon: LucideIcon;
    tone?: Tone;
    className?: string;
};

/**
 * Cortex-style metric tile. Coloured square icon block on the left,
 * label + value on the right, optional caption below the value.
 */
export function StatTile({
    label,
    value,
    suffix,
    icon: Icon,
    tone = 'info',
    className,
}: StatTileProps) {
    const styles = toneStyles[tone];

    return (
        <div
            className={cn(
                'flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:border-border-strong',
                className,
            )}
        >
            <div
                className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                    styles.bg,
                )}
            >
                <Icon className={cn('h-5 w-5', styles.fg)} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
                <p className="tabular text-2xl leading-none font-semibold tracking-tight text-foreground">
                    {value}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                    {label}
                </p>
                {suffix ? (
                    <p className="text-mono truncate text-[10px] text-muted-foreground/80">
                        {suffix}
                    </p>
                ) : null}
            </div>
        </div>
    );
}
