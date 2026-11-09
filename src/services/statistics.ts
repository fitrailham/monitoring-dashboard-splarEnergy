import { jakartaDate, number } from "./fleet";
import type { HistoryRow } from "./fleet";
export type Period = "Day" | "Month" | "Year" | "Lifetime";
export interface ChartPoint {
  label: string;
  value: number | null;
}
export function historyBuckets(
  history: HistoryRow[],
  period: Period,
  date: string,
): ChartPoint[] {
  const daily = new Map<string, number>();
  for (const row of history) {
    const value = number(row.yield_today_kwh);
    if (value === null || !Number.isFinite(new Date(row.recorded_at).getTime()))
      continue;
    const day = jakartaDate(row.recorded_at);
    daily.set(day, Math.max(daily.get(day) ?? 0, value));
  }
  if (period === "Day") {
    const hours = new Map<number, { time: number; value: number }>();
    for (const row of history) {
      const value = number(row.yield_today_kwh),
        time = new Date(row.recorded_at).getTime();
      if (
        value === null ||
        !Number.isFinite(time) ||
        jakartaDate(row.recorded_at) !== date
      )
        continue;
      const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date(time)),
      );
      if (!hours.has(hour) || hours.get(hour)!.time < time)
        hours.set(hour, { time, value });
    }
    return Array.from({ length: 24 }, (_, i) => ({
      label: String(i).padStart(2, "0"),
      value: hours.get(i)?.value ?? null,
    }));
  }
  if (period === "Month") {
    const length = new Date(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)),
      0,
    ).getDate();
    return Array.from({ length }, (_, i) => ({
      label: String(i + 1).padStart(2, "0"),
      value:
        daily.get(`${date.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`) ??
        null,
    }));
  }
  const totals = new Map<string, number>();
  for (const [day, value] of daily) {
    if (period === "Year" && !day.startsWith(date.slice(0, 4))) continue;
    const key = period === "Year" ? day.slice(5, 7) : day.slice(0, 4);
    totals.set(key, (totals.get(key) ?? 0) + value);
  }
  return period === "Year"
    ? Array.from({ length: 12 }, (_, i) => ({
        label: new Intl.DateTimeFormat("en", { month: "short" }).format(
          new Date(2026, i, 1),
        ),
        value: totals.get(String(i + 1).padStart(2, "0")) ?? null,
      }))
    : [...totals]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label, value }));
}
