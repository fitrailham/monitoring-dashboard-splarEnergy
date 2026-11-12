import assert from "node:assert/strict";
import { test } from "node:test";
import { alarmFiltersHaveCoverage, alarmTimestamp, EMPTY_ALARM_FILTERS, enrichAlarmDevices, filterAlarms, formatAlarmTime,
  getAlarmSnapshot, normalizeAlarms, sortAlarms, validAlarmRange } from "../src/services/alarms.ts";
import { normalizeDevices } from "../src/services/devices.ts";

const raw = (overrides = {}) => ({ alarm_id: "A1", vendor_alarm_id: "V1", plant_code: "P1", device_id: "D1",
  severity: "major", state: "active", acknowledged: false, name: "Grid issue", occurred_at: "2026-11-11T17:00:30Z", ...overrides });
const envelope = (rows = [], overrides = {}) => ({ success: true, configured: true, quality: "fresh", total: rows.length,
  data: rows, coverage: { complete: true }, meta: { is_partial: false }, ...overrides });

test("alarm normalization preserves zero IDs and does not equate acknowledged with cleared", () => {
  const [alarm] = normalizeAlarms([raw({ alarm_id: 0, device_sn: "00012", acknowledged: true, state: null, severity: "vendor-1" })], "P1", "Plant 1");
  assert.equal(alarm.alarmId, "0"); assert.equal(alarm.sn, "00012");
  assert.equal(alarm.state, "unknown"); assert.equal(alarm.acknowledged, true);
  assert.equal(alarm.severity, "unclassified");
});

test("inventory enrichment uses explicit IDs or serials and leaves unmatched metadata unknown", () => {
  const alarms = normalizeAlarms([raw(), raw({ alarm_id: "A2", device_id: "D2" })], "P1", "Plant 1");
  const devices = normalizeDevices([{ device_id: "D1", device_name: "Inverter 1", device_sn: "0001", device_type: "inverter" }], "P1", "Plant 1");
  const enriched = enrichAlarmDevices(alarms, devices);
  assert.equal(enriched[0].deviceName, "Inverter 1"); assert.equal(enriched[0].deviceType, "inverter"); assert.equal(enriched[0].sn, "0001");
  assert.equal(enriched[1].deviceName, null); assert.equal(enriched[1].deviceType, "unknown");
  assert.equal(alarms[0].deviceName, null);
});

test("conflicting device ID and serial cannot attach another device's metadata to an alarm", () => {
  const alarms = normalizeAlarms([raw({ device_id: "D1", device_sn: "SN2" })], "P1", "Plant 1");
  const devices = normalizeDevices([
    { device_id: "D1", device_sn: "SN1", device_type: "inverter", device_name: "Inverter 1" },
    { device_id: "D2", device_sn: "SN2", device_type: "dongle", device_name: "Dongle 2" },
  ], "P1", "Plant 1");
  const [alarm] = enrichAlarmDevices(alarms, devices);
  assert.equal(alarm.deviceName, null); assert.equal(alarm.deviceType, "unknown"); assert.equal(alarm.sn, "SN2");
});

test("configured fresh empty alarms are verified zero", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json(envelope()));
  const result = await getAlarmSnapshot("P1", "Plant 1", "active");
  assert.equal(result.configured, true); assert.equal(result.complete, true);
  assert.equal(result.expectedTotal, 0); assert.deepEqual(result.alarms, []);
});

test("unconfigured and unverified empty sources never become verified zero", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => Response.json(envelope([], { configured: false, total: null })));
  const unavailable = await getAlarmSnapshot("P1", "Plant 1", "active");
  assert.equal(unavailable.configured, false); assert.equal(unavailable.complete, false); assert.equal(unavailable.expectedTotal, null);
  mock.mock.restore();
  t.mock.method(globalThis, "fetch", async () => Response.json(envelope([], { quality: "unverified" })));
  assert.equal((await getAlarmSnapshot("P1", "Plant 1", "active")).complete, false);
});

test("historical alarms request cleared state and never include active or unknown states", async (t) => {
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/api/alarms/P%3D1%26B"); assert.equal(url.searchParams.get("state"), "cleared");
    return Response.json(envelope([raw({ plant_code: "P=1&B", state: "cleared" }), raw({ alarm_id: "A2", plant_code: "P=1&B", acknowledged: true })]));
  });
  const result = await getAlarmSnapshot("P=1&B", "Plant 1", "cleared");
  assert.equal(result.alarms.length, 1); assert.equal(result.alarms[0].state, "cleared"); assert.equal(result.complete, false);
});

test("alarm pagination is loaded before reporting complete counts", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    if (!url.searchParams.has("page")) return Response.json(envelope([raw()], { total: 2 }));
    assert.equal(url.searchParams.get("page_size"), "100");
    return Response.json(envelope([raw(), raw({ alarm_id: "A2" })]));
  });
  const result = await getAlarmSnapshot("P1", "Plant 1", "active");
  assert.equal(mock.mock.callCount(), 2); assert.equal(result.alarms.length, 2); assert.equal(result.complete, true);
});

test("repeated pages stop pagination and remain partial", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => Response.json(envelope([raw()], { total: 3 })));
  const result = await getAlarmSnapshot("P1", "Plant 1", "active");
  assert.equal(mock.mock.callCount(), 3); assert.equal(result.alarms.length, 1); assert.equal(result.complete, false);
  assert.ok(result.warnings.length);
});

test("large paginated sources expose the page limit instead of claiming complete coverage", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async (input) => {
    const page = Number(new URL(input).searchParams.get("page") ?? 0);
    return Response.json(envelope([raw({ alarm_id: `A${page}` })], { total: 5000 }));
  });
  const result = await getAlarmSnapshot("P1", "Plant 1", "active");
  assert.equal(mock.mock.callCount(), 21); assert.equal(result.alarms.length, 20); assert.equal(result.complete, false);
  assert.match(result.warnings.join(" "), /20 halaman/);
});

test("duplicate records and stale coverage cannot be counted as a complete snapshot", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json(envelope([raw(), raw()], { quality: "stale" })));
  const result = await getAlarmSnapshot("P1", "Plant 1", "active");
  assert.equal(result.alarms.length, 1); assert.equal(result.complete, false);
});

test("alarm filters combine metadata and a local occurrence range with an inclusive ending minute", () => {
  const alarms = normalizeAlarms([
    raw({ device_type: "inverter", device_sn: "0001", occurred_at: "2026-11-11T16:00:59Z" }),
    raw({ alarm_id: "A2", device_type: "inverter", device_sn: "0001", occurred_at: "2026-11-11T16:01:00Z" }),
    raw({ alarm_id: "A3", device_type: "inverter", device_sn: "0001", occurred_at: "2026-11-12T00:00:00" }),
  ], "P1", "Plant 1");
  const filters = { ...EMPTY_ALARM_FILTERS, deviceType: "inverter", sn: "000", name: " GRID ", alarmId: "V1", start: "2026-11-12T00:00", end: "2026-11-12T00:00" };
  assert.deepEqual(filterAlarms(alarms, filters, "Asia/Makassar").map((alarm) => alarm.alarmId), ["A1"]);
  assert.equal(alarmFiltersHaveCoverage(alarms, filters), false);
});

test("occurrence range rejects inverted and invalid calendar values", () => {
  assert.equal(validAlarmRange("", ""), true);
  assert.equal(validAlarmRange("2026-11-12T00:00", "2026-11-12T23:59"), true);
  assert.equal(validAlarmRange("2026-11-13T00:00", "2026-11-12T23:59"), false);
  assert.equal(validAlarmRange("2026-02-30T00:00", ""), false);
  assert.equal(alarmTimestamp("2026-11-12T00:00:00"), null);
  assert.equal(formatAlarmTime("1970-01-01T00:00:00Z", "Asia/Jakarta"), "1970-01-01 07:00:00");
});

test("alarm sorting prioritizes severity and always puts unknown times last", () => {
  const alarms = normalizeAlarms([
    raw({ severity: "warning", occurred_at: null }), raw({ alarm_id: "A2", severity: "critical" }),
    raw({ alarm_id: "A3", severity: "minor", occurred_at: "2026-11-12T00:00:00Z" }),
  ], "P1", "Plant 1");
  assert.deepEqual(sortAlarms(alarms, "severity", "asc").map((alarm) => alarm.severity), ["critical", "minor", "warning"]);
  for (const direction of ["asc", "desc"]) assert.equal(sortAlarms(alarms, "occurredAt", direction).at(-1).occurredAt, null);
  assert.equal(alarms[0].severity, "warning");
});

test("malformed alarm responses cannot silently become zero alarms", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ ...envelope(), data: {} }));
  await assert.rejects(getAlarmSnapshot("P1", "Plant 1", "active"), /Format data alarm/);
});
