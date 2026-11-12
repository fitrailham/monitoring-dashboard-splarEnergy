import { jakartaDate, number, request } from "./fleet.ts";
import type { MetricSummary } from "./quality.ts";

interface Coverage { expected: number; valid: number; missing: number; stale: number; unverified: number; not_applicable: number; partial: boolean }
export interface PortfolioSummary {
  total_plants: number;
  kpis: Record<string, number | null | string>;
  plant_status: Record<"normal" | "faulty" | "disconnected" | "unknown", number>;
  active_alarms: {
    configured: boolean; total: number | null; severity: Record<string, number | null>;
    coverage: { expected_plants: number; valid_plants: number; configured_plants: number; complete: boolean };
  };
  coverage: Record<string, Coverage>;
  environmental_benefits?: { status: string; coal_saved_kg: number | null; co2_avoided_kg: number | null; equivalent_tree_years: number | null; reason?: string | null };
  revenue?: { status: string; revenue_today_idr: number | null; reason?: string | null };
}
export async function getPortfolioSummary(signal?: AbortSignal) {
  const response = await request<PortfolioSummary>(`/api/portfolio/summary?${new URLSearchParams({date: jakartaDate(), time_zone: "Asia/Jakarta"})}`, signal);
  const data = response.data;
  if (!data || !Number.isInteger(data.total_plants) || data.total_plants < 0 || !data.kpis || !data.coverage || !data.active_alarms?.coverage ||
      !data.plant_status || Object.values(data.plant_status).reduce((a, b) => a + b, 0) !== data.total_plants)
    throw new Error("Kontrak summary portofolio tidak valid.");
  return data;
}
export function summaryMetric(summary: PortfolioSummary | null | undefined, metric: string, fallback: MetricSummary, coverageKey = metric): MetricSummary {
  if (!summary) return fallback;
  const coverage = summary.coverage[coverageKey] ?? summary.coverage[metric];
  return { value: number(summary.kpis[metric]), expected: coverage?.expected ?? summary.total_plants,
    valid: coverage?.valid ?? 0, missing: coverage?.missing ?? 0, stale: coverage?.stale ?? 0, unverified: coverage?.unverified ?? 0,
    notApplicable: coverage?.not_applicable ?? 0, demo: 0, partial: coverage ? coverage.partial : true };
}
export function summaryAlarms(summary: PortfolioSummary) {
  const alarms = summary.active_alarms, coverage = alarms.coverage;
  return { available: alarms.configured && alarms.total !== null,
    counts: ["critical", "major", "minor", "warning", "unclassified"].map((key) => number(alarms.severity[key]) ?? 0),
    coverage: coverage.valid_plants, totalPlants: coverage.expected_plants, complete: coverage.complete };
}
export interface Ranking { plantCode: string; plantName: string; specific: number }
export async function getRankings(date: string, zone: string, signal?: AbortSignal): Promise<{ rows: Ranking[]; note: string }> {
  const response = await request<{plant_code: string; plant_name: string; specific_energy_kwh_per_kwp: number}[]>(
    `/api/database/rankings?${new URLSearchParams({date, time_zone: zone, metric: "specific_energy", limit: "5"})}`, signal);
  if (!Array.isArray(response.data)) throw new Error("Kontrak ranking tidak valid.");
  return {rows: response.data.map((row) => {
    const specific = number(row.specific_energy_kwh_per_kwp);
    if (!row.plant_code || specific === null || specific < 0) throw new Error("Nilai ranking tidak valid.");
    return {plantCode: row.plant_code, plantName: row.plant_name, specific};
  }), note: response.meta?.warnings?.join(" ") ?? "Ranking berdasarkan data dan kelayakan periode dari backend."};
}
