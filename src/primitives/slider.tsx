import { type CSSProperties, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { useFieldControl } from './field';

export type SliderProps = {
    value: number;
    onValueChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    name?: string;
    id?: string;
    /** What a screen reader says for the value, such as "40 percent"; the number when omitted. */
    valueText?: (value: number) => string;
    /** Required when the slider has no `<Field>` label. */
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    className?: string;
};

/**
 * A value in a range, moved by pointer, arrow keys, Page Up/Down and Home/End. It is a native
 * `<input type="range">`, so touch, keyboard and assistive technology work as the platform does;
 * the track is filled up to the value. Inside a `<Field>` the Field's label names it. Show the
 * number beside it when the exact value matters.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
    { value, onValueChange, min = 0, max = 100, step = 1, disabled = false, valueText, className, ...props },
    ref,
) {
    const { required: _required, ...wiring } = useFieldControl();
    const fill = max > min ? ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100 : 0;

    return (
        <input
            ref={ref}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            aria-valuetext={valueText?.(value)}
            className={cn('cbx-ui-slider', className)}
            style={{ '--cbx-ui-slider-fill': `${fill}%` } as CSSProperties}
            onChange={(event) => onValueChange(Number(event.currentTarget.value))}
            {...wiring}
            {...props}
        />
    );
});
