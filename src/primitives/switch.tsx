import { forwardRef } from 'react';
import { cn } from '../utils/cn';
import { useFieldControl } from './field';

export type SwitchProps = {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    /** Submitted as `name=on` while checked, like a checkbox. */
    name?: string;
    id?: string;
    /** Required when the switch has no `<Field>` label. */
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    className?: string;
};

/**
 * An immediate on/off (`role="switch"`, Space and Enter toggle). A switch means the change
 * takes effect now; a setting that waits for a Save button is a `Checkbox`. Inside a `<Field>`
 * the Field's label names it.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch({ checked, onCheckedChange, disabled = false, name, className, ...props }, ref) {
    const field = useFieldControl();
    const { required: _required, ...wiring } = field;

    return (
        <>
            <button
                ref={ref}
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                className={cn('cbx-ui-switch', className)}
                onClick={() => onCheckedChange(!checked)}
                {...wiring}
                {...props}
            >
                <span className="cbx-ui-switch-thumb" aria-hidden="true" />
            </button>
            {name !== undefined && checked && <input type="hidden" name={name} value="on" />}
        </>
    );
});
