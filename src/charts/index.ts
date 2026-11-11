/** `@cboxdk/cbox-ui/charts`: the ECharts-based Cbox charts. Needs `echarts` (^6) installed. */
export { Chart, readChartColors, useChartColors, type ChartColors } from './chart';
export { TimeChart, type ChartEvent, type TimeChartProps, type TimeSeries } from './time-chart';
export { BarChart, WaterfallChart, type BarChartProps, type BarSeries, type WaterfallChartProps } from './bar-chart';
export { barExtent, niceRange, niceTicks, seriesData, timeTicks, waterfallBars, type SeriesDatum, type TimePoint, type WaterfallBar, type WaterfallStep } from './scale';
