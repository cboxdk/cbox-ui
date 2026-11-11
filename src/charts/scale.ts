/**
 * The arithmetic under the Cbox charts (first written for Cbox Telemetry): round value
 * ticks from zero, and time ticks on whole minutes, hours or days.
 */

/** A round step (1, 2, 2.5 or 5 times a power of ten) of at least `raw`. */
function niceStep(raw: number): number {
    const power = 10 ** Math.floor(Math.log10(raw));
    const fraction = raw / power;
    return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * power;
}

/** 0 and round steps up to at least `max`: 0, 250, 500, 750, 1000. */
export function niceTicks(max: number, count = 4): number[] {
    const top = max > 0 && Number.isFinite(max) ? max : 1;
    const step = niceStep(top / count);
    const ticks: number[] = [];

    for (let value = 0; value < top + step * 0.999; value += step) {
        ticks.push(Number(value.toPrecision(12)));
    }

    if (ticks.length < 2) {
        ticks.push(step);
    }

    return ticks;
}

const MINUTE = 60_000;
const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080].map((minutes) => minutes * MINUTE);

/** Ticks (milliseconds) on whole minutes, hours or days, about one per 84 px of plot. */
export function timeTicks(from: number, to: number, width: number): number[] {
    const most = Math.max(2, Math.floor(width / 84));
    const step = STEPS.find((candidate) => (to - from) / candidate <= most) ?? 7 * 1440 * MINUTE;
    const ticks: number[] = [];

    for (let tick = Math.ceil(from / step) * step; tick <= to; tick += step) {
        ticks.push(tick);
    }

    return ticks;
}

/** A sample at `t` milliseconds since the epoch. */
export type TimePoint = { t: number; value: number };

export type SeriesDatum = { value: [number, number | null]; symbolSize?: number };

/**
 * Runs of samples as ECharts line data: a null between runs keeps missing samples a gap
 * (never interpolated or drawn as zero), and an isolated sample becomes a visible dot.
 */
export function seriesData(segments: TimePoint[][]): SeriesDatum[] {
    const data: SeriesDatum[] = [];

    segments.forEach((segment, index) => {
        const first = segment[0];

        if (!first) {
            return;
        }

        if (index > 0) {
            data.push({ value: [first.t - 1, null] });
        }

        for (const point of segment) {
            data.push(segment.length === 1 ? { value: [point.t, point.value], symbolSize: 5 } : { value: [point.t, point.value] });
        }
    });

    return data;
}

/**
 * Round ticks covering `min` to `max`, always through zero: `niceTicks(max)` when nothing is
 * negative, mirrored when nothing is positive, else one round step across both sides.
 */
export function niceRange(min: number, max: number, count = 4): number[] {
    const low = Number.isFinite(min) ? Math.min(0, min) : 0;
    const high = Number.isFinite(max) ? Math.max(0, max) : 0;

    if (low === 0) {
        return niceTicks(high, count);
    }

    if (high === 0) {
        return niceTicks(-low, count)
            .map((value) => (value === 0 ? 0 : -value))
            .reverse();
    }

    const step = niceStep((high - low) / count);
    const ticks: number[] = [];

    for (let value = Math.floor(low / step) * step; value < high + step * 0.999; value += step) {
        ticks.push(Number(value.toPrecision(12)) || 0);
    }

    return ticks;
}

/** The lowest and highest point the bars reach: per category, the stack's negative and positive sums when stacked. */
export function barExtent(series: (number | null)[][], stacked: boolean): [number, number] {
    let min = 0;
    let max = 0;
    const length = Math.max(0, ...series.map((values) => values.length));

    for (let index = 0; index < length; index++) {
        let below = 0;
        let above = 0;

        for (const values of series) {
            const value = values[index];

            if (value === null || value === undefined || !Number.isFinite(value)) {
                continue;
            }

            if (stacked) {
                if (value < 0) below += value;
                else above += value;
            } else {
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
        }

        min = Math.min(min, below);
        max = Math.max(max, above);
    }

    return [min, max];
}

/**
 * One waterfall step. A `total` (start, end) is drawn from zero to `value` and sets the running
 * level; any other step is a signed change from the level the step before ended at.
 */
export type WaterfallStep = { key: string; label: string; value: number; total?: boolean };

/** Where each waterfall bar sits: an invisible `base`, a visible `height`, the level it ends at, and its kind. */
export type WaterfallBar = { base: number; height: number; end: number; change: number; kind: 'total' | 'up' | 'down' };

/**
 * Waterfall steps as floating bars: each change starts where the step before ended. Drawn as a
 * stacked base and rise, so the running level is expected to stay at or above zero (MRR,
 * revenue, a balance); below zero a bar is drawn from zero.
 */
export function waterfallBars(steps: WaterfallStep[]): WaterfallBar[] {
    let level = 0;

    return steps.map((step) => {
        const value = Number.isFinite(step.value) ? step.value : 0;

        if (step.total === true) {
            level = value;
            return { base: 0, height: Math.max(0, value), end: value, change: value, kind: 'total' };
        }

        const from = level;
        level += value;
        const low = Math.max(0, Math.min(from, level));
        const high = Math.max(0, Math.max(from, level));

        return { base: low, height: high - low, end: level, change: value, kind: value >= 0 ? 'up' : 'down' };
    });
}
