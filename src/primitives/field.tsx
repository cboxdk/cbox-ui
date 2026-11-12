import { createContext, useContext, useId, useMemo, type ReactNode } from 'react';
import { useCboxLocalization } from '../context/localization';
import { cn } from '../utils/cn';

type FieldContextValue = {
    controlId: string;
    describedBy: string | undefined;
    invalid: boolean;
    required: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export type FieldControlProps = Partial<{
    id: string;
    'aria-describedby': string;
    'aria-invalid': true;
    required: boolean;
}>;

/**
 * The wiring a control needs from its `<Field>`: id, `aria-describedby`, `aria-invalid` and
 * `required`. A control spreads it; outside a Field it is empty, so `<Input>` works bare (a
 * search box in a toolbar, with its own `aria-label`).
 */
export function useFieldControl(): FieldControlProps {
    const field = useContext(FieldContext);
    if (field === null) return {};
    return {
        id: field.controlId,
        ...(field.describedBy !== undefined ? { 'aria-describedby': field.describedBy } : {}),
        ...(field.invalid ? { 'aria-invalid': true as const } : {}),
        ...(field.required ? { required: true } : {}),
    };
}

export type FieldProps = {
    /** The visible label. A field cannot be built without one. */
    label: ReactNode;
    /** The control's id. Generated when omitted; state one only when something outside refers to it. */
    id?: string;
    /** A control on the label's row, right-aligned ("Forgot password?"). */
    labelAction?: ReactNode;
    /** Guidance under the control, always shown: not a placeholder, not a tooltip. */
    hint?: ReactNode;
    /** The message for this field. Present, the control is invalid and the message is announced. */
    error?: string | null;
    /** Marks the label (with a spoken "required") and the control. */
    required?: boolean;
    /** Says "optional" on the label, for the one field in a form that can be skipped. */
    optional?: boolean;
    className?: string;
    children: ReactNode;
};

/**
 * A labelled form control, wired: the label points at the control, the hint and the error
 * describe it, and the error is in a live region that exists before it has text (a region
 * inserted with its text is not announced by NVDA or VoiceOver).
 *
 * The words "required" and "optional" go through the host's translator
 * (`CboxLocalizationProvider`).
 */
export function Field({ label, id: statedId, labelAction, hint, error, required = false, optional = false, className, children }: FieldProps) {
    const { t } = useCboxLocalization();
    const generated = useId();
    const base = statedId ?? generated;
    const controlId = statedId ?? `${generated}-control`;
    const hintId = `${base}-hint`;
    const errorId = `${base}-error`;
    const hasError = error !== undefined && error !== null && error !== '';
    const describedBy = [hint !== undefined ? hintId : null, hasError ? errorId : null].filter(Boolean).join(' ') || undefined;

    const context = useMemo(() => ({ controlId, describedBy, invalid: hasError, required }), [controlId, describedBy, hasError, required]);

    const labelElement = (
        <label className="cbx-ui-label" htmlFor={controlId}>
            {label}
            {required && (
                <>
                    {' '}
                    <span className="cbx-ui-label-required" aria-hidden="true">
                        *
                    </span>
                    <span className="cbx-ui-sr-only">{t('(required)')}</span>
                </>
            )}
            {optional && (
                <>
                    {' '}
                    <span className="cbx-ui-label-optional">{t('(optional)')}</span>
                </>
            )}
        </label>
    );

    return (
        <FieldContext.Provider value={context}>
            <div className={cn('cbx-ui-field', className)}>
                {labelAction !== undefined ? (
                    <div className="cbx-ui-field-head">
                        {labelElement}
                        {labelAction}
                    </div>
                ) : (
                    labelElement
                )}
                {children}
                {hint !== undefined && (
                    <p id={hintId} className="cbx-ui-hint">
                        {hint}
                    </p>
                )}
                <p id={errorId} className="cbx-ui-error" role="alert" hidden={!hasError}>
                    {hasError ? error : null}
                </p>
            </div>
        </FieldContext.Provider>
    );
}
