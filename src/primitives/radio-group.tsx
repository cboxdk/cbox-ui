import { useId, type ReactNode } from 'react';
import { cn } from '../utils/cn';

export type RadioOption<T extends string = string> = {
    value: T;
    label: ReactNode;
    hint?: ReactNode;
    disabled?: boolean;
};

export type RadioGroupProps<T extends string = string> = {
    value: T | null;
    onValueChange: (value: T) => void;
    options: RadioOption<T>[];
    /** The question the options answer. Required: a radio group without one is a list. */
    label: ReactNode;
    /** Keep the label for assistive technology only, when a heading beside it already says it. */
    labelHidden?: boolean;
    /** The form field name. Generated when omitted (the arrow keys move within one name). */
    name?: string;
    disabled?: boolean;
    required?: boolean;
    className?: string;
};

/**
 * A choice of one where seeing every option at once matters. Native radios on the tokens: the
 * arrow keys move and select within the group, Tab enters at the checked one and leaves.
 */
export function RadioGroup<T extends string = string>({ value, onValueChange, options, label, labelHidden = false, name, disabled = false, required, className }: RadioGroupProps<T>) {
    const id = useId();
    const labelId = `${id}-label`;
    const groupName = name ?? `${id}-radio`;

    return (
        <div className={cn('cbx-ui-radio-group', className)}>
            <span id={labelId} className={labelHidden ? 'cbx-ui-sr-only' : 'cbx-ui-label'}>
                {label}
            </span>
            <div className="cbx-ui-radios" role="radiogroup" aria-labelledby={labelId} aria-required={required || undefined}>
                {options.map((option, index) => {
                    const optionId = `${id}-${index}`;
                    const off = disabled || option.disabled === true;
                    return (
                        <div key={option.value} className={cn('cbx-ui-radio', off && 'is-disabled')}>
                            <span className="cbx-ui-radio-box">
                                <input
                                    id={optionId}
                                    type="radio"
                                    className="cbx-ui-radio-input"
                                    name={groupName}
                                    value={option.value}
                                    checked={value === option.value}
                                    disabled={off}
                                    required={required}
                                    onChange={() => onValueChange(option.value)}
                                    aria-describedby={option.hint !== undefined ? `${optionId}-hint` : undefined}
                                />
                                <span className="cbx-ui-radio-dot" aria-hidden="true" />
                            </span>
                            <span className="cbx-ui-radio-text">
                                <label htmlFor={optionId} className="cbx-ui-radio-label">
                                    {option.label}
                                </label>
                                {option.hint !== undefined && (
                                    <span id={`${optionId}-hint`} className="cbx-ui-radio-hint">
                                        {option.hint}
                                    </span>
                                )}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
