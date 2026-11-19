import { useMemo, useState } from "react";
import type { AgPolarChartOptions } from "ag-charts-community";
import { getLocale, translate as t } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
import { ALARM_SEVERITIES } from "../services/alarms";
import type { AlarmSeverity } from "../services/alarms";
import { ALARM_LEVELS, PLANT_STATUSES, countPlantStatuses, formatDashboardMetric } from "../services/dashboard";
import { number, statusLabel } from "../services/fleet";
import type { Plant, PlantStatus } from "../services/fleet";
import type { DashboardOverview } from "../services/portfolio";
import { telemetryFreshness } from "../services/quality";
import type { useDashboardData } from "../services/useDashboardData";
import { DashboardDonutChart } from "./AgDashboardChart";
import DashboardFeedStatus from "./DashboardFeedStatus";
import Icon from "./Icon";
import type { IconName } from "./Icon";
import "./FleetSummary.css";

export interface AlarmSummary {
  available: boolean;
  counts: number[];
  coverage: number;
  totalPlants: number;
  complete?: boolean;
}

const statusColors = ["#36bd3d", "#ff454d", "#a4adb5", "#4ba9e9"];
const alarmColors = ["#ff384b", "#ff8700", "#ffc437", "#48b0f6", "#a4adb5"];
const alarmIcons = ["bell", "bolt", "info", "info", "help"] satisfies IconName[];
const kpis: { key: string; label: string; icon: IconName; units: string[] }[] = [
  { key: "current_power_kw", label: "Current power", icon: "bolt", units: ["kW", "MW"] },
  { key: "yield_today_kwh", label: "Yield today", icon: "sun", units: ["kWh", "MWh"] },
  { key: "revenue_today_idr", label: "Revenue today", icon: "coins", units: ["Rp"] },
  { key: "inverter_rated_power_kw", label: "Inverter rated power", icon: "device", units: ["kW", "MW"] },
  { key: "ess_rated_capacity_kwh", label: "Rated ESS capacity", icon: "battery", units: ["kWh", "MWh"] },
  { key: "total_yield_kwh", label: "Total yield", icon: "globe", units: ["kWh", "MWh", "GWh"] },
];
type Slice = { index: number; label: string; value: number | null; color: string };

function Donut({ slices, label, total, pending, partial, onSelect, onOpen }: {
  slices: Slice[];
  label: string;
  total: number | null;
  pending: boolean;
  partial?: boolean;
  onSelect: (index: number) => void;
  onOpen?: () => void;
}) {
  const hasValues = slices.some(({ value }) => value !== null && value > 0);
  const options = useMemo<AgPolarChartOptions<Slice>>(() => ({
    data: slices.filter(({ value }) => value !== null && value > 0),
    background: { fill: "transparent" },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    animation: { enabled: false },
    legend: { enabled: false },
    overlays: { noData: { enabled: false } },
    series: [{
      type: "donut",
      angleKey: "value",
      calloutLabelKey: "label",
      innerRadiusRatio: 0.76,
      outerRadiusRatio: 0.9,
      sectorSpacing: 0.5,
      calloutLabel: { enabled: false },
      sectorLabel: { enabled: false },
      cursor: "pointer",
      itemStyler: ({ datum }) => ({ fill: datum.color, stroke: datum.color }),
      listeners: { seriesNodeClick: ({ datum }) => onSelect(datum.index) },
    }],
  }), [slices, onSelect]);
  const count = total === null ? "—" : `${partial ? "≥" : ""}${new Intl.NumberFormat(getLocale()).format(total)}`;
  const center = <><strong>{count}</strong><span>{t(label)}</span></>;

  return (
    <div className="donut ag-donut">
      {!hasValues && <div className={`donut-empty-ring${pending ? " dashboard-ring-skeleton" : ""}`} aria-hidden="true" />}
      {hasValues && <DashboardDonutChart options={options} />}
      {!pending && (onOpen
        ? <button className="donut-label donut-link" type="button" aria-label={t("View active alarms")} onClick={onOpen}>{center}</button>
        : <div className="donut-label">{center}</div>)}
    </div>
  );
}

function KpiGrid({ overview, pending, showCoverage }: {
  overview?: DashboardOverview;
  pending: boolean;
  showCoverage: boolean;
}) {
  const locale = getLocale();
  const counts = new Intl.NumberFormat(locale);
  return (
    <div className="kpi-grid" id="fleet-kpi-grid">
      {kpis.map(({ key, label, icon, units }) => {
        const revenue = key === "revenue_today_idr";
        const unconfigured = revenue && overview?.revenue?.status === "unconfigured";
        const coverage = overview?.coverage[key];
        const raw = kpiValue(overview, key);
        const { amount, unit } = formatDashboardMetric(raw, units, locale, revenue);
        return (
          <div className="fleet-kpi" key={key}>
            <div className="kpi-symbol"><Icon name={icon} size={25} /></div>
            <div>
              {pending ? <div className="dashboard-skeleton" aria-hidden="true" /> :
                <div className="kpi-number" aria-label={raw === null ? t("Data unavailable") : undefined}>
                  {amount} <small>{t(unit)}</small>
                </div>}
              <span>{t(label)}</span>
              {unconfigured && <small className="kpi-coverage" title={overview?.revenue?.reason || undefined}>
                {t("Revenue not configured")}
              </small>}
              {showCoverage && coverage && (
                <small className={`kpi-coverage${coverage.partial ? " partial" : ""}`}>
                  {t(`Coverage ${counts.format(coverage.valid)}/${counts.format(coverage.expected)} plants${coverage.partial ? " · partial" : ""}`)}
                  {(coverage.missing > 0 || coverage.stale > 0 || coverage.unverified > 0 || coverage.not_applicable > 0) && (
                    <span className="kpi-coverage-detail">
                      {t(`${counts.format(coverage.missing)} missing, ${counts.format(coverage.stale)} stale, ${counts.format(coverage.unverified)} unverified, ${counts.format(coverage.not_applicable)} not applicable`)}
                    </span>
                  )}
                </small>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function kpiValue(overview: DashboardOverview | undefined, key: string) {
  return key === "revenue_today_idr" && overview?.revenue?.status === "unconfigured"
    ? null : number(overview?.kpis[key]);
}

export default function FleetSummary({
  plants, alarms, feeds, statusFilter, onStats, onStatus, onAlarms, now,
}: {
  plants: Plant[];
  alarms: AlarmSummary;
  feeds: ReturnType<typeof useDashboardData>;
  statusFilter: PlantStatus | "";
  onStats: () => void;
  onStatus: (status: PlantStatus | "") => void;
  onAlarms: (severity: AlarmSeverity | "") => void;
  now: number;
}) {
  useLanguage();
  const [showCoverage, setShowCoverage] = useState(false);
  const { overview, plants: plantFeed, alarms: alarmFeed, refresh } = feeds;
  const plantCounts = countPlantStatuses(plants);
  const plantSlices = PLANT_STATUSES.map((status, index) => ({
    index, label: t(statusLabel[status]), color: statusColors[index],
    value: plantFeed.data === undefined ? null : plantCounts[status],
  }));
  const alarmSlices = ALARM_LEVELS.map((severity, index) => ({
    index, label: t(ALARM_SEVERITIES[severity]), color: alarmColors[index],
    value: alarmFeed.data === undefined ? null : alarms.counts[index],
  }));
  const alarmTotal = alarmFeed.data?.alarms.length ?? null;
  const freshness = showCoverage ? plants.map((plant) => telemetryFreshness(plant, now)) : [];
  const retry = () => void refresh();
  const fmt = new Intl.NumberFormat(getLocale());

  return (
    <section className="fleet-summary" aria-label={t("Fleet overview")}>
      <div className="solar-grid" aria-hidden="true" />
      <article className="summary-kpis" aria-busy={overview.pending}>
        <div className="summary-title">
          <div className="summary-title-label">
            <h2>{t("Plant KPIs")}</h2>
            <button type="button" aria-label={t("Show KPI coverage")} aria-expanded={showCoverage}
              aria-controls="fleet-kpi-grid" onClick={() => setShowCoverage(!showCoverage)}>
              <Icon name="settings" size={14} />
            </button>
          </div>
          <button type="button" aria-label={t("View yield statistics")} onClick={onStats}><Icon name="chevron" /></button>
        </div>
        <KpiGrid overview={overview.data} pending={overview.pending} showCoverage={showCoverage} />
        <DashboardFeedStatus feed={overview} onRetry={retry}
          empty={overview.data && kpis.every(({ key }) => kpiValue(overview.data, key) === null) ? "KPI data is unavailable." : undefined} />
      </article>
      <article className="summary-status" aria-busy={plantFeed.pending}>
        <div className="summary-title">
          <h2>{t("Plant Status")}</h2>
          <button type="button" aria-label={t("View plant list and status")} onClick={() => onStatus("")}><Icon name="chevron" /></button>
        </div>
        <div className="donut-layout">
          <Donut slices={plantSlices} label="Total plants" total={plantFeed.data === undefined ? null : plants.length}
            pending={plantFeed.pending} onSelect={(index) => onStatus(PLANT_STATUSES[index])} />
          <div className="donut-legend">
            {plantSlices.filter(({ index, value }) => index !== 3 || (value ?? 0) > 0).map(({ index, label, value }) => (
              <button key={label} type="button" disabled={plantFeed.data === undefined}
                aria-pressed={statusFilter === PLANT_STATUSES[index]} onClick={() => onStatus(PLANT_STATUSES[index])}>
                <i className={`status-dot ${PLANT_STATUSES[index]}`} />
                <span><strong>{plantFeed.pending ? <i className="dashboard-skeleton" /> : value === null ? "—" : fmt.format(value)}</strong><small>{label}</small></span>
              </button>
            ))}
          </div>
        </div>
        <DashboardFeedStatus feed={plantFeed} onRetry={retry} empty={!plants.length ? "No plants yet" : undefined} />
      </article>
      <article className="summary-alarms" aria-busy={alarmFeed.pending}>
        <div className="summary-title">
          <h2>{t("Active Alarms")}</h2>
          <button type="button" aria-label={t("Open active alarm table")} onClick={() => onAlarms("")}><Icon name="chevron" /></button>
        </div>
        <div className="donut-layout">
          <Donut slices={alarmSlices} label="Total alarms" total={alarmTotal} pending={alarmFeed.pending}
            partial={alarms.complete === false} onSelect={(index) => onAlarms(ALARM_LEVELS[index])} onOpen={() => onAlarms("")} />
          <div className="donut-legend alarm-legend">
            {alarmSlices.filter(({ index, value }) => index < 4 || (value ?? 0) > 0).map(({ index, label, value }) => (
              <button key={label} type="button" disabled={alarmFeed.data === undefined} onClick={() => onAlarms(ALARM_LEVELS[index])}>
                <span className={`alarm-symbol severity-${index}`}><Icon name={alarmIcons[index]} size={15} /></span>
                <span><strong>{alarmFeed.pending ? <i className="dashboard-skeleton" /> : value === null ? "—" : fmt.format(value)}</strong><small>{label}</small></span>
              </button>
            ))}
            {alarmFeed.data && !alarms.complete && <p>{t("Alarm coverage is partial.")}</p>}
          </div>
        </div>
        <DashboardFeedStatus feed={alarmFeed} onRetry={retry} empty={alarmTotal === 0 && alarms.complete ? "No active alarms" : undefined} />
      </article>
      {showCoverage && (
        <div className="fleet-data-quality" id="fleet-telemetry-coverage" aria-label={t("Measurement time quality")}>
          <span>{t("Telemetry:")}</span>
          {(["fresh", "stale", "unverified", "missing"] as const).map((state, index) => (
            <span key={state}>{freshness.filter((item) => item.state === state).length}
              {t([" terbaru", " lama", " belum terverifikasi", " tanpa waktu"][index])}</span>
          ))}
        </div>
      )}
    </section>
  );
}
