import { describe, expect, it } from 'vitest';
import { niceTicks, seriesData, timeTicks } from '../../src/charts/scale';

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
