import { request } from "./fleet.ts";
import { DEVICE_TYPES } from "./devices.ts";
import type { DeviceType, InventoryDevice } from "./devices.ts";

export const ALARM_SEVERITIES = { critical: "Critical", major: "Major", minor: "Minor", warning: "Warning", unclassified: "Unclassified" };
export type AlarmSeverity = keyof typeof ALARM_SEVERITIES;
export type AlarmState = "active" | "cleared";
export interface MonitoringAlarm {
  id: string;
  alarmId: string | null;
  vendorId: string | null;
  plantName: string;
  deviceId: string | null;
  deviceName: string | null;
  deviceType: DeviceType;
  sn: string | null;
  severity: AlarmSeverity;
  state: AlarmState | "unknown";
  acknowledged: boolean | null;
  name: string | null;
  description: string | null;
  occurredAt: string | null;
  clearedAt: string | null;
}
export interface AlarmFilters { deviceType: string; sn: string; name: string; alarmId: string; start: string; end: string }
export const EMPTY_ALARM_FILTERS: AlarmFilters = { deviceType: "", sn: "", name: "", alarmId: "", start: "", end: "" };
export interface AlarmSnapshot {
  alarms: MonitoringAlarm[];
  configured: boolean;
  complete: boolean;
  expectedTotal: number | null;
  collectedAt: string | null;
  warnings: string[];
}
interface AlarmEnvelope {
  data: unknown[];
  configured?: boolean;
  total?: number | null;
  quality?: string;
  collected_at?: string | null;
  collectedAt?: string | null;
  coverage?: { complete?: boolean };
  meta?: { is_partial?: boolean; total_pages?: number | null };
}

function sourceText(raw: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}
export function alarmTimestamp(value: string | null) {
  return value && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
}

export function normalizeAlarms(rows: unknown[], code: string, plantName: string): MonitoringAlarm[] {
  return rows.flatMap((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const raw = value as Record<string, unknown>;
    const scope = sourceText(raw, "plant_code", "plantCode", "stationCode");
    if (scope && scope !== code) return [];
    const severity = sourceText(raw, "severity", "level")?.toLowerCase();
    const state = sourceText(raw, "state")?.toLowerCase();
    const type = sourceText(raw, "device_type")?.toLowerCase();
    const alarmId = sourceText(raw, "alarm_id"), vendorId = sourceText(raw, "vendor_alarm_id");
    const deviceId = sourceText(raw, "device_id"), sn = sourceText(raw, "device_sn", "sn", "esnCode");
    const occurredAt = sourceText(raw, "occurred_at", "occurredAt", "occurrence_time");
    const name = sourceText(raw, "name", "alarm_name");
    const id = JSON.stringify([code, alarmId ?? vendorId ?? name ?? index, deviceId ?? sn, occurredAt, state]);
    return [{ id, alarmId, vendorId, plantName: sourceText(raw, "plant_name") ?? plantName, deviceId,
      deviceName: sourceText(raw, "device_name", "devName"),
      deviceType: type && Object.hasOwn(DEVICE_TYPES, type) ? type as DeviceType : "unknown", sn,
      severity: severity && Object.hasOwn(ALARM_SEVERITIES, severity) ? severity as AlarmSeverity : "unclassified",
      state: state === "active" || state === "cleared" ? state : "unknown",
      acknowledged: typeof raw.acknowledged === "boolean" ? raw.acknowledged : null,
      name, description: sourceText(raw, "description"), occurredAt, clearedAt: sourceText(raw, "cleared_at", "clearedAt") }];
  });
}

export function enrichAlarmDevices(alarms: MonitoringAlarm[], devices: InventoryDevice[]) {
  const ids = new Map(devices.filter((device) => device.sourceId !== null).map((device) => [device.sourceId, device]));
  const serials = new Map(devices.filter((device) => device.sn !== null).map((device) => [device.sn, device]));
  return alarms.map((alarm) => {
    const byId = alarm.deviceId ? ids.get(alarm.deviceId) : undefined;
    const bySn = alarm.sn ? serials.get(alarm.sn) : undefined;
    const conflict = byId && alarm.sn && byId.sn && byId.sn !== alarm.sn ||
      bySn && alarm.deviceId && bySn.sourceId && bySn.sourceId !== alarm.deviceId;
    const device = conflict ? undefined : byId ?? bySn;
    return { ...alarm, deviceName: alarm.deviceName ?? device?.name ?? null,
      deviceType: alarm.deviceType === "unknown" ? device?.type ?? "unknown" : alarm.deviceType, sn: alarm.sn ?? device?.sn ?? null };
  });
}

// The per-plant route keeps legacy requests unpaginated. Explicit pages provide a
// bounded fallback if a backend version paginates the response by default.
export async function getAlarmSnapshot(code: string, plantName: string, state: AlarmState, signal?: AbortSignal): Promise<AlarmSnapshot> {
  const path = `/api/alarms/${encodeURIComponent(code)}`;
  const first: AlarmEnvelope = await request<unknown[]>(`${path}?${new URLSearchParams({ state })}`, signal);
  if (!Array.isArray(first.data)) throw new Error("Format data alarm tidak valid.");
  if (first.configured !== true) return { alarms: [], configured: false, complete: false, expectedTotal: null,
    collectedAt: first.collected_at ?? first.collectedAt ?? null,
    warnings: [first.configured === false ? "Sumber alarm PLTS belum dikonfigurasi. Jumlah alarm belum diketahui." : "Cakupan alarm belum terverifikasi dari backend."] };
  const total = typeof first.total === "number" && Number.isInteger(first.total) && first.total >= 0 ? first.total : null;
  let complete = first.quality === "fresh" && first.coverage?.complete !== false && first.meta?.is_partial !== true;
  let raw = first.data;
  const warnings: string[] = [];
  if (total !== null && raw.length < total) {
    raw = [];
    const seenPages = new Set<string>();
    for (let page = 1; page <= 20; page++) {
      if (signal?.aborted) throw signal.reason;
      const envelope: AlarmEnvelope = await request<unknown[]>(`${path}?${new URLSearchParams({ state, page: String(page), page_size: "100" })}`, signal);
      if (!Array.isArray(envelope.data)) throw new Error("Format halaman alarm tidak valid.");
      if (envelope.configured !== true) { complete = false; warnings.push("Cakupan alarm berubah saat pemuatan."); break; }
      complete = complete && envelope.quality === "fresh" && envelope.coverage?.complete !== false && envelope.meta?.is_partial !== true;
      const fingerprint = JSON.stringify(envelope.data);
      if (!envelope.data.length || seenPages.has(fingerprint)) { complete = false; warnings.push("Pagination alarm belum mengembalikan seluruh rekaman."); break; }
      seenPages.add(fingerprint); raw.push(...envelope.data);
      if (envelope.total !== total) { complete = false; warnings.push("Jumlah alarm berubah saat pemuatan. Muat ulang untuk snapshot terbaru."); break; }
      if (raw.length >= total) break;
    }
    if (raw.length < total) { complete = false; warnings.push(`Data parsial: ${raw.length}/${total} rekaman diterima; maksimum 20 halaman tambahan per pemuatan.`); }
  }
  const normalized = normalizeAlarms(raw, code, plantName);
  const matching = normalized.filter((alarm) => alarm.state === state);
  const alarms = [...new Map(matching.map((alarm) => [alarm.id, alarm])).values()];
  if (alarms.length !== raw.length) { complete = false; warnings.push("Record duplikat, tidak valid, di luar PLTS, atau tanpa state yang sesuai tidak ditampilkan."); }
  if (total === null || alarms.length !== total) complete = false;
  if (!complete && !warnings.length) warnings.push("Data alarm masih parsial atau freshness belum terverifikasi. Angka yang tersedia merupakan batas bawah.");
  return { alarms, configured: true, complete, expectedTotal: total, collectedAt: first.collected_at ?? first.collectedAt ?? null, warnings };
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>();
export function formatAlarmTime(value: string | null, zone: string): string | null {
  const timestamp = alarmTimestamp(value);
  if (timestamp === null) return null;
  let formatter = timeFormatters.get(zone);
  if (!formatter) { formatter = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }); timeFormatters.set(zone, formatter); }
  const parts = formatter.formatToParts(new Date(timestamp));
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
}

export function validAlarmRange(start: string, end: string) {
  const valid = (value: string) => !value || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + ":00Z")) && new Date(value + ":00Z").toISOString().slice(0, 16) === value;
  return valid(start) && valid(end) && (!start || !end || start <= end);
}
export function filterAlarms(alarms: MonitoringAlarm[], filters: AlarmFilters, zone: string) {
  const includes = (value: string | null, search: string) => (value ?? "").toLowerCase().includes(search.trim().toLowerCase());
  return alarms.filter((alarm) => {
    if (filters.deviceType && alarm.deviceType !== filters.deviceType || !includes(alarm.sn, filters.sn) ||
        !includes(alarm.name, filters.name) || !includes(`${alarm.alarmId ?? ""} ${alarm.vendorId ?? ""}`, filters.alarmId)) return false;
    if (filters.start || filters.end) {
      const local = formatAlarmTime(alarm.occurredAt, zone)?.replace(" ", "T").slice(0, 16);
      if (!local || filters.start && local < filters.start || filters.end && local > filters.end) return false;
    }
    return true;
  });
}
export function alarmFiltersHaveCoverage(alarms: MonitoringAlarm[], filters: AlarmFilters) {
  return !alarms.some((alarm) => filters.deviceType && alarm.deviceType === "unknown" || filters.sn && alarm.sn === null ||
    filters.name && alarm.name === null || filters.alarmId && alarm.alarmId === null && alarm.vendorId === null ||
    (filters.start || filters.end) && alarmTimestamp(alarm.occurredAt) === null);
}
export type AlarmSortKey = "severity" | "plantName" | "deviceType" | "deviceName" | "sn" | "alarmId" | "name" | "occurredAt";
const severityOrder = { critical: 0, major: 1, minor: 2, warning: 3, unclassified: 4 };
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export function sortAlarms(alarms: MonitoringAlarm[], key: AlarmSortKey, direction: "asc" | "desc") {
  return [...alarms].sort((left, right) => {
    const a = key === "severity" ? severityOrder[left.severity] : key === "occurredAt" ? alarmTimestamp(left.occurredAt) : left[key];
    const b = key === "severity" ? severityOrder[right.severity] : key === "occurredAt" ? alarmTimestamp(right.occurredAt) : right[key];
    if (a === null) return b === null ? 0 : 1;
    if (b === null) return -1;
    const comparison = typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b));
    return comparison * (direction === "asc" ? 1 : -1) || collator.compare(left.id, right.id);
  });
}
