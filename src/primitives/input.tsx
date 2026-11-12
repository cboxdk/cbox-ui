import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../utils/cn';
import { useFieldControl } from './field';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
    /** `md` (default) is 36px for dense consoles; `lg` is 44px, for a sign-in or a one-field screen. */
    scale?: 'md' | 'lg';
};

/**
 * A text input on the tokens: 36px, 13px, and 16px below 768px so iOS does not zoom into it.
 * Inside a `<Field>` it takes its id, description and invalid state from it; props given
 * here win.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ scale = 'md', className, ...props }, ref) {
    const field = useFieldControl();
    return <input ref={ref} className={cn('cbx-ui-input', scale === 'lg' && 'cbx-ui-input--lg', className)} {...field} {...props} />;
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** A multi-line text field, the same box as `Input`, four rows by default. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, rows = 4, ...props }, ref) {
    const field = useFieldControl();
    return <textarea ref={ref} rows={rows} className={cn('cbx-ui-input', className)} {...field} {...props} />;
});
