import { useEffect, useMemo, useRef, useState } from "react";
import type { Plant } from "../services/fleet";
import { format, request } from "../services/fleet";
import { calendarDate, validTimeZone } from "../services/calendar";
import { statisticsRange } from "../services/statistics";
import type { Period } from "../services/statistics";
import { getYieldStatistics } from "../services/yieldStatistics";
import type { YieldResult } from "../services/yieldStatistics";
import { mergeInverterYield, plantReportRows, sortReportRows } from "../services/reports";
import { getInverterReport } from "../services/analytics";
import type { InverterReport } from "../services/analytics";
import type { ReportColumn } from "../services/reports";
import { trendCsv } from "../services/monitoring";
import Icon from "./Icon";

const COLUMNS: { key: ReportColumn; title: string; digits: number }[] = [
  { key: "period", title: "Statistical Period", digits: 0 },
  { key: "pvYield", title: "PV Yield (kWh)", digits: 3 },
  { key: "inverterYield", title: "Inverter Yield (kWh)", digits: 3 },
  { key: "exportEnergy", title: "Export (kWh)", digits: 3 },
  { key: "revenue", title: "Revenue (Rp)", digits: 2 },
];
const PERIODS: { value: Period; title: string }[] = [
  { value: "Day", title: "By day" }, { value: "Month", title: "By month" },
  { value: "Year", title: "By year" }, { value: "Lifetime", title: "By lifecycle" },
];
interface Inverter { id: string; name: string }
interface Device { device_type?: string; device_id?: string | number; device_name?: string; device_sn?: string; id?: string | number; devDn?: string; devName?: string; esnCode?: string }
const fieldValue = (period: Period, date: string) => period === "Day" ? date : period === "Month" ? date.slice(0, 7) : date.slice(0, 4);
const fullDate = (period: Period, value: string) => period === "Day" ? value : period === "Month" ? value + "-01" : value + "-01-01";

export default function ReportManagement({ plant, now, refreshKey }: { plant?: Plant; now: number; refreshKey: number }) {
  const code = plant?.plant_code ?? "", zone = validTimeZone(plant?.time_zone);
  const [report, setReport] = useState<"plant" | "inverter">("plant");
  const [period, setPeriod] = useState<Period>("Day"), [inputDate, setInputDate] = useState(() => calendarDate(now, zone));
  const [applied, setApplied] = useState(() => ({ period: "Day" as Period, date: calendarDate(now, zone), revision: 0 }));
  const [mountedAt] = useState(now);
  const [page, setPage] = useState(1), [size, setSize] = useState(10);
  const [sort, setSort] = useState<{ column: ReportColumn; direction: "asc" | "desc" }>({ column: "period", direction: "asc" });
  const [visible, setVisible] = useState<ReportColumn[]>(COLUMNS.map((column) => column.key));
  const [formError, setFormError] = useState(""), [subscribeOpen, setSubscribeOpen] = useState(false);
  const [inverterId, setInverterId] = useState("");
  const subscriptionDialog = useRef<HTMLDialogElement>(null);
  const key = JSON.stringify([code, applied, zone, refreshKey, report, inverterId]);
  const [response, setResponse] = useState<{ key: string; result: YieldResult | null; inverters: InverterReport | null; error: string; warning: string } | null>(null);
  const [devices, setDevices] = useState<{ key: string; items: Inverter[]; error: string } | null>(null);
  const deviceKey = JSON.stringify([code, refreshKey, applied.revision]);
  const active = response?.key === key ? response : null;
  const inventory = devices?.key === deviceKey ? devices : null;
  const loading = Boolean(code) && !active;
  useEffect(() => {
    if (subscribeOpen) subscriptionDialog.current?.showModal(); else subscriptionDialog.current?.close();
  }, [subscribeOpen]);
  useEffect(() => {
    if (!code) return;
    const controller = new AbortController();
    const range = statisticsRange(applied.period, applied.date, zone, new Date(refreshKey || mountedAt));
    void Promise.allSettled([
      report === "plant" ? getYieldStatistics(code, range, controller.signal) : Promise.resolve(null),
      getInverterReport(code, range, report === "inverter" ? inverterId : "", controller.signal),
    ]).then(([pv, inverter]) => {
      if (controller.signal.aborted) return;
      const errors = [report === "plant" && pv.status === "rejected" ? pv.reason.message : "",
        inverter.status === "rejected" ? inverter.reason.message : ""].filter(Boolean);
      setResponse({key, result: pv.status === "fulfilled" ? pv.value : null,
        inverters: inverter.status === "fulfilled" ? inverter.value : null,
        error: report === "plant" ? pv.status === "rejected" ? errors.join(" ") : "" : inverter.status === "rejected" ? errors.join(" ") : "",
        warning: report === "plant" && inverter.status === "rejected" ? errors.join(" ") : ""});
    });
    return () => controller.abort();
  }, [code, report, applied, zone, key, refreshKey, mountedAt, inverterId]);
  useEffect(() => {
    if (!code || report !== "inverter") return;
    const controller = new AbortController();
    void request<Device[]>(`/api/devices/${encodeURIComponent(code)}`, controller.signal)
      .then((result) => {
        if (!Array.isArray(result.data)) throw new Error("Format inventory tidak valid.");
        const items = result.data.flatMap((device) => {
          if (device.device_type?.toLowerCase() !== "inverter") return [];
          const id = device.device_id ?? device.id ?? device.devDn;
          return id === undefined || id === null ? [] : [{ id: String(id), name: device.device_name || device.devName || device.device_sn || device.esnCode || String(id) }];
        });
        if (!controller.signal.aborted) setDevices({ key: deviceKey, items, error: "" });
      }).catch(() => { if (!controller.signal.aborted) setDevices({ key: deviceKey, items: [], error: "Inventory inverter belum dapat dimuat." }); });
    return () => controller.abort();
  }, [code, report, deviceKey]);
  const rows = useMemo(() => report === "inverter" ? active?.inverters?.rows ?? [] : active?.result ? mergeInverterYield(plantReportRows(active.result.points, zone), active.inverters?.rows ?? []) : [], [report, active, zone]);
  const sorted = useMemo(() => sortReportRows(rows, sort.column, sort.direction), [rows, sort]);
  const columns = COLUMNS.filter((column) => visible.includes(column.key));
  const pages = Math.max(1, Math.ceil(sorted.length / size)), currentPage = Math.min(page, pages);
  const displayed = sorted.slice((currentPage - 1) * size, currentPage * size);
  const pendingSearch = period !== applied.period || period !== "Lifetime" && inputDate !== fieldValue(applied.period, applied.date);
  function changePeriod(value: Period) { setPeriod(value); setInputDate(fieldValue(value, applied.date)); setFormError(""); }
  function search() {
    if (!code) return;
    const date = period === "Lifetime" ? applied.date : fullDate(period, inputDate);
    try { statisticsRange(period, date, zone, new Date(refreshKey || mountedAt)); }
    catch { setFormError("Pilih periode statistik yang valid."); return; }
    setApplied({ period, date, revision: applied.revision + 1 }); setPage(1); setFormError("");
  }
  function download() {
    if (!plant || loading || !sorted.length || active?.error) return;
    const data = [
      ["Plant Code", "Plant Name", "Time Zone", "Device ID", "Device Name", "SN", ...columns.map((column) => column.title), "Quality", "Inverter Quality", "Complete Period"],
      ...sorted.map((row) => [code, plant.plant_name, zone, row.deviceId ?? "", row.deviceName ?? "", row.deviceSn ?? "", ...columns.map((column) => row[column.key]), row.quality, row.inverterQuality ?? row.quality, (report === "plant" ? active?.result?.complete && active.inverters?.complete : active?.inverters?.complete) ? "true" : "false"]),
    ];
    const url = URL.createObjectURL(new Blob([trendCsv(data)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url;
    link.download = `${report}-report-${code.replace(/[^a-zA-Z0-9_-]/g, "_")}-${applied.period.toLowerCase()}-${applied.date}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="report-management-page"><section className="report-management-panel" aria-label="Report Management">
    <nav className="report-subtabs" aria-label="Jenis laporan"><button className={report === "plant" ? "active" : ""} aria-pressed={report === "plant"} onClick={() => { setReport("plant"); setPage(1); }}>Plant Report</button><button className={report === "inverter" ? "active" : ""} aria-pressed={report === "inverter"} onClick={() => { setReport("inverter"); setPage(1); }}>Inverter Report</button></nav>
    <form className="report-filter-bar" onSubmit={(event) => { event.preventDefault(); search(); }}>
      <label>Time granularity<select value={period} onChange={(event) => changePeriod(event.target.value as Period)}>{PERIODS.map((item) => <option key={item.value} value={item.value}>{item.title}</option>)}</select></label>
      <label>Statistical period{period === "Lifetime" ? <span className="report-lifecycle-range">1970–{calendarDate(now, zone).slice(0, 4)}</span> : <input aria-label="Statistical period" required type={period === "Day" ? "date" : period === "Month" ? "month" : "number"} value={inputDate}
        min={period === "Day" ? "1970-01-01" : period === "Month" ? "1970-01" : "1970"} max={period === "Day" ? "2100-12-31" : period === "Month" ? "2100-12" : "2100"}
        onChange={(event) => setInputDate(event.target.value)} />}</label>
      {report === "inverter" && <label>Inverter<select aria-label="Inverter laporan" value={inventory?.items.some((item) => item.id === inverterId) ? inverterId : ""} onChange={(event) => setInverterId(event.target.value)}><option value="">{!code ? "Pilih PLTS" : !inventory ? "Memuat inventory…" : inventory.items.length ? "All inverters" : "Inventory inverter belum tersedia"}</option>{inventory?.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <button className="report-search-button" type="submit" disabled={!code}>Search</button><div className="report-filter-actions"><button type="button" disabled={!code} onClick={() => setSubscribeOpen(true)}>Subscribe</button><button type="button" disabled={loading || !sorted.length || Boolean(active?.error)} onClick={download}>Export</button></div>
    </form>
    <div className="report-table-title"><h1>{report === "plant" ? "Plant Report" : "Inverter Report"}<span title="Nilai -- berarti belum tersedia atau belum terverifikasi."><Icon name="info" size={14} /></span></h1><span>{plant?.plant_name ?? "Pilih PLTS"} · {zone}</span></div>
    {pendingSearch && <p className="report-status-note" role="status">Klik Search untuk menerapkan perubahan periode.</p>}
    {(formError || active?.error) && <p className="report-error" role="alert">{formError || active?.error}</p>}
    {report === "plant" && active?.result && !active.result.complete && <p className="report-status-note partial" role="status">Laporan parsial: {active.result.completeBuckets}/{active.result.elapsedBuckets} interval lengkap. Interval mendatang tidak ditampilkan.</p>}
    {(active?.warning || inventory?.error && report === "inverter") && <p className="report-status-note" role="status">{active?.warning || inventory?.error}</p>}
    {active?.inverters && <p className={`report-status-note ${active.inverters.complete ? "" : "partial"}`} role="status">Energi inverter dari counter perangkat · Total {format(active.inverters.yield, 3)} kWh{active.inverters.complete ? "" : " · parsial"}. {active.inverters.warnings.join(" ")}</p>}
    <div className="report-table-wrap"><details className="report-column-settings"><summary aria-label="Pengaturan kolom laporan" title="Pengaturan kolom"><Icon name="settings" size={14} /></summary><div>{COLUMNS.map((column) => <label key={column.key}><input type="checkbox" checked={visible.includes(column.key)} disabled={column.key === "period"} onChange={(event) => {
      setVisible(event.target.checked ? [...visible, column.key] : visible.filter((item) => item !== column.key));
      if (!event.target.checked && sort.column === column.key) setSort({ column: "period", direction: "asc" });
    }} />{column.title}</label>)}</div></details>
      <div className="report-table-scroll"><table className="report-data-table"><thead><tr>{report === "inverter" && <><th>Inverter</th><th>SN</th></>}{columns.map((column) => <th key={column.key} scope="col" aria-sort={sort.column === column.key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button onClick={() => { setSort({ column: column.key, direction: sort.column === column.key && sort.direction === "asc" ? "desc" : "asc" }); setPage(1); }}>{column.title}<span className={`report-sort-icons ${sort.column === column.key ? sort.direction : ""}`} aria-hidden="true"><i /><i /></span></button></th>)}</tr></thead><tbody>
        {displayed.map((row) => <tr key={row.id}>{report === "inverter" && <><td>{row.deviceName}</td><td>{row.deviceSn ?? "--"}</td></>}{columns.map((column) => <td key={column.key} title={`Kualitas: ${column.key === "inverterYield" ? row.inverterQuality ?? row.quality : row.quality}${row.reason ? " ? " + row.reason : ""}`}>{column.key === "period" ? row.period : format(row[column.key], column.digits)}</td>)}</tr>)}
        {!displayed.length && <tr><td colSpan={columns.length + (report === "inverter" ? 2 : 0)} className="report-no-data"><Icon name={loading ? "refresh" : "list"} size={32} /><strong>{loading ? "Memuat laporan…" : !code ? "Pilih PLTS untuk melihat laporan" : report === "inverter" ? "Laporan inverter belum tersedia" : "No data"}</strong><span>{report === "inverter" ? "Belum ada telemetry inverter untuk periode/filter yang dipilih." : "Laporan menggunakan statistik energi terverifikasi sesuai periode pilihan."}</span></td></tr>}
      </tbody></table></div>
    </div>
    <footer className="report-pagination"><span>Total: {sorted.length}</span><div><button aria-label="Halaman laporan sebelumnya" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>{Array.from({ length: pages }, (_, index) => index + 1).filter((value) => pages <= 7 || value === 1 || value === pages || Math.abs(value - currentPage) <= 1).map((value, index, list) => <span key={value}>{index > 0 && value - list[index - 1] > 1 && <span className="report-page-ellipsis">…</span>}<button className={currentPage === value ? "active" : ""} aria-label={`Halaman laporan ${value}`} aria-current={currentPage === value ? "page" : undefined} onClick={() => setPage(value)}>{value}</button></span>)}<button aria-label="Halaman laporan berikutnya" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>›</button><select aria-label="Jumlah baris laporan per halaman" value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(1); }}>{[10, 20, 50].map((value) => <option key={value} value={value}>{value} / page</option>)}</select></div></footer>
    {report === "plant" && active?.result && <p className="report-data-note">PV Yield berasal dari energi interval. Inverter Yield dijumlahkan per interval dari laporan perangkat, dengan penanda kualitas terpisah. Export dan Revenue belum tersedia dan ditampilkan --. Ekspor mencakup seluruh halaman hasil pengurutan.</p>}
  </section>
    <dialog ref={subscriptionDialog} className="layout-dialog" aria-labelledby="report-subscribe-title" onCancel={() => setSubscribeOpen(false)}><div className="layout-dialog-heading"><h2 id="report-subscribe-title">Subscribe to reports</h2><button aria-label="Tutup langganan laporan" onClick={() => setSubscribeOpen(false)}><Icon name="close" size={18} /></button></div><p><strong>{plant?.plant_name}</strong><br />{report === "plant" ? "Plant Report" : "Inverter Report"} · {PERIODS.find((item) => item.value === applied.period)?.title} · {applied.date}</p><p>Langganan otomatis belum tersedia. Backend perlu menyediakan penjadwalan dan pengiriman laporan. Untuk laporan yang tersedia, gunakan Export untuk mengunduh CSV.</p><footer><button className="layout-save" onClick={() => setSubscribeOpen(false)}>Mengerti</button></footer></dialog>
  </div>;
}
