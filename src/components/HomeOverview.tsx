import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Plant } from "../services/fleet";
import { format, number } from "../services/fleet";
import { summaryMetric } from "../services/portfolio";
import type { PortfolioSummary } from "../services/portfolio";
import { getPowerStatistics } from "../services/analytics";
import { aggregateMetric, metricCoverageLabel, telemetryFreshness } from "../services/quality";
import { calendarDate, validTimeZone } from "../services/calendar";
import { statisticsRange } from "../services/statistics";
import { getYieldStatistics } from "../services/yieldStatistics";
import type { YieldResult } from "../services/yieldStatistics";
import type { AlarmSummary } from "./FleetSummary";
import PlantMap from "./PlantMap";
import Icon from "./Icon";
import type { IconName } from "./Icon";

type Point = { label: string; value: number | null; x: number };

function Panel({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  return <section className="command-panel">
    <h2><Icon name={icon} size={18} />{title}</h2>
    <div className="command-panel-content">{children}</div>
  </section>;
}

function MiniChart({ points, bars, unit }: { points: Point[]; bars?: boolean; unit: string }) {
  const available = points.filter((point) => point.value !== null);
  if (!available.length) return <div className="command-chart-empty"><Icon name="chart" size={30} /><span>Pengukuran belum tersedia</span></div>;
  const maximum = Math.max(1, ...available.map((point) => point.value!));
  const y = (value: number) => 124 - value / maximum * 102;
  const paths: string[] = [];
  let current = "", previous = -1;
  for (const point of points) {
    if (point.value === null) { if (current) paths.push(current); current = ""; continue; }
    if (previous >= 0 && point.x - previous > 1 / 48 && current) { paths.push(current); current = ""; }
    current += `${current ? " L" : "M"}${30 + point.x * 226},${y(point.value)}`;
    previous = point.x;
  }
  if (current) paths.push(current);
  return <svg className="command-mini-chart" viewBox="0 0 270 150" role="img" aria-label={`${bars ? "Yield bulanan" : "Daya harian"} (${unit})`}>
    <text x="4" y="12" className="command-chart-unit">{unit}</text>
    {[0, 1, 2, 3].map((index) => <g key={index}>
      <line x1="30" x2="260" y1={124 - index * 34} y2={124 - index * 34} />
      <text x="24" y={128 - index * 34} textAnchor="end">{format(maximum * index / 3, 1)}</text>
    </g>)}
    {bars ? points.map((point, index) => point.value === null ? null :
      <rect key={index} x={30 + point.x * 226} y={y(point.value)} width={Math.max(3, 210 / points.length)} height={Math.max(1, 124 - y(point.value))} rx="2">
        <title>{point.label}: {format(point.value)} {unit}</title>
      </rect>) : paths.map((path, index) => <path key={index} d={path} />)}
    {(bars ? points.filter((_, index) => index % 5 === 0) : [
      { label: "00:00", x: 0 }, { label: "06:00", x: 0.25 },
      { label: "12:00", x: 0.5 }, { label: "18:00", x: 0.75 }, { label: "24:00", x: 1 },
    ]).map((point) => <text key={point.label} x={30 + point.x * 226} y="143" textAnchor="middle">{point.label}</text>)}
  </svg>;
}

export default function HomeOverview({ plants, alarms, summary, now, selected, onChange, onSelect, refreshKey }: {
  plants: Plant[]; alarms: AlarmSummary; summary?: PortfolioSummary | null; now: number; selected: string;
  onChange: (code: string) => void; onSelect: (plant: Plant) => void; refreshKey: number;
}) {
  const [query, setQuery] = useState("");
  const plant = plants.find((item) => item.plant_code === selected);
  const zone = validTimeZone(plant?.time_zone);
  const today = calendarDate(now, zone);
  const key = JSON.stringify([selected, today, zone, refreshKey]);
  const [history, setHistory] = useState<{ key: string; power: Point[]; powerComplete: boolean; month: YieldResult | null; errors: string[] } | null>(null);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    void Promise.allSettled([
      getPowerStatistics(selected, statisticsRange("Day", today, zone), controller.signal),
      getYieldStatistics(selected, statisticsRange("Month", today, zone), controller.signal),
    ]).then(([powerResponse, monthResponse]) => {
      if (controller.signal.aborted) return;
      const errors: string[] = [];
      let power: Point[] = [];
      if (powerResponse.status === "fulfilled") {
        power = powerResponse.value.points.map((point, index, points) => ({
          label: point.label, value: point.pv === null ? null : point.pv / 1000, x: index / Math.max(1, points.length),
        }));
      } else errors.push("Riwayat daya belum dapat dimuat.");
      if (monthResponse.status === "rejected") errors.push("Yield bulanan belum dapat dimuat.");
      setHistory({ key, power, powerComplete: powerResponse.status === "fulfilled" && powerResponse.value.complete, month: monthResponse.status === "fulfilled" ? monthResponse.value : null, errors });
    });
    return () => controller.abort();
  }, [selected, today, zone, key]);
  const active = history?.key === key ? history : null;
  const matches = useMemo(() => plants.filter((item) => `${item.plant_name} ${item.plant_code} ${item.address ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())), [plants, query]);
  const power = summaryMetric(summary, "current_power_kw", aggregateMetric(plants, "pv_power_kw", now), "pv_power_kw");
  const total = summaryMetric(summary, "total_yield_kwh", aggregateMetric(plants, "total_yield_kwh", now));
  const capacity = summaryMetric(summary, "installed_pv_capacity_kwp", aggregateMetric(plants, "capacity_kwp", now), "capacity_kwp");
  const yieldToday = summaryMetric(summary, "yield_today_kwh", aggregateMetric(plants, "yield_today_kwh", now));
  const ranking = plants.flatMap((item) => {
    const metric = aggregateMetric([item], "total_yield_kwh", now);
    return metric.value === null ? [] : [{ plant: item, value: metric.value / 1e6 }];
  }).sort((a, b) => b.value - a.value).slice(0, 10);
  const monthPoints = active?.month?.points ?? [];
  const monthlyValues = monthPoints.flatMap((point) => point.value === null ? [] : [point.value]);
  const monthTotal = monthlyValues.length ? monthlyValues.reduce((a, b) => a + b, 0) / 1000 : null;
  const alarmTotal = alarms.available ? alarms.counts.reduce((a, b) => a + b, 0) : null;
  const alarmColors = ["#ff4b61", "#ff932c", "#ffd341", "#b78aff", "#7792ac"];
  const sectors = alarms.counts.map((count, index) => {
    const start = alarmTotal ? alarms.counts.slice(0, index).reduce((a, b) => a + b, 0) / alarmTotal * 360 : 0;
    const end = start + (alarmTotal ? count / alarmTotal * 360 : 0);
    return `${alarmColors[index]} ${start}deg ${end}deg`;
  });
  return <section className="home-command" aria-label="Dashboard monitoring">
    <div className="command-map"><PlantMap plants={matches} onSelect={onSelect} overview /></div>
    <header className="command-topbar">
      <div title={metricCoverageLabel(total)}><span>Total Yield{total.partial ? " (parsial)" : ""}</span><strong>{format(total.value === null ? null : total.value / 1e6)}</strong><small>GWh</small></div>
      <div className="command-brand"><img src="/icongreen-logo.png" alt="IconGreen" /><h1>Dashboard</h1></div>
      <time dateTime={new Date(now).toISOString()}>{new Date(now).toLocaleString("en-GB", { timeZone: "Asia/Jakarta", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })} WIB</time>
    </header>
    <div className="command-map-tools">
      <span className="command-location"><Icon name="pin" size={18} />IconGreenTWH · Indonesia</span>
      <label className="command-search"><input aria-label="Cari PLTS di Dashboard" placeholder="Enter a plant name…" value={query} onChange={(event) => setQuery(event.target.value)} /><Icon name="search" size={20} /></label>
      {query && <div className="command-search-results">{matches.length ? matches.slice(0, 6).map((item) => <button key={item.plant_code} onClick={() => { onChange(item.plant_code); onSelect(item); }}>{item.plant_name}<Icon name="chevron" size={13} /></button>) : <span>PLTS tidak ditemukan</span>}</div>}
    </div>
    <aside className="command-left">
      <Panel title="Real-Time Power" icon="bolt">
        <div className="command-panel-metric"><span>Current power</span><strong>{format(plant && telemetryFreshness(plant, now).state === "fresh" ? number(plant.pv_power_kw) === null ? null : number(plant.pv_power_kw)! / 1000 : null)}</strong><small>MW</small></div>
        <MiniChart points={active?.power ?? []} unit="MW" />
        <p className="command-note">PLTS pilihan · {zone} · daya per 5 menit dari API rentang tanggal{active?.powerComplete === false ? " (parsial)" : ""}</p>
      </Panel>
      <Panel title="Yield This Month" icon="sun">
        <div className="command-panel-metric"><span>Yield this month</span><strong>{format(monthTotal)}</strong><small>MWh</small></div>
        <MiniChart points={monthPoints.map((point, index) => ({ label: point.label, value: point.value === null ? null : point.value / 1000, x: index / Math.max(1, monthPoints.length) }))} bars unit="MWh" />
        <p className="command-note">PLTS pilihan{active?.month && !active.month.complete ? " · Data bulan ini parsial" : ""}{!active && selected ? " · Memuat riwayat…" : ""}</p>
      </Panel>
      <Panel title="Environmental Benefits" icon="tree">
        <div className="command-benefits">{([
          ["coal", "Standard coal saved", "tons", number(summary?.environmental_benefits?.coal_saved_kg)],
          ["cloud", "CO₂ avoided", "tons", number(summary?.environmental_benefits?.co2_avoided_kg)],
          ["tree", "Equivalent trees", "tree-years", number(summary?.environmental_benefits?.equivalent_tree_years)],
        ] as [IconName, string, string, number | null][]).map(([icon, label, unit, value]) => <div key={icon}><Icon name={icon} size={48} /><strong>{summary?.environmental_benefits?.status === "unconfigured" ? "--" : format(value === null ? null : icon === "tree" ? value : value / 1000)}</strong><span>{label}</span><small>{unit}</small></div>)}</div>
        <p className="command-note">{summary?.environmental_benefits?.reason || "Manfaat lingkungan portofolio berdasarkan metode dan faktor backend."}</p>
      </Panel>
    </aside>
    <div className="command-center-info"><label>Grafik PLTS<select aria-label="PLTS untuk grafik Dashboard" value={selected} onChange={(event) => onChange(event.target.value)}>{!plants.length && <option value="">Belum ada PLTS</option>}{plants.map((item) => <option key={item.plant_code} value={item.plant_code}>{item.plant_name}</option>)}</select></label>
      <span>{matches.length} PLTS · {matches.filter((item) => { const lat = number(item.latitude), lng = number(item.longitude); return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180; }).length} memiliki koordinat</span>
      {active?.errors.map((error) => <span className="command-inline-error" key={error}>{error}</span>)}
    </div>
    <aside className="command-right">
      <Panel title="Energy Yield Ranking" icon="chart">
        <div className="command-ranking-unit">Total yield · GWh</div>
        <div className="command-ranking">{ranking.map((entry) => <button key={entry.plant.plant_code} onClick={() => { onChange(entry.plant.plant_code); onSelect(entry.plant); }} title={entry.plant.plant_name}><span>{entry.plant.plant_name}</span><div><i style={{ width: `${entry.value / Math.max(ranking[0]?.value ?? 1, 0.001) * 100}%` }} /></div><strong>{format(entry.value, 2)}</strong></button>)}{!ranking.length && <p className="command-empty-copy">Yield terverifikasi belum tersedia.</p>}</div>
        <p className="command-note">{metricCoverageLabel(total)}</p>
      </Panel>
      <Panel title="O&M Statistics" icon="settings"><div className="command-ring-layout"><div className="command-ring"><strong>--</strong></div><div className="command-operation-legend">{["To be approved", "To be dispatched", "Discarded", "Ended", "Ongoing"].map((label, index) => <span key={label}><i style={{ background: ["#2dcc54", "#ff8652", "#9cdbff", "#6e98ef", "#d465d6"][index] }} />{label}<b>--</b></span>)}</div></div><p className="command-note">Data work order O&M belum tersedia.</p></Panel>
      <Panel title="Active Alarms" icon="bell"><div className="command-panel-metric"><span>Total alarms</span><strong>{alarmTotal ?? "--"}</strong></div><div className="command-ring-layout"><div className="command-ring" style={{ background: alarmTotal ? `conic-gradient(${sectors.join(",")})` : undefined }}><strong>{alarmTotal ?? "--"}</strong></div><div className="command-operation-legend">{["Critical", "Major", "Minor", "Warning", "Unclassified"].map((label, index) => <span key={label}><i style={{ background: alarmColors[index] }} />{label}<b>{alarms.available ? alarms.counts[index] : "--"}</b></span>)}</div></div><p className="command-note">{alarms.available ? `Cakupan ${alarms.coverage}/${alarms.totalPlants} PLTS${alarms.complete === false ? " \u00b7 parsial" : ""}` : "Data alarm belum tersedia"}</p></Panel>
    </aside>
    <footer className="command-bottom"><strong>IconGreenTWH<small>PORTFOLIO OVERVIEW</small></strong>{[
      ["Installed PV capacity", capacity.value === null ? null : capacity.value / 1000, "MWp", capacity],
      ["Current power", power.value === null ? null : power.value / 1000, "MW", power],
      ["Yield today", yieldToday.value === null ? null : yieldToday.value / 1000, "MWh", yieldToday],
    ].map(([label, value, unit, metric]) => <div key={String(label)}><span>{String(label)}</span><strong>{format(value as number | null)}<small>{String(unit)}</small></strong><small>{metricCoverageLabel(metric as typeof power)}</small></div>)}
      <div><span>Revenue today</span><strong>{summary?.revenue?.status === "unconfigured" ? "--" : format(number(summary?.kpis.revenue_today_idr))}<small>Rp</small></strong><small>{summary?.revenue?.reason || "Summary portofolio"}</small></div>
    </footer>
  </section>;
}
