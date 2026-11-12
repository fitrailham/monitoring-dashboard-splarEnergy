import { AgCharts } from "ag-charts-react";
import { CategoryAxisModule, LineSeriesModule, NumberAxisModule } from "ag-charts-community";
import type { AgCartesianChartOptions } from "ag-charts-community";

const modules = [LineSeriesModule, CategoryAxisModule, NumberAxisModule];
const style = { width: "100%", height: "100%", minHeight: 0 };

export default function MonitoringLineChart<T>({ options }: { options: AgCartesianChartOptions<T> }) {
  return <AgCharts options={options} modules={modules} style={style} />;
}
