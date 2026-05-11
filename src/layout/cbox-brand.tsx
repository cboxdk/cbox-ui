import type { ComponentProps } from 'react';
import { cn } from '../utils/cn';

export type CboxBrandProps = {
    /**
     * App key — drives the small mono submark beside the wordmark.
     * Convention: lowercase single word matching the `cbox_apps.key`
     * row in id (`notifications`, `webhooks`, `id`, `cortex`, …).
     */
    appKey: string;
    /**
     * Override the submark text. Defaults to `appKey`. Hide it
     * entirely with `submark={null}`.
     */
    submark?: string | null;
    /** Asset base path. Default `/brand` — apps drop the standard
     *  png set (`cbox-icon.png`, `cbox-logo.png`, plus `@2x` retina)
     *  into `public/brand/` and they Just Work. */
    assetBase?: string;
    /** Tone of the wordmark. `dark` on light surfaces (default),
     *  `light` on dark / coloured surfaces. */
    tone?: 'dark' | 'light';
    /** Collapsed mode renders only the square icon — used in the
     *  collapsed-sidebar state. */
    collapsed?: boolean;
    className?: string;
};

/**
 * Canonical Cbox brand mark. Every app wears this — the only
 * variable bit is the `appKey` submark beside the wordmark
 * ("notifications", "webhooks", …).
 *
 * No app should ship its own brand component. If a product needs
 * a materially different mark, that's a cbox-ui PR (extend this
 * component), not a per-app fork.
 */
export function CboxBrand({
    appKey,
    submark,
    assetBase = '/brand',
    tone = 'dark',
    collapsed = false,
    className,
}: CboxBrandProps) {
    if (collapsed) {
        return (
            <img
                src={`${assetBase}/cbox-icon.png`}
                srcSet={`${assetBase}/cbox-icon.png 1x, ${assetBase}/cbox-icon@2x.png 2x`}
                alt="Cbox"
                width={36}
                height={36}
                className={cn('h-9 w-9 rounded-md', className)}
            />
        );
    }

    const wordmark =
        tone === 'light'
            ? `${assetBase}/cbox-logo-white.png`
            : `${assetBase}/cbox-logo.png`;
    const wordmarkRetina =
        tone === 'light'
            ? `${assetBase}/cbox-logo-white@2x.png`
            : `${assetBase}/cbox-logo@2x.png`;

    const submarkText = submark === undefined ? appKey : submark;

    return (
        <div
            className={cn('inline-flex items-center gap-2', className)}
            aria-label={`Cbox · ${appKey}`}
        >
            <img
                src={wordmark}
                srcSet={`${wordmark} 1x, ${wordmarkRetina} 2x`}
                alt="Cbox"
                height={22}
                className="h-[22px] w-auto select-none"
                draggable={false}
            />
            {submarkText !== null && submarkText !== '' ? (
                <span
                    className={cn(
                        'text-mono text-[10px] font-semibold tracking-[0.22em] uppercase',
                        tone === 'light'
                            ? 'text-white/60'
                            : 'text-muted-foreground/80',
                    )}
                >
                    {submarkText}
                </span>
            ) : null}
        </div>
    );
}

/**
 * Re-export shape kept in case a host app needs to pass
 * additional <img> attrs (`loading`, `fetchPriority`, …).
 */
export type CboxBrandImageProps = ComponentProps<'img'>;
