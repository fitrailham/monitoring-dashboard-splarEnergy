import { useEffect, useMemo, useRef, useState } from "react";
import type { AgCartesianChartOptions } from "ag-charts-community";
import type { Plant } from "../services/fleet";
import { format } from "../services/fleet";
import { calendarDate, validTimeZone } from "../services/calendar";
import { getDevices } from "../services/devices";
import type { InventoryDevice } from "../services/devices";
import { CV_BANDS, cvBand, cvGroupTrend, cvRange, getCvAnalysis, offsetCvDate } from "../services/cvAnalysis";
import type { CvMode, CvQuery, CvRow, CvSnapshot } from "../services/cvAnalysis";
import { trendCsv } from "../services/monitoring";
import { DashboardBarChart } from "./AgDashboardChart";
import Icon from "./Icon";

interface Filters extends CvQuery { sn: string; revision: number }
interface CvResponse { key: string; snapshot: CvSnapshot | null; devices: InventoryDevice[]; error: string; inventoryError: string; inventoryWarning: string }
const EMPTY_ROWS: CvRow[] = [], EMPTY_DEVICES: InventoryDevice[] = [];
const QUALITY = { measured: "Measured", derived: "Derived", partial: "Partial", missing: "Unavailable" };

export default function CoefficientVariationAnalysis({ plant, now, refreshKey }: { plant?: Plant; now: number; refreshKey: number }) {
  const code = plant?.plant_code ?? "", plantName = plant?.plant_name ?? "", zone = validTimeZone(plant?.time_zone);
  const [mode, setMode] = useState<CvMode>("inverter");
  const [draft, setDraft] = useState<Filters>(() => { const date = calendarDate(now, zone); return { fromDate: offsetCvDate(date, -6), toDate: date, deviceId: "", sn: "", revision: 0 }; });
  const [applied, setApplied] = useState(draft), [formError, setFormError] = useState("");
  const [response, setResponse] = useState<CvResponse | null>(null);
  const [group, setGroup] = useState(""), [date, setDate] = useState(""), [band, setBand] = useState("");
  const [page, setPage] = useState(1), [size, setSize] = useState(10);
  const [sort, setSort] = useState<{ key: "deviceName" | "cv" | "deviation" | "count"; direction: "asc" | "desc" }>({ key: "cv", direction: "desc" });
  const [methodOpen, setMethodOpen] = useState(false), [detail, setDetail] = useState<CvRow | null>(null);
  const methodDialog = useRef<HTMLDialogElement>(null), detailDialog = useRef<HTMLDialogElement>(null);
  const key = JSON.stringify([code, plantName, mode, applied, refreshKey]);
  const active = response?.key === key ? response : null, loading = Boolean(code) && !active;
  const snapshot = active?.snapshot ?? null, rows = snapshot?.rows ?? EMPTY_ROWS, devices = active?.devices ?? EMPTY_DEVICES;
  const ready = snapshot?.status === "ready";
  useEffect(() => {
    if (!code) return;
    const controller = new AbortController();
    void Promise.allSettled([getCvAnalysis(code, mode, applied, zone, controller.signal), getDevices(code, plantName, controller.signal)])
      .then(([analysis, inventory]) => {
        if (controller.signal.aborted) return;
        setResponse({ key, snapshot: analysis.status === "fulfilled" ? analysis.value : null,
          error: analysis.status === "rejected" ? analysis.reason instanceof Error ? analysis.reason.message : "Analisis CV belum dapat dimuat." : "",
          devices: inventory.status === "fulfilled" ? inventory.value.devices : [],
          inventoryError: inventory.status === "rejected" ? "Inventory inverter belum dapat dimuat." : "",
          inventoryWarning: inventory.status === "fulfilled" ? inventory.value.warning : "" });
      });
    return () => controller.abort();
  }, [code, plantName, mode, applied, zone, key]);
  useEffect(() => { if (methodOpen) methodDialog.current?.showModal(); else methodDialog.current?.close(); }, [methodOpen]);
  useEffect(() => { if (detail) detailDialog.current?.showModal(); else detailDialog.current?.close(); }, [detail]);
  const inverters = useMemo(() => devices.filter((device) => device.type === "inverter"), [devices]);
  const inventoryById = useMemo(() => new Map(inverters.map((device) => [device.sourceId, device])), [inverters]);
  const enrichedRows = useMemo(() => rows.map((row) => {
    const device = inventoryById.get(row.deviceId);
    if (!device || row.deviceSn && device.sn && row.deviceSn !== device.sn) return row;
    return { ...row, deviceName: row.deviceName === row.deviceId ? device.name : row.deviceName, deviceSn: row.deviceSn ?? device.sn };
  }), [rows, inventoryById]);
  const scopedRows = useMemo(() => enrichedRows.filter((row) => (row.deviceSn ?? "").toLowerCase().includes(applied.sn.trim().toLowerCase())), [enrichedRows, applied.sn]);
  const viewComplete = Boolean(snapshot?.complete) && (!applied.sn.trim() || enrichedRows.every((row) => row.deviceSn !== null));
  const groups = useMemo(() => [...new Set(scopedRows.map((row) => row.group))].sort(), [scopedRows]);
  const activeGroup = groups.includes(group) ? group : groups.length === 1 ? groups[0] : "";
  const trend = useMemo(() => cvGroupTrend(scopedRows, activeGroup), [scopedRows, activeGroup]);
  const dates = useMemo(() => [...new Set(scopedRows.filter((row) => !activeGroup || row.group === activeGroup).map((row) => row.date))].sort(), [scopedRows, activeGroup]);
  const activeDate = dates.includes(date) ? date : dates.at(-1) ?? applied.toDate;
  const dailyRows = useMemo(() => scopedRows.filter((row) => row.date === activeDate && (!activeGroup || row.group === activeGroup)), [scopedRows, activeDate, activeGroup]);
  const filtered = useMemo(() => [...dailyRows.filter((row) => !band || cvBand(row.cv) === band)].sort((left, right) => {
    const a = left[sort.key], b = right[sort.key];
    if (a === null) return b === null ? 0 : 1;
    if (b === null) return -1;
    const result = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "en", { numeric: true });
    return result * (sort.direction === "asc" ? 1 : -1) || left.id.localeCompare(right.id);
  }), [dailyRows, band, sort]);
  const histogram = useMemo(() => dailyRows.some((row) => row.cv !== null) ? CV_BANDS.map((item) => ({ ...item, count: dailyRows.filter((row) => cvBand(row.cv) === item.id).length })) : [], [dailyRows]);
  const pages = Math.max(1, Math.ceil(filtered.length / size)), current = Math.min(page, pages);
  const displayed = filtered.slice((current - 1) * size, current * size);
  const trendOptions = useMemo<AgCartesianChartOptions<(typeof trend)[number]>>(() => ({
    data: trend, background: { fill: "transparent" }, animation: { enabled: false }, legend: { enabled: false }, overlays: { noData: { enabled: false } },
    series: [{ type: "bar", xKey: "date", yKey: "value", yName: "Group CV (%)", fill: "#5ba2ed", strokeWidth: 0 }],
    axes: { x: { type: "category", position: "bottom", label: { fontSize: 10, color: "#899aaa" } }, y: { type: "number", position: "left", min: 0, title: { text: "CV (%)", fontSize: 11 }, gridLine: { style: [{ stroke: "#e7edf3", lineDash: [4, 3] }] } } },
    listeners: { seriesNodeClick: ({ datum }) => { setDate(datum.date); setPage(1); setBand(""); } },
  }), [trend]);
  const distributionOptions = useMemo<AgCartesianChartOptions<(typeof histogram)[number]>>(() => ({
    data: histogram, background: { fill: "transparent" }, animation: { enabled: false }, legend: { enabled: false }, overlays: { noData: { enabled: false } },
    series: [{ type: "bar", direction: "horizontal", xKey: "label", yKey: "count", yName: "Analysis rows", strokeWidth: 0, itemStyler: ({ datum }) => ({ fill: datum.color }) }],
    axes: { x: { type: "category", position: "left", label: { fontSize: 11, color: "#899aaa" } }, y: { type: "number", position: "bottom", min: 0, title: { text: "Jumlah baris", fontSize: 11 }, label: { formatter: ({ value }) => Number.isInteger(value) ? String(value) : "" } } },
    listeners: { seriesNodeClick: ({ datum }) => { setBand((previous) => previous === datum.id ? "" : datum.id); setPage(1); } },
  }), [histogram]);
  function submit() {
    try { cvRange(draft, zone); } catch (error) { setFormError(error instanceof Error ? error.message : "Periode tidak valid."); return; }
    setApplied({ ...draft, revision: applied.revision + 1 }); setFormError(""); setGroup(""); setDate(""); setBand(""); setPage(1);
  }
  function download() {
    if (!ready || !filtered.length || !snapshot || !plant) return;
    const csv = trendCsv([
      ["Plant Code", "Plant Name", "Analysis Type", "Date", "Time Zone", "Device ID", "Device Name", "SN", "String ID", "Comparison Group", "CV (%)", "Deviation (%)", `Group Mean (${snapshot.unit})`, `Group Standard Deviation (${snapshot.unit})`, "Comparable Members", "Average Current (A)", "Average Voltage (V)", "Quality", "Reason", "Metric", "Method", "Comparison Basis", "Complete Scope"],
      ...filtered.map((row) => [code, plantName, mode, row.date, zone, row.deviceId, row.deviceName, row.deviceSn, row.stringId, row.group, row.cv, row.deviation, row.mean, row.stddev, row.count, row.averageCurrent, row.averageVoltage, row.quality, row.reason, snapshot.metric, snapshot.method, snapshot.basis, String(viewComplete)]),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), link = document.createElement("a");
    link.href = url; link.download = `cv-${mode}-${code.replace(/[^a-zA-Z0-9_-]/g, "_")}-${activeDate}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function sortColumn(column: typeof sort.key, title: string) {
    return <button onClick={() => { setSort({ key: column, direction: sort.key === column && sort.direction === "asc" ? "desc" : "asc" }); setPage(1); }}>{title}<span aria-hidden="true">{sort.key === column ? sort.direction === "asc" ? " ↑" : " ↓" : " ↕"}</span></button>;
  }
  return <div className="cv-analysis-page"><section className="cv-analysis-panel" aria-label="Coefficient of Variation Analysis">
    <header className="cv-tab-header"><nav aria-label="Jenis analisis CV"><button className={mode === "inverter" ? "active" : ""} aria-pressed={mode === "inverter"} onClick={() => { setMode("inverter"); setBand(""); setPage(1); }}>Inverter Coefficient of Variation</button><button className={mode === "string" ? "active" : ""} aria-pressed={mode === "string"} onClick={() => { setMode("string"); setBand(""); setPage(1); }}>String Coefficient of Variation</button></nav><button className="cv-method-button" onClick={() => setMethodOpen(true)}><Icon name="info" size={14} />Method</button></header>
    <form className="cv-filter-bar" onSubmit={(event) => { event.preventDefault(); submit(); }}><label>Inverter<select value={draft.deviceId} onChange={(event) => setDraft({ ...draft, deviceId: event.target.value })}><option value="">All inverters</option>{inverters.filter((device) => device.sourceId !== null).map((device) => <option key={device.id} value={device.sourceId!}>{device.name}</option>)}</select></label><label>SN<input placeholder="Device SN" value={draft.sn} onChange={(event) => setDraft({ ...draft, sn: event.target.value })} /></label><label>Time range<input aria-label="Tanggal awal analisis CV" type="date" required min="1970-01-01" max="2100-12-31" value={draft.fromDate} onChange={(event) => setDraft({ ...draft, fromDate: event.target.value })} /><span>—</span><input aria-label="Tanggal akhir analisis CV" type="date" required min="1970-01-01" max="2100-12-31" value={draft.toDate} onChange={(event) => setDraft({ ...draft, toDate: event.target.value })} /></label><button className="cv-search" type="submit" disabled={!code}>Search</button><button type="button" className="cv-reset" onClick={() => { const today = calendarDate(now, zone); const next = { fromDate: offsetCvDate(today, -6), toDate: today, deviceId: "", sn: "", revision: applied.revision + 1 }; setDraft(next); setApplied(next); setFormError(""); setGroup(""); setDate(""); setBand(""); setPage(1); }}>Reset</button><button className="cv-export" type="button" disabled={!ready || !filtered.length || loading} onClick={download}>Export</button></form>
    {formError && <p className="cv-message error" role="alert">{formError}</p>}
    <p className="cv-comparison-note"><Icon name="info" size={15} />Bandingkan perangkat/string dalam comparison group dengan kondisi operasi dan kapasitas yang sebanding. CV bukan diagnosis kerusakan otomatis.</p>
    {active?.error && <p className="cv-message error" role="alert">{active.error}<button onClick={() => setApplied({ ...applied, revision: applied.revision + 1 })}>Coba lagi</button></p>}
    {snapshot?.status === "unconfigured" && <p className="cv-message" role="status">Data analisis CV belum terhubung dari backend. Diperlukan hasil perbandingan per inverter/string, identitas group, mean, dan standar deviasi. Telemetry total PLTS tidak digunakan sebagai pengganti.</p>}
    {active?.inventoryError && <p className="cv-inventory-note">{active.inventoryError}</p>}
    {active?.inventoryWarning && <p className="cv-inventory-note">{active.inventoryWarning}</p>}
    {ready && !viewComplete && <p className="cv-message" role="status">Hasil masih parsial. CV dengan data tidak valid, mean nol, atau anggota pembanding kurang dari dua ditampilkan --. Filter SN yang memerlukan metadata belum tersedia juga belum memiliki cakupan lengkap.</p>}
    <div className="cv-summary-cards">
      <div><Icon name="panel" size={22} /><span>Inverters in inventory</span><strong>{active && !active.inventoryError ? `${active.inventoryWarning ? "≥" : ""}${inverters.length}` : "--"}</strong></div>
      <div><Icon name="chart" size={22} /><span>Analyzed devices</span><strong>{ready ? new Set(scopedRows.map((row) => row.deviceId)).size : "--"}</strong></div>
      <div><Icon name="check" size={22} /><span>Rows with valid CV</span><strong>{ready ? scopedRows.filter((row) => row.cv !== null).length : "--"}</strong></div>
      <div><Icon name="calendar" size={22} /><span>Analysis coverage</span><strong className="cv-coverage-label">{loading ? "Loading…" : !ready ? "Unavailable" : viewComplete ? "Complete" : "Partial"}</strong></div>
    </div>
    <div className="cv-chart-controls"><span>{plantName || "Pilih PLTS dari daftar di sisi kiri"} · {zone} · {applied.fromDate} – {applied.toDate}</span><label>Comparison group<select aria-label="Comparison group CV" value={activeGroup} disabled={!groups.length} onChange={(event) => { setGroup(event.target.value); setDate(""); setBand(""); setPage(1); }}><option value="">Semua group (tabel)</option>{groups.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
    <div className="cv-charts"><section><h2>Coefficient of Variation Trend <small>(%)</small></h2><div className="cv-chart"><DashboardBarChart options={trendOptions} />{(!trend.some((point) => point.value !== null) || loading) && <div className="cv-chart-empty"><Icon name={loading ? "refresh" : "chart"} size={32} /><span>{loading ? "Memuat analisis…" : groups.length > 1 && !activeGroup ? "Pilih satu comparison group untuk menampilkan trend." : "No analysis data"}</span></div>}</div><p>Klik batang tanggal untuk melihat rincian. CV antar-group tidak dirata-ratakan.</p></section><section><h2>CV Distribution <small>· {activeDate}</small></h2><div className="cv-chart"><DashboardBarChart options={distributionOptions} />{(!histogram.length || loading) && <div className="cv-chart-empty"><Icon name="chart" size={32} /><span>Distribusi belum tersedia</span></div>}</div><div className="cv-band-legend">{CV_BANDS.map((item) => <button key={item.id} className={band === item.id ? "active" : ""} aria-pressed={band === item.id} onClick={() => { setBand(band === item.id ? "" : item.id); setPage(1); }}><i style={{ background: item.color }} />{item.label}</button>)}</div><p>Rentang tampilan, bukan ambang diagnosis.</p></section></div>
    {trend.some((point) => !point.consistent) && <p className="cv-message" role="status">Sebagian nilai CV dalam group/tanggal tidak lengkap atau tidak konsisten; batang tersebut dibiarkan kosong.</p>}
    <div className="cv-detail-heading"><h2>{mode === "inverter" ? "Inverter Deviation Details" : "String Deviation Details"}</h2><label>Analysis date<select aria-label="Tanggal rincian CV" disabled={!dates.length} value={activeDate} onChange={(event) => { setDate(event.target.value); setBand(""); setPage(1); }}>{!dates.length && <option value={activeDate}>{activeDate}</option>}{dates.map((value) => <option key={value}>{value}</option>)}</select></label></div>
    <div className="cv-table-region"><div className="cv-table-scroll"><table className="cv-results-table"><thead><tr><th scope="col">{sortColumn("deviceName", "Inverter Name")}</th><th scope="col">SN</th>{mode === "string" && <th scope="col">String ID</th>}<th scope="col">Comparison Group</th><th scope="col" aria-sort={sort.key === "cv" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}>{sortColumn("cv", "Group CV (%)")}</th><th scope="col">{sortColumn("deviation", "Deviation (%)")}</th>{mode === "string" && <><th scope="col">Avg. Current (A)</th><th scope="col">Avg. Voltage (V)</th></>}<th scope="col">{sortColumn("count", "Comparable Members")}</th><th scope="col">Quality</th><th scope="col">Operation</th></tr></thead><tbody>{displayed.map((row) => <tr key={row.id}><td>{row.deviceName}</td><td>{row.deviceSn ?? "--"}</td>{mode === "string" && <td>{row.stringId ?? "--"}</td>}<td>{row.group}</td><td>{format(row.cv)}</td><td>{format(row.deviation)}</td>{mode === "string" && <><td>{format(row.averageCurrent)}</td><td>{format(row.averageVoltage)}</td></>}<td>{row.count}</td><td><span className={`cv-quality ${row.quality}`}>{QUALITY[row.quality]}</span></td><td><button className="cv-row-details" onClick={() => setDetail(row)}>Details</button></td></tr>)}{!displayed.length && <tr><td colSpan={mode === "string" ? 11 : 8} className="cv-no-data" aria-label="Belum ada baris analisis">&nbsp;</td></tr>}</tbody></table></div>
      {!displayed.length && <div className="cv-table-empty-overlay" role="status"><Icon name="chart" size={32} /><strong>{loading ? "Memuat hasil analisis…" : "No data"}</strong><span>Hasil muncul setelah data CV per inverter/string tersedia dan lolos pemeriksaan kualitas.</span></div>}
    </div>
    <footer className="cv-pagination"><span>Total: {ready ? filtered.length : "--"}{band ? ` · ${CV_BANDS.find((item) => item.id === band)?.label}` : ""}</span><div><button aria-label="Halaman CV sebelumnya" disabled={current === 1} onClick={() => setPage(current - 1)}>‹</button><span>{current} / {pages}</span><button aria-label="Halaman CV berikutnya" disabled={current === pages} onClick={() => setPage(current + 1)}>›</button><select aria-label="Jumlah baris CV per halaman" value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(1); }}>{[10, 20, 50].map((value) => <option key={value} value={value}>{value} / page</option>)}</select></div></footer>
    {ready && <p className="cv-source-note">Metric: {snapshot.metric} ({snapshot.unit}) · Method: {snapshot.method} · Comparison basis: {snapshot.basis}</p>}
  </section>
    <dialog ref={methodDialog} className="layout-dialog cv-detail-dialog" onCancel={() => setMethodOpen(false)} aria-labelledby="cv-method-title"><div className="layout-dialog-heading"><h2 id="cv-method-title">CV Method & Data Requirements</h2><button aria-label="Tutup metode CV" onClick={() => setMethodOpen(false)}><Icon name="close" size={18} /></button></div><p>CV (%) = standar deviasi ÷ mean × 100. Mean harus positif dan group memiliki minimal dua anggota yang dapat dibandingkan. Mean nol menghasilkan CV tidak terdefinisi.</p><p>Backend menentukan metric, normalisasi, window pengukuran, dan comparison group yang setara. Halaman memeriksa konsistensi nilai CV dengan statistik group, bukan meniru algoritma diagnosis vendor. CV tinggi tidak otomatis berarti perangkat rusak.</p><p>Rentang tanggal maksimum 366 hari. Data total PLTS dan variasi produksi antar-jam tidak dipakai untuk menggantikan perbandingan inverter/string.</p><p><a href="https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/coefvate.htm" target="_blank" rel="noreferrer">Definisi CV — NIST</a> · <a href="https://info.support.huawei.com/Energy/info/en_US/solar/docView/EDOC1100612098" target="_blank" rel="noreferrer">Panduan monitoring — Huawei</a></p><footer><button className="layout-save" onClick={() => setMethodOpen(false)}>Mengerti</button></footer></dialog>
    <dialog ref={detailDialog} className="layout-dialog cv-detail-dialog" onCancel={() => setDetail(null)} aria-labelledby="cv-row-title"><div className="layout-dialog-heading"><h2 id="cv-row-title">CV Analysis Details</h2><button aria-label="Tutup rincian CV" onClick={() => setDetail(null)}><Icon name="close" size={18} /></button></div>{detail && <><dl className="cv-detail-list">{[
      ["Inverter", detail.deviceName], ["SN", detail.deviceSn], ["String", detail.stringId], ["Date", detail.date], ["Comparison group", detail.group], ["Group CV (%)", format(detail.cv)], ["Deviation (%)", format(detail.deviation)], [`Mean (${snapshot?.unit ?? "--"})`, format(detail.mean)], [`Std. deviation (${snapshot?.unit ?? "--"})`, format(detail.stddev)], ["Comparable members", String(detail.count)], ["Avg. current (A)", format(detail.averageCurrent)], ["Avg. voltage (V)", format(detail.averageVoltage)], ["Quality", QUALITY[detail.quality]], ["Reason", detail.reason || "--"],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "--"}</dd></div>)}</dl></>}<footer><button className="layout-save" onClick={() => setDetail(null)}>Close</button></footer></dialog>
  </div>;
}
