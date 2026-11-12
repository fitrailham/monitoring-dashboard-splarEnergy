import { calendarDate } from "./calendar.ts";
import { number } from "./fleet.ts";
import type { Numeric } from "./fleet.ts";

export interface PowerSample {
  recorded_at: string;
  measured_at?: string | null;
  measurement_time_verified?: boolean;
  pv_power_kw: Numeric;
  load_power_kw: Numeric;
  grid_power_kw: Numeric;
}
export interface PowerPoint {
  label: string;
  pv: number | null;
  grid: number | null;
  load: number | null;
  battery?: number | null;
  startAt?: string;
  endAt?: string;
  quality?: "measured" | "derived" | "partial" | "missing" | "pending";
  fieldQuality?: Record<string, string>;
}
export function hourlyPower(rows: PowerSample[], date: string, zone: string): PowerPoint[] {
  return powerTimeline(rows, date, zone, 60);
}

export function powerTimeline(rows: PowerSample[], date: string, zone: string, stepMinutes = 5): PowerPoint[] {
  if (!Number.isInteger(stepMinutes) || stepMinutes < 1 || stepMinutes > 60 || 1440 % stepMinutes !== 0)
    throw new Error("Interval grafik daya tidak valid.");
  const hours = new Map<number, { time: number; row: PowerSample }>();
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (const row of rows) {
    const timestamp = row.measured_at ?? row.recorded_at;
    const time = Date.parse(timestamp);
    if (!row.measurement_time_verified || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) ||
        !Number.isFinite(time) || calendarDate(time, zone) !== date) continue;
    const [hourValue, minute] = formatter.format(new Date(time)).split(":").map(Number);
    const hour = Math.floor((hourValue * 60 + minute) / stepMinutes);
    if (!hours.has(hour) || hours.get(hour)!.time < time) hours.set(hour, { time, row });
  }
  return Array.from({ length: 1440 / stepMinutes }, (_, hour) => {
    const row = hours.get(hour)?.row;
    const minute = hour * stepMinutes;
    return { label: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
      pv: number(row?.pv_power_kw), grid: number(row?.grid_power_kw), load: number(row?.load_power_kw) };
  });
}

export function trendCsv(rows: (string | number | null)[][]) {
  return "\uFEFF" + rows.map((row) => row.map((value) => {
    let text = value === null ? "" : String(value);
    if (typeof value === "string" && /^(?:\s*[=+@-]|[\t\r\n])/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
}
