import { useEffect } from 'react';

/**
 * The on-screen keyboard on a phone. iOS Safari does not shrink the layout viewport when the
 * keyboard opens (and ignores `interactive-widget`), so a bottom sheet would sit behind it and the
 * tab bar would ride up over the page's fields. While the phone layout is on, this keeps two
 * variables on <html>:
 * - `--cbx-keyboard`: how much of the layout viewport the keyboard covers (0 when closed, and 0 on
 *   Android with `interactive-widget=resizes-content`, where the layout viewport shrinks instead);
 * - `--cbx-vvh`: the height that is really visible.
 * and `data-cbx-keyboard` while a field has focus and the keyboard is up, which hides the tab bar.
 */
export function keyboardInset({ innerHeight, viewportHeight, offsetTop }: { innerHeight: number; viewportHeight: number; offsetTop: number }): number {
    return Math.max(0, Math.round(innerHeight - viewportHeight - offsetTop));
}

const EDITABLE = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]), textarea, select, [contenteditable]';

export function useViewportInsets(enabled: boolean): void {
    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return;
        const html = document.documentElement;
        const viewport = window.visualViewport;
        let tallest = window.innerHeight;
        let width = window.innerWidth;
        let frame = 0;
        const update = () => {
            frame = 0;
            if (window.innerWidth !== width) {
                // Turned: a new baseline.
                width = window.innerWidth;
                tallest = window.innerHeight;
            }
            tallest = Math.max(tallest, window.innerHeight);
            const visible = viewport?.height ?? window.innerHeight;
            const inset = keyboardInset({ innerHeight: window.innerHeight, viewportHeight: visible, offsetTop: viewport?.offsetTop ?? 0 });
            html.style.setProperty('--cbx-keyboard', `${inset}px`);
            html.style.setProperty('--cbx-vvh', `${Math.round(visible)}px`);
            const typing = document.activeElement instanceof Element && document.activeElement.matches(EDITABLE);
            const shrunk = tallest - visible > 120;
            if (typing && (inset > 120 || shrunk)) html.setAttribute('data-cbx-keyboard', '');
            else html.removeAttribute('data-cbx-keyboard');
        };
        const schedule = () => {
            if (frame === 0) frame = requestAnimationFrame(update);
        };
        update();
        viewport?.addEventListener('resize', schedule);
        viewport?.addEventListener('scroll', schedule);
        window.addEventListener('resize', schedule);
        document.addEventListener('focusin', schedule);
        document.addEventListener('focusout', schedule);
        return () => {
            cancelAnimationFrame(frame);
            viewport?.removeEventListener('resize', schedule);
            viewport?.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            document.removeEventListener('focusin', schedule);
            document.removeEventListener('focusout', schedule);
            html.style.removeProperty('--cbx-keyboard');
            html.style.removeProperty('--cbx-vvh');
            html.removeAttribute('data-cbx-keyboard');
        };
    }, [enabled]);
}
