import { cn } from '../utils/cn';

export type SpinnerProps = {
    className?: string;
    /**
     * What is being waited for. Given, the spinner is a live status with that name; omitted, it
     * is silent, which is right inside a control that already says it is busy (`aria-busy`).
     */
    label?: string;
};

/**
 * The one indeterminate progress indicator. It takes the text colour, and under
 * `prefers-reduced-motion` it slows down rather than stopping: a still ring reads as broken.
 */
export function Spinner({ className, label }: SpinnerProps) {
    return (
        <span
            className={cn('cbx-ui-spinner', className)}
            role={label === undefined ? undefined : 'status'}
            aria-hidden={label === undefined ? true : undefined}
            aria-label={label}
        />
    );
}
