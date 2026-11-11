import { describe, expect, it } from 'vitest';
import { barExtent, niceRange, niceTicks, seriesData, timeTicks, waterfallBars } from '../../src/charts/scale';

describe('niceTicks', () => {
    it('starts at zero and uses round steps up to the maximum', () => {
        expect(niceTicks(0.9)).toEqual([0, 0.25, 0.5, 0.75, 1]);
        expect(niceTicks(2.4)).toEqual([0, 1, 2, 3]);
        expect(niceTicks(870)).toEqual([0, 250, 500, 750, 1000]);
    });

    it('draws an empty or broken series against a unit axis', () => {
        expect(niceTicks(0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
        expect(niceTicks(Number.NaN)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    });
});

describe('timeTicks', () => {
    it('lands on whole steps inside the window and thins out on narrow charts', () => {
        const from = Date.UTC(2026, 10, 8, 10, 0, 30);
        const to = from + 3_600_000;
        const wide = timeTicks(from, to, 840);

        expect(wide.every((tick) => tick % 300_000 === 0 && tick >= from && tick <= to)).toBe(true);
        expect(timeTicks(from, to, 240).length).toBeLessThan(wide.length);
    });
});

describe('seriesData', () => {
    it('breaks the line between runs and draws an isolated sample as a dot', () => {
        expect(seriesData([[{ t: 0, value: 1 }, { t: 60_000, value: 2 }], [{ t: 300_000, value: 3 }]])).toEqual([
            { value: [0, 1] },
            { value: [60_000, 2] },
            { value: [299_999, null] },
            { value: [300_000, 3], symbolSize: 5 },
        ]);
    });
});

describe('niceRange', () => {
    it('is niceTicks when nothing is negative, mirrored when nothing is positive', () => {
        expect(niceRange(0, 870)).toEqual([0, 250, 500, 750, 1000]);
        expect(niceRange(-870, 0)).toEqual([-1000, -750, -500, -250, 0]);
        expect(niceRange(0, 0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    });

    it('crosses zero on one round step', () => {
        const ticks = niceRange(-120, 380);
        expect(ticks).toContain(0);
        expect(ticks[0]).toBeLessThanOrEqual(-120);
        expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(380);
        expect(ticks).toEqual([-200, 0, 200, 400]);
    });
});

describe('barExtent', () => {
    it('takes the tallest bar side by side, and the stack sums when stacked', () => {
        const series = [
            [10, 20, null],
            [5, -8, 30],
        ];
        expect(barExtent(series, false)).toEqual([-8, 30]);
        expect(barExtent(series, true)).toEqual([-8, 30]);
        expect(barExtent([[10, 20], [5, 15]], true)).toEqual([0, 35]);
    });
});

describe('waterfallBars', () => {
    it('floats each change from where the step before ended, totals from zero', () => {
        expect(
            waterfallBars([
                { key: 'start', label: 'Start', value: 100, total: true },
                { key: 'new', label: 'New', value: 30 },
                { key: 'churn', label: 'Churn', value: -50 },
                { key: 'end', label: 'End', value: 80, total: true },
            ]),
        ).toEqual([
            { base: 0, height: 100, end: 100, change: 100, kind: 'total' },
            { base: 100, height: 30, end: 130, change: 30, kind: 'up' },
            { base: 80, height: 50, end: 80, change: -50, kind: 'down' },
            { base: 0, height: 80, end: 80, change: 80, kind: 'total' },
        ]);
    });

    it('draws a change below zero from zero', () => {
        expect(waterfallBars([{ key: 'a', label: 'A', value: 10, total: true }, { key: 'b', label: 'B', value: -30 }])[1]).toEqual({ base: 0, height: 10, end: -20, change: -30, kind: 'down' });
    });
});
