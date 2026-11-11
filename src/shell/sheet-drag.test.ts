import { describe, expect, it } from 'vitest';
import { dragIntent, LARGE, MEDIUM, rubberBand, settleSheet, sheetDetents, VelocityTracker } from './sheet-drag';

describe('sheet detents', () => {
    it('a sheet that fits its content rests where it opened, and grows to the large detent only when there is more to show', () => {
        expect(sheetDetents({ size: 'fit', viewport: 800, current: 300, content: 300 })).toEqual([300]);
        expect(sheetDetents({ size: 'fit', viewport: 800, current: 480, content: 1200 })).toEqual([480, Math.round(800 * LARGE)]);
        // Content a little taller than the open sheet: up to the content, not past it.
        expect(sheetDetents({ size: 'fit', viewport: 800, current: 480, content: 600 })).toEqual([480, 600]);
    });

    it('a tall sheet rests at half the screen and where it opened', () => {
        expect(sheetDetents({ size: 'tall', viewport: 800, current: 720, content: 300 })).toEqual([Math.round(800 * MEDIUM), 720]);
        expect(sheetDetents({ size: 'full', viewport: 664, current: 624, content: 2000 })).toEqual([332, 624]);
    });

    it('detents closer than 48px are one', () => {
        expect(sheetDetents({ size: 'fit', viewport: 800, current: 700, content: 730 })).toEqual([700]);
        expect(sheetDetents({ size: 'tall', viewport: 100, current: 60, content: 0 })).toEqual([60]);
    });
});

describe('settling a released sheet', () => {
    const detents = [400, 736];

    it('goes to the nearest detent when let go slowly', () => {
        expect(settleSheet({ height: 700, velocity: 0, detents })).toEqual({ close: false, height: 736 });
        expect(settleSheet({ height: 520, velocity: 0, detents })).toEqual({ close: false, height: 400 });
        expect(settleSheet({ height: 380, velocity: 0, detents })).toEqual({ close: false, height: 400 });
    });

    it('follows a flick: up to the large detent, down to the medium one', () => {
        expect(settleSheet({ height: 450, velocity: -1.2, detents })).toEqual({ close: false, height: 736 });
        expect(settleSheet({ height: 700, velocity: 1.5, detents })).toEqual({ close: false, height: 400 });
    });

    it('closes when pulled well below the smallest detent, or flicked down below it', () => {
        expect(settleSheet({ height: 400 - 141, velocity: 0, detents })).toEqual({ close: true });
        expect(settleSheet({ height: 400 - 100, velocity: 0, detents })).toEqual({ close: false, height: 400 });
        expect(settleSheet({ height: 400 - 30, velocity: 0.8, detents })).toEqual({ close: true });
        // A short sheet closes after a third of its height, a tall one after 160px.
        expect(settleSheet({ height: 200 - 71, velocity: 0, detents: [200] })).toEqual({ close: true });
        expect(settleSheet({ height: 900 - 161, velocity: 0, detents: [900] })).toEqual({ close: true });
    });

    it('never closes on a flick down while still above the smallest detent', () => {
        expect(settleSheet({ height: 401, velocity: 3, detents })).toEqual({ close: false, height: 400 });
    });
});

describe('rubber band', () => {
    it('gives less and less past the largest detent and never reaches the limit', () => {
        expect(rubberBand(0)).toBe(0);
        expect(rubberBand(-20)).toBe(0);
        expect(rubberBand(60)).toBeLessThan(60);
        expect(rubberBand(120)).toBe(60);
        expect(rubberBand(10_000)).toBeLessThan(120);
    });
});

describe('velocity', () => {
    it('measures the last 100ms of the finger, in px/ms', () => {
        const tracker = new VelocityTracker();
        tracker.add(0, 0);
        tracker.add(500, 0);
        tracker.add(550, 50);
        tracker.add(600, 100);
        expect(tracker.velocity()).toBe(1);
        expect(new VelocityTracker().velocity()).toBe(0);
    });
});

describe('which gesture moves the sheet', () => {
    it('waits until the finger has moved', () => {
        expect(dragIntent({ zone: 'grab', dx: 1, dy: 2, scrollTop: 0, canGrow: false })).toBeUndefined();
    });

    it('the handle and header always drag, unless the move is sideways', () => {
        expect(dragIntent({ zone: 'grab', dx: 0, dy: -10, scrollTop: 0, canGrow: false })).toBe('drag');
        expect(dragIntent({ zone: 'grab', dx: 0, dy: 10, scrollTop: 50, canGrow: false })).toBe('drag');
        expect(dragIntent({ zone: 'grab', dx: 12, dy: 3, scrollTop: 0, canGrow: false })).toBe('scroll');
    });

    it('content drags the sheet down only from its top, as on iOS', () => {
        expect(dragIntent({ zone: 'content', dx: 0, dy: 10, scrollTop: 0, canGrow: false })).toBe('drag');
        expect(dragIntent({ zone: 'content', dx: 0, dy: 10, scrollTop: 1, canGrow: false })).toBe('scroll');
    });

    it('content drags the sheet up while it can still grow, then scrolls', () => {
        expect(dragIntent({ zone: 'content', dx: 0, dy: -10, scrollTop: 0, canGrow: true })).toBe('drag');
        expect(dragIntent({ zone: 'content', dx: 0, dy: -10, scrollTop: 0, canGrow: false })).toBe('scroll');
    });
});
