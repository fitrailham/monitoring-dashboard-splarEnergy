import { calendarMidnight } from "./calendar.ts";
import { request } from "./fleet.ts";

export type CvMode = "inverter" | "string";
export type CvQuality = "measured" | "derived" | "partial" | "missing";
export interface CvQuery { fromDate: string; toDate: string; deviceId: string }
export interface CvRow {
  id: string; date: string; deviceId: string; deviceName: string; deviceSn: string | null;
  stringId: string | null; group: string; cv: number | null; deviation: number | null;
  mean: number | null; stddev: number | null; count: number; averageCurrent: number | null;
  averageVoltage: number | null; quality: CvQuality; reason: string;
}
export interface CvSnapshot {
  status: "ready" | "unconfigured"; rows: CvRow[]; complete: boolean;
  metric: string; unit: string; method: string; basis: string;
}
const ENDPOINT = import.meta.env?.VITE_CV_ANALYSIS_PATH?.trim() ?? "";

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number(value.slice(0, 4)) >= 1970 && Number(value.slice(0, 4)) <= 2100 &&
  Number.isFinite(Date.parse(value + "T00:00:00Z")) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;

export function offsetCvDate(value: string, days: number) {
  return new Date(Date.parse(value + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);
}
export function cvRange(query: CvQuery, zone: string) {
  if (!validDate(query.fromDate) || !validDate(query.toDate) || query.fromDate > query.toDate)
    throw new Error("Pilih rentang tanggal yang valid.");
  const days = (Date.parse(query.toDate) - Date.parse(query.fromDate)) / 86400000 + 1;
  if (days > 366) throw new Error("Pilih maksimum 366 hari untuk satu analisis.");
  const boundary = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return calendarMidnight(year, month, day, zone);
  };
  return { from: boundary(query.fromDate), to: boundary(offsetCvDate(query.toDate, 1)), days };
}

export function cvFromSummary(mean: number | null, stddev: number | null, count: number) {
  if (mean === null || stddev === null || !Number.isFinite(mean) || !Number.isFinite(stddev) ||
      mean <= 0 || stddev < 0 || !Number.isInteger(count) || count < 2) return null;
  const value = stddev / mean * 100;
  return Number.isFinite(value) ? value : null;
}
const numeric = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

export function parseCvData(value: unknown, code: string, mode: CvMode, query: CvQuery, zone: string, partial = false): CvSnapshot {
  const range = cvRange(query, zone), invalid = () => new Error("Format analisis CV tidak sesuai scope, periode, atau metadata pembanding yang diminta.");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const data = value as Record<string, unknown>;
  if (data.plant_code !== code || data.analysis_type !== mode || data.time_zone !== zone ||
      typeof data.from !== "string" || typeof data.to !== "string" || Date.parse(data.from) !== Date.parse(range.from) ||
      !/(?:Z|[+-]\d{2}:\d{2})$/i.test(data.from) || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(data.to) ||
      Date.parse(data.to) !== Date.parse(range.to) || !text(data.metric) || !text(data.unit) || !text(data.method) ||
      !text(data.comparison_basis) || !Array.isArray(data.rows)) throw invalid();
  let complete = data.complete === true && !partial;
  const ids = new Set<string>();
  const rows: CvRow[] = data.rows.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw invalid();
    const row = item as Record<string, unknown>;
    const date = text(row.date), deviceId = text(row.device_id), group = text(row.comparison_group), stringId = text(row.string_id);
    if (!date || !validDate(date) || date < query.fromDate || date > query.toDate || !deviceId || !group ||
        query.deviceId && query.deviceId !== deviceId || mode === "string" && !stringId) throw invalid();
    const id = JSON.stringify([date, deviceId, stringId, group]);
    if (ids.has(id)) throw invalid();
    ids.add(id);
    const mean = numeric(row.mean_value), stddev = numeric(row.stddev_value);
    const rawCount = numeric(row.comparable_count), count = rawCount !== null && Number.isInteger(rawCount) && rawCount >= 0 ? rawCount : 0;
    const quality = ["measured", "derived", "partial", "missing"].includes(String(row.quality)) ? row.quality as CvQuality : "missing";
    const expected = cvFromSummary(mean, stddev, count), supplied = numeric(row.cv_percent);
    const usable = quality !== "missing" && expected !== null && supplied !== null && supplied >= 0 && Math.abs(supplied - expected) <= .05;
    let reason = text(row.reason) ?? "";
    if (!usable && !reason) reason = count < 2 ? "Memerlukan minimal dua anggota pembanding." : mean === 0 ? "Mean nol; CV tidak terdefinisi." : "Statistik pembanding belum valid atau CV tidak konsisten dengan mean/stddev.";
    if (!usable || quality === "partial") complete = false;
    return { id, date, deviceId, deviceName: text(row.device_name) ?? deviceId, deviceSn: text(row.device_sn), stringId, group,
      cv: usable ? supplied : null, deviation: usable ? numeric(row.deviation_percent) : null,
      mean, stddev, count, averageCurrent: numeric(row.average_current_a), averageVoltage: numeric(row.average_voltage_v),
      quality: usable ? quality : "missing", reason };
  });
  const groupStatistics = new Map<string, CvRow>();
  for (const row of rows) {
    const groupKey = JSON.stringify([row.date, row.group]), first = groupStatistics.get(groupKey);
    if (first && (first.mean !== row.mean || first.stddev !== row.stddev || first.count !== row.count)) complete = false;
    else if (!first) groupStatistics.set(groupKey, row);
  }
  return { status: "ready", rows, complete, metric: text(data.metric)!, unit: text(data.unit)!, method: text(data.method)!, basis: text(data.comparison_basis)! };
}

export async function getCvAnalysis(code: string, mode: CvMode, query: CvQuery, zone: string, signal?: AbortSignal, path = ENDPOINT): Promise<CvSnapshot> {
  const range = cvRange(query, zone);
  if (!path) return { status: "unconfigured", rows: [], complete: false, metric: "", unit: "", method: "", basis: "" };
  if (!/^\/(?!\/)[^\s?#]*$/.test(path)) throw new Error("Endpoint CV harus berupa path relatif terhadap backend.");
  const parameters = new URLSearchParams({ plant_code: code, analysis_type: mode, from: range.from, to: range.to, time_zone: zone });
  if (query.deviceId) parameters.set("device_id", query.deviceId);
  const response = await request<unknown>(`${path}?${parameters}`, signal);
  return parseCvData(response.data, code, mode, query, zone, response.meta?.is_partial === true);
}

export const CV_BANDS = [
  { id: "low", label: "0–5%", color: "#48b99b" }, { id: "mid", label: ">5–10%", color: "#59a3e1" },
  { id: "high", label: ">10–20%", color: "#e4b05f" }, { id: "upper", label: ">20%", color: "#b38acb" },
] as const;
export function cvBand(value: number | null): string | null {
  return value === null || !Number.isFinite(value) || value < 0 ? null : value <= 5 ? "low" : value <= 10 ? "mid" : value <= 20 ? "high" : "upper";
}
export function cvGroupTrend(rows: CvRow[], group: string) {
  const dates = [...new Set(rows.filter((row) => row.group === group).map((row) => row.date))].sort();
  return dates.map((date) => {
    const groupRows = rows.filter((row) => row.group === group && row.date === date), first = groupRows[0];
    const consistent = first.cv !== null && groupRows.every((row) => row.cv !== null && Math.abs(row.cv - first.cv!) <= .05 && row.count === first.count && row.mean === first.mean && row.stddev === first.stddev);
    return { date, value: consistent ? first.cv : null, consistent };
  });
}
