import { useEffect, useMemo, useRef, useState } from "react";
import type { AgCartesianChartOptions } from "ag-charts-community";
import type { Plant } from "../services/fleet";
import { getPowerStatistics } from "../services/analytics";
import { calendarDate, validTimeZone } from "../services/calendar";
import { statisticsRange } from "../services/statistics";
import type { ChartPoint, Period } from "../services/statistics";
import { getYieldStatistics } from "../services/yieldStatistics";
import type { YieldResult } from "../services/yieldStatistics";
import { trendCsv } from "../services/monitoring";
import type { PowerPoint } from "../services/monitoring";
import MonitoringLineChart from "./MonitoringLineChart";
import { DashboardBarChart } from "./AgDashboardChart";
import Icon from "./Icon";

type SeriesKey = "pv" | "grid" | "load";
const SERIES = [
  { key: "pv", name: "PV output", color: "#55cd91" },
  { key: "grid", name: "Power from grid", color: "#999faa" },
  { key: "load", name: "Consumed by appliances", color: "#ff880b" },
] as const;
const EMPTY_POWER: PowerPoint[] = [];
const EMPTY_ENERGY: ChartPoint[] = [];
const TEMPLATES: { name: string; description: string; series: SeriesKey[] }[] = [
  { name: "Energy Overview", description: "PV output, power from grid, dan consumed by appliances.", series: ["pv", "grid", "load"] },
  { name: "PV Performance", description: "Fokus pada kurva daya produksi PV.", series: ["pv"] },
  { name: "Grid & Load", description: "Bandingkan daya jaringan dan daya beban.", series: ["grid", "load"] },
];
interface TrendResponse { key: string; power: PowerPoint[]; energy: YieldResult | null; error: string; complete?: boolean }

export default function MonitoringTrend({ plant, now, refreshKey }: { plant?: Plant; now: number; refreshKey: number }) {
  const zone = validTimeZone(plant?.time_zone), code = plant?.plant_code ?? "";
  const [mode, setMode] = useState<"energy" | "custom">("energy");
  const [period, setPeriod] = useState<Period>("Day"), [date, setDate] = useState(() => calendarDate(now, zone));
  const [enabled, setEnabled] = useState<SeriesKey[]>(["pv", "grid", "load"]);
  const [templatesOpen, setTemplatesOpen] = useState(false), [retry, setRetry] = useState(0);
  const [mountedAt] = useState(now);
  const [response, setResponse] = useState<TrendResponse | null>(null);
  const templates = useRef<HTMLDialogElement>(null);
  const key = JSON.stringify([code, period, date, zone, refreshKey, retry]);
  const active = response?.key === key ? response : null;
  const loading = Boolean(code) && !active;
  useEffect(() => {
    if (templatesOpen) templates.current?.showModal(); else templates.current?.close();
  }, [templatesOpen]);
  useEffect(() => {
    if (!code) return;
    const controller = new AbortController();
    void (async () => {
      try {
        let power: PowerPoint[] = [], energy: YieldResult | null = null, complete = true;
        if (period === "Day") {
          const result = await getPowerStatistics(code, statisticsRange("Day", date, zone), controller.signal);
          power = result.points; complete = result.complete;
        } else {
          energy = await getYieldStatistics(code, statisticsRange(period, date, zone, new Date(refreshKey || mountedAt)), controller.signal);
        }
        if (!controller.signal.aborted) setResponse({ key, power, energy, error: "", complete });
      } catch (error) {
        if (!controller.signal.aborted) setResponse({ key, power: [], energy: null, error: error instanceof Error ? error.message : "Gagal mengambil data trend." });
      }
    })();
    return () => controller.abort();
  }, [code, period, date, zone, key, refreshKey, mountedAt]);
  const power = active?.power ?? EMPTY_POWER, energy = active?.energy?.points ?? EMPTY_ENERGY;
  const hasData = period === "Day" ? power.some((point) => enabled.some((series) => point[series] !== null)) : energy.some((point) => point.value !== null);
  const lineOptions = useMemo<AgCartesianChartOptions<PowerPoint>>(() => ({
    data: power, background: { fill: "transparent" }, animation: { enabled: false },
    padding: { top: 16, left: 12, right: 24, bottom: 10 },
    overlays: { noData: { enabled: false } },
    legend: { position: "bottom", spacing: 28, item: { label: { color: "#747d89", fontSize: 12 } } },
    series: SERIES.filter((series) => enabled.includes(series.key)).map((series) => ({
      type: "line", xKey: "label", yKey: series.key, yName: series.name,
      stroke: series.color, strokeWidth: 1.8, marker: { enabled: false }, connectMissingData: false,
      tooltip: { renderer: ({ datum }) => ({ title: datum.label, data: [{ label: series.name, value: `${datum[series.key] ?? "--"} kW` }] }) },
    })),
    axes: {
      x: { type: "category", position: "bottom", label: { fontSize: 11, color: "#9aa3af", avoidCollisions: true }, line: { stroke: "#a4acb7" }, tick: { enabled: false } },
      y: { type: "number", position: "left", title: { text: "kW", color: "#9aa3af", fontSize: 11 }, label: { color: "#9aa3af", fontSize: 11 }, gridLine: { style: [{ stroke: "#e0e2e6" }] }, line: { enabled: false }, tick: { enabled: false } },
    },
  }), [power, enabled]);
  const barOptions = useMemo<AgCartesianChartOptions<ChartPoint>>(() => ({
    data: energy, background: { fill: "transparent" }, animation: { enabled: false },
    padding: { top: 16, left: 12, right: 24, bottom: 10 }, overlays: { noData: { enabled: false } },
    legend: { position: "bottom", spacing: 28 },
    series: [{ type: "bar", xKey: "label", yKey: "value", yName: "PV energy", fill: "#55cd91", strokeWidth: 0 }],
    axes: { x: { type: "category", position: "bottom", label: { fontSize: 11, color: "#9aa3af" } },
      y: { type: "number", position: "left", min: 0, title: { text: "kWh", color: "#9aa3af", fontSize: 11 }, gridLine: { style: [{ stroke: "#e0e2e6" }] } } },
  }), [energy]);
  function choosePeriod(value: Period) {
    setPeriod(value);
    if (value !== "Day" && !enabled.includes("pv")) setEnabled([...enabled, "pv"]);
  }
  function download() {
    if (!plant || !hasData || loading || !active) return;
    const rows: (string | number | null)[][] = period === "Day" ? [
      ["plant_code", "plant_name", "local_date", "time_zone", "interval", "start_at", "end_at", ...enabled.map((series) => `${series}_power_kw`), "quality", "field_quality"],
      ...power.map((point) => {
        const values = enabled.map((series) => point[series]);
        return [code, plant.plant_name, date, zone, point.label, point.startAt ?? null, point.endAt ?? null, ...values,
          point.quality ?? (values.every((value) => value === null) ? "missing" : "partial"), JSON.stringify(point.fieldQuality ?? {})];
      }),
    ] : [
      ["plant_code", "plant_name", "period", "selected_date", "time_zone", "bucket", "pv_energy_kwh", "quality", "complete_period"],
      ...energy.map((point) => [code, plant.plant_name, period, date, zone, point.label, point.value, point.quality, active.energy?.complete ? "true" : "false"]),
    ];
    const url = URL.createObjectURL(new Blob([trendCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url;
    link.download = `trend-${code.replace(/[^a-zA-Z0-9_-]/g, "_")}-${period.toLowerCase()}-${date}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="monitor-trend-page"><section className="monitor-trend-panel" aria-label="Monitoring Trend">
    <header className="trend-panel-header"><div className="trend-subtabs" role="group" aria-label="Jenis trend"><button className={mode === "energy" ? "active" : ""} aria-pressed={mode === "energy"} onClick={() => setMode("energy")}>Energy Trend</button><button className={mode === "custom" ? "active" : ""} aria-pressed={mode === "custom"} onClick={() => setMode("custom")}>Custom</button></div><div className="trend-header-actions"><button onClick={() => setTemplatesOpen(true)}>Templates</button><button disabled={!hasData || loading || Boolean(active?.error)} onClick={download}>Export</button></div></header>
    <div className="trend-period-row"><div className="trend-period-toggle" role="group" aria-label="Periode trend">{(["Day", "Month", "Year", "Lifetime"] as Period[]).map((value) => <button key={value} className={period === value ? "active" : ""} aria-pressed={period === value} onClick={() => choosePeriod(value)}>{value === "Lifetime" ? "Lifecycle" : value}</button>)}</div>
      {period === "Lifetime" ? <span className="trend-lifecycle-range">1970–{calendarDate(now, zone).slice(0, 4)}</span> : <input className="trend-date" aria-label="Tanggal trend" type={period === "Day" ? "date" : period === "Month" ? "month" : "number"}
        value={period === "Day" ? date : period === "Month" ? date.slice(0, 7) : date.slice(0, 4)}
        min={period === "Day" ? "1970-01-01" : period === "Month" ? "1970-01" : "1970"}
        max={period === "Day" ? "2100-12-31" : period === "Month" ? "2100-12" : "2100"}
        onChange={(event) => { const value = event.target.value; if (!value || !event.target.validity.valid || period === "Year" && value.length !== 4) return;
          setDate(period === "Day" ? value : period === "Month" ? value + "-01" : value + "-01-01"); }} />}
    </div>
    {mode === "custom" && <div className="trend-custom-controls"><span>Seri grafik</span>{SERIES.map((series) => <label key={series.key}><input type="checkbox" checked={period === "Day" ? enabled.includes(series.key) : series.key === "pv"} disabled={period !== "Day" || enabled.includes(series.key) && enabled.length === 1} onChange={(event) => setEnabled(event.target.checked ? [...enabled, series.key] : enabled.filter((key) => key !== series.key))} /><i style={{ background: series.color }} />{series.name}</label>)}{period !== "Day" && <small>Periode energi saat ini menyediakan PV energy saja.</small>}</div>}
    <div className="trend-chart-title"><h1>{mode === "energy" ? "Energy Trend" : "Custom Trend"}</h1><span>{plant?.plant_name ?? "Pilih PLTS melalui daftar di sisi kiri"}</span></div>
    <div className="trend-chart-stage" aria-busy={loading}>{period === "Day" ? <MonitoringLineChart options={lineOptions} /> : <DashboardBarChart options={barOptions} />}
      {(!hasData || loading || active?.error) && <div className="trend-chart-overlay"><Icon name={loading ? "refresh" : "chart"} size={34} /><strong>{loading ? "Memuat data trend…" : active?.error ? "Data trend belum dapat dimuat" : "Belum ada data pengukuran terverifikasi"}</strong><p>{active?.error || (code ? "Periksa periode atau pilih PLTS lain." : "Buka daftar PLTS dengan tombol di sisi kiri.")}</p>{active?.error && <button onClick={() => setRetry((value) => value + 1)}>Coba lagi</button>}</div>}
    </div>
    <p className="trend-data-note">{zone} · {period === "Day" ? "Daya dari API rentang tanggal, pembacaan terakhir per 5 menit. Gap tidak diinterpolasi; tanda jaringan mengikuti verifikasi backend." : "Energi interval PV untuk seluruh rentang pilihan; periode tanpa data dibiarkan kosong."}</p>
    {period === "Day" && active?.complete === false && <p className="trend-partial-note" role="status">Cakupan daya masih parsial; kualitas diperiksa per metrik dan data kosong tidak diubah menjadi nol.</p>}
    {active?.energy && !active.energy.complete && <p className="trend-partial-note" role="status">Data parsial: {active.energy.completeBuckets}/{active.energy.elapsedBuckets} interval lengkap.{active.energy.truncated ? " Backend belum mengembalikan seluruh rentang." : ""}</p>}
  </section>
    <dialog ref={templates} className="layout-dialog trend-template-dialog" aria-labelledby="trend-templates-title" onCancel={() => setTemplatesOpen(false)}><div className="layout-dialog-heading"><h2 id="trend-templates-title">Trend Templates</h2><button aria-label="Tutup Templates" onClick={() => setTemplatesOpen(false)}><Icon name="close" size={18} /></button></div><p>Pilih konfigurasi seri daya harian untuk PLTS yang aktif.</p><div className="trend-template-list">{TEMPLATES.map((template) => <button key={template.name} onClick={() => { setEnabled([...template.series]); setPeriod("Day"); setMode(template.name === "Energy Overview" ? "energy" : "custom"); setTemplatesOpen(false); }}><Icon name="chart" size={22} /><span><strong>{template.name}</strong><small>{template.description}</small></span><Icon name="chevron" size={15} /></button>)}</div><footer><button onClick={() => setTemplatesOpen(false)}>Cancel</button></footer></dialog>
  </div>;
}
