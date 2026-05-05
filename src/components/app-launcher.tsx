import { useState, type ReactNode } from 'react';
import { useCboxId, type CboxAppLink } from '../context/cbox-id';
import { cn } from '../utils/cn';

/**
 * Google-style 9-dot launcher. Shows the sister Cbox apps the user
 * can jump into. Reads `apps` from CboxIdProvider — each consuming
 * app populates this list from the id-client SDK or hardcodes it
 * in dev/staging while the SDK matures.
 */
export function AppLauncher({ className }: { className?: string }) {
    const { apps } = useCboxId();
    const [open, setOpen] = useState(false);

    if (apps.length === 0) {
        return null;
    }

    return (
        <div className={cn('relative', className)}>
            <button
                type="button"
                aria-label="Open app launcher"
                onClick={() => setOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
                <Grid />
            </button>
            {open ? (
                <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-popover p-2 shadow-md">
                    <p className="text-eyebrow px-2 pb-2 text-muted-foreground">
                        Cbox apps
                    </p>
                    <div className="grid grid-cols-3 gap-1">
                        {apps.map((app) => (
                            <AppTile key={app.key} app={app} />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function AppTile({ app }: { app: CboxAppLink }): ReactNode {
    const monogram = app.monogram ?? app.name.slice(0, 1).toUpperCase();
    return (
        <a
            href={app.url}
            className={cn(
                'flex flex-col items-center gap-1.5 rounded-md px-2 py-3 text-center hover:bg-secondary',
                app.current && 'bg-accent-soft',
            )}
        >
            <div
                className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-sm font-semibold text-foreground',
                    app.current && 'border-accent-edge',
                )}
            >
                {app.iconUrl ? (
                    <img
                        src={app.iconUrl}
                        alt=""
                        className="h-6 w-6"
                        loading="lazy"
                    />
                ) : (
                    <span>{monogram}</span>
                )}
            </div>
            <span className="truncate text-xs text-foreground">{app.name}</span>
        </a>
    );
}

function Grid(): ReactNode {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            {[1, 8, 15].flatMap((y) =>
                [1, 8, 15].map((x) => (
                    <rect
                        key={`${x}-${y}`}
                        x={x}
                        y={y}
                        width="2.5"
                        height="2.5"
                        rx="0.6"
                        fill="currentColor"
                    />
                )),
            )}
        </svg>
    );
}
