import { AgCharts } from "ag-charts-react";
import {
  BarSeriesModule,
  CategoryAxisModule,
  DonutSeriesModule,
  NumberAxisModule,
} from "ag-charts-community";
import type {
  AgCartesianChartOptions,
  AgPolarChartOptions,
} from "ag-charts-community";

const barModules = [BarSeriesModule, CategoryAxisModule, NumberAxisModule];
const donutModules = [DonutSeriesModule];
const chartStyle = { width: "100%", height: "100%", minHeight: 0 };

export function DashboardBarChart<T>({
  options,
}: {
  options: AgCartesianChartOptions<T>;
}) {
  return <AgCharts options={options} modules={barModules} style={chartStyle} />;
}

export function DashboardDonutChart<T>({
  options,
}: {
  options: AgPolarChartOptions<T>;
}) {
  return (
    <AgCharts options={options} modules={donutModules} style={chartStyle} />
  );
}
