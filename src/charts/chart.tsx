import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../utils/cn';

/** The chart colours of the mode on screen, read from the design tokens. */
export type ChartColors = {
    series: string[];
    text: string;
    muted: string;
    grid: string;
    surface: string;
    border: string;
    font: string;
    mono: string;
};

export function readChartColors(): ChartColors {
    const style = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;

    return {
        series: [1, 2, 3, 4, 5].map((index) => token(`--chart-${index}`, '#2a78d6')),
        text: token('--foreground', '#1f1a13'),
        muted: token('--muted-foreground', '#6a6257'),
        grid: token('--border', '#e2ded5'),
        surface: token('--popover', '#fffefc'),
        border: token('--border', '#e2ded5'),
        font: getComputedStyle(document.body).fontFamily,
        mono: token('--font-mono', '') || 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    };
}

/** Follows the theme switch: the `dark` class and `data-theme` on <html>, and the OS setting. */
export function useChartColors(): ChartColors {
    const [colors, setColors] = useState(readChartColors);

    useEffect(() => {
        const update = () => setColors(readChartColors());
        const observer = new MutationObserver(update);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        media.addEventListener('change', update);

        return () => {
            observer.disconnect();
            media.removeEventListener('change', update);
        };
    }, []);

    return colors;
}

/**
 * One ECharts chart, the Cbox convention: SVG renderer, sized by its box, ECharts imported on
 * first mount. The option is built from the colours on screen, so light and dark follow, and
 * animation is off under reduced motion. `label` is what a screen reader hears; keep a table
 * of the same numbers beside the chart. Keep `option` stable (useCallback) to avoid redraws.
 */
export function Chart({ option, label, height = 220, className }: { option: (colors: ChartColors) => EChartsCoreOption; label: string; height?: number; className?: string }) {
    const box = useRef<HTMLDivElement>(null);
    const [chart, setChart] = useState<ECharts | null>(null);
    const colors = useChartColors();

    useEffect(() => {
        let disposed = false;
        let instance: ECharts | null = null;
        let resize: ResizeObserver | null = null;

        void import('./engine').then(({ echarts }) => {
            const element = box.current;

            if (disposed || !element) {
                return;
            }

            instance = echarts.init(element, null, { renderer: 'svg' });
            resize = new ResizeObserver(() => instance?.resize());
            resize.observe(element);
            setChart(instance);
        });

        return () => {
            disposed = true;
            resize?.disconnect();
            instance?.dispose();
        };
    }, []);

    useEffect(() => {
        if (!chart) {
            return;
        }

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        chart.setOption({ animation: !reduce, aria: { enabled: true, label: { description: label } }, ...option(colors) }, true);
    }, [chart, option, colors, label]);

    return <div ref={box} style={{ height }} role="img" aria-label={label} className={cn('w-full', className)} />;
}
