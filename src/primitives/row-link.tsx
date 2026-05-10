import { type ComponentType, type ReactNode } from 'react';
import { cn } from '../utils/cn';

type Props = {
    /** URL the row navigates to. */
    href: string;
    /**
     * Link component from the host — e.g. Inertia's `Link` or React
     * Router's `Link`. Falls back to a plain `<a>` when omitted.
     */
    LinkComponent?: ComponentType<{ href: string; className?: string; children: ReactNode }>;
    /** Visually highlight the row as the active / current item. */
    active?: boolean;
    /** Content rendered in the leading section (typically an avatar + text block). */
    children: ReactNode;
    /** Optional trailing slot — action buttons, status pills, etc. */
    trailing?: ReactNode;
    className?: string;
};

/**
 * Full-row clickable link for list views. The whole row navigates to
 * `href`; the trailing slot floats right and doesn't participate in
 * the link hit-area.
 *
 * Designed for table/list rows where "clicking the row" IS the primary
 * action — no separate "Edit" / "View" buttons needed.
 */
export function RowLink({
    href,
    LinkComponent,
    active = false,
    children,
    trailing,
    className,
}: Props) {
    const linkClass = cn(
        'flex flex-1 min-w-0 items-center gap-3 px-4 py-3',
        'transition-colors',
        active ? 'bg-accent-soft/50' : 'hover:bg-secondary/60',
        className,
    );

    const inner = (
        <div className="flex w-full items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
            {trailing ? (
                <div className="flex shrink-0 items-center gap-2">{trailing}</div>
            ) : null}
        </div>
    );

    if (LinkComponent) {
        return (
            <LinkComponent href={href} className={linkClass}>
                {inner}
            </LinkComponent>
        );
    }

    return (
        <a href={href} className={linkClass}>
            {inner}
        </a>
    );
}
