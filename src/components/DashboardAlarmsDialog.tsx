import { useEffect, useRef, useState } from "react";
import { translate as t } from "../i18n/language";
import { ALARM_SEVERITIES, alarmTimestamp, formatAlarmTime } from "../services/alarms";
import type { AlarmSeverity } from "../services/alarms";
import { DEFAULT_TIME_ZONE } from "../services/calendar";
import { ALARM_LEVELS } from "../services/dashboard";
import type { getDashboardAlarms } from "../services/dashboard";
import type { Plant } from "../services/fleet";
import type { DashboardFeed } from "../services/useDashboardData";
import DashboardFeedStatus from "./DashboardFeedStatus";
import Icon from "./Icon";

const pageSize = 10;
const columns = ["Plant Name", "Device Name", "Alarm Name", "Severity", "Raised Time", "Repair Suggestion"];
type AlarmData = Awaited<ReturnType<typeof getDashboardAlarms>>["value"];

export default function DashboardAlarmsDialog({ initialSeverity, feed, plants, onRetry, onClose }: {
  initialSeverity: AlarmSeverity | "";
  feed: DashboardFeed<AlarmData>;
  plants: Plant[];
  onRetry: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [severity, setSeverity] = useState(initialSeverity);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const names = new Map(plants.map((plant) => [plant.plant_code, plant.plant_name]));
  const matches = (feed.data?.alarms ?? []).filter((alarm) => !severity || alarm.severity === severity)
    .sort((a, b) => (alarmTimestamp(b.occurredAt) ?? -Infinity) - (alarmTimestamp(a.occurredAt) ?? -Infinity));
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const current = Math.min(page, pages);
  const fallback = feed.pending ? "Loading alarms…" : !feed.data ? "Alarm data is unavailable" :
    !feed.data.complete ? "No matching alarms in the available data." : severity ? "No matching alarms" : "No active alarms";

  return (
    <dialog ref={dialog} className="layout-dialog dashboard-alarm-dialog" aria-labelledby="dashboard-alarm-title" onCancel={onClose}>
      <div className="layout-dialog-heading">
        <h2 id="dashboard-alarm-title">{t("Active Alarms")}</h2>
        <button type="button" aria-label={t("Close")} onClick={onClose}><Icon name="close" size={17} /></button>
      </div>
      <div className="dashboard-alarm-content">
        <DashboardFeedStatus feed={feed} onRetry={onRetry} />
        {feed.data && !feed.data.complete && <p className="more-alarm-note">{t("Alarm coverage is partial.")}</p>}
        <label className="dashboard-alarm-filters">{t("Severity")}
          <select value={severity} aria-label={t("Severity")} onChange={(event) => { setSeverity(event.target.value as AlarmSeverity | ""); setPage(1); }}>
            <option value="">{t("All")}</option>
            {ALARM_LEVELS.map((level) => <option value={level} key={level}>{t(ALARM_SEVERITIES[level])}</option>)}
          </select>
        </label>
        <div className="dashboard-alarm-table" tabIndex={0} role="region" aria-label={t("Active alarm table")}>
          <table>
            <thead><tr>{columns.map((column) => <th scope="col" key={column}>{t(column)}</th>)}</tr></thead>
            <tbody>
              {matches.slice((current - 1) * pageSize, current * pageSize).map((alarm, index) => (
                <tr key={`${alarm.id}:${index}`}>
                  <td>{names.get(alarm.plantCode) ?? (alarm.plantName || "—")}</td>
                  <td>{alarm.deviceName ?? "—"}</td>
                  <td>{alarm.name ?? "—"}</td>
                  <td><span className={`alarm-severity-label ${alarm.severity}`}><i />{t(ALARM_SEVERITIES[alarm.severity])}</span></td>
                  <td>{formatAlarmTime(alarm.occurredAt, DEFAULT_TIME_ZONE) ?? "—"}</td>
                  <td>{alarm.repairSuggestion ?? "—"}</td>
                </tr>
              ))}
              {!matches.length && <tr><td className="alarm-table-message" colSpan={6}>{t(fallback)}</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="dashboard-alarm-pages">
          <span>{t("Total: ")}{feed.data ? matches.length : "—"}</span>
          {pages > 1 && <nav aria-label={t("Alarm table pagination")}>
            <button type="button" disabled={current === 1} aria-label={t("Previous page")} onClick={() => setPage(current - 1)}>‹</button>
            <span>{current} / {pages}</span>
            <button type="button" disabled={current === pages} aria-label={t("Next page")} onClick={() => setPage(current + 1)}>›</button>
          </nav>}
        </footer>
      </div>
    </dialog>
  );
}
