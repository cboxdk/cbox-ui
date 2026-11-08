import { useCallback } from 'react';
import { Chart, type ChartColors } from './chart';
import { niceTicks, seriesData, type TimePoint } from './scale';

export type TimeSeries = {
    key: string;
    label: string;
    /** Contiguous runs of samples; a new run starts after a gap, which is drawn as a gap. */
    segments: TimePoint[][];
    /** The headline series: drawn with a faint area. Defaults to the first series. */
    primary?: boolean;
    /** A reference to read the others against (last week, a limit): dashed, no area. */
    dashed?: boolean;
};

/** A moment worth explaining (a deploy, a scale step): a labelled vertical line, never a cause claim. */
export type ChartEvent = {
    /** Milliseconds since the epoch. */
    at: number;
    label: string;
    /** Index into the chart tokens; deploys use 1 and scaling 2 by convention. */
    tone?: number;
    /** Extra tooltip line, such as the end time and outcome. Plain text. */
    detail?: string;
};

export type TimeChartProps = {
    series: TimeSeries[];
    /** The window, in milliseconds. */
    from: number;
    to: number;
    /** Accessible name; keep a table of the same numbers next to the chart. */
    label: string;
    formatValue: (value: number) => string;
    /** Axis and tooltip time. Say the zone once beside the chart. */
    formatTime?: (t: number) => string;
    /** Appended to values in the tooltip. */
    unit?: string;
    /** Lowest top of the y axis, so a flat near-zero line does not fill the plot. */
    minimumTop?: number;
    events?: ChartEvent[];
    /** A moment marked with a dashed line, such as a selected request. */
    marker?: number | null;
    /** Zoom by slider, pinch or Ctrl/⌘ + scroll. On by default. */
    zoom?: boolean;
    height?: number;
    className?: string;
};

const defaultTime = (t: number) => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(t);

const escape = (text: string) => text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

/**
 * THE CBOX TIME CHART (ECharts): drawn to scale from zero with round ticks, a line with a
 * faint area for the headline series, thin lines for the rest, labelled vertical lines for
 * events, gaps for missing samples, an axis tooltip with every series, and zoom.
 */
export function TimeChart({ series, from, to, label, formatValue, formatTime = defaultTime, unit = '', minimumTop = 0, events = [], marker = null, zoom = true, height = 260, className }: TimeChartProps) {
    const option = useCallback(
        (colors: ChartColors) => {
            const ticks = niceTicks(Math.max(minimumTop, ...series.flatMap((item) => item.segments.flat().map((point) => point.value))));
            const top = ticks[ticks.length - 1] ?? 1;
            const axisLabel = { color: colors.muted, fontFamily: colors.mono, fontSize: 11 };
            const primary = Math.max(0, series.findIndex((item) => item.primary));
            const tone = (index: number) => colors.series[index % colors.series.length] ?? colors.text;
            const value = (number: number) => `${formatValue(number)}${unit ? ` ${unit}` : ''}`;
            const lines = [
                ...events
                    .filter((event) => event.at >= from && event.at <= to)
                    .map((event) => ({
                        xAxis: event.at,
                        name: event.label,
                        event,
                        lineStyle: { color: tone(event.tone ?? 1), type: 'solid', width: 1, opacity: 0.8 },
                        label: { show: true, formatter: event.label, position: 'insideEndTop', color: tone(event.tone ?? 1), fontFamily: colors.mono, fontSize: 10 },
                    })),
                ...(marker !== null && marker >= from && marker <= to ? [{ xAxis: marker, name: '', lineStyle: { color: colors.text, type: 'dashed', width: 1 }, label: { show: false } }] : []),
            ];

            return {
                color: colors.series,
                textStyle: { fontFamily: colors.font, color: colors.text },
                grid: { top: 16, right: 16, bottom: zoom ? 56 : 24, left: 56 },
                xAxis: {
                    type: 'time',
                    min: from,
                    max: to,
                    axisLine: { lineStyle: { color: colors.grid } },
                    axisTick: { show: false },
                    splitLine: { show: false },
                    axisLabel: { ...axisLabel, hideOverlap: true, formatter: (t: number) => formatTime(t) },
                },
                yAxis: {
                    type: 'value',
                    min: 0,
                    max: top,
                    interval: top / Math.max(1, ticks.length - 1),
                    axisLabel: { ...axisLabel, formatter: (number: number) => formatValue(number) },
                    splitLine: { lineStyle: { color: colors.grid, type: 'dashed' } },
                },
                dataZoom: zoom
                    ? [
                          { type: 'inside', xAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false, moveOnMouseMove: true },
                          {
                              type: 'slider',
                              xAxisIndex: 0,
                              filterMode: 'none',
                              height: 18,
                              bottom: 8,
                              borderColor: colors.grid,
                              fillerColor: 'rgba(127,127,127,0.12)',
                              handleStyle: { color: colors.surface, borderColor: colors.muted },
                              moveHandleSize: 0,
                              showDetail: false,
                              dataBackground: { lineStyle: { color: colors.muted, opacity: 0.4 }, areaStyle: { opacity: 0 } },
                              selectedDataBackground: { lineStyle: { color: tone(0) }, areaStyle: { opacity: 0 } },
                              textStyle: axisLabel,
                          },
                      ]
                    : [],
                tooltip: {
                    trigger: 'axis',
                    confine: true,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    padding: [6, 10],
                    textStyle: { color: colors.text, fontFamily: colors.mono, fontSize: 12 },
                    axisPointer: { type: 'line', lineStyle: { color: colors.muted, opacity: 0.5 } },
                    formatter: (items: { seriesName: string; color: string; value: [number, number | null] }[]) => {
                        const present = items.filter((item) => item.value[1] !== null);
                        const first = present[0];

                        if (!first) {
                            return '';
                        }

                        const rows = present.map((item) =>
                            series.length > 1 ? `<span style="color:${item.color}">●</span> ${escape(item.seriesName)} <b>${escape(value(item.value[1] ?? 0))}</b>` : `<b>${escape(value(item.value[1] ?? 0))}</b>`,
                        );

                        return `${escape(formatTime(first.value[0]))}<br/>${rows.join('<br/>')}`;
                    },
                },
                series: series.map((item, index) => {
                    const color = tone(index);
                    const isPrimary = index === primary;

                    return {
                        type: 'line',
                        name: item.label,
                        data: seriesData(item.segments),
                        connectNulls: false,
                        symbol: 'circle',
                        symbolSize: 0,
                        lineStyle: { width: isPrimary ? 1.5 : 1, color, type: item.dashed ? 'dashed' : 'solid' },
                        itemStyle: { color },
                        areaStyle: isPrimary && !item.dashed ? { opacity: 0.14, color } : undefined,
                        emphasis: { disabled: true },
                        z: isPrimary ? 3 : 2,
                        markLine:
                            isPrimary && lines.length > 0
                                ? {
                                      silent: false,
                                      symbol: 'none',
                                      data: lines,
                                      tooltip: {
                                          formatter: (entry: { data: { event?: ChartEvent; name: string } }) => {
                                              const event = entry.data.event;

                                              if (!event) {
                                                  return escape(entry.data.name);
                                              }

                                              return `${escape(event.label)}<br/>${escape(formatTime(event.at))}${event.detail ? ` · ${escape(event.detail)}` : ''}`;
                                          },
                                      },
                                  }
                                : undefined,
                    };
                }),
            };
        },
        [series, from, to, formatValue, formatTime, unit, minimumTop, events, marker, zoom],
    );

    return <Chart option={option} label={label} height={height} className={className} />;
}
