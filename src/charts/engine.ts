import { LineChart } from 'echarts/charts';
import { AriaComponent, DataZoomComponent, GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

/** Only what the Cbox time chart uses; loaded on first mount so pages without charts never pay for it. */
echarts.use([LineChart, DataZoomComponent, GridComponent, TooltipComponent, MarkLineComponent, AriaComponent, SVGRenderer]);

export { echarts };
