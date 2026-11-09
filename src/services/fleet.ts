export const API_BASE = (
  import.meta.env.VITE_API_URL?.trim() || "http://127.0.0.1:8000"
).replace(/\/+$/, "");
export type Numeric = number | string | null;
export interface Plant {
  plant_code: string;
  plant_name: string;
  capacity_kwp: Numeric;
  address?: string;
  recorded_at: string | null;
  pv_power_kw: Numeric;
  load_power_kw: Numeric;
  grid_power_kw: Numeric;
  yield_today_kwh: Numeric;
  total_yield_kwh: Numeric;
  battery_power_kw: Numeric;
  battery_soc_percent: Numeric;
  ess_charge_today_kwh: Numeric;
  ess_discharge_today_kwh: Numeric;
  data_source?: string;
  timestamp_source?: string;
  status?: string;
  latitude?: Numeric;
  longitude?: Numeric;
  is_demo?: boolean;
}
export interface HistoryRow {
  recorded_at: string;
  yield_today_kwh: Numeric;
  pv_power_kw: Numeric;
}
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  detail?: string;
  configured?: boolean;
}
export function number(value: Numeric | undefined): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value === "string" && !value.trim())
  )
    return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
export async function request<T>(
  path: string,
  signal?: AbortSignal,
): Promise<ApiResponse<T>> {
  let response: Response;
  try {
    response = await fetch(API_BASE + path, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      `Backend tidak dapat dihubungi di ${API_BASE}. Periksa koneksi dan izin CORS.`,
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success)
    throw new Error(
      typeof result?.detail === "string"
        ? result.detail
        : result?.message || `API error (${response.status})`,
    );
  return result;
}
export async function getFleet(signal?: AbortSignal) {
  const [overview, metadata] = await Promise.allSettled([
    request<Plant[]>("/api/database/overview", signal),
    request<Partial<Plant>[]>("/api/database/plants", signal),
  ]);
  if (overview.status === "rejected") throw overview.reason;
  if (!Array.isArray(overview.value.data))
    throw new Error("Format ringkasan monitoring tidak valid.");
  const details = new Map(
    metadata.status === "fulfilled" && Array.isArray(metadata.value.data)
      ? metadata.value.data.map((p) => [p.plant_code, p])
      : [],
  );
  return {
    plants: overview.value.data.map((p) => ({
      ...details.get(p.plant_code),
      ...p,
    })),
    warning:
      metadata.status === "rejected"
        ? "Informasi alamat PLTS belum dapat dimuat."
        : "",
  };
}
export async function getHistory(code: string, signal?: AbortSignal) {
  const response = await request<HistoryRow[]>(
    `/api/database/history/${encodeURIComponent(code)}?limit=500`,
    signal,
  );
  if (!Array.isArray(response.data))
    throw new Error("Format riwayat monitoring tidak valid.");
  return response.data;
}
export type PlantStatus = "normal" | "faulty" | "disconnected" | "unknown";
export function status(plant: Plant): PlantStatus {
  const value = plant.status?.toLowerCase();
  if (value === "normal" || value === "online") return "normal";
  if (value === "faulty" || value === "fault" || value === "alarm")
    return "faulty";
  if (value === "disconnected" || value === "offline") return "disconnected";
  return "unknown";
}
export const statusLabel = {
  normal: "Normal",
  faulty: "Faulty",
  disconnected: "Disconnected",
  unknown: "Unknown",
};
export function sum(plants: Plant[], key: keyof Plant) {
  const values = plants
    .map((p) => number(p[key] as Numeric))
    .filter((v): v is number => v !== null);
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
}
export function format(value: Numeric | undefined, digits = 2) {
  const parsed = number(value);
  return parsed === null
    ? "--"
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(parsed);
}
export function specific(plant: Plant) {
  const capacity = number(plant.capacity_kwp);
  const yieldToday = number(plant.yield_today_kwh);
  return capacity && yieldToday !== null ? yieldToday / capacity : null;
}
export function jakartaDate(date: Date | string = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)?.value)
    .join("-");
}
