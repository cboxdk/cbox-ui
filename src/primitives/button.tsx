import {
    Children,
    cloneElement,
    forwardRef,
    isValidElement,
    type ButtonHTMLAttributes,
    type MouseEvent,
    type ReactElement,
    type ReactNode,
} from 'react';
import { cn } from '../utils/cn';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    /** `primary` for the one main action, `secondary` a step below, `ghost` (default) plain, `danger` destructive. */
    variant?: ButtonVariant;
    /** 28px, 32px (default) or 42px. */
    size?: ButtonSize;
    /** A leading glyph (a 16px icon). Decorative: the label beside it is the accessible name. */
    icon?: ReactNode;
    /**
     * The action is in flight: the button disables itself, swaps the glyph for a spinner and says
     * `aria-busy`. The label does not change, so nothing reflows under the cursor.
     */
    loading?: boolean;
    /**
     * Style the single child element (a router `Link`, an `<a>`) as this button instead of
     * rendering a `<button>`. A control that navigates must be a link: it can be middle-clicked,
     * opened in a new tab and copied. The glyph is put inside the child.
     */
    asChild?: boolean;
    children?: ReactNode;
};

/** The class list a button of this variant and size carries, for an element Button cannot wrap. */
export function buttonClassName({ variant = 'ghost', size = 'md' }: { variant?: ButtonVariant; size?: ButtonSize } = {}): string {
    return cn('cbx-ui-btn', `cbx-ui-btn--${variant}`, size !== 'md' && `cbx-ui-btn--${size}`);
}

type ChildProps = { className?: string; children?: ReactNode; onClick?: (event: MouseEvent<HTMLElement>) => void };

/**
 * The Cbox button: four variants, three sizes, a loading state and `asChild` for links.
 * An unspecified `type` is `button`, so a Cancel inside a form never submits it.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'ghost', size = 'md', icon, loading = false, asChild = false, disabled, className, children, type, ...props },
    ref,
) {
    const classes = cn(buttonClassName({ variant, size }), className);
    const glyph = loading ? <Spinner /> : icon !== undefined && icon !== null ? <span className="cbx-ui-btn-glyph" aria-hidden="true">{icon}</span> : null;
    const inactive = (disabled ?? false) || loading;

    if (asChild) {
        const child = Children.only(children);
        if (!isValidElement<ChildProps>(child)) return null;
        const own = child.props;
        return cloneElement(child as ReactElement<ChildProps & Record<string, unknown>>, {
            ...props,
            ref,
            className: cn(classes, own.className),
            'aria-busy': loading || undefined,
            'aria-disabled': inactive || undefined,
            // A disabled link keeps its focus (so it can be reached and explained) but goes nowhere.
            onClick: (event: MouseEvent<HTMLElement>) => {
                if (inactive) {
                    event.preventDefault();
                    return;
                }
                own.onClick?.(event);
                (props.onClick as ((event: MouseEvent<HTMLElement>) => void) | undefined)?.(event);
            },
            children: (
                <>
                    {glyph}
                    {own.children}
                </>
            ),
        });
    }

    return (
        <button
            ref={ref}
            type={type ?? 'button'}
            className={classes}
            disabled={inactive}
            aria-busy={loading || undefined}
            {...props}
        >
            {glyph}
            {children}
        </button>
    );
});
