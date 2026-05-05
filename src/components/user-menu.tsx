import { useState, type ReactNode } from 'react';
import { useCboxId } from '../context/cbox-id';
import { cn } from '../utils/cn';

type Props = {
    /**
     * App-specific menu items rendered above the standard
     * "Manage account" / "Sign out" set. Use sparingly — the goal
     * is consistency across apps.
     */
    extras?: ReactNode;
    className?: string;
};

/**
 * User-menu dropdown. Always exposes:
 *   - Manage account ↗   (deep-link into id)
 *   - Team & billing ↗   (deep-link into id, current org scope)
 *   - Sign out
 *
 * The arrows signal cross-app navigation — id is canonical.
 */
export function UserMenu({ extras, className }: Props) {
    const { user, currentOrganization, urls } = useCboxId();
    const [open, setOpen] = useState(false);

    const initials = user.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase() ?? '')
        .join('');

    return (
        <div className={cn('relative', className)}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex h-9 items-center gap-2 rounded-md px-1.5 hover:bg-secondary"
                aria-label="Open user menu"
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
                <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover p-1 shadow-md">
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
                    <a
                        href={urls.accountUrl}
                        className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-secondary"
                    >
                        <span>Manage account</span>
                        <CrossAppArrow />
                    </a>
                    {urls.orgSettingsUrl && currentOrganization ? (
                        <a
                            href={urls.orgSettingsUrl}
                            className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-secondary"
                        >
                            <span className="truncate">
                                Team & billing
                                <span className="text-muted-foreground"> · {currentOrganization.name}</span>
                            </span>
                            <CrossAppArrow />
                        </a>
                    ) : null}
                    <div className="my-1 border-t border-border" />
                    <form action={urls.signOutUrl} method="POST">
                        <SignOutCsrf />
                        <button
                            type="submit"
                            className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-secondary"
                        >
                            Sign out
                        </button>
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
