import { useEffect, useMemo, useRef, useState } from "react";
import type { AgCartesianChartOptions } from "ag-charts-community";
import type { Plant } from "../services/fleet";
import { format, number, request, status, statusLabel } from "../services/fleet";
import { calendarDate, validTimeZone } from "../services/calendar";
import { telemetryFreshness, telemetryLabel } from "../services/quality";
import { statisticsRange } from "../services/statistics";
import type { ChartPoint, Period } from "../services/statistics";
import { getYieldStatistics } from "../services/yieldStatistics";
import type { YieldResult } from "../services/yieldStatistics";
import { getPowerStatistics } from "../services/analytics";
import type { PowerPoint } from "../services/monitoring";
import { DashboardBarChart } from "./AgDashboardChart";
import MonitoringLineChart from "./MonitoringLineChart";
import Icon from "./Icon";
import PhysicalLayout from "./PhysicalLayout";
import MonitoringTrend from "./MonitoringTrend";
import ReportManagement from "./ReportManagement";
import DeviceManagement from "./DeviceManagement";
import AlarmManagement from "./AlarmManagement";
import CoefficientVariationAnalysis from "./CoefficientVariationAnalysis";

interface Alarm { severity?: string; level?: string; name?: string; description?: string }
interface Result { key: string; energy: YieldResult | null; power: PowerPoint[]; powerComplete?: boolean; alarms: Alarm[] | null; errors: string[] }
const EMPTY_POWER: PowerPoint[] = [];
const EMPTY_ENERGY: ChartPoint[] = [];

function FlowDiagram({ plant }: { plant: Plant }) {
  const pv = number(plant.pv_power_kw);
  return <svg className="monitor-flow-diagram" viewBox="0 0 640 340" role="img" aria-label={`Aliran energi: PV ${format(pv)} kW, beban ${format(plant.load_power_kw)} kW, jaringan ${format(plant.grid_power_kw)} kW`}>
    <defs>
      <linearGradient id="monitor-roof" x2="1" y2="1"><stop stopColor="#e0e4e9" /><stop offset="1" stopColor="#929ba7" /></linearGradient>
      <linearGradient id="monitor-panel" x2="0" y2="1"><stop stopColor="#555f72" /><stop offset="1" stopColor="#1d2f4a" /></linearGradient>
      <marker id="monitor-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0 6 3 0 6" fill="#1684ff" /></marker>
    </defs>
    <path d="M125 235 284 140" fill="none" stroke="#c2cfdf" strokeWidth="1.5" />
    <path d="M525 235 357 143" fill="none" stroke="#9bbaf2" strokeWidth="1.5" markerEnd={pv !== null && pv > 0 ? "url(#monitor-arrow)" : undefined} />
    <path d="M135 258 Q320 390 515 258" fill="none" stroke="#e0e5ec" />
    <g transform="translate(263 70)">
      <ellipse cx="55" cy="95" rx="66" ry="12" fill="#12253b0c" />
      <path d="M0 32 70 0 120 23 50 58Z" fill="url(#monitor-roof)" stroke="#818c9b" strokeWidth="2" />
      <path d="M0 32 50 58 50 104 0 77Z" fill="#444b56" /><path d="M50 58 120 23 120 68 50 104Z" fill="#6b7583" />
      {[62, 76, 90, 104].map((x) => <path key={x} d={`M${x} ${64 - (x - 50) / 2}v22`} stroke="#b3bdc7" strokeWidth="5" />)}
      <path d="M8 48 41 65" stroke="#d5b87e" strokeWidth="2" />
    </g>
    <g transform="translate(74 173)" stroke="#8d98a5" fill="none" strokeWidth="1.5">
      {[0, 43].map((offset) => <g key={offset} transform={`translate(${offset} 0)`}><path d="M20 0 1 95M20 0l20 95M11 20h19M7 40h27M4 60h33M12 20l20 20L5 60l33 32M28 20 8 40l28 20L2 92M0 25h40M-5 35h50" /></g>)}
    </g>
    <g transform="translate(474 205)">
      <ellipse cx="35" cy="61" rx="66" ry="10" fill="#12253b0c" />
      {[0, 28].map((offset) => <g key={offset} transform={`translate(0 ${offset})`}><path d="m-30 13 79-33 28 20-79 35Z" fill="url(#monitor-panel)" stroke="#8b95a2" />{[0, 1, 2, 3, 4].map((index) => <path key={index} d={`m${-20 + index * 14} ${9 - index * 6} 26 20`} stroke="#b4bfcb" strokeWidth=".7" />)}<path d="m-15 24 79-33" stroke="#a9b5c2" strokeWidth=".7" /></g>)}
    </g>
    <g className="monitor-flow-values"><text x="315" y="24" textAnchor="middle">{format(plant.load_power_kw, 3)} kW</text><text x="52" y="157">{format(plant.grid_power_kw, 3)} kW</text><text x="470" y="157">{format(pv, 3)} kW</text></g>
    <g className="monitor-flow-labels"><text x="315" y="44" textAnchor="middle">Consumed by appliances</text><text x="52" y="176">Power from grid</text><text x="470" y="176">PV output</text><text x="390" y="125">Load</text><text x="90" y="295">Grid</text><text x="570" y="266">PV</text></g>
  </svg>;
}

export default function PlantMonitoring({ plants, selected, onChange, now, refreshKey }: {
  plants: Plant[]; selected: string; onChange: (code: string) => void;
  now: number; refreshKey: number;
}) {
  const root = useRef<HTMLDivElement>(null), energyPanel = useRef<HTMLElement>(null), alarmPanel = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState(""), [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<"overview" | "layout" | "trend" | "reports" | "devices" | "alarms" | "cv">("overview");
  const plant = plants.find((item) => item.plant_code === selected);
  const zone = validTimeZone(plant?.time_zone);
  const [date, setDate] = useState(() => calendarDate(now, zone)), [period, setPeriod] = useState<Period>("Day");
  const [revenuePeriod, setRevenuePeriod] = useState<Period>("Month"), [revenueDate, setRevenueDate] = useState(() => calendarDate(now, zone));
  const [retry, setRetry] = useState(0), [fullscreenError, setFullscreenError] = useState("");
  const [mountedAt] = useState(now);
  const key = JSON.stringify([selected, period, date, zone, refreshKey, retry]);
  const [response, setResponse] = useState<Result | null>(null);
  const active = response?.key === key ? response : null;
  const loading = Boolean(selected) && !active;
  useEffect(() => {
    if (!selected || tab !== "overview") return;
    const controller = new AbortController();
    const range = statisticsRange(period, date, zone, new Date(refreshKey || mountedAt));
    void Promise.allSettled([
      getYieldStatistics(selected, range, controller.signal),
      request<Alarm[]>(`/api/alarms/${encodeURIComponent(selected)}`, controller.signal),
      period === "Day" ? getPowerStatistics(selected, range, controller.signal, 60) : Promise.resolve(null),
    ]).then(([energy, alarms, power]) => {
      if (controller.signal.aborted) return;
      const errors: string[] = [];
      if (energy.status === "rejected") errors.push("Statistik energi belum dapat dimuat.");
      if (power.status === "rejected") errors.push("Riwayat daya belum dapat dimuat.");
      setResponse({ key, energy: energy.status === "fulfilled" ? energy.value : null,
        alarms: alarms.status === "fulfilled" && alarms.value.configured && Array.isArray(alarms.value.data) ? alarms.value.data : null,
        power: power.status === "fulfilled" && power.value ? power.value.points : [], powerComplete: power.status === "fulfilled" && Boolean(power.value?.complete), errors });
    });
    return () => controller.abort();
  }, [selected, period, date, zone, key, refreshKey, mountedAt, tab]);
  const matching = plants.filter((item) => `${item.plant_name} ${item.plant_code}`.toLowerCase().includes(search.toLowerCase().trim()));
  const energyPoints = active?.energy?.points ?? EMPTY_ENERGY;
  const energyValues = energyPoints.flatMap((point) => point.value === null ? [] : [point.value]);
  const energyTotal = energyValues.length ? energyValues.reduce((a, b) => a + b, 0) : null;
  const powerData = active?.power ?? EMPTY_POWER;
  const powerOptions = useMemo<AgCartesianChartOptions<PowerPoint>>(() => ({
    data: powerData, background: { fill: "transparent" }, animation: { enabled: false },
    padding: { top: 15, right: 15, bottom: 15, left: 5 },
    legend: { position: "bottom", item: { label: { color: "#8c96a5", fontSize: 11 } } },
    overlays: { noData: { text: "Belum ada sampel daya terverifikasi untuk tanggal ini." } },
    series: ([ ["pv", "PV output", "#55cd91"], ["grid", "Power from grid", "#a3a8b4"], ["load", "Consumed by appliances", "#ff8b27"] ] as const).map(([yKey, yName, stroke]) => ({
      type: "line", xKey: "label", yKey, yName, stroke, strokeWidth: 2,
      marker: { enabled: false }, connectMissingData: false,
    })), axes: { x: { type: "category", position: "bottom", label: { fontSize: 10, color: "#929baa" } },
      y: { type: "number", position: "left", title: { text: "kW" }, label: { fontSize: 10, color: "#929baa" }, gridLine: { style: [{ stroke: "#e3e6eb", lineDash: [4, 3] }] } } },
  }), [powerData]);
  const energyOptions = useMemo<AgCartesianChartOptions<(typeof energyPoints)[number]>>(() => ({
    data: energyPoints, background: { fill: "transparent" }, animation: { enabled: false }, legend: { enabled: false },
    series: [{ type: "bar", xKey: "label", yKey: "value", yName: "PV energy (kWh)", fill: "#55cd91", strokeWidth: 0 }],
    axes: { x: { type: "category", position: "bottom", label: { fontSize: 10, color: "#929baa" } }, y: { type: "number", position: "left", min: 0, title: { text: "kWh" } } },
  }), [energyPoints]);
  function moveDate(direction: number, revenue = false) {
    const current = revenue ? revenueDate : date, selectedPeriod = revenue ? revenuePeriod : period;
    const next = new Date(current + "T12:00:00Z");
    if (selectedPeriod === "Day") next.setUTCDate(next.getUTCDate() + direction);
    else if (selectedPeriod === "Month") { next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + direction); }
    else next.setUTCFullYear(next.getUTCFullYear() + direction);
    const value = next.toISOString().slice(0, 10);
    if (value >= "1970-01-01" && value <= "2100-12-31") (revenue ? setRevenueDate : setDate)(value);
  }
  function dateControl(revenue = false) {
    const selectedPeriod = revenue ? revenuePeriod : period, value = revenue ? revenueDate : date;
    return selectedPeriod === "Lifetime" ? null : <div className="monitor-date-control"><button aria-label={revenue ? "Periode pendapatan sebelumnya" : "Periode energi sebelumnya"} onClick={() => moveDate(-1, revenue)}>‹</button>
      <input aria-label={revenue ? "Tanggal pendapatan" : "Tanggal energi"} type={selectedPeriod === "Day" ? "date" : selectedPeriod === "Month" ? "month" : "number"}
        value={selectedPeriod === "Day" ? value : selectedPeriod === "Month" ? value.slice(0, 7) : value.slice(0, 4)}
        min={selectedPeriod === "Day" ? "1970-01-01" : selectedPeriod === "Month" ? "1970-01" : "1970"}
        max={selectedPeriod === "Day" ? "2100-12-31" : selectedPeriod === "Month" ? "2100-12" : "2100"}
        onChange={(event) => { const next = event.target.value; if (!next || !event.target.validity.valid || selectedPeriod === "Year" && next.length !== 4) return;
          (revenue ? setRevenueDate : setDate)(selectedPeriod === "Day" ? next : selectedPeriod === "Month" ? next + "-01" : next + "-01-01"); }} />
      <button aria-label={revenue ? "Periode pendapatan berikutnya" : "Periode energi berikutnya"} onClick={() => moveDate(1, revenue)}>›</button></div>;
  }
  async function toggleFullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.current?.requestFullscreen(); }
    catch { setFullscreenError("Mode layar penuh belum tersedia di browser ini."); }
  }
  return <div ref={root} className={`plant-monitoring ${collapsed ? "sidebar-collapsed" : ""} ${tab !== "overview" ? "monitor-layout-page" : ""}`}>
    <aside className="monitor-sidebar" aria-label="Daftar PLTS">
      <label className="monitor-plant-search"><Icon name="panel" size={17} /><input placeholder="Enter a plant name" aria-label="Cari PLTS monitoring" value={search} onChange={(event) => setSearch(event.target.value)} /><Icon name="search" size={15} /></label>
      <div className="monitor-plant-list">{matching.map((item) => <button key={item.plant_code} className={selected === item.plant_code ? "selected" : ""} aria-pressed={selected === item.plant_code} onClick={() => onChange(item.plant_code)} title={item.plant_name}><Icon name="chevron" size={10} /><span className="monitor-plant-icon"><Icon name="home" size={16} /><i className={`status-dot ${status(item)}`} /></span><span>{item.plant_name}</span></button>)}{!matching.length && <p>PLTS tidak ditemukan.</p>}</div>
    </aside>
    <button className="monitor-sidebar-toggle" aria-label={collapsed ? "Buka daftar PLTS" : "Tutup daftar PLTS"} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? "›" : "‹"}</button>
    <div className="monitor-workspace">
      <nav className="monitor-tabs" aria-label="Navigasi monitoring PLTS"><button className={tab === "overview" ? "active" : ""} onClick={() => { setTab("overview"); setCollapsed(false); }}>Overview</button><button className={tab === "layout" ? "active" : ""} onClick={() => { setTab("layout"); setCollapsed(true); }}>Layout</button><button className={tab === "trend" ? "active" : ""} onClick={() => { setTab("trend"); setCollapsed(true); }}>Trend</button><button className={tab === "reports" ? "active" : ""} onClick={() => { setTab("reports"); setCollapsed(true); }}>Report Management</button><button className={tab === "devices" ? "active" : ""} onClick={() => { setTab("devices"); setCollapsed(true); }}>Device Management</button><button className={tab === "alarms" ? "active" : ""} onClick={() => { setTab("alarms"); setCollapsed(true); }}>Alarms</button><button className={tab === "cv" ? "active" : ""} onClick={() => { setTab("cv"); setCollapsed(true); }}>Coefficient of Variation Analysis</button></nav>
      {tab === "layout" ? <PhysicalLayout key={selected} plant={plant} /> : tab === "trend" ? <MonitoringTrend key={selected} plant={plant} now={now} refreshKey={refreshKey} /> : tab === "reports" ? <ReportManagement key={selected} plant={plant} now={now} refreshKey={refreshKey} /> : tab === "devices" ? <DeviceManagement key={selected} plant={plant} refreshKey={refreshKey} onOverview={() => { setTab("overview"); setCollapsed(false); }} /> : tab === "alarms" ? <AlarmManagement key={selected} plant={plant} refreshKey={refreshKey} onOverview={() => { setTab("overview"); setCollapsed(false); }} /> : tab === "cv" ? <CoefficientVariationAnalysis key={selected} plant={plant} now={now} refreshKey={refreshKey} /> : <>
      <header className="monitor-plant-header"><div><span className="monitor-heading-icon"><Icon name="bolt" size={20} /></span><div><h1>{plant?.plant_name ?? "Pilih PLTS"}</h1><p>{plant ? `${statusLabel[status(plant)]} · ${telemetryLabel(telemetryFreshness(plant, now))}` : "Daftar PLTS akan tampil setelah data backend tersedia."}</p></div></div><div className="monitor-header-tools"><span><Icon name="sun" size={22} /><small>Cuaca belum tersedia</small></span><time>{calendarDate(now, zone)}<small>{zone}</small></time><button className="monitor-fullscreen" aria-label="Ubah mode layar penuh" onClick={() => void toggleFullscreen()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg></button></div></header>
      {fullscreenError && <p className="monitor-message" role="status">{fullscreenError}</p>}
      <div className="monitor-content">
        <div className="monitor-left-column">
          <section className="monitor-card monitor-kpis" aria-label="Ringkasan PLTS">{[
            ["Yield today", plant?.yield_today_kwh, "kWh"], ["Revenue today", plant?.revenue_today_idr, "Rp"],
            ["Total yield", number(plant?.total_yield_kwh) === null ? null : number(plant?.total_yield_kwh)! / 1000, "MWh"],
            ["Inverter rated power", plant?.inverter_rated_power_kw, "kW"], ["Supply from grid today", null, "kWh"],
          ].map(([label, value, unit]) => <div key={String(label)}><strong>{format(value as number | string | null)}<small>{String(unit)}</small></strong><span>{String(label)}</span></div>)}</section>
          <section className="monitor-card monitor-flow-card"><div className="monitor-alarm-strip" ref={alarmPanel}>{["Critical", "Major", "Minor", "Warning"].map((label, index) => <div key={label}><i className={`monitor-severity severity-${index}`}>{index === 3 ? "i" : "!"}</i><span>{label}</span><strong>{active?.alarms ? active.alarms.filter((alarm) => String(alarm.severity ?? alarm.level ?? "").toLowerCase() === label.toLowerCase()).length : "--"}</strong></div>)}</div>
            {plant ? <FlowDiagram plant={plant} /> : <div className="monitor-flow-empty"><Icon name="panel" size={56} /><span>Pilih PLTS untuk melihat aliran energi</span></div>}
            <p className="monitor-card-note">{active?.alarms ? `${active.alarms.length} alarm · ` : "Cakupan alarm belum tersedia · "}Nilai daya mengikuti pembacaan sumber; arah jaringan belum disimpulkan.</p>
          </section>
          <section className="monitor-card monitor-environment"><h2>Environmental Benefits</h2><div>{([ ["coal", "Standard coal saved", "tons"], ["cloud", "CO₂ avoided", "tons"], ["tree", "Equivalent trees planted", "trees"] ] as const).map(([icon, label, unit]) => <div key={label}><Icon name={icon} size={31} /><div><strong>-- <small>{unit}</small></strong><span>{label}</span></div></div>)}</div><p className="monitor-card-note">Data dan faktor lingkungan belum tersedia.</p></section>
        </div>
        <div className="monitor-right-column">
          <section className="monitor-card monitor-energy" ref={energyPanel}><div className="monitor-chart-heading"><h2>Energy Trend <Icon name="info" size={13} /></h2><div className="monitor-chart-tools"><div className="monitor-periods" role="group" aria-label="Periode energi">{(["Day", "Month", "Year", "Lifetime"] as Period[]).map((value) => <button key={value} className={period === value ? "active" : ""} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value}</button>)}</div>{dateControl()}</div></div>
            <div className="monitor-energy-summary"><span>PV yield: <strong>{format(energyTotal)}</strong> kWh {active?.energy && !active.energy.complete ? "· parsial" : ""}</span><span>Consumed by appliances: <strong>--</strong> kWh</span></div>
            <div className="monitor-energy-bars"><div><i /><span>Energi pemakaian sendiri belum tersedia</span></div><div><i /><span>Energi dari jaringan belum tersedia</span></div></div>
            <div className="monitor-chart" aria-busy={loading}>{period === "Day" ? <MonitoringLineChart options={powerOptions} /> : <DashboardBarChart options={energyOptions} />}{(loading || (period === "Day" ? !powerData.some((point) => point.pv !== null || point.grid !== null || point.load !== null) : !energyValues.length)) && <div className="monitor-chart-empty"><Icon name={loading ? "refresh" : "chart"} size={27} /><span>{loading ? "Memuat pengukuran…" : "Belum ada pengukuran terverifikasi pada periode ini"}</span></div>}</div>
            <p className="monitor-card-note">{period === "Day" ? "Daya: pembacaan terakhir per jam dari API rentang tanggal. Gap dan tanda daya belum terverifikasi tetap kosong. " : "Energi interval dari backend untuk seluruh rentang pilihan. "}{zone}. {period === "Day" && active?.powerComplete === false ? "Cakupan daya parsial. " : ""}{active?.energy && !active.energy.complete ? "Cakupan energi parsial; total belum lengkap." : ""}</p>
            {active && active.errors.length > 0 && <div className="monitor-message" role="alert">{active.errors.join(" ")}<button onClick={() => setRetry((value) => value + 1)}>Coba lagi</button></div>}
          </section>
          <section className="monitor-card monitor-revenue"><div className="monitor-chart-heading"><h2>Revenue Trend <Icon name="info" size={13} /></h2><div className="monitor-chart-tools"><div className="monitor-periods" role="group" aria-label="Periode pendapatan">{(["Month", "Year", "Lifetime"] as Period[]).map((value) => <button key={value} className={revenuePeriod === value ? "active" : ""} aria-pressed={revenuePeriod === value} onClick={() => setRevenuePeriod(value)}>{value}</button>)}</div>{dateControl(true)}</div></div><p className="monitor-revenue-total">Total revenue <strong>--</strong> Rp</p><div className="monitor-revenue-placeholder"><div className="monitor-revenue-axis">{["750k", "600k", "450k", "300k", "150k", "0"].map((label) => <span key={label}>{label}<i /></span>)}</div><div className="monitor-revenue-empty"><Icon name="coins" size={32} /><span>Riwayat pendapatan belum tersedia</span><small>{revenuePeriod === "Lifetime" ? "Lifetime" : revenuePeriod === "Year" ? revenueDate.slice(0, 4) : revenueDate.slice(0, 7)}</small></div></div><div className="monitor-revenue-legend"><i />Revenue</div><p className="monitor-card-note">Grafik akan menampilkan data setelah energi eligible dan tarif tersedia dari backend.</p></section>
        </div>
      </div>
      </>}
    </div>
  </div>;
}
