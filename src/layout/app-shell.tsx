import type { ReactNode } from 'react';

/**
 * Top-level chrome. Hosts the desktop sidebar (left) and the
 * scrollable content column (right) side-by-side. Fits the full
 * viewport height; only the content column scrolls.
 *
 * Pair with <AppContent> inside. Per-app sidebars compose alongside
 * — cbox-ui doesn't ship one because the nav items are app-specific.
 */
export function AppShell({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-svh w-full bg-canvas text-foreground">
            {children}
        </div>
    );
}
