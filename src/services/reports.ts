import { calendarDate } from "./calendar.ts";
import type { ChartPoint } from "./statistics.ts";

export interface PlantReportRow {
  id: string;
  period: string;
  timestamp: number;
  pvYield: number | null;
  inverterYield: number | null;
  exportEnergy: number | null;
  revenue: number | null;
  quality: ChartPoint["quality"];
}
export type ReportColumn = "period" | "pvYield" | "inverterYield" | "exportEnergy" | "revenue";

export function plantReportRows(points: ChartPoint[], zone: string): PlantReportRow[] {
  return points.flatMap((point, index) => {
    if (point.quality === "pending") return [];
    const time = point.startAt ? Date.parse(point.startAt) : NaN;
    const period = Number.isFinite(time) ? `${calendarDate(time, zone)} ${new Intl.DateTimeFormat("en-GB", {
      timeZone: zone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).format(new Date(time))}` : point.label;
    return [{ id: point.startAt ?? `${index}-${point.label}`, period, timestamp: Number.isFinite(time) ? time : index,
      pvYield: point.quality === "missing" ? null : point.value,
      inverterYield: null, exportEnergy: null, revenue: null, quality: point.quality }];
  });
}

export function sortReportRows(rows: PlantReportRow[], column: ReportColumn, direction: "asc" | "desc") {
  return [...rows].sort((a, b) => {
    const left = column === "period" ? a.timestamp : a[column];
    const right = column === "period" ? b.timestamp : b[column];
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return (left - right) * (direction === "asc" ? 1 : -1) || a.timestamp - b.timestamp;
  });
}
