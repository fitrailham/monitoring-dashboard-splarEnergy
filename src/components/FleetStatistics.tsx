import { useEffect, useMemo, useState } from "react";
import { format, getHistory, jakartaDate, specific } from "../services/fleet";
import type { HistoryRow, Plant } from "../services/fleet";
import { historyBuckets } from "../services/statistics";
import type { ChartPoint, Period } from "../services/statistics";
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
                  label: "Yield kumulatif",
                  value: format(datum.value) + " kWh",
                },
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
}: {
  plants: Plant[];
  selected: string;
  onChange: (code: string) => void;
}) {
  const [history, setHistory] = useState<HistoryRow[]>([]),
    [period, setPeriod] = useState<Period>("Day"),
    [date, setDate] = useState(jakartaDate()),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setLoading(true);
    setHistory([]);
    setError("");
    getHistory(selected, controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setHistory(rows);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selected]);
  const points = useMemo(
    () => historyBuckets(history, period, date),
    [history, period, date],
  );
  function moveDate(direction: number) {
    const next = new Date(date + "T12:00:00+07:00");
    if (period === "Day") next.setUTCDate(next.getUTCDate() + direction);
    else if (period === "Month") {
      next.setUTCDate(1);
      next.setUTCMonth(next.getUTCMonth() + direction);
    } else next.setUTCFullYear(next.getUTCFullYear() + direction);
    setDate(jakartaDate(next));
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
                  min={period === "Year" ? "2000" : undefined}
                  max={period === "Year" ? "2100" : undefined}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    if (period === "Day") setDate(e.target.value);
                    else if (period === "Month")
                      setDate(e.target.value + "-01");
                    else if (
                      e.target.value.length === 4 &&
                      Number(e.target.value) >= 2000 &&
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
            {loading ? "Loading history…" : `${history.length} records`}
          </span>
        </label>
        {error ? (
          <div className="chart-error" role="alert">
            <Icon name="info" />
            <span>{error}</span>
          </div>
        ) : (
          <YieldChart points={points} loading={loading} />
        )}
        <p className="chart-caption">
          {period === "Day"
            ? "Yield kumulatif: pembacaan terakhir setiap jam (WIB)."
            : "Yield dari nilai harian tertinggi pada rekaman yang tersedia."}{" "}
          Maksimal 500 rekaman; periode tanpa data ditampilkan kosong.
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
