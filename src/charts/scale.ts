/**
 * The arithmetic under the Cbox charts (first written for Cbox Telemetry): round value
 * ticks from zero, and time ticks on whole minutes, hours or days.
 */

/** 0 and round steps up to at least `max`: 0, 250, 500, 750, 1000. */
export function niceTicks(max: number, count = 4): number[] {
    const top = max > 0 && Number.isFinite(max) ? max : 1;
    const raw = top / count;
    const power = 10 ** Math.floor(Math.log10(raw));
    const fraction = raw / power;
    const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * power;
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
