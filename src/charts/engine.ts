import { BarChart, LineChart } from 'echarts/charts';
import { AriaComponent, DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

/** Only what the Cbox time, bar and waterfall charts use; loaded on first mount so pages without charts never pay for it. */
echarts.use([LineChart, BarChart, LegendComponent, DataZoomComponent, GridComponent, TooltipComponent, MarkLineComponent, AriaComponent, SVGRenderer]);

export { echarts };
