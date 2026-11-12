import { ApiError, number, request } from "./fleet.ts";
import type { ChartPoint, StatisticsRange } from "./statistics.ts";

interface YieldBucket {
  start_at: string;
  end_at: string;
  label: string;
  yield_kwh: number | string | null;
  quality: ChartPoint["quality"];
}
interface YieldStatistics {
  aggregation: string;
  unit: string;
  grain: string;
  time_zone: string;
  from?: string;
  to?: string;
  from_at?: string;
  to_at?: string;
  complete: boolean;
  truncated?: boolean;
  buckets: YieldBucket[];
}
export interface YieldResult {
  points: ChartPoint[];
  complete: boolean;
  truncated: boolean;
  completeBuckets: number;
  elapsedBuckets: number;
  pendingBuckets: number;
}

export async function getYieldStatistics(
  code: string, range: StatisticsRange, signal?: AbortSignal,
): Promise<YieldResult> {
  const query = new URLSearchParams({
    plant_code: code, from: range.from, to: range.to,
    grain: range.grain, time_zone: range.timeZone,
  });
  let response;
  try {
    response = await request<YieldStatistics>(`/api/database/yield-statistics?${query}`, signal);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
      throw new Error("Statistik rentang waktu belum tersedia. Backend perlu menyediakan endpoint yield-statistics.");
    }
    throw error;
  }
  const data = response.data;
  const invalid = () => new Error("Format statistik energi tidak sesuai dengan periode yang diminta.");
  if (!data || data.aggregation !== "interval_energy" || data.unit !== "kWh" ||
      data.grain !== range.grain || data.time_zone !== range.timeZone ||
      Date.parse(data.from ?? data.from_at ?? "") !== Date.parse(range.from) ||
      Date.parse(data.to ?? data.to_at ?? "") !== Date.parse(range.to) ||
      !Array.isArray(data.buckets)) throw invalid();

  let previousEnd = Date.parse(range.from);
  const points = [...data.buckets]
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at))
    .map((bucket): ChartPoint => {
      const start = Date.parse(bucket.start_at), end = Date.parse(bucket.end_at);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start !== previousEnd ||
          end <= start || end > Date.parse(range.to) || typeof bucket.label !== "string" ||
          !["measured", "derived", "partial", "missing", "pending"].includes(bucket.quality)) throw invalid();
      previousEnd = end;
      const value = number(bucket.yield_kwh);
      if (((bucket.quality === "measured" || bucket.quality === "derived") && value === null) ||
          (value !== null && value < 0)) throw invalid();
      return {
        label: bucket.label,
        startAt: bucket.start_at,
        endAt: bucket.end_at,
        value: bucket.quality === "missing" || bucket.quality === "pending" ? null : value,
        quality: bucket.quality,
      };
    });
  const completeBuckets = points.filter((point) => point.quality === "measured" || point.quality === "derived").length;
  const pendingBuckets = points.filter((point) => point.quality === "pending").length;
  const truncated = data.truncated === true || previousEnd !== Date.parse(range.to);
  return {
    points,
    complete: data.complete === true && response.meta?.is_partial !== true && !truncated &&
      points.every((point) => point.quality !== "missing" && point.quality !== "partial"),
    truncated, completeBuckets, elapsedBuckets: points.length - pendingBuckets, pendingBuckets,
  };
}
