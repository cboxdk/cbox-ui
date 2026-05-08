import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../utils/cn';

type Props = ComponentProps<'main'> & {
    children: ReactNode;
};

/**
 * Scrolling main column inside an <AppShell>. Wears the soft blue-
 * tinted gradient canvas so every Cbox app sits on the same
 * background.
 */
export function AppContent({ children, className, ...props }: Props) {
    return (
        <main
            {...props}
            className={cn(
                'canvas-gradient relative flex h-svh flex-1 flex-col overflow-y-auto',
                className,
            )}
        >
            {children}
        </main>
    );
}
