// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canScrollWithin, lockScroll, scrollLockCount } from './scroll-lock';

function box({ height, content, top = 0, className = '' }: { height: number; content: number; top?: number; className?: string }): HTMLElement {
    const element = document.createElement('div');
    element.className = className;
    element.style.overflowY = 'auto';
    Object.defineProperty(element, 'clientHeight', { configurable: true, value: height });
    Object.defineProperty(element, 'scrollHeight', { configurable: true, value: content });
    element.scrollTop = top;
    Object.defineProperty(element, 'scrollTop', { configurable: true, writable: true, value: top });
    return element;
}

afterEach(() => {
    while (scrollLockCount() > 0) lockScroll()();
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
    vi.restoreAllMocks();
});

describe('scroll lock', () => {
    it('holds the document while any lock is held, counted for stacked sheets', () => {
        const first = lockScroll();
        expect(document.documentElement.style.overflow).toBe('hidden');
        expect(document.body.style.overflow).toBe('hidden');
        expect(document.documentElement.hasAttribute('data-cbx-scroll-locked')).toBe(true);
        const second = lockScroll();
        expect(scrollLockCount()).toBe(2);
        first();
        // The sheet underneath is still open: still locked.
        expect(document.documentElement.style.overflow).toBe('hidden');
        first();
        expect(scrollLockCount()).toBe(1);
        second();
        expect(scrollLockCount()).toBe(0);
        expect(document.documentElement.style.overflow).toBe('');
        expect(document.body.style.overflow).toBe('');
        expect(document.documentElement.hasAttribute('data-cbx-scroll-locked')).toBe(false);
    });

    it('gives back the styles the page had', () => {
        document.documentElement.style.overflow = 'clip';
        document.body.style.overflow = 'auto';
        document.body.style.paddingRight = '3px';
        const release = lockScroll();
        release();
        expect(document.documentElement.style.overflow).toBe('clip');
        expect(document.body.style.overflow).toBe('auto');
        expect(document.body.style.paddingRight).toBe('3px');
    });

    it('puts the page back where it was, at once, if it moved while locked', () => {
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 640 });
        const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
        const release = lockScroll();
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 });
        document.documentElement.style.scrollBehavior = '';
        release();
        expect(scrollTo).toHaveBeenCalledWith(0, 640);
        expect(document.documentElement.style.scrollBehavior).toBe('');
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    });

    it('holds a scrollable <main> too and restores its offset', () => {
        const main = box({ height: 500, content: 3000, top: 373, className: 'cbx-shell-main' });
        document.body.append(main);
        const release = lockScroll();
        expect(main.style.overflow).toBe('hidden');
        main.scrollTop = 0;
        release();
        expect(main.style.overflow).toBe('');
        expect(main.scrollTop).toBe(373);
    });

    it('leaves a <main> that does not scroll alone (the document scrolls)', () => {
        const main = document.createElement('main');
        main.className = 'cbx-shell-main';
        document.body.append(main);
        const release = lockScroll();
        expect(main.style.overflow).toBe('');
        release();
    });

    it('cancels a touch that would scroll the page, not one that scrolls inside the sheet', () => {
        const layer = document.createElement('div');
        layer.className = 'cbx-overlay';
        const body = box({ height: 400, content: 900, top: 0 });
        const row = document.createElement('button');
        body.append(row);
        layer.append(body);
        document.body.append(layer);
        const page = document.createElement('p');
        document.body.append(page);
        const release = lockScroll();
        const swipe = (target: Element, from: number, to: number, fingers = 1) => {
            const touch = (y: number) => Array.from({ length: fingers }, () => ({ clientX: 10, clientY: y, target }));
            target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: touch(from) as unknown as Touch[] }));
            const move = new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: touch(to) as unknown as Touch[] });
            target.dispatchEvent(move);
            return move.defaultPrevented;
        };
        // The page behind: always cancelled.
        expect(swipe(page, 300, 200)).toBe(true);
        // Inside the sheet: towards its end scrolls, past its top does not.
        expect(swipe(row, 300, 200)).toBe(false);
        expect(swipe(row, 200, 300)).toBe(true);
        // Pinch-zoom is never taken.
        expect(swipe(page, 300, 200, 2)).toBe(false);
        release();
        // Unlocked: the guard is gone.
        expect(swipe(page, 300, 200)).toBe(false);
    });
});

describe('canScrollWithin', () => {
    it('follows the finger: down scrolls towards the top, up towards the end', () => {
        const layer = document.createElement('div');
        layer.className = 'cbx-overlay';
        const list = box({ height: 300, content: 600, top: 100 });
        const item = document.createElement('span');
        list.append(item);
        layer.append(list);
        document.body.append(layer);
        expect(canScrollWithin(item, 0, 40)).toBe(true);
        expect(canScrollWithin(item, 0, -40)).toBe(true);
        list.scrollTop = 0;
        expect(canScrollWithin(item, 0, 40)).toBe(false);
        list.scrollTop = 300;
        expect(canScrollWithin(item, 0, -40)).toBe(false);
    });

    it('nothing outside an open layer scrolls, and a layer with no scroller does not either', () => {
        const outside = document.createElement('div');
        document.body.append(outside);
        expect(canScrollWithin(outside, 0, -40)).toBe(false);
        const layer = document.createElement('div');
        layer.className = 'cbx-overlay';
        const head = document.createElement('div');
        layer.append(head);
        document.body.append(layer);
        expect(canScrollWithin(head, 0, -40)).toBe(false);
    });

    it('lets text fields handle their own touches', () => {
        const layer = document.createElement('div');
        layer.className = 'cbx-overlay';
        const field = document.createElement('textarea');
        layer.append(field);
        document.body.append(layer);
        expect(canScrollWithin(field, 0, -40)).toBe(true);
    });
});
