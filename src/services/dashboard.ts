import { ALARM_SEVERITIES, alarmTimestamp, normalizeAlarms } from "./alarms.ts";
import type { MonitoringAlarm } from "./alarms.ts";
import { calendarDate, DEFAULT_TIME_ZONE } from "./calendar.ts";
import { number, status } from "./fleet.ts";
import type { Plant } from "./fleet.ts";
import { request } from "./http.ts";
import type { ApiResponse } from "./http.ts";
import type { DashboardOverview } from "./portfolio.ts";

export interface DashboardSnapshot<T> {
  value: T;
  updatedAt: number | null;
  stale: boolean;
}

export interface DashboardAlarm extends MonitoringAlarm {
  plantCode: string;
}

export const PLANT_STATUSES = ["normal", "faulty", "disconnected", "unknown"] as const;
export const ALARM_LEVELS = Object.keys(ALARM_SEVERITIES) as (keyof typeof ALARM_SEVERITIES)[];
export const DASHBOARD_REFRESH_MS = 5 * 60 * 1000;
export const DASHBOARD_STALE_MS = 10 * 60 * 1000;
const PAGE_SIZE = 100;
const MAX_PAGES = 200;
const KPI_FIELDS = ["current_power_kw", "revenue_today_idr", "ess_rated_capacity_kwh",
  "yield_today_kwh", "inverter_rated_power_kw", "total_yield_kwh"];

type Page = Omit<ApiResponse<unknown[]>, "total"> & {
  total?: number | null;
  quality?: string;
  collected_at?: string | null;
  collectedAt?: string | null;
  coverage?: { complete?: boolean; valid_plants?: number; expected_plants?: number; stale_plants?: number };
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function pages(path: string, signal?: AbortSignal) {
  const fetchPage = (page: number, snapshotId?: string): Promise<Page> => {
    const query = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (snapshotId) query.set("snapshot_id", snapshotId);
    return request(`${path}?${query}`, signal);
  };
  const first = await fetchPage(1);
  const badSnapshot = "The dashboard returned an incomplete or invalid dataset.";
  if (!Array.isArray(first.data) || (first.total != null && (!Number.isSafeInteger(first.total) || first.total < 0)))
    throw new Error(badSnapshot);
  const total = first.total ?? undefined;
  const pageCount = first.meta?.total_pages ?? (total !== undefined && total > first.data.length
    ? Math.ceil(total / (first.data.length || PAGE_SIZE)) : 1);
  if (!Number.isSafeInteger(pageCount) || pageCount < 0 || pageCount > MAX_PAGES || (first.meta?.page ?? 1) !== 1 ||
    (!first.data.length && pageCount > 1) || (first.data.length > 0 && pageCount === 0)) throw new Error(badSnapshot);

  const rows = [...first.data];
  const fingerprint = new Set([JSON.stringify(first.data)]);
  for (let page = 2; page <= pageCount; page++) {
    const next = await fetchPage(page, first.meta?.snapshot_id);
    if (!Array.isArray(next.data) || !next.data.length || (next.meta?.page ?? page) !== page ||
      (next.meta?.total_pages ?? pageCount) !== pageCount ||
      (next.total ?? undefined) !== total || next.configured !== first.configured ||
      next.meta?.snapshot_id !== first.meta?.snapshot_id)
      throw new Error(badSnapshot);
    const key = JSON.stringify(next.data);
    if (fingerprint.has(key)) throw new Error(badSnapshot);
    fingerprint.add(key);
    rows.push(...next.data);
  }
  if (total !== undefined && rows.length !== total) throw new Error(badSnapshot);
  return { envelope: first, rows };
}

export async function getDashboardOverview(date: string, signal?: AbortSignal): Promise<DashboardSnapshot<DashboardOverview>> {
  const query = new URLSearchParams({ date, time_zone: DEFAULT_TIME_ZONE });
  const response = await request<DashboardOverview & { updated_at?: string | null; quality?: string }>(
    `/api/v1/dashboard/overview?${query}`, signal,
  );
  const data = response.data;
  if (!data || !record(data.kpis) || KPI_FIELDS.some((key) => {
    const value = data.kpis[key];
    return value != null && ((typeof value !== "number" && typeof value !== "string") || number(value) === null);
  })) throw new Error("The dashboard returned invalid KPI data.");
  return {
    value: { ...data, coverage: record(data.coverage) ? data.coverage : {} },
    updatedAt: alarmTimestamp(data.updated_at === undefined ? response.meta?.generated_at ?? null : data.updated_at),
    stale: data.quality === "stale" || Object.values(data.coverage ?? {}).some((metric) => (metric?.stale ?? 0) > 0),
  };
}

export async function getDashboardPlants(signal?: AbortSignal): Promise<DashboardSnapshot<Plant[]>> {
  const { envelope, rows } = await pages("/api/v1/plants", signal);
  const plants = new Map<string, Plant>();
  for (const row of rows) {
    if (!record(row) || typeof row.plant_code !== "string" || !row.plant_code.trim() ||
      typeof row.plant_name !== "string" || !row.plant_name.trim() || plants.has(row.plant_code))
      throw new Error("The dashboard returned an incomplete or invalid dataset.");
    const plant = row as unknown as Plant;
    plants.set(plant.plant_code, plant);
  }
  return {
    value: [...plants.values()],
    updatedAt: alarmTimestamp(envelope.meta?.generated_at ?? null),
    stale: envelope.quality === "stale",
  };
}

export async function getDashboardAlarms(signal?: AbortSignal): Promise<DashboardSnapshot<{
  alarms: DashboardAlarm[]; complete: boolean; coverage: number | null; totalPlants: number | null;
}>> {
  const { envelope, rows } = await pages("/api/v1/alarms/active", signal);
  if (envelope.configured === false) throw new Error("Alarm data is not configured");
  const emptyScope = envelope.total === 0 && envelope.coverage?.expected_plants === 0 && envelope.coverage.complete === true;
  if (envelope.total === null || (envelope.quality === "missing" && !emptyScope))
    throw new Error("Alarm data is unavailable");
  const alarms: DashboardAlarm[] = [];
  const knownIds = new Set<string>();
  for (const raw of rows) {
    if (!record(raw) || (raw.state != null && String(raw.state).toLowerCase() !== "active"))
      throw new Error("The dashboard returned an incomplete or invalid dataset.");
    const code = typeof raw.plant_code === "string" ? raw.plant_code : "";
    const [alarm] = normalizeAlarms([{ ...raw, state: "active" }], code, code);
    if (!alarm || (alarm.alarmId !== null && knownIds.has(alarm.id)))
      throw new Error("The dashboard returned an incomplete or invalid dataset.");
    if (alarm.alarmId !== null) knownIds.add(alarm.id);
    alarms.push({ ...alarm, plantCode: code });
  }
  return {
    value: {
      alarms,
      complete: envelope.coverage?.complete !== false && envelope.meta?.is_partial !== true,
      coverage: envelope.coverage?.valid_plants ?? null,
      totalPlants: envelope.coverage?.expected_plants ?? null,
    },
    updatedAt: alarmTimestamp(envelope.collected_at ?? envelope.collectedAt ?? envelope.meta?.generated_at ?? null),
    stale: envelope.quality === "stale" || (envelope.coverage?.stale_plants ?? 0) > 0,
  };
}

export function countPlantStatuses(plants: Plant[]) {
  const counts = { normal: 0, faulty: 0, disconnected: 0, unknown: 0 };
  for (const plant of plants) counts[status(plant)]++;
  return counts;
}

export function countAlarmSeverities(alarms: DashboardAlarm[]) {
  const counts = { critical: 0, major: 0, minor: 0, warning: 0, unclassified: 0 };
  for (const alarm of alarms) counts[alarm.severity]++;
  return counts;
}

export function formatDashboardMetric(value: number | null, units: readonly string[], locale: string, compact = false) {
  let unitIndex = 0;
  let amount = value;
  while (amount !== null && Math.abs(amount) >= 1000 && unitIndex < units.length - 1) {
    amount /= 1000;
    unitIndex++;
  }
  return {
    amount: amount === null ? "—" : new Intl.NumberFormat(locale, compact
      ? { notation: "compact", maximumFractionDigits: 2 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount),
    unit: units[unitIndex],
  };
}

export function isDashboardDataStale(updatedAt: number | null, now: number) {
  return updatedAt !== null && now - updatedAt >= DASHBOARD_STALE_MS;
}

export function dashboardDate(now: number) {
  return calendarDate(now, DEFAULT_TIME_ZONE);
}
