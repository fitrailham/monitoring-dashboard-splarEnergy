import { useEffect, useMemo, useState } from "react";
import { format, jakartaDate, specific } from "../services/fleet";
import type { Plant } from "../services/fleet";
import { statisticsRange } from "../services/statistics";
import type { ChartPoint, Period } from "../services/statistics";
import { calendarDate, validTimeZone } from "../services/calendar";
import { getYieldStatistics } from "../services/yieldStatistics";
import type { YieldResult } from "../services/yieldStatistics";
import Icon from "./Icon";
import type { AgCartesianChartOptions } from "ag-charts-community";
import { DashboardBarChart } from "./AgDashboardChart";

function YieldChart({
  points,
  loading,
}: {
  points: ChartPoint[];
  loading: boolean;
}) {
  const available = points.filter((p) => p.value !== null);
  const options = useMemo<AgCartesianChartOptions<ChartPoint>>(
    () => ({
      data: points,
      background: { fill: "transparent" },
      animation: { enabled: false },
      legend: { enabled: false },
      padding: { top: 10, right: 12, bottom: 10, left: 8 },
      minWidth: 0,
      minHeight: 0,
      overlays: { noData: { enabled: false } },
      series: [
        {
          type: "bar",
          xKey: "label",
          yKey: "value",
          yName: "Yield (kWh)",
          fill: "#12c98c",
          strokeWidth: 0,
          tooltip: {
            renderer: ({ datum }) => ({
              title: datum.label,
              data: [
                {
                  label: "Energi interval",
                  value: format(datum.value) + " kWh",
                },
                { label: "Kualitas", value: {
                  measured: "Terukur", derived: "Dihitung", partial: "Parsial",
                  missing: "Tidak tersedia", pending: "Belum berlangsung",
                }[datum.quality] },
              ],
            }),
          },
        },
      ],
      axes: {
        x: {
          type: "category",
          position: "bottom",
          label: {
            fontFamily: "Arial",
            fontSize: 10,
            color: "#888e97",
            avoidCollisions: true,
          },
          line: { stroke: "#dce1e7" },
          tick: { enabled: false },
        },
        y: {
          type: "number",
          position: "left",
          min: 0,
          label: {
            fontFamily: "Arial",
            fontSize: 10,
            color: "#888e97",
            formatter: ({ value }) => format(Number(value), 0),
          },
          gridLine: {
            enabled: true,
            style: [{ stroke: "#dce1e7", lineDash: [3, 3] }],
          },
          line: { enabled: false },
          tick: { enabled: false },
        },
      },
    }),
    [points],
  );
  return (
    <div
      className="yield-chart ag-yield-chart"
      aria-busy={loading}
      aria-label="Grafik yield berdasarkan riwayat backend"
    >
      <div className="chart-key">
        <i />
        Yield <span>kWh</span>
      </div>
      <div className="ag-yield-canvas">
        <DashboardBarChart options={options} />
      </div>
      {!available.length && (
        <div className="chart-no-data" role="status">
          <Icon
            name={loading ? "refresh" : "chart"}
            size={30}
            className={loading ? "spinning" : ""}
          />
          <span>
            {loading
              ? "Memuat riwayat yield..."
              : "Belum ada riwayat pada periode ini"}
          </span>
        </div>
      )}
    </div>
  );
}
function RankingChart({
  plants,
  onChange,
}: {
  plants: Plant[];
  onChange: (code: string) => void;
}) {
  const data = useMemo(
    () =>
      [...plants]
        .filter((p) => specific(p) !== null)
        .sort((a, b) => specific(b)! - specific(a)!)
        .slice(0, 5)
        .map((p) => ({
          plantName: p.plant_name,
          plantCode: p.plant_code,
          specific: specific(p)!,
        })),
    [plants],
  );
  const options = useMemo<AgCartesianChartOptions<(typeof data)[number]>>(
    () => ({
      data,
      background: { fill: "transparent" },
      animation: { enabled: false },
      legend: { enabled: false },
      padding: { top: 9, right: 80, bottom: 5, left: 0 },
      minWidth: 0,
      minHeight: 0,
      overlays: {
        noData: { text: "Data yield dan kapasitas belum tersedia." },
      },
      series: [
        {
          type: "bar",
          direction: "horizontal",
          xKey: "plantName",
          yKey: "specific",
          yName: "Specific energy",
          fill: "#0787ff",
          strokeWidth: 0,
          label: {
            enabled: true,
            placement: "outside-end",
            fontFamily: "Arial",
            fontSize: 11,
            color: "#535d69",
            formatter: ({ value }) => format(Number(value)) + " kWh/kWp",
          },
          tooltip: {
            renderer: ({ datum }) => ({
              title: datum.plantName,
              data: [
                {
                  label: "Specific energy",
                  value: format(datum.specific) + " kWh/kWp",
                },
              ],
            }),
          },
        },
      ],
      listeners: { seriesNodeClick: ({ datum }) => onChange(datum.plantCode) },
      axes: {
        x: {
          type: "category",
          position: "left",
          label: {
            fontFamily: "Arial",
            fontSize: 10,
            color: "#858b94",
            maxWidth: 115,
            wrapping: "never",
          },
          line: { enabled: false },
          tick: { enabled: false },
        },
        y: {
          type: "number",
          position: "bottom",
          min: 0,
          label: {
            fontFamily: "Arial",
            fontSize: 10,
            color: "#a3a9b1",
            formatter: ({ value }) => format(Number(value), 1),
          },
          gridLine: {
            enabled: true,
            style: [{ stroke: "#edf0f5", lineDash: [3, 3] }],
          },
          line: { enabled: false },
          tick: { enabled: false },
        },
      },
    }),
    [data, onChange],
  );
  return (
    <div
      className="ranking-chart ag-ranking-chart"
      aria-label="Peringkat specific energy PLTS"
    >
      <DashboardBarChart options={options} />
      <div className="sr-only">
        <ol>
          {data.map((p) => (
            <li key={p.plantCode}>
              <button onClick={() => onChange(p.plantCode)}>
                {p.plantName}
              </button>
              : {format(p.specific)} kWh/kWp
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
export default function FleetStatistics({
  plants,
  selected,
  onChange,
  refreshKey = 0,
}: {
  plants: Plant[];
  selected: string;
  onChange: (code: string) => void;
  refreshKey?: number;
}) {
  const timeZone = validTimeZone(plants.find((plant) => plant.plant_code === selected)?.time_zone);
  const [period, setPeriod] = useState<Period>("Day"),
    [date, setDate] = useState(() => calendarDate(Date.now(), timeZone)),
    [retry, setRetry] = useState(0);
  const [mountedAt] = useState(Date.now);
  const range = useMemo(
    () => statisticsRange(period, date, timeZone, new Date(refreshKey || mountedAt)),
    [period, date, timeZone, refreshKey, mountedAt],
  );
  const queryKey = JSON.stringify([selected, range, refreshKey, retry]);
  const [response, setResponse] = useState<{ key: string; result: YieldResult | null; error: string } | null>(null);
  const active = response?.key === queryKey ? response : null;
  const loading = Boolean(selected) && active === null;
  const error = active?.error ?? "";
  const result = active?.result ?? null;
  const points = result?.points ?? [];
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    getYieldStatistics(selected, range, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setResponse({ key: queryKey, result, error: "" });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setResponse({ key: queryKey, result: null, error: e.message });
      });
    return () => controller.abort();
  }, [selected, range, queryKey]);
  function moveDate(direction: number) {
    const next = new Date(date + "T12:00:00+07:00");
    if (period === "Day") next.setUTCDate(next.getUTCDate() + direction);
    else if (period === "Month") {
      next.setUTCDate(1);
      next.setUTCMonth(next.getUTCMonth() + direction);
    } else next.setUTCFullYear(next.getUTCFullYear() + direction);
    const nextDate = jakartaDate(next);
    if (nextDate >= "1970-01-01" && nextDate <= "2100-12-31") setDate(nextDate);
  }
  return (
    <section className="statistics-grid">
      <article className="white-panel yield-panel">
        <div className="panel-heading">
          <h2>Yield Statistics</h2>
          <div className="statistics-tools">
            <div
              className="period-tabs"
              role="group"
              aria-label="Periode yield"
            >
              {(["Day", "Month", "Year", "Lifetime"] as Period[]).map((p) => (
                <button
                  key={p}
                  className={period === p ? "active" : ""}
                  aria-pressed={period === p}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            {period !== "Lifetime" && (
              <div className="date-control">
                <button
                  aria-label="Periode sebelumnya"
                  onClick={() => moveDate(-1)}
                >
                  ‹
                </button>
                <input
                  aria-label="Tanggal statistik"
                  type={
                    period === "Day"
                      ? "date"
                      : period === "Month"
                        ? "month"
                        : "number"
                  }
                  value={
                    period === "Day"
                      ? date
                      : period === "Month"
                        ? date.slice(0, 7)
                        : date.slice(0, 4)
                  }
                  min={period === "Year" ? "1970" : period === "Month" ? "1970-01" : "1970-01-01"}
                  max={period === "Year" ? "2100" : period === "Month" ? "2100-12" : "2100-12-31"}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    if (!e.target.validity.valid) return;
                    if (period === "Day") setDate(e.target.value);
                    else if (period === "Month")
                      setDate(e.target.value + "-01");
                    else if (
                      e.target.value.length === 4 &&
                      Number(e.target.value) >= 1970 &&
                      Number(e.target.value) <= 2100
                    )
                      setDate(e.target.value + "-01-01");
                  }}
                />
                <button
                  aria-label="Periode berikutnya"
                  onClick={() => moveDate(1)}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
        <label className="history-plant-label">
          Plant
          <select
            aria-label="PLTS untuk statistik"
            value={selected}
            onChange={(e) => onChange(e.target.value)}
          >
            {plants.map((p) => (
              <option key={p.plant_code} value={p.plant_code}>
                {p.plant_name}
              </option>
            ))}
          </select>
          <span className="history-badge">
            <i />
            {loading ? "Memuat statistik…" : result
              ? `${result.completeBuckets}/${result.elapsedBuckets} interval lengkap`
              : "Statistik belum tersedia"}
          </span>
        </label>
        {error ? (
          <div className="chart-error" role="alert">
            <Icon name="info" />
            <span>{error}</span>
            <button className="text-button" onClick={() => setRetry((value) => value + 1)}>Coba lagi</button>
          </div>
        ) : (
          <YieldChart points={points} loading={loading} />
        )}
        {result && !result.complete && (
          <p className="statistics-coverage-warning" role="status">
            {result.truncated ? "Riwayat belum mencakup seluruh rentang yang diminta. " : "Data periode ini masih parsial. "}
            {result.completeBuckets} dari {result.elapsedBuckets} interval yang telah berjalan lengkap.
            Total periode belum dapat dianggap lengkap.
          </p>
        )}
        <p className="chart-caption">
          Energi produksi per {period === "Day" ? "jam" : period === "Month" ? "hari" : period === "Year" ? "bulan" : "tahun"} ({timeZone}).
          {" "}Periode tanpa pengukuran ditampilkan kosong.
          {period === "Lifetime" ? ` Arsip sejak 1970 hingga ${calendarDate(new Date(range.to).getTime() - 1, timeZone).slice(0, 4)}.` : ""}
          {result && result.pendingBuckets > 0 ? ` ${result.pendingBuckets} interval mendatang belum dinilai.` : ""}
        </p>
      </article>
      <div className="statistics-right">
        <article className="white-panel ranking-panel">
          <h2>
            Today's Plant Ranking <span>(Specific Energy)</span>
          </h2>
          <RankingChart plants={plants} onChange={onChange} />
        </article>
        <article className="white-panel benefits-panel">
          <h2>Environmental Benefits</h2>
          <div className="benefits">
            {[
              {
                icon: "coal" as const,
                label: "Standard coal saved",
                unit: "tons",
                color: "purple",
              },
              {
                icon: "cloud" as const,
                label: "CO₂ avoided",
                unit: "tons",
                color: "blue",
              },
              {
                icon: "tree" as const,
                label: "Equivalent trees planted",
                unit: "trees",
                color: "green",
              },
            ].map((b) => (
              <div className={`benefit ${b.color}`} key={b.color}>
                <Icon name={b.icon} size={34} />
                <div>
                  <strong>--</strong>
                  <small> {b.unit}</small>
                </div>
                <span>{b.label}</span>
              </div>
            ))}
          </div>
          <p className="benefits-note">
            Indikator lingkungan belum tersedia dari backend.
          </p>
        </article>
      </div>
    </section>
  );
}
