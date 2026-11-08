import { type PointerEvent, type ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../utils/cn';
import { niceTicks, timeTicks } from './scale';

/** A sample at `t` milliseconds since the epoch. */
export type TimePoint = { t: number; value: number };

export type TimeSeries = {
    key: string;
    label: string;
    /** A chart token such as `var(--chart-1)`; defaults to the palette in order. */
    color?: string;
    /** Contiguous runs of samples; a new run starts after a gap, which is drawn as a gap. */
    segments: TimePoint[][];
    /** A reference to read the others against (last week), drawn dashed and without area. */
    dashed?: boolean;
};

export type TimeChartProps = {
    series: TimeSeries[];
    /** The window, in milliseconds. */
    from: number;
    to: number;
    /** Accessible name; keep a table of the same numbers next to the chart. */
    label: string;
    formatValue: (value: number) => string;
    formatTime?: (t: number) => string;
    /** Lowest top of the y axis, so a flat near-zero line does not fill the plot. */
    minimumTop?: number;
    /** A moment marked with a dashed line, such as a deploy or a selected request. */
    marker?: number | null;
    height?: number;
    className?: string;
};

export const CHART_PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

const PAD = { top: 8, right: 8, bottom: 22, left: 48 };

const defaultTime = (t: number) => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(t);

function useWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(640);

    useLayoutEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const update = () => setWidth(Math.max(240, element.clientWidth));
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return [ref, width] as const;
}

/**
 * THE CBOX TIME CHART: lines over one window with a faint area under each, hand-built in
 * SVG and drawn to scale (the y axis starts at zero). Round value ticks, time ticks on
 * whole minutes/hours/days, gaps where samples are missing, an optional marker, and a
 * crosshair with every series at the nearest sample on hover or tap. Colours are the
 * shared chart tokens, so light and dark follow on their own.
 */
export function TimeChart({ series, from, to, label, formatValue, formatTime = defaultTime, minimumTop = 0, marker = null, height = 200, className }: TimeChartProps) {
    const [ref, width] = useWidth<HTMLDivElement>();
    const [hover, setHover] = useState<number | null>(null);
    const coloured = series.map((item, index) => ({ ...item, color: item.color ?? CHART_PALETTE[index % CHART_PALETTE.length] ?? 'var(--chart-1)' }));
    const times = useMemo(() => [...new Set(series.flatMap((item) => item.segments.flat().map((point) => point.t)))].sort((a, b) => a - b), [series]);
    const ticks = niceTicks(Math.max(minimumTop, ...series.flatMap((item) => item.segments.flat().map((point) => point.value))));
    const top = ticks[ticks.length - 1] ?? 1;
    const plotWidth = width - PAD.left - PAD.right;
    const plotHeight = height - PAD.top - PAD.bottom;
    const span = Math.max(1, to - from);
    const x = (t: number) => PAD.left + ((t - from) / span) * plotWidth;
    const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;
    const baseline = y(0);
    const line = (segment: TimePoint[]) => segment.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.t).toFixed(1)} ${y(point.value).toFixed(1)}`).join('');

    const pick = (event: PointerEvent<SVGSVGElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const t = from + ((event.clientX - bounds.left - PAD.left) / plotWidth) * span;
        let best: number | null = null;

        for (const candidate of times) {
            if (best === null || Math.abs(candidate - t) < Math.abs(best - t)) {
                best = candidate;
            }
        }

        setHover(best);
    };

    const rows: { key: string; label: string; color: string; value: number }[] = [];

    if (hover !== null) {
        for (const item of coloured) {
            const point = item.segments.flat().find((candidate) => candidate.t === hover);

            if (point) {
                rows.push({ key: item.key, label: item.label, color: item.color, value: point.value });
            }
        }
    }

    const tooltip: ReactNode = hover !== null && (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 min-w-[140px] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-sm"
            style={{ left: Math.min(Math.max(x(hover) - 70, 0), Math.max(0, width - 160)) }}
        >
            <div className="font-mono tabular-nums text-muted-foreground">{formatTime(hover)}</div>
            {rows.map((row) => (
                <div key={row.key} className="flex items-center gap-2">
                    {coloured.length > 1 && <span className="size-2 rounded-full" style={{ background: row.color }} />}
                    {coloured.length > 1 && <span className="truncate text-muted-foreground">{row.label}</span>}
                    <span className="ml-auto font-mono font-medium tabular-nums">{formatValue(row.value)}</span>
                </div>
            ))}
        </div>
    );

    return (
        <div ref={ref} className={cn('relative w-full', className)}>
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label={label}
                className="block touch-pan-y select-none"
                onPointerMove={pick}
                onPointerDown={pick}
                onPointerLeave={(event) => {
                    if (event.pointerType === 'mouse') {
                        setHover(null);
                    }
                }}
            >
                {ticks.map((tick) => (
                    <g key={tick}>
                        <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeDasharray={tick === 0 ? undefined : '2 4'} />
                        <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground font-mono text-[11px] tabular-nums">
                            {formatValue(tick)}
                        </text>
                    </g>
                ))}
                {timeTicks(from, to, plotWidth).map((tick) => (
                    <text key={tick} x={x(tick)} y={height - 6} textAnchor="middle" className="fill-muted-foreground font-mono text-[11px] tabular-nums">
                        {formatTime(tick)}
                    </text>
                ))}
                {coloured.map((item) =>
                    item.segments.map((segment) => {
                        const first = segment[0];
                        const last = segment[segment.length - 1];

                        if (!first || !last) {
                            return null;
                        }

                        return segment.length > 1 ? (
                            <g key={`${item.key}-${first.t}`}>
                                {!item.dashed && <path d={`${line(segment)}L${x(last.t).toFixed(1)} ${baseline}L${x(first.t).toFixed(1)} ${baseline}Z`} fill={item.color} opacity={0.14} />}
                                <path d={line(segment)} fill="none" stroke={item.color} strokeWidth={1.5} strokeDasharray={item.dashed ? '4 3' : undefined} strokeLinejoin="round" strokeLinecap="round" />
                            </g>
                        ) : (
                            <circle key={`${item.key}-${first.t}`} cx={x(first.t)} cy={y(first.value)} r={2.5} fill={item.color} />
                        );
                    }),
                )}
                {marker !== null && marker >= from && marker <= to && <line x1={x(marker)} x2={x(marker)} y1={PAD.top} y2={baseline} stroke="var(--foreground)" strokeDasharray="4 4" />}
                {hover !== null && (
                    <g aria-hidden="true">
                        <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={baseline} stroke="var(--muted-foreground)" opacity={0.5} />
                        {rows.map((row) => (
                            <circle key={row.key} cx={x(hover)} cy={y(row.value)} r={3.5} fill="var(--background)" stroke={row.color} strokeWidth={2} />
                        ))}
                    </g>
                )}
            </svg>
            {tooltip}
        </div>
    );
}

/** A row's shape over the window, small: a line with a faint area, zero at the bottom. Decorative. */
export function Sparkline({ values, color = 'var(--chart-1)', width = 90, height = 20 }: { values: number[]; color?: string; width?: number; height?: number }) {
    if (values.length === 0) {
        return null;
    }

    const clean = values.map((value) => (Number.isFinite(value) ? value : 0));
    const max = Math.max(1e-9, ...clean);
    const points = clean.map((value, index) => [(index / Math.max(1, clean.length - 1)) * (width - 2) + 1, height - 1 - (value / max) * (height - 3)] as const);
    const d = points.map(([px, py], index) => `${index === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`).join('');

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            <path d={`${d}L${width - 1} ${height}L1 ${height}Z`} fill={color} opacity={0.14} />
            <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}
