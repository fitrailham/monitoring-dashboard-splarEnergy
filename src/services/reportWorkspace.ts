import type { PlantReportRow } from "./reports.ts";

export const REPORT_TABS = [
  { id: "plant", label: "Plant Report" },
  { id: "inverter", label: "Inverter Report" },
  { id: "pcs", label: "PCS Report" },
  { id: "battery", label: "Battery Report" },
  { id: "pvess", label: "PV&ESS Report" },
] as const;

export type ReportType = typeof REPORT_TABS[number]["id"];
export type ReportDimension = "time" | "plant" | "site" | "device";
export type WorkspaceField = "period" | "plantName" | "deviceName" | "capacity" | "yield" |
  "totalYield" | "specificEnergy" | "peakAcPower" | "pvYield" | "inverterYield" |
  "exportEnergy" | "revenue" | "charge" | "discharge";
export interface WorkspaceColumn { key: WorkspaceField; title: string; digits?: number }
export interface WorkspaceRow {
  id: string;
  values: Partial<Record<WorkspaceField, string | number | null>>;
  quality: string;
  fieldQuality?: Partial<Record<WorkspaceField, string>>;
  deviceId?: string;
  deviceSn?: string | null;
}

const plantColumn: WorkspaceColumn = { key: "plantName", title: "Plant Name" };
const deviceColumn: WorkspaceColumn = { key: "deviceName", title: "Device Name" };
export function workspaceColumns(report: ReportType, dimension: ReportDimension): WorkspaceColumn[] {
  if (report === "plant") return [
    dimension === "plant" ? plantColumn : { key: "period", title: "Statistical Period" },
    { key: "pvYield", title: "PV Yield (kWh)", digits: 3 },
    { key: "inverterYield", title: "Inverter Yield (kWh)", digits: 3 },
    { key: "exportEnergy", title: "Export (kWh)", digits: 3 },
    { key: "revenue", title: "Revenue (Rp)", digits: 2 },
  ];
  if (report === "battery") return [plantColumn, ...(dimension === "device" ? [deviceColumn] : []),
    { key: "charge", title: "Charge (kWh)", digits: 3 },
    { key: "discharge", title: "Discharge (kWh)", digits: 3 }];
  if (report === "pcs") return [plantColumn, deviceColumn,
    { key: "discharge", title: "Discharge (kWh)", digits: 3 },
    { key: "totalYield", title: "Total Yield (kWh)", digits: 3 },
    { key: "peakAcPower", title: "Peak AC Power (kW)", digits: 3 },
    { key: "charge", title: "Charge (kWh)", digits: 3 }];
  return [plantColumn, deviceColumn,
    { key: "capacity", title: "Total String Capacity (kWp)", digits: 3 },
    { key: "yield", title: "Yield (kWh)", digits: 3 },
    { key: "totalYield", title: "Total Yield (kWh)", digits: 3 },
    { key: "specificEnergy", title: "Specific Energy (kWh/kWp)", digits: 3 },
    { key: "peakAcPower", title: "Peak AC Power (kW)", digits: 3 }];
}

function sumKnown(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return known.length ? known.reduce((sum, value) => sum + value, 0) : null;
}

// Interval energy can be added within the selected period. Lifetime counters,
// capacity and peak power need their own source and must never be inferred here.
export function inverterWorkspaceRows(rows: PlantReportRow[], plantName: string, complete: boolean): WorkspaceRow[] {
  const groups = new Map<string, PlantReportRow[]>();
  for (const row of rows) {
    if (!row.deviceId || row.quality === "pending") continue;
    const group = groups.get(row.deviceId) ?? [];
    group.push(row);
    groups.set(row.deviceId, group);
  }
  return [...groups.entries()].map(([deviceId, members]) => {
    const value = sumKnown(members.map((row) => row.inverterYield));
    const usable = complete && members.every((row) => row.inverterYield !== null && ["measured", "derived"].includes(row.quality));
    return { id: deviceId, deviceId, deviceSn: members[0].deviceSn, quality: value === null ? "missing" : usable ? "derived" : "partial",
      values: { plantName, deviceName: members[0].deviceName ?? deviceId, yield: value,
        capacity: null, totalYield: null, specificEnergy: null, peakAcPower: null } };
  });
}

export function plantWorkspaceRows(rows: PlantReportRow[], plantName: string, dimension: ReportDimension): WorkspaceRow[] {
  if (dimension !== "plant") return rows.map((row) => ({ id: row.id, quality: row.quality,
    fieldQuality: { inverterYield: row.inverterQuality ?? "missing" },
    values: { period: row.period, pvYield: row.pvYield, inverterYield: row.inverterYield,
      exportEnergy: row.exportEnergy, revenue: row.revenue } }));
  if (!rows.length) return [];
  const complete = rows.every((row) => ["measured", "derived"].includes(row.quality));
  const inverterComplete = rows.every((row) => ["measured", "derived"].includes(row.inverterQuality ?? "missing"));
  return [{ id: "plant-total", quality: complete ? "derived" : "partial",
    fieldQuality: { inverterYield: inverterComplete ? "derived" : "partial" },
    values: { plantName, pvYield: sumKnown(rows.map((row) => row.pvYield)),
      inverterYield: sumKnown(rows.map((row) => row.inverterYield)), exportEnergy: null, revenue: null } }];
}

export function sortWorkspaceRows(rows: WorkspaceRow[], field: WorkspaceField, direction: "asc" | "desc") {
  return [...rows].sort((a, b) => {
    const left = a.values[field] ?? null, right = b.values[field] ?? null;
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    const order = typeof left === "number" && typeof right === "number" ? left - right :
      String(left).localeCompare(String(right), "en", { numeric: true });
    return order * (direction === "asc" ? 1 : -1);
  });
}
