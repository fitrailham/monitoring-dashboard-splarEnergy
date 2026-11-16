import { getLanguage, translate as t } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Plant } from "../services/fleet";
import { format } from "../services/fleet";
import { calendarDate, validTimeZone } from "../services/calendar";
import { statisticsRange } from "../services/statistics";
import type { Period } from "../services/statistics";
import { getYieldStatistics } from "../services/yieldStatistics";
import type { YieldResult } from "../services/yieldStatistics";
import { getInverterReport } from "../services/analytics";
import type { InverterReport } from "../services/analytics";
import { getDevices } from "../services/devices";
import type { InventoryDevice } from "../services/devices";
import { mergeInverterYield, plantReportRows } from "../services/reports";
import { trendCsv } from "../services/monitoring";
import { REPORT_TABS, inverterWorkspaceRows, plantWorkspaceRows, sortWorkspaceRows, workspaceColumns } from "../services/reportWorkspace";
import type { ReportDimension, ReportType, WorkspaceField } from "../services/reportWorkspace";
import Icon from "./Icon";
import "./ReportsPage.css";

const PERIODS: { value: Period; title: string }[] = [
  { value: "Day", title: "By day" }, { value: "Month", title: "By month" },
  { value: "Year", title: "By year" }, { value: "Lifetime", title: "By lifecycle" },
];
const dateValue = (period: Period, date: string) => period === "Day" ? date : period === "Month" ? date.slice(0, 7) : date.slice(0, 4);
const fullDate = (period: Period, value: string) => period === "Day" ? value : period === "Month" ? `${value}-01` : `${value}-01-01`;

function TreeIcon({ plant = false }: { plant?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
    {plant ? <path d="m3 8 7-6 7 6v9H3V8Zm4 0h6m-6 4h6m-6 3h3" /> : <path d="M3 17V3h10v14M1 17h18M13 8h4v9M6 6h4M6 9h4M6 12h4M6 15h4" />}
  </svg>;
}

function ReportEmpty({ loading, message }: { loading: boolean; message: string }) {
  useLanguage();
  return <div className="reports-empty-state" role="status">
    {loading ? <Icon name="refresh" size={35} className="spinning" /> :
      <svg width="90" height="74" viewBox="0 0 90 74" fill="none" aria-hidden="true">
        <ellipse cx="45" cy="65" rx="33" ry="4" fill="#f3f4f6" />
        <path d="M19 40h52v24H19z" fill="#e1e4e8" /><path d="m19 40 12-15h29l11 15H19Z" fill="#cdd2d9" />
        <path d="M25 40h40v6H25z" fill="#d6dae0" /><path d="m10 20 5 3-1-5m61-7 4-4-1 7" stroke="#d2d7df" />
        <path d="M22 17c16-23 40 8 48-12" stroke="#e0e4ea" strokeDasharray="3 3" />
      </svg>}
    <strong>{loading ? t("Loading report…") : t("No data")}</strong>
    <span>{loading ? t("Memuat laporan untuk periode pilihan.") : t(message)}</span>
  </div>;
}

interface ReportsPageProps {
  plants: Plant[];
  report: ReportType;
  onReportChange: (report: ReportType) => void;
  now: number;
  refreshKey: number;
  plantsLoading: boolean;
}

export default function ReportsPage({ plants, report, onReportChange, now, refreshKey, plantsLoading }: ReportsPageProps) {
  useLanguage();
  const [scope, setScope] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const plant = plants.find((item) => item.plant_code === scope);
  const filtered = useMemo(() => plants.filter((item) => `${item.plant_name} ${item.plant_code}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.plant_name.localeCompare(b.plant_name, "en", { numeric: true })), [plants, search, getLanguage()]);
  const groups = useMemo(() => {
    const result = new Map<string, Plant[]>();
    for (const item of filtered) {
      const name = item.region?.trim() || "";
      result.set(name, [...(result.get(name) ?? []), item]);
    }
    return [...result.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, getLanguage()]);
  function choose(code: string) { setScope(code); setSidebarOpen(false); }
  function plantButton(item: Plant) {
    return <li key={item.plant_code}><button className={`reports-tree-plant ${scope === item.plant_code ? "selected" : ""}`}
      title={item.plant_name} aria-current={scope === item.plant_code ? "true" : undefined} onClick={() => choose(item.plant_code)}>
      <TreeIcon plant /><span>{item.plant_name}</span></button></li>;
  }
  return <section className="reports-page" aria-labelledby="reports-page-title">
    <div className="reports-page-heading"><h1 id="reports-page-title">{t("Report Management")}</h1>
      <button className="reports-mobile-toggle" aria-expanded={sidebarOpen} aria-controls="reports-plant-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>
        <Icon name="list" size={16} />{plant?.plant_name ?? t("All plants")}<Icon name="chevron" size={13} />
      </button>
    </div>
    <div className={`reports-shell ${sidebarOpen ? "sidebar-open" : ""}`}>
      <aside id="reports-plant-sidebar" className="reports-plant-sidebar" aria-label={t("Report plant selection")}>
        <div className="reports-tree-search"><Icon name="home" size={15} /><span className="reports-search-divider" />
          <input aria-label={t("Search report plants")} placeholder={t("Enter a plant name")} value={search} onChange={(event) => { setSearch(event.target.value); setExpanded(true); }} />
          {search ? <button aria-label={t("Clear plant search")} onClick={() => setSearch("")}><Icon name="close" size={13} /></button> : <Icon name="search" size={14} />}
        </div>
        <div className="reports-tree-scroll">
          <div className="reports-tree-root"><button className={`reports-tree-expander ${expanded ? "expanded" : ""}`} aria-label={t(expanded ? "Collapse plant list" : "Expand plant list")} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><Icon name="chevron" size={11} /></button>
            <button className={`reports-tree-account ${!scope ? "selected" : ""}`} aria-current={!scope ? "true" : undefined} onClick={() => choose("")}><TreeIcon /><span>{t("IconGreenTWH")}</span></button></div>
          {expanded && <ul className="reports-tree-list">{groups.map(([name, items]) => name ? <li key={name}><details open={Boolean(search) || undefined} className="reports-tree-group"><summary><TreeIcon /><span>{name}</span></summary><ul>{items.map(plantButton)}</ul></details></li> : items.map(plantButton))}</ul>}
          {expanded && !filtered.length && <p className="reports-tree-message">{plantsLoading ? t("Loading plants…") : search ? t("No matching plants") : t("Daftar PLTS belum tersedia.")}</p>}
        </div>
      </aside>
      <div className="reports-workspace">
        <nav className="report-subtabs reports-tabs" aria-label={t("Report types")}>{REPORT_TABS.map((item) =>
          <button key={item.id} className={report === item.id ? "active" : ""} aria-pressed={report === item.id} onClick={() => onReportChange(item.id)}>{t(item.label)}</button>)}</nav>
        <ReportWorkspace key={`${report}-${scope}`} report={report} plant={plant} plants={plants} onPlantChange={choose} now={now} refreshKey={refreshKey} />
      </div>
    </div>
  </section>;
}

function ReportWorkspace({ report, plant, plants, onPlantChange, now, refreshKey }: {
  report: ReportType; plant?: Plant; plants: Plant[]; onPlantChange: (code: string) => void; now: number; refreshKey: number;
}) {
  useLanguage();
  const code = plant?.plant_code ?? "", zone = validTimeZone(plant?.time_zone);
  const [period, setPeriod] = useState<Period>("Day");
  const [date, setDate] = useState(() => calendarDate(now, zone));
  const [dimension, setDimension] = useState<ReportDimension>(report === "battery" ? "site" : "time");
  const [deviceId, setDeviceId] = useState("");
  const [applied, setApplied] = useState(() => ({ period: "Day" as Period, date: calendarDate(now, zone), dimension, deviceId: "", revision: 0 }));
  const [mountedAt] = useState(now);
  const [page, setPage] = useState(1), [size, setSize] = useState(10);
  const columns = workspaceColumns(report, applied.dimension);
  const [hidden, setHidden] = useState<WorkspaceField[]>([]);
  const [sort, setSort] = useState<{ key: WorkspaceField; direction: "asc" | "desc" }>({ key: report === "plant" ? "period" : report === "battery" ? "charge" : report === "pcs" ? "discharge" : "yield", direction: report === "plant" ? "asc" : "desc" });
  const [formError, setFormError] = useState("");
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const subscriptionDialog = useRef<HTMLDialogElement>(null);
  const supported = report === "plant" || report === "inverter";
  const key = JSON.stringify([report, code, zone, applied, refreshKey]);
  const [response, setResponse] = useState<{ key: string; pv: YieldResult | null; inverter: InverterReport | null; error: string; warning: string } | null>(null);
  const [inventory, setInventory] = useState<{ devices: InventoryDevice[]; error: string } | null>(null);
  const active = response?.key === key ? response : null;
  const loading = supported && Boolean(code) && !active;
  const label = REPORT_TABS.find((item) => item.id === report)!.label;
  const title = report === "battery" ? `Battery ${applied.dimension === "device" ? "Device" : "Site"} Report` : label;

  useEffect(() => {
    if (!supported || !code) return;
    const controller = new AbortController();
    const range = statisticsRange(applied.period, applied.date, zone, new Date(refreshKey || mountedAt));
    void Promise.allSettled([
      report === "plant" ? getYieldStatistics(code, range, controller.signal) : Promise.resolve(null),
      getInverterReport(code, range, report === "inverter" ? applied.deviceId : "", controller.signal),
    ]).then(([pv, inverter]) => {
      if (controller.signal.aborted) return;
      const message = (error: unknown) => error instanceof Error ? error.message : "Laporan belum dapat dimuat.";
      setResponse({ key, pv: pv.status === "fulfilled" ? pv.value : null, inverter: inverter.status === "fulfilled" ? inverter.value : null,
        error: report === "plant" ? pv.status === "rejected" ? message(pv.reason) : "" : inverter.status === "rejected" ? message(inverter.reason) : "",
        warning: report === "plant" && inverter.status === "rejected" ? "Inverter Yield belum dapat dimuat. PV Yield tetap ditampilkan." : "" });
    });
    return () => controller.abort();
  }, [supported, report, code, zone, applied, key, refreshKey, mountedAt]);

  useEffect(() => {
    if (report !== "inverter" || !plant) return;
    const controller = new AbortController();
    void getDevices(code, plant.plant_name, controller.signal).then((result) => {
      if (!controller.signal.aborted) setInventory({ devices: result.devices.filter((device) => device.type === "inverter" && device.sourceId), error: result.warning });
    }).catch(() => { if (!controller.signal.aborted) setInventory({ devices: [], error: "Inventory inverter belum dapat dimuat." }); });
    return () => controller.abort();
  }, [report, code, plant, refreshKey]);

  useEffect(() => {
    if (subscribeOpen) subscriptionDialog.current?.showModal();
    else subscriptionDialog.current?.close();
  }, [subscribeOpen]);

  const rows = useMemo(() => {
    if (!active || !plant || active.error) return [];
    if (report === "inverter") return inverterWorkspaceRows(active.inverter?.rows ?? [], plant.plant_name, active.inverter?.complete === true);
    return active.pv ? plantWorkspaceRows(mergeInverterYield(plantReportRows(active.pv.points, zone), active.inverter?.rows ?? []), plant.plant_name, applied.dimension) : [];
  }, [active, plant, report, zone, applied.dimension, getLanguage()]);
  const sorted = useMemo(() => sortWorkspaceRows(rows, sort.key, sort.direction), [rows, sort, getLanguage()]);
  const visible = columns.filter((column) => !hidden.includes(column.key));
  const pages = Math.max(1, Math.ceil(sorted.length / size)), currentPage = Math.min(page, pages);
  const displayed = sorted.slice((currentPage - 1) * size, currentPage * size);
  const pending = period !== applied.period || dimension !== applied.dimension || deviceId !== applied.deviceId || period !== "Lifetime" && date !== dateValue(applied.period, applied.date);
  const partial = active && (active.pv && !active.pv.complete || active.inverter && !active.inverter.complete);
  const unavailable = !supported ? "Data laporan ini belum tersedia. Sumber laporan sedang disiapkan." : !code ? "Pilih PLTS di sebelah kiri untuk melihat laporan yang tersedia." : "Tidak ada data untuk periode dan filter yang dipilih.";

  function search() {
    const selectedDate = period === "Lifetime" ? applied.date : fullDate(period, date);
    try { statisticsRange(period, selectedDate, zone, new Date(refreshKey || mountedAt)); }
    catch { setFormError("Pilih periode statistik yang valid."); return; }
    setApplied({ period, date: selectedDate, dimension, deviceId, revision: applied.revision + 1 });
    if (dimension !== applied.dimension) { setSort({ key: workspaceColumns(report, dimension)[0].key, direction: "asc" }); setHidden([]); }
    setPage(1); setFormError("");
  }
  function exportCsv() {
    if (!plant || loading || !sorted.length || active?.error) return;
    const csv = trendCsv([
      ["Plant Code", "Time Zone", "Report", "Period", "From", "To", "Device ID", "SN", ...visible.map((column) => column.title), "Quality", "Field Quality", "Complete"],
      ...sorted.map((row) => {
        const range = statisticsRange(applied.period, applied.date, zone, new Date(refreshKey || mountedAt));
        return [code, zone, label, applied.period, range.from, range.to, row.deviceId ?? "", row.deviceSn ?? "", ...visible.map((column) => row.values[column.key] ?? null), row.quality, JSON.stringify(row.fieldQuality ?? {}),
          String(report === "plant" ? active?.pv?.complete === true && active?.inverter?.complete === true : active?.inverter?.complete === true)];
      }),
    ]);
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url;
    link.download = `${report}-report-${code.replace(/[^a-zA-Z0-9_-]/g, "_")}-${applied.date}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const plantSelect = (caption: string) => <label>{t(caption)}<select aria-label={t(caption)} value={code} onChange={(event) => onPlantChange(event.target.value)}>
    <option value="">{t("All")}</option>{plants.map((item) => <option key={item.plant_code} value={item.plant_code}>{item.plant_name}</option>)}</select></label>;
  const deviceSelect = <label>{t("Device")}<select aria-label={t("Report device")} value={deviceId} disabled={!code || report !== "inverter" || !inventory}
    onChange={(event) => setDeviceId(event.target.value)}><option value="">{t("All")}</option>{inventory?.devices.map((device) => <option key={device.id} value={device.sourceId!}>{device.name}</option>)}</select></label>;

  return <>
    <form className="report-filter-bar reports-filter-bar" onSubmit={(event) => { event.preventDefault(); search(); }}>
      {report === "plant" && <>{plantSelect("Plant")}<label>{t("Dimension")}<select aria-label={t("Plant report dimension")} value={dimension} onChange={(event) => setDimension(event.target.value as ReportDimension)}><option value="time">{t("By time")}</option><option value="plant">{t("By plant")}</option></select></label></>}
      {report === "battery" ? <><label>{t("Dimension")}<select aria-label={t("Battery report dimension")} value={dimension} onChange={(event) => setDimension(event.target.value as ReportDimension)}><option value="site">{t("Site")}</option><option value="device">{t("Device")}</option></select></label>{plantSelect("Select plant")}</> : report !== "plant" && deviceSelect}
      <label>{t("Time granularity")}<select aria-label={t("Report time granularity")} value={period} onChange={(event) => { const next = event.target.value as Period; setPeriod(next); setDate(dateValue(next, applied.date)); setFormError(""); }}>
        {PERIODS.map((item) => <option key={item.value} value={item.value}>{t(item.title)}</option>)}</select></label>
      <label>{t("Statistical period")}{period === "Lifetime" ? <span className="report-lifecycle-range">1970–{calendarDate(now, zone).slice(0, 4)}</span> :
        <input aria-label={t("Report statistical period")} required type={period === "Day" ? "date" : period === "Month" ? "month" : "number"} value={date}
          min={period === "Day" ? "1970-01-01" : period === "Month" ? "1970-01" : "1970"} max={period === "Day" ? "2100-12-31" : period === "Month" ? "2100-12" : "2100"}
          onChange={(event) => setDate(event.target.value)} />}</label>
      <button type="submit" className="report-search-button">{t("Search")}</button>
      <div className="report-filter-actions"><button type="button" onClick={() => setSubscribeOpen(true)}>{t("Subscribe")}</button><button type="button" disabled={loading || !sorted.length || Boolean(active?.error)} onClick={exportCsv}>{t("Export")}</button></div>
    </form>
    <div className="report-table-title reports-table-title"><h2>{t(title)}<span title={t("Nilai -- berarti data belum tersedia atau belum terverifikasi.")}><Icon name="info" size={14} /></span></h2>
      {plant && <span>{plant.plant_name} · {zone}</span>}</div>
    {pending && <p className="report-status-note" role="status">{t("Klik Search untuk menerapkan perubahan filter.")}</p>}
    {(t(formError) || t(active?.error)) && <p className="report-error" role="alert">{t(formError) || t(active?.error)}</p>}
    {active?.warning && <p className="report-status-note" role="status">{t(active.warning)}</p>}
    {inventory?.error && <p className="report-status-note" role="status">{t(inventory.error)}</p>}
    {active?.inverter?.warnings.length ? <p className="report-status-note" role="status">{active.inverter.warnings.join(" ")}</p> : null}
    {partial && <p className="report-status-note partial" role="status">{t("Data periode ini masih parsial. Nilai yang belum tersedia tetap --.")}</p>}
    <div className="report-table-wrap">
      <details className="report-column-settings"><summary aria-label={t("Report column settings")} title={t("Column settings")}><Icon name="settings" size={14} /></summary>
        <div>{columns.map((column, index) => <label key={column.key}><input type="checkbox" checked={!hidden.includes(column.key)} disabled={index === 0} onChange={(event) => {
          setHidden(event.target.checked ? hidden.filter((key) => key !== column.key) : [...hidden, column.key]);
          if (!event.target.checked && sort.key === column.key) setSort({ key: columns[0].key, direction: "asc" });
        }} />{t(column.title)}</label>)}</div>
      </details>
      <div className={`report-table-scroll reports-table-scroll ${report === "inverter" || report === "pvess" ? "reports-wide-table" : ""}`}>
        <table className={`report-data-table reports-data-table reports-${report}-table`} aria-label={t(title)}>
          <thead><tr>{visible.map((column) => <th key={column.key} scope="col" data-field={column.key} aria-sort={sort.key === column.key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}>
            <button onClick={() => { setSort({ key: column.key, direction: sort.key === column.key && sort.direction === "asc" ? "desc" : "asc" }); setPage(1); }}>
              {t(column.title)}<span className={`report-sort-icons ${sort.key === column.key ? sort.direction : ""}`} aria-hidden="true"><i /><i /></span></button></th>)}</tr></thead>
          <tbody>{displayed.map((row) => <tr key={row.id}>{visible.map((column) => <td key={column.key} className={sort.key === column.key ? "reports-sorted-cell" : ""}
            title={t(`Quality: ${row.fieldQuality?.[column.key] ?? row.quality}`)}>
            {column.digits === undefined ? row.values[column.key] ?? "--" : format(row.values[column.key] as number | null, column.digits)}
            {column.digits !== undefined && (row.fieldQuality?.[column.key] ?? row.quality) === "partial" && row.values[column.key] != null && <sup className="reports-partial-mark" title={t("Partial data")}>*</sup>}
          </td>)}</tr>)}
            {!displayed.length && <tr><td colSpan={visible.length} className="report-no-data reports-no-data"><ReportEmpty loading={loading} message={active?.error ? "Laporan gagal dimuat. Klik Search untuk mencoba lagi." : unavailable} /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
    <footer className="report-pagination reports-pagination"><span>{t("Total: ")}{!supported || !code || loading || active?.error ? "--" : sorted.length}</span><div>
      <button aria-label={t("Previous report page")} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>
      {Array.from({ length: pages }, (_, index) => index + 1).filter((value) => pages <= 7 || value === 1 || value === pages || Math.abs(value - currentPage) <= 1).map((value, index, list) => <span key={value}>
        {index > 0 && value - list[index - 1] > 1 && <span className="report-page-ellipsis">…</span>}<button aria-label={t(`Report page ${value}`)} className={currentPage === value && sorted.length > 0 ? "active" : ""} aria-current={currentPage === value ? "page" : undefined} disabled={!sorted.length} onClick={() => setPage(value)}>{value}</button></span>)}
      <button aria-label={t("Next report page")} disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>›</button>
      <select aria-label={t("Report rows per page")} value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(1); }}>{[10, 20, 50].map((value) => <option key={value} value={value}>{value}{t(" / page")}</option>)}</select>
    </div></footer>
    {sorted.length > 0 && <p className="report-data-note">{report === "plant" ? t("Export dan Revenue belum tersedia. ") : t("Yield mengikuti periode pilihan; kapasitas string, lifetime yield, specific energy dan peak power menunggu sumber laporan. ")}
      {partial ? t("* Nilai parsial. ") : ""}{t("Export mencakup seluruh halaman sesuai filter dan urutan yang diterapkan.")}</p>}
    <dialog ref={subscriptionDialog} className="layout-dialog reports-subscribe-dialog" aria-labelledby="reports-subscribe-title" onCancel={() => setSubscribeOpen(false)}>
      <div className="layout-dialog-heading"><h2 id="reports-subscribe-title">{t("Subscribe to reports")}</h2><button aria-label={t("Close report subscription")} onClick={() => setSubscribeOpen(false)}><Icon name="close" size={18} /></button></div>
      <p><strong>{t(label)}</strong><br />{plant?.plant_name ?? t("All plants")} · {t(PERIODS.find((item) => item.value === applied.period)?.title)} · {applied.date}</p>
      <p>{t("Langganan otomatis belum tersedia. Gunakan Export untuk mengunduh laporan yang tersedia.")}</p><footer><button className="layout-save" onClick={() => setSubscribeOpen(false)}>{t("Mengerti")}</button></footer>
    </dialog>
  </>;
}
