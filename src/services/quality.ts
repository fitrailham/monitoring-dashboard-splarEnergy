import { number } from "./fleet.ts";
import type { Plant } from "./fleet.ts";
import { calendarDate, validTimeZone } from "./calendar.ts";

export type FreshnessState = "fresh" | "stale" | "unverified" | "missing";
export interface TelemetryFreshness {
  state: FreshnessState;
  ageSeconds: number | null;
  measuredAt: string | null;
}
export type MetricKey = "pv_power_kw" | "yield_today_kwh" | "capacity_kwp" | "total_yield_kwh";
export interface MetricSummary {
  value: number | null;
  valid: number;
  expected: number;
  missing: number;
  stale: number;
  unverified: number;
  notApplicable: number;
  demo: number;
  partial: boolean;
}

export function telemetryFreshness(plant: Plant, now = Date.now()): TelemetryFreshness {
  const quality = plant.data_quality;
  const verified = quality?.measurement_time_verified ?? plant.measurement_time_verified ?? false;
  const timestamp = quality?.measured_at ?? plant.measured_at ??
    (plant.timestamp_source === "collector" ? null : plant.recorded_at);
  const measuredAt = timestamp && /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) &&
    Number.isFinite(Date.parse(timestamp)) ? timestamp : null;
  const ageSeconds = measuredAt ? Math.max(0, (now - Date.parse(measuredAt)) / 1000) : null;
  if (quality?.state === "missing") return { state: "missing", ageSeconds, measuredAt };
  if (!verified || !measuredAt || quality?.state === "unverified" || Date.parse(measuredAt) > now + 60000) {
    return { state: timestamp || plant.recorded_at ? "unverified" : "missing", ageSeconds, measuredAt };
  }
  const threshold = number(quality?.stale_after_seconds);
  const staleAfter = threshold !== null && threshold > 0 ? threshold : 900;
  return { state: quality?.state === "stale" || ageSeconds! > staleAfter ? "stale" : "fresh", ageSeconds, measuredAt };
}

export function telemetryLabel(freshness: TelemetryFreshness) {
  const age = freshness.ageSeconds;
  const ageLabel = age === null ? "" : age < 60 ? "<1 menit lalu" : age < 3600
    ? `${Math.floor(age / 60)} menit lalu` : age < 86400
      ? `${Math.floor(age / 3600)} jam lalu` : `${Math.floor(age / 86400)} hari lalu`;
  if (freshness.state === "missing") return "Waktu tidak tersedia";
  if (freshness.state === "unverified") return "Waktu belum terverifikasi";
  return `${freshness.state === "fresh" ? "Terbaru" : "Data lama"} · ${ageLabel}`;
}

export function aggregateMetric(plants: Plant[], key: MetricKey, now = Date.now()): MetricSummary {
  const result: MetricSummary = {
    value: null, valid: 0, expected: 0, missing: 0, stale: 0,
    unverified: 0, notApplicable: 0, demo: 0, partial: false,
  };
  for (const plant of plants) {
    if (plant.is_demo) { result.demo++; continue; }
    const quality = plant.data_quality;
    const fieldQuality = quality?.field_quality?.[key]?.toUpperCase();
    if (plant.has_pv === false || quality?.not_applicable_fields?.includes(key) ||
        ["NOT_INSTALLED", "NOT_APPLICABLE"].includes(fieldQuality ?? "")) {
      result.notApplicable++; continue;
    }
    result.expected++;
    const value = number(plant[key]);
    if (value === null || quality?.missing_fields?.includes(key) ||
        ["MISSING", "SOURCE_UNSUPPORTED", "SOURCE_UNAVAILABLE"].includes(fieldQuality ?? "")) {
      result.missing++; continue;
    }
    if (key !== "capacity_kwp") {
      const freshness = telemetryFreshness(plant, now);
      if (freshness.state !== "fresh") { result[freshness.state]++; continue; }
      if (fieldQuality === "STALE") { result.stale++; continue; }
      if (fieldQuality && !["FRESH", "VALID", "MEASURED", "DERIVED", "OK", "AVAILABLE"].includes(fieldQuality)) {
        result.unverified++; continue;
      }
      if (key === "yield_today_kwh") {
        const zone = validTimeZone(plant.time_zone);
        const businessDate = plant.yield_business_date || calendarDate(freshness.measuredAt!, zone);
        if (businessDate !== calendarDate(now, zone)) { result.stale++; continue; }
      }
    }
    result.value = (result.value ?? 0) + value;
    result.valid++;
  }
  result.partial = result.valid < result.expected;
  return result;
}

export function metricCoverageLabel(metric: MetricSummary) {
  return `Cakupan ${metric.valid}/${metric.expected} PLTS${metric.partial ? " · parsial" : ""}`;
}
export function metricCoverageDetail(metric: MetricSummary) {
  return `${metric.valid} valid; ${metric.missing} kosong; ${metric.stale} lama; ${metric.unverified} belum terverifikasi; ${metric.notApplicable} tidak relevan; ${metric.demo} demo dikecualikan.`;
}
