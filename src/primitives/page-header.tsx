import type { ReactNode } from 'react';
import { useCboxLocalization } from '../context/localization';
import { useShellHelp } from '../shell/context';
import { cn } from '../utils/cn';

type Props = {
    title: ReactNode;
    /**
     * Tiny uppercase lead-in above the title (sections, breadcrumb-light
     * disambiguation). Shown in mono-tracking caps so it reads as
     * meta, not as a competing heading.
     */
    eyebrow?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    /**
     * Show the `?` beside the title that toggles the shell's Help column (spec §7.1). The page's
     * help topic itself travels in `shell.help.topic`. Ignored outside `CboxShell`.
     */
    help?: boolean;
    className?: string;
};

/**
 * Title block at the top of every page. Big bold title, optional mono
 * eyebrow lead-in, muted lead, optional right-aligned actions slot.
 * Cortex-style — no italics, no brackets — so it carries across many
 * sibling apps cleanly.
 */
export function PageHeader({
    title,
    eyebrow,
    description,
    actions,
    help = false,
    className,
}: Props) {
    const { t } = useCboxLocalization();
    const shellHelp = useShellHelp();
    return (
        <header
            className={cn(
                'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
                className,
            )}
        >
            <div className="space-y-1.5">
                {eyebrow !== undefined ? (
                    <p className="text-mono text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                        {eyebrow}
                    </p>
                ) : null}
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
                        {title}
                    </h1>
                    {help && shellHelp !== null ? (
                        <button
                            type="button"
                            onClick={() => shellHelp.toggleHelp()}
                            aria-label={t('Help for this page')}
                            aria-controls="cbx-help"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground hover:border-accent-edge hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                        >
                            ?
                        </button>
                    ) : null}
                </div>
                {description ? (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                ) : null}
            </div>
            {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {actions}
                </div>
            ) : null}
        </header>
    );
}
