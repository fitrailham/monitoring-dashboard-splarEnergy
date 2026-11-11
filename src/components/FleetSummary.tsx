import { useMemo } from "react";
import type { AgPolarChartOptions } from "ag-charts-community";
import { DashboardDonutChart } from "./AgDashboardChart";
import type { Plant } from "../services/fleet";
import { format, status, statusLabel } from "../services/fleet";
import { aggregateMetric, metricCoverageDetail, metricCoverageLabel, telemetryFreshness } from "../services/quality";
import type { MetricSummary } from "../services/quality";
import Icon from "./Icon";
import type { IconName } from "./Icon";

export interface AlarmSummary {
  available: boolean;
  counts: number[];
  coverage: number;
  totalPlants: number;
}
function Donut({
  values,
  colors,
  label,
  total,
}: {
  values: number[];
  colors: string[];
  label: string;
  total: number | null;
}) {
  const count = values.reduce((sum, value) => sum + value, 0);
  const options = useMemo<
    AgPolarChartOptions<{ label: string; value: number; color: string }>
  >(
    () => ({
      data: values
        .map((value, index) => ({
          label:
            label === "Total plants"
              ? ["Normal", "Faulty", "Disconnected", "Unknown"][index]
              : ["Critical", "Major", "Minor", "Warning", "Unclassified"][
                  index
                ],
          value,
          color: colors[index],
        }))
        .filter((d) => d.value > 0),
      background: { fill: "transparent" },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      animation: { enabled: false },
      legend: { enabled: false },
      overlays: { noData: { enabled: false } },
      series: [
        {
          type: "donut",
          angleKey: "value",
          calloutLabelKey: "label",
          innerRadiusRatio: 0.76,
          outerRadiusRatio: 0.9,
          strokeWidth: 0,
          sectorSpacing: count > 0 ? 0.5 : 0,
          calloutLabel: { enabled: false },
          sectorLabel: { enabled: false },
          itemStyler: ({ datum }) => ({
            fill: datum.color,
            stroke: datum.color,
          }),
          tooltip: {
            renderer: ({ datum }) => ({
              title: datum.label,
              data: [{ label: "Count", value: String(datum.value) }],
            }),
          },
        },
      ],
    }),
    [values, colors, label, count],
  );
  return (
    <div
      className="donut ag-donut"
      aria-label={label + ": " + (total ?? "belum tersedia")}
    >
      {!count && <div className="donut-empty-ring" aria-hidden="true" />}
      <DashboardDonutChart options={options} />
      <div className="donut-label">
        <strong>{total ?? "--"}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
function KPI({
  icon,
  label,
  value,
  unit,
  coverage,
}: {
  icon: IconName;
  label: string;
  value: number | null;
  unit: string;
  coverage?: MetricSummary;
}) {
  return (
    <div className="fleet-kpi">
      <div className="kpi-symbol">
        <Icon name={icon} size={25} />
      </div>
      <div>
        <div className="kpi-number">
          {format(value)} <small>{unit}</small>
        </div>
        <span>{label}</span>
        {coverage && (
          <small className={`kpi-coverage ${coverage.partial ? "partial" : ""}`} title={metricCoverageDetail(coverage)}>
            {metricCoverageLabel(coverage)}
          </small>
        )}
      </div>
    </div>
  );
}
export default function FleetSummary({
  plants,
  alarms,
  onStats,
  onStatus,
  now,
}: {
  plants: Plant[];
  alarms: AlarmSummary;
  onStats: () => void;
  onStatus: () => void;
  now: number;
}) {
  const statuses = ["normal", "faulty", "disconnected", "unknown"] as const;
  const values = statuses.map(
    (s) => plants.filter((p) => status(p) === s).length,
  );
  const power = aggregateMetric(plants, "pv_power_kw", now),
    yieldToday = aggregateMetric(plants, "yield_today_kwh", now),
    capacity = aggregateMetric(plants, "capacity_kwp", now),
    totalYield = aggregateMetric(plants, "total_yield_kwh", now);
  const freshness = plants.map((plant) => telemetryFreshness(plant, now));
  return (
    <section className="fleet-summary" aria-label="Fleet overview">
      <div className="solar-grid" aria-hidden="true" />
      <article className="summary-kpis">
        <div className="summary-title">
          <h2>
            Plant KPIs <Icon name="settings" size={13} />
          </h2>
          <button aria-label="Lihat statistik yield" onClick={onStats}>
            <Icon name="chevron" />
          </button>
        </div>
        <div className="kpi-grid">
          <KPI
            icon="bolt"
            label="Current power"
            value={power.value === null ? null : power.value / 1000}
            unit="MW"
            coverage={power}
          />
          <KPI
            icon="sun"
            label="Yield today"
            value={yieldToday.value === null ? null : yieldToday.value / 1000}
            unit="MWh"
            coverage={yieldToday}
          />
          <KPI icon="coins" label="Revenue today" value={null} unit="Rp" />
          <KPI
            icon="panel"
            label="Installed PV capacity"
            value={capacity.value === null ? null : capacity.value / 1000}
            unit="MWp"
            coverage={capacity}
          />
          <KPI
            icon="battery"
            label="Rated ESS capacity"
            value={null}
            unit="MWh"
          />
          <KPI
            icon="globe"
            label="Total yield"
            value={totalYield.value === null ? null : totalYield.value / 1e6}
            unit="GWh"
            coverage={totalYield}
          />
        </div>
      </article>
      <article className="summary-status">
        <div className="summary-title">
          <h2>Plant Status</h2>
          <button aria-label="Lihat daftar dan status PLTS" onClick={onStatus}>
            <Icon name="chevron" />
          </button>
        </div>
        <div className="donut-layout">
          <Donut
            values={values}
            colors={["#36bd3d", "#ff454d", "#a4adb5", "#4ba9e9"]}
            total={plants.length}
            label="Total plants"
          />
          <div className="donut-legend">
            {statuses.map((s, i) => (
              <div key={s}>
                <i className={`status-dot ${s}`} />
                <span>
                  <strong>{values[i]}</strong>
                  <small>{statusLabel[s]}</small>
                </span>
              </div>
            ))}
            <p>Status mengikuti data backend.</p>
          </div>
        </div>
      </article>
      <article className="summary-alarms">
        <div className="summary-title">
          <h2>Active Alarms</h2>
          <Icon name="bell" size={17} />
        </div>
        <div className="donut-layout">
          <Donut
            values={alarms.counts}
            colors={["#ff384b", "#ff8700", "#ffc437", "#48b0f6", "#a4adb5"]}
            total={
              alarms.available ? alarms.counts.reduce((a, b) => a + b, 0) : null
            }
            label="Total alarms"
          />
          <div className="donut-legend alarm-legend">
            {["Critical", "Major", "Minor", "Warning"].map((label, i) => (
              <div key={label}>
                <span className={`alarm-symbol severity-${i}`}>
                  <Icon
                    name={i === 0 ? "bell" : i === 1 ? "bolt" : "info"}
                    size={15}
                  />
                </span>
                <span>
                  <strong>{alarms.available ? alarms.counts[i] : "--"}</strong>
                  <small>{label}</small>
                </span>
              </div>
            ))}
            {alarms.counts[4] > 0 && (
              <div>
                <i className="status-dot disconnected" />
                <span>
                  <strong>{alarms.counts[4]}</strong>
                  <small>Unclassified</small>
                </span>
              </div>
            )}
            <p>
              {alarms.available
                ? `Cakupan ${alarms.coverage}/${alarms.totalPlants} PLTS`
                : "Data alarm belum tersedia"}
            </p>
          </div>
        </div>
      </article>
      <div className="fleet-data-quality" aria-label="Kualitas waktu pengukuran">
        <span>Telemetry:</span>
        <span>{freshness.filter((item) => item.state === "fresh").length} terbaru</span>
        <span>{freshness.filter((item) => item.state === "stale").length} lama</span>
        <span>{freshness.filter((item) => item.state === "unverified").length} belum terverifikasi</span>
        <span>{freshness.filter((item) => item.state === "missing").length} tanpa waktu</span>
        <small>KPI telemetry hanya menjumlahkan pengukuran terbaru yang terverifikasi.</small>
      </div>
    </section>
  );
}
