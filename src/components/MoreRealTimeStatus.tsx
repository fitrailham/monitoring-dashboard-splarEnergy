import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { translate as t } from "../i18n/language";
import { ALARM_SEVERITIES, getFleetAlarmPage } from "../services/alarms";
import { format, status, statusLabel } from "../services/fleet";
import type { Plant } from "../services/fleet";
import { summaryMetric } from "../services/portfolio";
import type { DashboardOverview } from "../services/portfolio";
import { aggregateMetric, metricCoverageLabel } from "../services/quality";
import type { AlarmSummary } from "./FleetSummary";
import Icon from "./Icon";
import PlantMap from "./PlantMap";

const PAGE_SIZE = 8;
const PLANT_COLORS = { normal: "#2fa363", faulty: "#da536e", disconnected: "#8898a9", unknown: "#477ebb" };
const ALARM_COLORS = ["#d64360", "#e1792b", "#e4ad2e", "#4a87c7", "#8797aa"];
const SEVERITIES = Object.keys(ALARM_SEVERITIES) as (keyof typeof ALARM_SEVERITIES)[];

interface Props {
  plants: Plant[];
  loading: boolean;
  now: number;
  refreshKey: number;
  alarms: AlarmSummary;
  summary: DashboardOverview | null;
  onPlantSelect: (plant: Plant) => void;
  onAlarmSelect: (plantCode: string) => void;
}

function PageControls({ label, page, pages, total, onPageChange }: {
  label: string; page: number; pages: number; total: string | number; onPageChange: (page: number) => void;
}) {
  return (
    <footer className="more-live-pagination">
      <span>{t("Total: ")}{total}</span>
      <nav aria-label={t(label)}>
        <button type="button" className="more-prev" aria-label={t("Previous page")} disabled={page === 1}
          onClick={() => onPageChange(page - 1)}><Icon name="chevron" size={14} /></button>
        <span>{page} / {pages}</span>
        <button type="button" aria-label={t("Next page")} disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}><Icon name="chevron" size={14} /></button>
      </nav>
    </footer>
  );
}

function StatusBreakdown({ title, total, entries, note }: {
  title: string; total: number | null; entries: { label: string; count: number | null; color: string }[]; note?: string;
}) {
  const sum = entries.reduce((value, entry) => value + (entry.count ?? 0), 0);
  let offset = 0;
  const sectors: string[] = [];
  for (const { count, color } of entries) {
    const next = offset + (sum ? ((count ?? 0) / sum) * 360 : 0);
    sectors.push(`${color} ${offset}deg ${next}deg`);
    offset = next;
  }

  return (
    <section className="more-status-breakdown" aria-label={t(title)}>
      <h3>{t(title)}</h3>
      <div>
        <div className="more-status-ring" style={{ background: sum ? `conic-gradient(${sectors.join(",")})` : undefined }} aria-hidden="true">
          <strong>{total ?? "—"}</strong>
        </div>
        <ul>{entries.map(({ label, count, color }) => (
          <li key={label} style={{ "--status-color": color } as CSSProperties}><i />{t(label)}<strong>{count ?? "—"}</strong></li>
        ))}</ul>
      </div>
      {note && <p>{t(note)}</p>}
    </section>
  );
}

export default function MoreRealTimeStatus({ plants, loading, now, refreshKey, alarms, summary, onPlantSelect, onAlarmSelect }: Props) {
  const [plantPage, setPlantPage] = useState(1);
  const [alarmPage, setAlarmPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{
    key: string; data?: Awaited<ReturnType<typeof getFleetAlarmPage>>; error?: string;
  }>();
  const key = `${alarmPage}:${refreshKey}:${retry}`;

  useEffect(() => {
    const controller = new AbortController();
    void getFleetAlarmPage(alarmPage, PAGE_SIZE, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(1, Math.ceil((data.total ?? 0) / PAGE_SIZE));
      if (data.total !== null && lastPage < alarmPage) {
        setAlarmPage(lastPage);
        return;
      }
      setResponse({ key, data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted)
        setResponse({ key, error: error instanceof Error ? error.message : "Alarm data could not be loaded." });
    });
    return () => controller.abort();
  }, [alarmPage, key]);

  const active = response?.key === key ? response : undefined;
  const alarmData = active?.data;
  const plantPages = Math.max(1, Math.ceil(plants.length / PAGE_SIZE));
  const currentPlantPage = Math.min(plantPage, plantPages);
  const alarmPages = Math.max(alarmPage, Math.ceil((alarmData?.total ?? 0) / PAGE_SIZE));
  const power = summaryMetric(summary, "current_power_kw", aggregateMetric(plants, "pv_power_kw", now), "pv_power_kw");
  const yieldToday = summaryMetric(summary, "yield_today_kwh", aggregateMetric(plants, "yield_today_kwh", now));
  const plantStatuses = (Object.keys(PLANT_COLORS) as (keyof typeof PLANT_COLORS)[]).map((item) => ({
    label: statusLabel[item], color: PLANT_COLORS[item],
    count: loading && !plants.length ? null : plants.filter((plant) => status(plant) === item).length,
  }));
  const plantNames = new Map(plants.map((plant) => [plant.plant_code, plant.plant_name]));
  const alarmTotal = alarmData?.total ?? (alarms.available ? alarms.counts.reduce((sum, count) => sum + count, 0) : null);

  return (
    <section className="more-live" aria-label={t("Real-Time Status")}>
      <section className="more-live-panel">
        <h2><Icon name="panel" size={18} />{t("Plant Status Center")}</h2>
        <div className="more-table-scroll" tabIndex={0} role="region" aria-label={t("Plant Status Center")}>
          <table className="more-data-table">
            <thead><tr>{["Plant Name", "Installed PV (kWp)", "Power (kW)", "Status"].map((label) => <th key={label} scope="col">{t(label)}</th>)}</tr></thead>
            <tbody>
              {plants.slice((currentPlantPage - 1) * PAGE_SIZE, currentPlantPage * PAGE_SIZE).map((plant) => (
                <tr key={plant.plant_code}>
                  <td><button type="button" onClick={() => onPlantSelect(plant)}>{plant.plant_name}</button></td>
                  <td>{format(plant.capacity_kwp)}</td>
                  <td>{format(aggregateMetric([plant], "pv_power_kw", now).value)}</td>
                  <td><span className={`status-dot ${status(plant)}`} role="img" aria-label={t(statusLabel[status(plant)])} title={t(statusLabel[status(plant)])} /></td>
                </tr>
              ))}
              {!plants.length && <tr><td colSpan={4} className="more-table-message">{t(loading ? "Loading plants…" : "No plants yet")}</td></tr>}
            </tbody>
          </table>
        </div>
        <PageControls label="Plant table pagination" page={currentPlantPage} pages={plantPages}
          total={loading && !plants.length ? "—" : plants.length} onPageChange={setPlantPage} />
        <StatusBreakdown title="Plant Status" total={loading && !plants.length ? null : plants.length} entries={plantStatuses} />
      </section>

      <section className="more-live-map" aria-label={t("Solar plant map")}>
        <div className="more-live-kpis">
          <div title={t(metricCoverageLabel(power))}><Icon name="bolt" size={20} /><div><span>{t("Current power")}</span><strong>{format(power.value)} <small>kW</small></strong></div></div>
          <div title={t(metricCoverageLabel(yieldToday))}><Icon name="sun" size={20} /><div><span>{t("Yield today")}</span><strong>{format(yieldToday.value)} <small>kWh</small></strong></div></div>
        </div>
        <PlantMap plants={plants} onSelect={onPlantSelect} embedded />
      </section>

      <section className="more-live-panel">
        <h2><Icon name="bell" size={18} />{t("Plant Alarm Center")}</h2>
        {active?.error && <p className="more-alarm-note" role="alert">{t(active.error)} <button type="button" onClick={() => setRetry((value) => value + 1)}>{t("Try again")}</button></p>}
        {alarmData?.configured && !alarmData.complete && <p className="more-alarm-note" role="status">{t("Alarm coverage is partial.")}</p>}
        <div className="more-table-scroll" tabIndex={0} role="region" aria-label={t("Plant Alarm Center")}>
          <table className="more-data-table">
            <thead><tr>{["Plant Name", "Alarm Name", "Severity"].map((label) => <th scope="col" key={label}>{t(label)}</th>)}</tr></thead>
            <tbody>
              {alarmData?.alarms.map((alarm, index) => (
                <tr key={`${alarm.id}:${index}`}>
                  <td><button type="button" onClick={() => onAlarmSelect(alarm.plantCode)} disabled={!plantNames.has(alarm.plantCode)}>{plantNames.get(alarm.plantCode) ?? alarm.plantName}</button></td>
                  <td>{alarm.name ?? "—"}</td>
                  <td><span className="more-severity" style={{ "--status-color": ALARM_COLORS[SEVERITIES.indexOf(alarm.severity)] } as CSSProperties}><i />{t(ALARM_SEVERITIES[alarm.severity])}</span></td>
                </tr>
              ))}
              {!alarmData?.alarms.length && <tr><td colSpan={3} className="more-table-message">
                {t(!active ? "Loading alarms…" : alarmData?.total == null ? "Alarm data is unavailable" : "No data")}
              </td></tr>}
            </tbody>
          </table>
        </div>
        <PageControls label="Alarm table pagination" page={alarmPage} pages={alarmPages}
          total={alarmData?.total == null ? "—" : `${alarmData.complete ? "" : "≥"}${alarmData.total}`} onPageChange={setAlarmPage} />
        <StatusBreakdown title="Active Alarms" total={alarmTotal}
          entries={SEVERITIES.map((severity, index) => ({
            label: ALARM_SEVERITIES[severity], color: ALARM_COLORS[index], count: alarms.available ? alarms.counts[index] : null,
          }))}
          note={alarms.available && !alarms.complete ? "Alarm coverage is partial." : undefined} />
      </section>
    </section>
  );
}
