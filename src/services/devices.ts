import { request } from "./fleet.ts";

export const DEVICE_TYPES = {
  inverter: "Inverter", dongle: "Dongle", ess: "ESS", meter: "Meter",
  logger: "Logger", emi: "EMI", optimizer: "Optimizer", unknown: "Unknown",
};
export type DeviceType = keyof typeof DEVICE_TYPES;
export type DeviceStatus = "normal" | "faulty" | "disconnected" | "unknown";
export interface InventoryDevice {
  id: string;
  sourceId: string | null;
  name: string;
  plantName: string;
  type: DeviceType;
  status: DeviceStatus;
  software: string | null;
  sn: string | null;
  parentId: string | null;
  parentName: string | null;
  model: string | null;
  lastSeen: string | null;
  optimizerQuantity: number | null;
}
export interface DeviceFilters { type: string; name: string; sn: string; status: string; model: string }
export const EMPTY_DEVICE_FILTERS: DeviceFilters = { type: "", name: "", sn: "", status: "", model: "" };

export function normalizeDevices(rows: unknown[], plantCode: string, plantName: string): InventoryDevice[] {
  const devices = new Map<string, InventoryDevice>();
  rows.forEach((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const raw = value as Record<string, unknown>;
    const text = (...keys: string[]) => {
      for (const key of keys) {
        const item = raw[key];
        if (typeof item === "string" && item.trim()) return item.trim();
        if (typeof item === "number" && Number.isFinite(item)) return String(item);
      }
      return null;
    };
    const scope = text("plant_code", "stationCode");
    if (scope && scope !== plantCode) return;
    const sourceId = text("device_id", "id", "devDn"), sn = text("device_sn", "esnCode", "sn");
    const id = sourceId ? `id:${sourceId}` : sn ? `sn:${sn}` : `unidentified:${index}`;
    if (devices.has(id)) return;
    const type = text("device_type")?.toLowerCase();
    const state = text("status")?.toLowerCase();
    const status: DeviceStatus = state === "normal" || state === "online" ? "normal" :
      state === "faulty" || state === "fault" || state === "alarm" ? "faulty" :
        state === "disconnected" || state === "offline" ? "disconnected" : "unknown";
    const quantity = raw.optimizer_quantity ?? raw.optimizerNumber;
    const optimizerQuantity = typeof quantity === "number" && Number.isInteger(quantity) && quantity >= 0 ? quantity : null;
    devices.set(id, {
      id, sourceId, name: text("device_name", "devName", "name") ?? sn ?? sourceId ?? "Unnamed device",
      plantName: text("plant_name", "stationName") ?? plantName,
      type: type && Object.hasOwn(DEVICE_TYPES, type) ? type as DeviceType : "unknown", status,
      software: text("software_version", "softwareVersion", "firmware_version"), sn,
      parentId: text("parent_device_id", "parent_id", "parentId"),
      parentName: text("parent_device_name", "parent_name", "parentName"),
      model: text("model"), lastSeen: text("last_seen_at"), optimizerQuantity,
    });
  });
  const result = [...devices.values()];
  for (const device of result) {
    if (!device.parentName && device.parentId) {
      device.parentName = result.find((parent) => parent.id !== device.id && (parent.sourceId === device.parentId || parent.sn === device.parentId))?.name ?? null;
    }
  }
  return result;
}

export async function getDevices(code: string, plantName: string, signal?: AbortSignal) {
  const result = await request<unknown>(`/api/devices/${encodeURIComponent(code)}`, signal);
  if (!Array.isArray(result.data)) throw new Error("Format inventory perangkat tidak valid.");
  const devices = normalizeDevices(result.data, code, plantName);
  return { devices, warning: result.meta?.is_partial ? "Inventory perangkat masih parsial." :
    devices.length < result.data.length ? "Sebagian record duplikat/tidak valid atau di luar PLTS ini tidak ditampilkan." : "" };
}

export function filterDevices(devices: InventoryDevice[], filters: DeviceFilters) {
  const includes = (value: string | null, search: string) => (value ?? "").toLowerCase().includes(search.trim().toLowerCase());
  return devices.filter((device) => (!filters.type || device.type === filters.type) && includes(device.name, filters.name) &&
    includes(device.sn, filters.sn) && (!filters.status || device.status === filters.status) && includes(device.model, filters.model));
}

export type DeviceSortKey = "name" | "plantName" | "type" | "software" | "sn" | "parentName" | "status";
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export function sortDevices(devices: InventoryDevice[], key: DeviceSortKey, direction: "asc" | "desc") {
  return [...devices].sort((left, right) => {
    const a = left[key], b = right[key];
    if (a === null) return b === null ? 0 : 1;
    if (b === null) return -1;
    return collator.compare(a, b) * (direction === "asc" ? 1 : -1) || collator.compare(left.id, right.id);
  });
}
