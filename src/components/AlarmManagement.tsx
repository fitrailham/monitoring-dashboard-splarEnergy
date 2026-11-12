import { useEffect, useMemo, useRef, useState } from "react";
import type { Plant } from "../services/fleet";
import { validTimeZone } from "../services/calendar";
import { DEVICE_TYPES, getDevices } from "../services/devices";
import { ALARM_SEVERITIES, EMPTY_ALARM_FILTERS, alarmFiltersHaveCoverage, alarmTimestamp, enrichAlarmDevices,
  filterAlarms, formatAlarmTime, getAlarmSnapshot, sortAlarms, validAlarmRange } from "../services/alarms";
import type { AlarmFilters, AlarmSeverity, AlarmSnapshot, AlarmSortKey, AlarmState, MonitoringAlarm } from "../services/alarms";
import { trendCsv } from "../services/monitoring";
import Icon from "./Icon";

const EMPTY_ALARMS: MonitoringAlarm[] = [];
const COLUMNS: { key: AlarmSortKey; title: string; className: string }[] = [
  { key: "severity", title: "Alarm Severity", className: "alarms-col-severity" },
  { key: "plantName", title: "Plant Name", className: "alarms-col-plant" },
  { key: "deviceType", title: "Device Type", className: "alarms-col-type" },
  { key: "deviceName", title: "Device Name", className: "alarms-col-device" },
  { key: "sn", title: "SN", className: "alarms-col-sn" },
  { key: "alarmId", title: "Alarm ID", className: "alarms-col-id" },
  { key: "name", title: "Alarm Name", className: "alarms-col-name" },
  { key: "occurredAt", title: "Occurrence Time", className: "alarms-col-time" },
];

function EmptyAlarmIcon() {
  return <svg width="82" height="70" viewBox="0 0 90 76" fill="none" aria-hidden="true"><ellipse cx="45" cy="68" rx="34" ry="5" fill="#f4f5f7" /><path d="m18 44 13-18h28l14 18v23H18Z" fill="#eceff3" /><path d="m27 46 10-16h16l12 16v9H27Z" fill="#c9cfd7" /><path d="M14 43h14l5 12h25l5-12h14" stroke="#fff" strokeWidth="3" /><path d="m58 11 6-7 5 1-3 8-5 2" fill="#d8dde4" /><path d="M61 19c13 0 11-13 5-10M23 23c-12-10 3-12 2-4" stroke="#e6e9ed" strokeDasharray="3 3" /><path d="m13 25 4 2-2 4-4-4Z" fill="#e0e4e9" /></svg>;
}

export default function AlarmManagement({ plant, refreshKey, onOverview }: { plant?: Plant; refreshKey: number; onOverview: () => void }) {
  const code = plant?.plant_code ?? "", plantName = plant?.plant_name ?? "", zone = validTimeZone(plant?.time_zone);
  const [state, setState] = useState<AlarmState>("active"), [draft, setDraft] = useState<AlarmFilters>(EMPTY_ALARM_FILTERS);
  const [filters, setFilters] = useState<AlarmFilters>(EMPTY_ALARM_FILTERS), [severity, setSeverity] = useState<AlarmSeverity | "">("");
  const [autoRefresh, setAutoRefresh] = useState(false), [revision, setRevision] = useState(0), [formError, setFormError] = useState("");
  const [page, setPage] = useState(1), [size, setSize] = useState(10), [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<{ key: AlarmSortKey; direction: "asc" | "desc" }>({ key: "occurredAt", direction: "desc" });
  const [response, setResponse] = useState<{ key: string; data: AlarmSnapshot | null; error: string; syncedAt: string | null } | null>(null);
  const [detail, setDetail] = useState<MonitoringAlarm | null>(null);
  const busy = useRef(false), requestId = useRef(0), dialog = useRef<HTMLDialogElement>(null), checkbox = useRef<HTMLInputElement>(null);
  const key = JSON.stringify([code, plantName, state, refreshKey, revision]);
  const active = response?.key === key ? response : null;
  const loading = Boolean(code) && !active, data = active?.data ?? null;
  useEffect(() => {
    if (!code) return;
    const controller = new AbortController(), id = ++requestId.current;
    busy.current = true;
    void Promise.allSettled([getAlarmSnapshot(code, plantName, state, controller.signal), getDevices(code, plantName, controller.signal)])
      .then(([snapshot, inventory]) => {
        if (controller.signal.aborted) return;
        if (snapshot.status === "rejected") throw snapshot.reason;
        const result = snapshot.value;
        const warnings = [...result.warnings];
        if (result.alarms.length && inventory.status === "rejected") warnings.push("Metadata perangkat belum dapat dimuat; filter tipe/SN mungkin belum lengkap.");
        if (result.alarms.length && inventory.status === "fulfilled" && inventory.value.warning) warnings.push(inventory.value.warning);
        const alarms = inventory.status === "fulfilled" ? enrichAlarmDevices(result.alarms, inventory.value.devices) : result.alarms;
        setResponse({ key, data: { ...result, alarms, warnings }, error: "", syncedAt: new Date().toISOString() });
      }).catch((error) => {
        if (!controller.signal.aborted) setResponse({ key, data: null, error: error instanceof Error ? error.message : "Gagal memuat data alarm.", syncedAt: null });
      }).finally(() => { if (requestId.current === id) busy.current = false; });
    return () => controller.abort();
  }, [code, plantName, state, key]);
  useEffect(() => {
    if (!autoRefresh || !code) return;
    const timer = setInterval(() => { if (!busy.current) setRevision((value) => value + 1); }, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, code]);
  useEffect(() => { if (detail) dialog.current?.showModal(); else dialog.current?.close(); }, [detail]);
  const alarms = data?.alarms ?? EMPTY_ALARMS;
  const filteredBase = useMemo(() => filterAlarms(alarms, filters, zone), [alarms, filters, zone]);
  const filtered = useMemo(() => sortAlarms(severity ? filteredBase.filter((alarm) => alarm.severity === severity) : filteredBase, sort.key, sort.direction), [filteredBase, severity, sort]);
  const coverageComplete = Boolean(data?.complete) && alarmFiltersHaveCoverage(alarms, filters);
  const pages = Math.max(1, Math.ceil(filtered.length / size)), current = Math.min(page, pages);
  const displayed = filtered.slice((current - 1) * size, current * size), selected = filtered.filter((alarm) => selection.has(alarm.id));
  const allSelected = displayed.length > 0 && displayed.every((alarm) => selection.has(alarm.id));
  const someSelected = displayed.some((alarm) => selection.has(alarm.id));
  useEffect(() => { if (checkbox.current) checkbox.current.indeterminate = someSelected && !allSelected; }, [someSelected, allSelected]);
  function countLabel(count: number) { return loading || !data?.configured ? "--" : coverageComplete ? String(count) : count > 0 ? `≥${count}` : "--"; }
  function changeState(value: AlarmState) { setState(value); setPage(1); setSeverity(""); setSelection(new Set()); setFormError(""); }
  const canExport = Boolean(data?.configured) && !loading && !active?.error && (filtered.length > 0 || coverageComplete);
  function download() {
    if (!canExport || !data) return;
    const rows = selected.length ? selected : filtered;
    const csv = trendCsv([
      ["Plant Code", "Severity", "Plant Name", "Device Type", "Device Name", "SN", "Alarm ID", "Vendor Alarm ID", "Alarm Name", `Occurrence Time (${zone})`, "Occurrence Timestamp (source)", "Offset-aware timestamp", "State", "Acknowledged", `Cleared Time (${zone})`, "Description", "Coverage Complete"],
      ...rows.map((alarm) => [code, ALARM_SEVERITIES[alarm.severity], alarm.plantName, DEVICE_TYPES[alarm.deviceType], alarm.deviceName, alarm.sn,
        alarm.alarmId, alarm.vendorId, alarm.name, formatAlarmTime(alarm.occurredAt, zone), alarm.occurredAt, alarmTimestamp(alarm.occurredAt) !== null ? "true" : "false",
        alarm.state, alarm.acknowledged === null ? null : String(alarm.acknowledged), formatAlarmTime(alarm.clearedAt, zone), alarm.description, String(coverageComplete)]),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), link = document.createElement("a");
    link.href = url; link.download = `${state}-alarms-${code.replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="alarm-management-page"><section className="alarm-management-panel" aria-label="Alarm Management">
    <nav className="alarm-subtabs" aria-label="Status alarm"><button className={state === "active" ? "active" : ""} aria-pressed={state === "active"} onClick={() => changeState("active")}>Active Alarms</button><button className={state === "cleared" ? "active" : ""} aria-pressed={state === "cleared"} onClick={() => changeState("cleared")}>Historical Alarms</button><span>{plantName || "Pilih PLTS melalui daftar di sisi kiri"}</span></nav>
    <form className="alarm-filter-form" onSubmit={(event) => {
      event.preventDefault();
      if (!validAlarmRange(draft.start, draft.end)) { setFormError("Occurrence time tidak valid: waktu akhir harus setelah atau sama dengan waktu awal."); return; }
      setFilters({ ...draft }); setFormError(""); setPage(1); setSelection(new Set()); setRevision((value) => value + 1);
    }}>
      <label>Device type<select value={draft.deviceType} onChange={(event) => setDraft({ ...draft, deviceType: event.target.value })}><option value="">All</option>{Object.entries(DEVICE_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>SN <span title="Serial number perangkat dari sumber alarm atau inventory"><Icon name="info" size={12} /></span><input aria-label="SN alarm" placeholder="SN" value={draft.sn} onChange={(event) => setDraft({ ...draft, sn: event.target.value })} /></label>
      <label>Alarm name<input placeholder="Alarm Name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <label>Alarm ID <span title="Pencarian ID alarm internal atau vendor"><Icon name="info" size={12} /></span><input placeholder="Alarm ID" value={draft.alarmId} onChange={(event) => setDraft({ ...draft, alarmId: event.target.value })} /></label>
      <div className="alarm-time-filter"><span title={`Waktu lokal PLTS: ${zone}`}>Occurrence time</span><div><input aria-label="Occurrence start time" title={zone} type="datetime-local" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /><span>→</span><input aria-label="Occurrence end time" title={zone} type="datetime-local" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></div></div>
      <button className="alarm-search" type="submit" disabled={!code}>Search</button>
    </form>
    <div className="alarm-actions-row"><div className="alarm-refresh-and-counts"><button className={`alarm-refresh-switch ${autoRefresh ? "on" : ""}`} type="button" role="switch" aria-checked={autoRefresh} aria-label="Auto Refresh setiap 30 detik" onClick={() => setAutoRefresh(!autoRefresh)}><i /></button><span>Auto Refresh</span><span title="Muat ulang setiap 30 detik saat tidak ada permintaan berjalan"><Icon name="info" size={12} /></span>
      <div className="alarm-severity-counts">{(Object.keys(ALARM_SEVERITIES) as AlarmSeverity[]).filter((value) => value !== "unclassified" || filteredBase.some((alarm) => alarm.severity === value) || severity === value).map((value) => <button key={value} className={`alarm-count-badge ${value} ${severity === value ? "selected" : ""}`} aria-label={`Filter ${ALARM_SEVERITIES[value]}`} aria-pressed={severity === value} title={`${ALARM_SEVERITIES[value]} · hasil filter yang dimuat`} onClick={() => { setSeverity(severity === value ? "" : value); setPage(1); setSelection(new Set()); }}><i>{value === "warning" || value === "unclassified" ? "i" : "!"}</i>{countLabel(filteredBase.filter((alarm) => alarm.severity === value).length)}</button>)}</div>
      {selected.length > 0 && <span className="alarm-selection-count">{selected.length} selected <button onClick={() => setSelection(new Set())}>Reset selection</button></span>}
    </div><div className="alarm-export-actions"><button disabled title="Backend belum menyediakan operasi Clear alarm">Clear</button><button disabled={!canExport} onClick={download}>Export</button></div></div>
    {formError && <p className="alarm-message error" role="alert">{formError}</p>}
    {active?.error && <p className="alarm-message error" role="alert">{active.error}<button onClick={() => setRevision((value) => value + 1)}>Coba lagi</button></p>}
    {data && data.warnings.length > 0 && <div className="alarm-message" role="status">{data.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
    {data?.complete && !coverageComplete && <p className="alarm-message" role="status">Sebagian alarm belum memiliki metadata atau waktu terverifikasi untuk filter ini. Jumlah hasil belum dapat dianggap lengkap.</p>}
    <div className="alarm-table-region"><div className="alarm-table-scroll"><table className="alarm-data-table"><thead><tr><th className="alarms-col-check"><input ref={checkbox} type="checkbox" aria-label="Pilih semua alarm di halaman ini" checked={allSelected} disabled={!displayed.length} onChange={(event) => { const checked = event.target.checked; setSelection((previous) => { const next = new Set(previous); displayed.forEach((alarm) => { if (checked) next.add(alarm.id); else next.delete(alarm.id); }); return next; }); }} /></th>
      {COLUMNS.map((column) => <th key={column.key} className={column.className} scope="col" aria-sort={sort.key === column.key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button onClick={() => { setSort({ key: column.key, direction: sort.key === column.key && sort.direction === "asc" ? "desc" : "asc" }); setPage(1); }}>{column.title}{(column.key === "severity" || column.key === "occurredAt" || sort.key === column.key) && <span className={`report-sort-icons ${sort.key === column.key ? sort.direction : ""}`} aria-hidden="true"><i /><i /></span>}</button></th>)}<th className="alarms-col-operation" scope="col">Operation</th></tr></thead><tbody>
      {displayed.map((alarm) => <tr key={alarm.id} className={selection.has(alarm.id) ? "alarm-row-selected" : ""}><td><input type="checkbox" aria-label={`Pilih alarm ${alarm.name ?? alarm.alarmId ?? "tanpa nama"}`} checked={selection.has(alarm.id)} onChange={(event) => { const checked = event.target.checked; setSelection((previous) => { const next = new Set(previous); if (checked) next.add(alarm.id); else next.delete(alarm.id); return next; }); }} /></td><td><span className={`alarm-severity-label ${alarm.severity}`}><i />{ALARM_SEVERITIES[alarm.severity]}</span></td><td><button className="alarm-data-link" onClick={onOverview}>{alarm.plantName}</button></td><td>{DEVICE_TYPES[alarm.deviceType]}</td><td>{alarm.deviceName ?? "--"}</td><td>{alarm.sn ?? "--"}</td><td>{alarm.alarmId ?? alarm.vendorId ?? "--"}</td><td><button className="alarm-data-link" onClick={() => setDetail(alarm)}>{alarm.name ?? "--"}</button></td><td title={zone}>{formatAlarmTime(alarm.occurredAt, zone) ?? "--"}</td><td className="alarms-col-operation"><button className="alarm-data-link" onClick={() => setDetail(alarm)}>Details</button></td></tr>)}
      {!displayed.length && <tr><td colSpan={10} className="alarm-empty-cell" aria-label="Tidak ada baris alarm">&nbsp;</td></tr>}
    </tbody></table></div>{!displayed.length && <div className="alarm-table-empty" role="status"><EmptyAlarmIcon /><span>{loading ? "Memuat alarm…" : !code ? "Pilih PLTS untuk melihat alarm" : active?.error ? "Data alarm belum dapat dimuat" : data && !data.configured ? "Data alarm belum dikonfigurasi" : "No data"}</span></div>}</div>
    <footer className="alarm-pagination"><span>Total: {active?.error || !code ? "--" : countLabel(filtered.length)}</span><div><button aria-label="Halaman alarm sebelumnya" disabled={current === 1} onClick={() => setPage(current - 1)}>‹</button>{Array.from({ length: pages }, (_, index) => index + 1).filter((value) => pages <= 7 || value === 1 || value === pages || Math.abs(value - current) <= 1).map((value, index, list) => <span key={value}>{index > 0 && value - list[index - 1] > 1 && <span className="alarm-page-ellipsis">…</span>}<button className={current === value ? "active" : ""} aria-current={current === value ? "page" : undefined} aria-label={`Halaman alarm ${value}`} onClick={() => setPage(value)}>{value}</button></span>)}<button aria-label="Halaman alarm berikutnya" disabled={current === pages} onClick={() => setPage(current + 1)}>›</button><select aria-label="Jumlah alarm per halaman" value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(1); }}>{[10, 20, 50].map((value) => <option key={value} value={value}>{value} / page</option>)}</select></div></footer>
    {active?.syncedAt && <p className="alarm-source-note">{zone} · {state === "active" ? "Active alarms" : "Historical = cleared alarms"} · API synced {formatAlarmTime(active.syncedAt, zone)}{data?.collectedAt ? ` · Collected ${formatAlarmTime(data.collectedAt, zone) ?? "--"}` : ""}. {coverageComplete ? "Cakupan sumber lengkap." : "Angka ≥ adalah batas bawah dari data yang tersedia."} Export mengikuti seluruh hasil filter/pengurutan, atau pilihan baris.</p>}
  </section>
    <dialog ref={dialog} className="layout-dialog alarm-detail-dialog" aria-labelledby="alarm-detail-title" onCancel={() => setDetail(null)}><div className="layout-dialog-heading"><h2 id="alarm-detail-title">Alarm Details</h2><button aria-label="Tutup detail alarm" onClick={() => setDetail(null)}><Icon name="close" size={18} /></button></div>{detail && <><dl className="alarm-detail-list">{[
      ["Alarm Severity", ALARM_SEVERITIES[detail.severity]], ["Plant Name", detail.plantName], ["Device Type", DEVICE_TYPES[detail.deviceType]], ["Device Name", detail.deviceName], ["SN", detail.sn], ["Alarm ID", detail.alarmId], ["Vendor Alarm ID", detail.vendorId], ["Alarm Name", detail.name], ["State", detail.state], ["Acknowledged", detail.acknowledged === null ? "--" : detail.acknowledged ? "Yes" : "No"], ["Occurrence Time", formatAlarmTime(detail.occurredAt, zone)], ["Cleared Time", formatAlarmTime(detail.clearedAt, zone)], ["Time Zone", zone], ["Description", detail.description],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "--"}</dd></div>)}</dl><p>Detail mengikuti snapshot yang dimuat. Acknowledged tidak berarti alarm sudah cleared.</p></>}<footer>{detail?.state === "active" && <button disabled title="Backend belum menyediakan operasi Clear alarm">Clear</button>}<button className="layout-save" onClick={() => setDetail(null)}>Close</button></footer></dialog>
  </div>;
}
