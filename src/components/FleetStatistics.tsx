import { getLanguage, translate as t } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
import { useEffect, useMemo, useState } from "react";
import { format, jakartaDate, number } from "../services/fleet";
import type { Plant } from "../services/fleet";
import { statisticsRange } from "../services/statistics";
import type { ChartPoint, Period } from "../services/statistics";
import { calendarDate, validTimeZone } from "../services/calendar";
import { getYieldStatistics } from "../services/yieldStatistics";
import type { YieldResult } from "../services/yieldStatistics";
import { getRankings } from "../services/portfolio";
import type { PortfolioSummary, Ranking } from "../services/portfolio";
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
  useLanguage();
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
          yName: t("Yield (kWh)"),
          fill: "#12c98c",
          strokeWidth: 0,
          tooltip: {
            renderer: ({ datum }) => ({
              title: datum.label,
              data: [
                {
                  label: t("Energi interval"),
                  value: format(datum.value) + " kWh",
                },
                { label: t("Kualitas"), value: {
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
    [points, getLanguage()],
  );
  return (
    <div
      className="yield-chart ag-yield-chart"
      aria-busy={loading}
      aria-label={t("Grafik yield berdasarkan riwayat backend")}
    >
      <div className="chart-key">
        <i />{t("Yield ")}<span>{t("kWh")}</span>
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
              ? t("Memuat riwayat yield...")
              : t("Belum ada riwayat pada periode ini")}
          </span>
        </div>
      )}
    </div>
  );
}
function RankingChart({ onChange, zone, refreshKey }: {
  onChange: (code: string) => void; zone: string; refreshKey: number;
}) {
  useLanguage();
  const [mountedAt] = useState(Date.now);
  const date = calendarDate(refreshKey || mountedAt, zone), key = JSON.stringify([date, zone, refreshKey]);
  const [response, setResponse] = useState<{key: string; rows: Ranking[]; note: string} | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void getRankings(date, zone, controller.signal).then((result) => {
      if (!controller.signal.aborted) setResponse({key, ...result});
    }).catch((error) => { if (!controller.signal.aborted) setResponse({key, rows: [], note: error.message}); });
    return () => controller.abort();
  }, [date, zone, key]);
  const data = useMemo(() => response?.key === key ? response.rows : [], [response, key, getLanguage()]);
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
          yName: t("Specific energy"),
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
                  label: t("Specific energy"),
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
    [data, onChange, getLanguage()],
  );
  return (
    <div
      className="ranking-chart ag-ranking-chart"
      aria-label={t("Peringkat specific energy PLTS")}
      title={t(response?.key === key ? response.note : "Memuat ranking backend…")}
    >
      <DashboardBarChart options={options} />
      {response?.key === key && !data.length && <p className="chart-caption" role="status">{t("Ranking belum memiliki data yang layak dibandingkan. ")}{response.note}</p>}
      <div className="sr-only">
        <ol>
          {data.map((p) => (
            <li key={p.plantCode}>
              <button onClick={() => onChange(p.plantCode)}>
                {p.plantName}
              </button>
              : {format(p.specific)}{t(" kWh/kWp")}</li>
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
  summary,
}: {
  plants: Plant[];
  selected: string;
  onChange: (code: string) => void;
  refreshKey?: number;
  summary?: PortfolioSummary | null;
}) {
  useLanguage();
  const timeZone = validTimeZone(plants.find((plant) => plant.plant_code === selected)?.time_zone);
  const [period, setPeriod] = useState<Period>("Day"),
    [date, setDate] = useState(() => calendarDate(Date.now(), timeZone)),
    [retry, setRetry] = useState(0);
  const [mountedAt] = useState(Date.now);
  const range = useMemo(
    () => statisticsRange(period, date, timeZone, new Date(refreshKey || mountedAt)),
    [period, date, timeZone, refreshKey, mountedAt, getLanguage()],
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
          <h2>{t("Yield Statistics")}</h2>
          <div className="statistics-tools">
            <div
              className="period-tabs"
              role="group"
              aria-label={t("Periode yield")}
            >
              {(["Day", "Month", "Year", "Lifetime"] as Period[]).map((p) => (
                <button
                  key={p}
                  className={period === p ? "active" : ""}
                  aria-pressed={period === p}
                  onClick={() => setPeriod(p)}
                >
                  {t(p)}
                </button>
              ))}
            </div>
            {period !== "Lifetime" && (
              <div className="date-control">
                <button
                  aria-label={t("Periode sebelumnya")}
                  onClick={() => moveDate(-1)}
                >
                  ‹
                </button>
                <input
                  aria-label={t("Tanggal statistik")}
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
                  aria-label={t("Periode berikutnya")}
                  onClick={() => moveDate(1)}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
        <label className="history-plant-label">{t("Plant")}<select
            aria-label={t("PLTS untuk statistik")}
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
            {loading ? t("Memuat statistik…") : result
              ? t(`${result.completeBuckets}/${result.elapsedBuckets} interval lengkap`)
              : t("Statistik belum tersedia")}
          </span>
        </label>
        {error ? (
          <div className="chart-error" role="alert">
            <Icon name="info" />
            <span>{t(error)}</span>
            <button className="text-button" onClick={() => setRetry((value) => value + 1)}>{t("Coba lagi")}</button>
          </div>
        ) : (
          <YieldChart points={points} loading={loading} />
        )}
        {result && !result.complete && (
          <p className="statistics-coverage-warning" role="status">
            {result.truncated ? t("Riwayat belum mencakup seluruh rentang yang diminta. ") : t("Data periode ini masih parsial. ")}
            {result.completeBuckets}{t(" dari ")}{result.elapsedBuckets}{t(" interval yang telah berjalan lengkap. Total periode belum dapat dianggap lengkap.")}</p>
        )}
        <p className="chart-caption">{t("Energi produksi per ")}{period === "Day" ? t("jam") : period === "Month" ? t("hari") : period === "Year" ? t("bulan") : t("tahun")} ({timeZone}).
          {" "}{t("Periode tanpa pengukuran ditampilkan kosong.")}{period === "Lifetime" ? t(` Arsip sejak 1970 hingga ${calendarDate(new Date(range.to).getTime() - 1, timeZone).slice(0, 4)}.`) : ""}
          {result && result.pendingBuckets > 0 ? t(` ${result.pendingBuckets} interval mendatang belum dinilai.`) : ""}
        </p>
      </article>
      <div className="statistics-right">
        <article className="white-panel ranking-panel">
          <h2>{t("Today's Plant Ranking ")}<span>{t("(Specific Energy)")}</span>
          </h2>
          <RankingChart onChange={onChange} zone={timeZone} refreshKey={refreshKey} />
        </article>
        <article className="white-panel benefits-panel">
          <h2>{t("Environmental Benefits")}</h2>
          <div className="benefits">
            {[
              {
                icon: "coal" as const,
                label: "Standard coal saved",
                unit: "tons",
                color: "purple",
                value: number(summary?.environmental_benefits?.coal_saved_kg),
              },
              {
                icon: "cloud" as const,
                label: "CO₂ avoided",
                unit: "tons",
                color: "blue",
                value: number(summary?.environmental_benefits?.co2_avoided_kg),
              },
              {
                icon: "tree" as const,
                label: "Equivalent trees",
                unit: "tree-years",
                color: "green",
                value: number(summary?.environmental_benefits?.equivalent_tree_years),
              },
            ].map((b) => (
              <div className={`benefit ${b.color}`} key={b.color}>
                <Icon name={b.icon} size={34} />
                <div>
                  <strong>{summary?.environmental_benefits?.status === "unconfigured" ? "--" : format(b.value === null ? null : b.icon === "tree" ? b.value : b.value / 1000)}</strong>
                  <small> {b.unit}</small>
                </div>
                <span>{t(b.label)}</span>
              </div>
            ))}
          </div>
          <p className="benefits-note">
            {summary?.environmental_benefits?.reason || t("Indikator lingkungan portofolio dari summary backend.")}
          </p>
        </article>
      </div>
    </section>
  );
}
