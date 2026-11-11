import { useCallback } from 'react';
import { Chart, type ChartColors } from './chart';
import { barExtent, niceRange, waterfallBars, type WaterfallStep } from './scale';

export type BarSeries = {
    key: string;
    label: string;
    /** One value per category, in the order of `categories`; null leaves the bar out. */
    values: (number | null)[];
    /** Index into the chart tokens from 0 (`--chart-1`), as `ChartEvent.tone`. Defaults to the series' position. */
    tone?: number;
};

export type BarChartProps = {
    /** The category axis, in order (months, plans, countries). */
    categories: string[];
    series: BarSeries[];
    /** Stack the series in one bar per category; the tooltip adds the total. Default: side by side. */
    stacked?: boolean;
    /** Bars run left to right, categories down the side (long names, rankings). */
    horizontal?: boolean;
    /** Accessible name; keep a table of the same numbers next to the chart. */
    label: string;
    formatValue: (value: number) => string;
    /** Appended to values in the tooltip. */
    unit?: string;
    /** Lowest top of the value axis, so small bars do not fill the plot. */
    minimumTop?: number;
    /** A legend above the plot. Default: on with more than one series. */
    legend?: boolean;
    height?: number;
    className?: string;
};

export type WaterfallChartProps = {
    /** Totals (`total: true`) from zero, changes floating from where the step before ended. */
    steps: WaterfallStep[];
    label: string;
    formatValue: (value: number) => string;
    unit?: string;
    height?: number;
    className?: string;
};

const escape = (text: string) => text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

type TooltipItem = { seriesName: string; color: string; value: number | null | undefined; dataIndex: number; seriesIndex: number };

/** The parts every Cbox chart shares: token colours, mono axis labels, dashed grid, the tooltip box. */
function frame(colors: ChartColors) {
    const axisLabel = { color: colors.muted, fontFamily: colors.mono, fontSize: 11 };
    const tone = (index: number) => colors.series[index % colors.series.length] ?? colors.text;
    const tooltip = {
        trigger: 'axis',
        confine: true,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        padding: [6, 10],
        textStyle: { color: colors.text, fontFamily: colors.mono, fontSize: 12 },
        axisPointer: { type: 'shadow', shadowStyle: { color: colors.muted, opacity: 0.08 } },
    };

    return { axisLabel, tone, tooltip };
}

function valueAxis(colors: ChartColors, ticks: number[], formatValue: (value: number) => string, axisLabel: Record<string, unknown>) {
    const min = ticks[0] ?? 0;
    const max = ticks[ticks.length - 1] ?? 1;

    return {
        type: 'value',
        min,
        max,
        interval: (max - min) / Math.max(1, ticks.length - 1),
        axisLabel: { ...axisLabel, formatter: (number: number) => formatValue(number) },
        splitLine: { lineStyle: { color: colors.grid, type: 'dashed' } },
    };
}

function categoryAxis(colors: ChartColors, categories: string[], axisLabel: Record<string, unknown>) {
    return {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: colors.grid } },
        axisTick: { show: false },
        axisLabel: { ...axisLabel, fontFamily: colors.font, hideOverlap: true },
    };
}

/**
 * THE CBOX BAR CHART (ECharts): categories against values drawn to scale from zero with round
 * ticks, side by side or stacked, vertical or horizontal, in the chart tokens. Negative values
 * hang below zero. The axis tooltip lists every series, and the total when stacked.
 */
export function BarChart({ categories, series, stacked = false, horizontal = false, label, formatValue, unit = '', minimumTop = 0, legend, height = 260, className }: BarChartProps) {
    const option = useCallback(
        (colors: ChartColors) => {
            const { axisLabel, tone, tooltip } = frame(colors);
            const [low, high] = barExtent(
                series.map((item) => item.values),
                stacked,
            );
            const ticks = niceRange(low, Math.max(minimumTop, high));
            const value = (number: number) => `${formatValue(number)}${unit ? ` ${unit}` : ''}`;
            const showLegend = legend ?? series.length > 1;
            const values = valueAxis(colors, ticks, formatValue, axisLabel);
            const names = categoryAxis(colors, categories, axisLabel);
            const radius = 3;

            return {
                color: colors.series,
                textStyle: { fontFamily: colors.font, color: colors.text },
                grid: { top: showLegend ? 40 : 16, right: 16, bottom: 8, left: 8, containLabel: true },
                legend: showLegend
                    ? { top: 4, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, itemGap: 16, textStyle: { color: colors.muted, fontFamily: colors.font, fontSize: 12 } }
                    : { show: false },
                xAxis: horizontal ? values : names,
                yAxis: horizontal ? { ...names, inverse: true } : values,
                tooltip: {
                    ...tooltip,
                    formatter: (items: TooltipItem[]) => {
                        const present = items.filter((item) => typeof item.value === 'number');
                        const first = items[0];

                        if (!first || present.length === 0) {
                            return '';
                        }

                        const rows = present.map((item) =>
                            series.length > 1 ? `<span style="color:${item.color}">●</span> ${escape(item.seriesName)} <b>${escape(value(item.value ?? 0))}</b>` : `<b>${escape(value(item.value ?? 0))}</b>`,
                        );

                        if (stacked && present.length > 1) {
                            rows.push(`Total <b>${escape(value(present.reduce((sum, item) => sum + (item.value ?? 0), 0)))}</b>`);
                        }

                        return `${escape(categories[first.dataIndex] ?? '')}<br/>${rows.join('<br/>')}`;
                    },
                },
                series: series.map((item, index) => {
                    // Only the outer end of a bar is rounded: the top of a stack, never a seam inside it.
                    const outer = !stacked || index === series.length - 1;
                    const corners = horizontal ? [0, radius, radius, 0] : [radius, radius, 0, 0];

                    return {
                        type: 'bar',
                        name: item.label,
                        stack: stacked ? 'total' : undefined,
                        data: item.values.map((entry) => (entry === null || !Number.isFinite(entry) ? '-' : entry)),
                        barMaxWidth: 44,
                        barGap: '20%',
                        itemStyle: { color: tone(item.tone ?? index), borderRadius: outer ? corners : 0 },
                        emphasis: { disabled: true },
                    };
                }),
            };
        },
        [categories, series, stacked, horizontal, formatValue, unit, minimumTop, legend],
    );

    return <Chart option={option} label={label} height={height} className={className} />;
}

/**
 * THE CBOX WATERFALL (ECharts): a start total, each change floating from where the last one
 * ended, an end total. Totals in `--chart-1`, growth in `--chart-2` (green), loss in `--chart-4`
 * (red), as everywhere in Cbox. The running level should stay at or above zero (MRR, revenue).
 */
export function WaterfallChart({ steps, label, formatValue, unit = '', height = 240, className }: WaterfallChartProps) {
    const option = useCallback(
        (colors: ChartColors) => {
            const { axisLabel, tone, tooltip } = frame(colors);
            const bars = waterfallBars(steps);
            const ticks = niceRange(0, Math.max(0, ...bars.map((bar) => bar.base + bar.height)));
            const fill = { total: tone(0), up: tone(1), down: tone(3) };
            const value = (number: number) => `${formatValue(number)}${unit ? ` ${unit}` : ''}`;

            return {
                textStyle: { fontFamily: colors.font, color: colors.text },
                grid: { top: 16, right: 16, bottom: 8, left: 8, containLabel: true },
                xAxis: categoryAxis(colors, steps.map((step) => step.label), { ...axisLabel, interval: 0 }),
                yAxis: valueAxis(colors, ticks, formatValue, axisLabel),
                tooltip: {
                    ...tooltip,
                    formatter: (items: TooltipItem[]) => {
                        const index = items[0]?.dataIndex ?? 0;
                        const step = steps[index];
                        const bar = bars[index];

                        if (!step || !bar) {
                            return '';
                        }

                        const amount = bar.kind === 'total' ? value(bar.change) : `${bar.change >= 0 ? '+' : '−'}${value(Math.abs(bar.change))}`;

                        return `${escape(step.label)}<br/><b>${escape(amount)}</b>`;
                    },
                },
                series: [
                    { type: 'bar', stack: 'waterfall', silent: true, itemStyle: { color: 'transparent' }, emphasis: { disabled: true }, data: bars.map((bar) => bar.base) },
                    {
                        type: 'bar',
                        stack: 'waterfall',
                        name: label,
                        barMaxWidth: 44,
                        emphasis: { disabled: true },
                        data: bars.map((bar) => ({ value: bar.height, itemStyle: { color: fill[bar.kind], borderRadius: 3 } })),
                    },
                ],
            };
        },
        [steps, label, formatValue, unit],
    );

    return <Chart option={option} label={label} height={height} className={className} />;
}
