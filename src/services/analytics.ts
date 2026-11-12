import { number, request } from "./fleet.ts";
import { calendarDate } from "./calendar.ts";
import type { StatisticsRange } from "./statistics.ts";
import type { PowerPoint } from "./monitoring.ts";
import type { PlantReportRow } from "./reports.ts";

type Quality = "measured" | "derived" | "partial" | "missing" | "pending";
interface RangeEnvelope { from?: string; to?: string; from_at?: string; to_at?: string; time_zone: string }
function matchesRange(data: RangeEnvelope, range: StatisticsRange) {
  return data.time_zone === range.timeZone && Date.parse(data.from ?? data.from_at ?? "") === Date.parse(range.from) &&
    Date.parse(data.to ?? data.to_at ?? "") === Date.parse(range.to);
}
const time = (value: string) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? Date.parse(value) : NaN;
const qualityIsUsable = (quality: string) => ["measured", "derived", "partial"].includes(quality);
export interface SampleCoverage { quality: string; valid_samples: number; expected_samples: number; reason?: string | null }
interface PowerBucket {
  start_at: string; end_at: string; quality: Quality;
  pv_power_kw: number | null; grid_power_kw: number | null; load_power_kw: number | null; battery_power_kw: number | null;
  coverage: Record<string, SampleCoverage>;
}
interface PowerData extends RangeEnvelope {
  plant_code: string; unit: string; aggregation: string; resolution_minutes: number;
  complete: boolean; truncated: boolean; buckets: PowerBucket[];
}
export interface PowerResult { points: PowerPoint[]; complete: boolean; warnings: string[] }
export async function getPowerStatistics(code: string, range: StatisticsRange, signal?: AbortSignal, resolution = 5): Promise<PowerResult> {
  const query = new URLSearchParams({ plant_code: code, from: range.from, to: range.to, time_zone: range.timeZone,
    resolution_minutes: String(resolution), aggregation: "last" });
  const response = await request<PowerData>(`/api/database/power-statistics?${query}`, signal);
  const data = response.data;
  if (!data || !matchesRange(data, range) || data.plant_code !== code || data.unit !== "kW" ||
      data.aggregation !== "last" || data.resolution_minutes !== resolution || !Array.isArray(data.buckets))
    throw new Error("Kontrak statistik daya tidak sesuai dengan PLTS/periode yang diminta.");
  let boundary = time(range.from);
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: range.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const points = data.buckets.map((bucket): PowerPoint => {
    const start = time(bucket.start_at), end = time(bucket.end_at);
    if (start !== boundary || !(end > start) || end > time(range.to) || !bucket.coverage ||
        !["measured", "partial", "missing", "pending"].includes(bucket.quality)) throw new Error("Bucket statistik daya tidak valid.");
    boundary = end;
    function value(field: keyof PowerBucket) {
      const coverage = bucket.coverage[field];
      return bucket.quality === "pending" || !coverage || !qualityIsUsable(coverage.quality) ? null : number(bucket[field] as number | null);
    }
    return { label: formatter.format(new Date(start)), startAt: bucket.start_at, endAt: bucket.end_at,
      pv: value("pv_power_kw"), grid: value("grid_power_kw"), load: value("load_power_kw"), battery: value("battery_power_kw"),
      quality: bucket.quality, fieldQuality: Object.fromEntries(Object.entries(bucket.coverage).map(([key, coverage]) => [key, coverage.quality])) };
  });
  return { points, complete: data.complete === true && !data.truncated && !response.meta?.is_partial && boundary === time(range.to), warnings: response.meta?.warnings ?? [] };
}

interface ReportRow {
  plant_code: string; device_id: string; device_key: string; device_name: string | null; device_sn: string | null;
  start_at: string; end_at: string; inverter_yield_kwh: number | null; quality: Quality; reason?: string | null;
}
interface ReportEnvelope extends RangeEnvelope {
  data: ReportRow[]; total?: number; grain: string; unit: string; aggregation: string; complete: boolean; truncated: boolean;
  totals: { inverter_yield_kwh: number | null; total_rows: number; complete_rows: number; missing_rows: number; partial_rows: number };
}
export interface InverterReport { rows: PlantReportRow[]; complete: boolean; total: number; yield: number | null; warnings: string[] }
export async function getInverterReport(code: string, range: StatisticsRange, deviceId = "", signal?: AbortSignal): Promise<InverterReport> {
  const rows: PlantReportRow[] = [], seen = new Set<string>(), warnings = new Set<string>();
  let total = -1, complete = true, yieldTotal: number | null = null;
  for (let page = 1; page <= 50; page++) {
    const query = new URLSearchParams({ plant_code: code, from: range.from, to: range.to, grain: range.grain,
      time_zone: range.timeZone, page: String(page), page_size: "1000" });
    if (deviceId) query.set("device_id", deviceId);
    const response = await request<ReportRow[]>(`/api/reports/inverters?${query}`, signal);
    const envelope = response as typeof response & ReportEnvelope;
    if (!matchesRange(envelope, range) || envelope.unit !== "kWh" || envelope.aggregation !== "interval_energy" ||
        envelope.grain !== range.grain || !Array.isArray(envelope.data) || !Number.isInteger(envelope.total) ||
        envelope.total! < 0 || envelope.total! > 50000 || !envelope.totals || envelope.totals.total_rows !== envelope.total)
      throw new Error("Kontrak laporan inverter tidak valid atau rentang melebihi 50000 baris.");
    if (total < 0) { total = envelope.total!; yieldTotal = number(envelope.totals.inverter_yield_kwh); }
    if (envelope.total !== total || number(envelope.totals.inverter_yield_kwh) !== yieldTotal)
      throw new Error("Laporan berubah saat pagination. Muat ulang laporan.");
    complete = complete && envelope.complete === true && !envelope.truncated && !response.meta?.is_partial;
    response.meta?.warnings?.forEach((warning) => warnings.add(warning));
    for (const row of envelope.data) {
      const start = time(row.start_at), end = time(row.end_at), id = JSON.stringify([row.plant_code, row.device_key, row.start_at]);
      const energy = number(row.inverter_yield_kwh);
      if (row.plant_code !== code || !row.device_key || !row.device_id || deviceId && row.device_id !== deviceId ||
          !(start >= time(range.from) && end <= time(range.to) && end > start) || seen.has(id) ||
          !["measured", "derived", "partial", "missing", "pending"].includes(row.quality) || energy !== null && energy < 0)
        throw new Error("Baris laporan inverter duplikat atau di luar lingkup permintaan.");
      seen.add(id);
      const period = `${calendarDate(start, range.timeZone)} ${new Intl.DateTimeFormat("en-GB", {timeZone: range.timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"}).format(new Date(start))}`;
      rows.push({ id, period, timestamp: start, pvYield: null, inverterYield: qualityIsUsable(row.quality) ? energy : null,
        exportEnergy: null, revenue: null, quality: row.quality, deviceName: row.device_name ?? row.device_id,
        deviceId: row.device_id, deviceSn: row.device_sn, reason: row.reason ?? null });
      if (!["measured", "derived", "pending"].includes(row.quality) || qualityIsUsable(row.quality) && energy === null) complete = false;
    }
    if (seen.size === total) return { rows: rows.filter((row) => row.quality !== "pending"), complete, total, yield: yieldTotal, warnings: [...warnings] };
    if (!envelope.data.length || seen.size > total) break;
  }
  throw new Error("Laporan inverter belum lengkap. Persempit periode atau pilih satu inverter.");
}

export interface DeviceSample {
  sample_id: string; measured_at: string | null; collected_at: string; measurement_time_verified: boolean;
  active_power_kw: number | null; pv_input_power_kw: number | null; grid_power_kw: number | null; load_power_kw: number | null;
  battery_power_kw: number | null; battery_soc_percent: number | null; yield_today_kwh: number | null; total_yield_kwh: number | null;
  field_quality: Record<string, string>; power_direction_convention: string; status: string;
}
export async function getDeviceHistory(code: string, deviceId: string, range: StatisticsRange, signal?: AbortSignal) {
  if (!deviceId || time(range.to) <= time(range.from) || time(range.to) - time(range.from) > 31 * 86400000)
    throw new Error("Pilih perangkat dan rentang maksimum 31 hari.");
  const samples: DeviceSample[] = [], ids = new Set<string>(), warnings = new Set<string>();
  let total = -1;
  for (let page = 1; page <= 100; page++) {
    const query = new URLSearchParams({ plant_code: code, from: range.from, to: range.to, time_zone: range.timeZone, page: String(page), page_size: "1000" });
    const response = await request<DeviceSample[]>(`/api/devices/${encodeURIComponent(deviceId)}/history?${query}`, signal);
    const envelope = response as typeof response & RangeEnvelope & { plant_code: string; device_id: string; units: { power: string; energy: string }; };
    if (!matchesRange(envelope, range) || envelope.plant_code !== code || envelope.device_id !== deviceId ||
        !Array.isArray(response.data) || !Number.isInteger(response.total) || response.total! < 0 ||
        envelope.units?.power !== "kW" || envelope.units?.energy !== "kWh") throw new Error("Kontrak riwayat perangkat tidak valid.");
    if (total < 0) total = response.total!;
    if (total !== response.total) throw new Error("Riwayat perangkat berubah saat ekspor. Coba lagi.");
    response.meta?.warnings?.forEach((warning) => warnings.add(warning));
    for (const sample of response.data) {
      if (!sample.sample_id || ids.has(sample.sample_id)) throw new Error("Riwayat perangkat memuat sampel duplikat.");
      if (sample.measurement_time_verified && !(time(sample.measured_at ?? "") >= time(range.from) && time(sample.measured_at ?? "") < time(range.to)))
        throw new Error("Waktu pengukuran perangkat berada di luar rentang ekspor.");
      ids.add(sample.sample_id); samples.push(sample);
    }
    if (samples.length === total) return { samples, warnings: [...warnings] };
    if (!response.data.length || samples.length > total) break;
  }
  throw new Error("Ekspor terlalu besar atau belum lengkap. Persempit rentang tanggal.");
}

export function devicePerformanceRows(code: string, deviceId: string, samples: DeviceSample[]) {
  const fields = ["active_power_kw", "pv_input_power_kw", "load_power_kw", "grid_power_kw", "battery_power_kw", "battery_soc_percent", "yield_today_kwh", "total_yield_kwh"] as const;
  return [["plant_code", "device_id", "sample_id", "measured_at", "collected_at", "measurement_time_verified", ...fields, "field_quality", "power_direction_convention", "status"],
    ...samples.map((sample) => [code, deviceId, sample.sample_id, sample.measured_at, sample.collected_at, String(sample.measurement_time_verified), ...fields.map((field) => {
      const quality = sample.field_quality?.[field];
      const signed = field === "grid_power_kw" || field === "battery_power_kw";
      return !sample.measurement_time_verified || !Number.isFinite(time(sample.measured_at ?? "")) || quality && quality !== "VALID" ||
        signed && sample.power_direction_convention !== "grid_import_battery_discharge_positive" ? null : number(sample[field]);
    }), JSON.stringify(sample.field_quality ?? {}), sample.power_direction_convention, sample.status])];
}
