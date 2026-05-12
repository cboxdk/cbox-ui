import { X } from 'lucide-react';
import { useEffect } from 'react';
import { CboxBrand } from './cbox-brand';
import type {
    CboxNavSection,
    LinkComponent,
} from './cbox-app-sidebar';
import { cn } from '../utils/cn';

export type CboxMobileNavDrawerProps = {
    open: boolean;
    onClose: () => void;
    appKey: string;
    brandSubmark?: string | null;
    assetBase?: string;
    brandHref?: string;
    sections: CboxNavSection[];
    currentPath: string;
    LinkComponent: LinkComponent;
};

/**
 * Mobile-only slide-in sidebar. Hidden on `lg` and up — there the
 * desktop `CboxAppSidebar` is always visible. Shares the same
 * `sections` shape as the desktop sidebar so apps don't have to
 * maintain two nav configs.
 *
 * State (open/close) lives in `CboxAppShell` so it can wire the
 * hamburger button + auto-close on `currentPath` change. The drawer
 * itself just renders; it doesn't track anything.
 *
 * Closes on: Escape, scrim click, navigation (parent unsets `open`
 * when `currentPath` changes). Locks body scroll while open so the
 * page underneath doesn't scroll on touch.
 */
export function CboxMobileNavDrawer({
    open,
    onClose,
    appKey,
    brandSubmark,
    assetBase,
    brandHref = '/',
    sections,
    currentPath,
    LinkComponent,
}: CboxMobileNavDrawerProps) {
    useEffect(() => {
        if (!open) {
            return;
        }

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);

    return (
        <div
            className={cn(
                'fixed inset-0 z-40 lg:hidden',
                open ? '' : 'pointer-events-none',
            )}
            aria-hidden={open ? 'false' : 'true'}
        >
            <div
                onClick={onClose}
                className={cn(
                    'absolute inset-0 bg-black/40 transition-opacity duration-200',
                    open ? 'opacity-100' : 'opacity-0',
                )}
            />
            <aside
                role="dialog"
                aria-modal="true"
                aria-label="Navigation"
                className={cn(
                    'absolute inset-y-0 left-0 flex w-[280px] max-w-[80vw] flex-col border-r border-sidebar-border bg-sidebar shadow-xl transition-transform duration-200 ease-out',
                    open ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border/70 px-4">
                    <LinkComponent
                        href={brandHref}
                        aria-label="Home"
                        className="flex items-center"
                    >
                        <CboxBrand
                            appKey={appKey}
                            submark={brandSubmark}
                            assetBase={assetBase}
                            collapsed={false}
                        />
                    </LinkComponent>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close navigation"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                        <X className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                </div>
                <nav className="flex-1 space-y-5 overflow-y-auto px-3 pt-5 pb-3">
                    {sections.map((section) => (
                        <div key={section.label} className="space-y-1">
                            <p className="text-eyebrow px-3 pb-1">
                                {section.label}
                            </p>
                            <ul className="space-y-0.5">
                                {section.items.map((item) => {
                                    const active =
                                        item.matchPrefix === true
                                            ? currentPath === item.href ||
                                              currentPath.startsWith(
                                                  item.href + '/',
                                              )
                                            : currentPath === item.href;
                                    const Icon = item.icon;

                                    return (
                                        <li key={item.label}>
                                            <LinkComponent
                                                href={item.href}
                                                prefetch
                                                className={cn(
                                                    'group flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] transition-colors',
                                                    active
                                                        ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                                                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground',
                                                )}
                                            >
                                                <Icon
                                                    className={cn(
                                                        'h-4 w-4 shrink-0',
                                                        active
                                                            ? 'text-foreground'
                                                            : 'text-sidebar-muted',
                                                    )}
                                                    strokeWidth={1.7}
                                                />
                                                <span className="flex-1 truncate">
                                                    {item.label}
                                                </span>
                                            </LinkComponent>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>
            </aside>
        </div>
    );
}
