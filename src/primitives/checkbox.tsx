import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '../utils/cn';

export type CheckboxProps = {
    /** `'indeterminate'` draws a dash: some of a group are checked. A click then checks it. */
    checked: boolean | 'indeterminate';
    onCheckedChange: (checked: boolean) => void;
    /** The label beside the box, clickable. A bare box in a row is not offered. */
    label: ReactNode;
    /** A line under the label, read as the box's description. */
    hint?: ReactNode;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    value?: string;
    id?: string;
    className?: string;
};

/**
 * A checkbox: a native `<input type="checkbox">` drawn on the tokens, so the keyboard (Space),
 * form submission and screen readers behave as the platform's own. The box is 16px; its target
 * is 24px.
 */
export function Checkbox({ checked, onCheckedChange, label, hint, disabled = false, required, name, value, id: statedId, className }: CheckboxProps) {
    const generated = useId();
    const id = statedId ?? generated;
    const hintId = `${id}-hint`;
    const input = useRef<HTMLInputElement | null>(null);
    const indeterminate = checked === 'indeterminate';

    useEffect(() => {
        if (input.current !== null) input.current.indeterminate = indeterminate;
    }, [indeterminate]);

    return (
        <div className={cn('cbx-ui-check', disabled && 'is-disabled', className)}>
            <span className="cbx-ui-check-box">
                <input
                    ref={input}
                    id={id}
                    type="checkbox"
                    className="cbx-ui-check-input"
                    checked={checked === true}
                    aria-checked={indeterminate ? 'mixed' : undefined}
                    onChange={(event) => onCheckedChange(event.target.checked)}
                    disabled={disabled}
                    required={required}
                    name={name}
                    value={value}
                    aria-describedby={hint !== undefined ? hintId : undefined}
                />
                <svg className="cbx-ui-check-mark cbx-ui-check-mark--check" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2.5 6.2 4.9 8.5 9.5 3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <svg className="cbx-ui-check-mark cbx-ui-check-mark--minus" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M3 6h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            </span>
            <span className="cbx-ui-check-text">
                <label htmlFor={id} className="cbx-ui-check-label">
                    {label}
                </label>
                {hint !== undefined && (
                    <span id={hintId} className="cbx-ui-check-hint">
                        {hint}
                    </span>
                )}
            </span>
        </div>
    );
}
