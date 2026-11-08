/** The chart tokens in order, for series that set their own colour. */
export const CHART_PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

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
