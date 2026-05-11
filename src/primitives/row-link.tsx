import type { ComponentType, ReactNode } from 'react';
import { cn } from '../utils/cn';

/**
 * A clickable list row — replaces the "name on left + Manage button on
 * right" pattern with a row that's clickable as a single Link, with a
 * visible hover state and a focus ring. Trailing content (badges,
 * action buttons) sits in the `trailing` slot, which renders alongside
 * the body but stops click-propagation on any nested interactive
 * control so action buttons there don't trigger row navigation.
 *
 *   <RowLink href={editOrg(slug).url} LinkComponent={Link}>
 *       <Avatar />
 *       <div>
 *           <p>Cbox Systems</p>
 *           <p className="text-mono">cbox-systems</p>
 *       </div>
 *   </RowLink>
 *
 * With trailing actions:
 *
 *   <RowLink href={...} trailing={<StatusPill>owner</StatusPill>}>
 *
 * Hit target: the entire row. The Link wraps all content directly so
 * every pixel inside the row is clickable, including the trailing
 * area's whitespace. Interactive controls inside `trailing` (buttons,
 * inputs, anchors, role="button") auto-stop the click via the
 * onClickCapture handler — no per-button stopPropagation boilerplate.
 */

export type RowLinkProps = {
    /** Destination URL — clicking anywhere on the row navigates here. */
    href: string;
    /** Row body. Compose freely; common pattern is avatar + text block. */
    children: ReactNode;
    /**
     * Right-aligned slot. Status pills, action buttons, kebab menus.
     * Interactive controls inside this slot auto-stop the row click
     * via DOM-traversal (button/a/input/select/textarea/[role=button]
     * /[data-stop-row-click]). No manual stopPropagation needed.
     */
    trailing?: ReactNode;
    /**
     * The framework's link component. Inertia consumers pass the
     * Inertia `Link`; TanStack Router consumers pass their typed
     * `Link`. Plain `<a>` is the fallback.
     */
    LinkComponent?: ComponentType<{
        href: string;
        prefetch?: boolean;
        className?: string;
        children: ReactNode;
    }>;
    /** Highlight as the active row (the user's current selection). */
    active?: boolean;
    /** Additional classes for the row container. */
    className?: string;
};

const DefaultLink: ComponentType<{
    href: string;
    className?: string;
    children: ReactNode;
}> = ({ href, className, children }) => (
    <a href={href} className={className}>
        {children}
    </a>
);

export function RowLink({
    href,
    children,
    trailing,
    LinkComponent = DefaultLink,
    active = false,
    className,
}: RowLinkProps) {
    return (
        <LinkComponent
            href={href}
            prefetch
            // The Link IS the row. Wrapping everything in the Link
            // means every pixel inside is clickable — no fiddly
            // overlay positioning or stretched-link hacks.
            className={cn(
                'group flex w-full items-center gap-4 px-5 py-3.5 transition-colors focus-visible:bg-secondary/60 focus-visible:outline-none',
                active
                    ? 'bg-accent-soft hover:bg-accent-soft/80'
                    : 'hover:bg-secondary/60',
                className,
            )}
        >
            <span
                data-component="row-link"
                data-active={active ? 'true' : undefined}
                // Body content. Captures clicks on `trailing`'s
                // interactive controls so they don't bubble up to the
                // Link and trigger the row navigation. The "click" on
                // a button inside trailing fires the button's handler
                // and stops there.
                onClickCapture={(event) => {
                    const target = event.target as HTMLElement;
                    if (
                        target.closest(
                            'button, a, input, select, textarea, [role="button"], [data-stop-row-click]',
                        ) !== null &&
                        target.closest('[data-row-body]') === null
                    ) {
                        event.stopPropagation();
                    }
                }}
                className="flex w-full items-center gap-4"
            >
                <span
                    data-row-body
                    className="flex min-w-0 flex-1 items-center gap-4"
                >
                    {children}
                </span>
                {trailing !== undefined ? (
                    <span className="flex shrink-0 items-center gap-2">
                        {trailing}
                    </span>
                ) : null}
            </span>
        </LinkComponent>
    );
}
