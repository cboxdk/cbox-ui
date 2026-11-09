import { useCboxLocalization } from '../context/localization';
import { useState, type ReactNode } from 'react';
import { useCboxId } from '../context/cbox-id';
import type { LinkComponent } from '../layout/cbox-app-sidebar';
import { cn } from '../utils/cn';

type Props = {
    /**
     * App-specific menu items rendered above the standard
     * "Manage account" / "Sign out" set. Use sparingly — the goal
     * is consistency across apps.
     */
    extras?: ReactNode;
    placement?: 'bottom-end' | 'top-start';
    className?: string;
    /**
     * The router's link for the account and organization rows, when they are pages of this
     * app (an Inertia `Link` keeps the visit client-side). Default: a plain anchor, which is
     * right when the rows deep-link into Cbox ID on another origin.
     */
    LinkComponent?: LinkComponent;
};

const Anchor: LinkComponent = ({ href, className, children }) => <a href={href} className={className}>{children}</a>;

/**
 * User-menu dropdown. Always exposes:
 *   - Manage account ↗   (deep-link into id)
 *   - Team & billing ↗   (deep-link into id, current org scope)
 *   - Sign out
 *
 * The arrows signal cross-app navigation — id is canonical.
 */
export function UserMenu({ extras, className, placement = 'bottom-end', LinkComponent: Link = Anchor }: Props) {
    const { t } = useCboxLocalization();
    const { user, currentOrganization, urls } = useCboxId();
    const [open, setOpen] = useState(false);

    const initials = user.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase() ?? '')
        .join('');

    return (
        <div className={cn('relative', className)} onKeyDown={event => { if (event.key === "Escape") setOpen(false); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex h-9 items-center gap-2 rounded-md px-1.5 hover:bg-secondary"
                aria-label={t("Open user menu")}
                aria-expanded={open}
                onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}
            >
                {user.avatar_url ? (
                    <img
                        src={user.avatar_url}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover"
                    />
                ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-foreground">
                        {initials || '?'}
                    </span>
                )}
            </button>
            {open ? (
                <div className={cn("absolute z-50 w-64 rounded-lg border border-border bg-popover p-1 shadow-md", placement === "top-start" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-1")}>
                    <div className="px-2 py-2">
                        <p className="truncate text-sm font-medium text-foreground">
                            {user.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                    {extras ? (
                        <>
                            <div className="my-1 border-t border-border" />
                            {extras}
                        </>
                    ) : null}
                    <div className="my-1 border-t border-border" />
                    <Link
                        href={urls.accountUrl}
                        className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-secondary"
                    >
                        <span>{t("Manage account")}</span>
                        <CrossAppArrow />
                    </Link>
                    {urls.orgSettingsUrl && currentOrganization ? (
                        <Link
                            href={urls.orgSettingsUrl}
                            className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-secondary"
                        >
                            <span className="truncate">
                                {t("Team & billing")}<span className="text-muted-foreground"> · {currentOrganization.name}</span>
                            </span>
                            <CrossAppArrow />
                        </Link>
                    ) : null}
                    <div className="my-1 border-t border-border" />
                    <form action={urls.signOutUrl} method="POST">
                        <SignOutCsrf />
                        <button
                            type="submit"
                            className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-secondary"
                        >
                            {t("Sign out")}</button>
                    </form>
                </div>
            ) : null}
        </div>
    );
}

function CrossAppArrow(): ReactNode {
    return (
        <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden
        >
            <path
                d="M3 7l4-4M3 3h4v4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function SignOutCsrf(): ReactNode {
    if (typeof document === 'undefined') return null;
    const csrf = document
        .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
        ?.content;
    if (!csrf) return null;
    return <input type="hidden" name="_token" value={csrf} />;
}
