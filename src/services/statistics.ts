import { calendarDate, calendarMidnight, DEFAULT_TIME_ZONE } from "./calendar.ts";
export type Period = "Day" | "Month" | "Year" | "Lifetime";
export interface ChartPoint {
  label: string;
  value: number | null;
  startAt?: string;
  endAt?: string;
  quality: "measured" | "derived" | "partial" | "missing" | "pending";
}
export interface StatisticsRange {
  from: string;
  to: string;
  grain: "hour" | "day" | "month" | "year";
  timeZone: string;
}
export function statisticsRange(
  period: Period, date: string, timeZone = DEFAULT_TIME_ZONE, now = new Date(),
): StatisticsRange {
  const [year, month, day] = date.split("-").map(Number);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || year < 1970 || year > 2100 ||
      new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date) {
    throw new Error("Tanggal statistik tidak valid.");
  }
  let start = [year, month, day], end = [year, month, day + 1];
  let grain: StatisticsRange["grain"] = "hour";
  if (period === "Month") {
    start = [year, month, 1]; end = [year, month + 1, 1]; grain = "day";
  } else if (period === "Year") {
    start = [year, 1, 1]; end = [year + 1, 1, 1]; grain = "month";
  } else if (period === "Lifetime") {
    // Historical bound for the monitoring archive; never a fixed number of rows.
    start = [1970, 1, 1];
    end = [Number(calendarDate(now, timeZone).slice(0, 4)) + 1, 1, 1];
    grain = "year";
  }
  return {
    from: calendarMidnight(start[0], start[1], start[2], timeZone),
    to: calendarMidnight(end[0], end[1], end[2], timeZone),
    grain, timeZone,
  };
}
