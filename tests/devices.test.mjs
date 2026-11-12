import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_DEVICE_FILTERS, filterDevices, getDevices, normalizeDevices, sortDevices } from "../src/services/devices.ts";

test("device inventory preserves zero IDs and leading-zero serials while normalizing explicit device types", () => {
  const [device] = normalizeDevices([{ id: 0, devName: "Inverter 1", esnCode: "001234", device_type: "Inverter", status: "online", optimizer_quantity: 0 }], "P1", "Plant 1");
  assert.equal(device.sourceId, "0");
  assert.equal(device.sn, "001234");
  assert.equal(device.type, "inverter");
  assert.equal(device.status, "normal");
  assert.equal(device.optimizerQuantity, 0);
  assert.equal(device.software, null);
});

test("inventory timestamps and vendor numeric codes do not imply online status or a device type", () => {
  const [device] = normalizeDevices([{ device_id: "1", devTypeId: 1, last_seen_at: "2026-11-12T00:00:00Z" }], "P1", "Plant 1");
  assert.equal(device.status, "unknown");
  assert.equal(device.type, "unknown");
  assert.equal(device.parentName, null);
});

test("superior equipment is resolved only from an explicit parent relationship", () => {
  const devices = normalizeDevices([
    { device_id: "d", device_name: "Dongle", device_type: "dongle" },
    { device_id: "i1", device_name: "Inverter 1", parent_device_id: "d" },
    { device_id: "i2", device_name: "Inverter 2" },
  ], "P1", "Plant 1");
  assert.equal(devices[1].parentName, "Dongle");
  assert.equal(devices[2].parentName, null);
});

test("invalid, duplicate and out-of-scope inventory records cannot create duplicate selections", () => {
  const devices = normalizeDevices([null, false, [], { device_id: "a", plant_code: "P2" },
    { device_id: "b", device_name: "First" }, { device_id: "b", device_name: "Duplicate" }], "P1", "Plant 1");
  assert.equal(devices.length, 1);
  assert.equal(devices[0].name, "First");
});

test("device filters combine type, name, serial, model and status without changing inventory", () => {
  const devices = normalizeDevices([
    { device_id: "a", device_name: "Roof Inverter", device_type: "inverter", device_sn: "00123", model: "SUN-X", status: "normal" },
    { device_id: "b", device_name: "Roof Inverter 2", device_type: "inverter", device_sn: "00456", model: "SUN-X", status: "offline" },
  ], "P1", "Plant 1");
  const filtered = filterDevices(devices, { ...EMPTY_DEVICE_FILTERS, type: "inverter", name: " roof ", sn: "001", model: "sun", status: "normal" });
  assert.deepEqual(filtered.map((device) => device.sourceId), ["a"]);
  assert.equal(devices.length, 2);
});

test("device sorting is natural and leaves unavailable software last in either direction", () => {
  const devices = normalizeDevices([
    { device_id: "a", device_name: "Inverter 10", software_version: "V10" },
    { device_id: "b", device_name: "Inverter 2", software_version: "V2" },
    { device_id: "c", device_name: "Inverter 3" },
  ], "P1", "Plant 1");
  assert.deepEqual(sortDevices(devices, "name", "asc").map((device) => device.name), ["Inverter 2", "Inverter 3", "Inverter 10"]);
  assert.deepEqual(sortDevices(devices, "software", "asc").map((device) => device.software), ["V2", "V10", null]);
  assert.deepEqual(sortDevices(devices, "software", "desc").map((device) => device.software), ["V10", "V2", null]);
  assert.equal(devices[0].name, "Inverter 10");
});

test("inventory API scopes requests to the encoded plant and exposes partial coverage", async (t) => {
  t.mock.method(globalThis, "fetch", async (input) => {
    assert.equal(new URL(input).pathname, "/api/devices/PLANT%3DA%26B");
    return Response.json({ success: true, data: [{ device_id: "a", device_sn: "0001", device_type: "inverter" }], meta: { is_partial: true } });
  });
  const result = await getDevices("PLANT=A&B", "Plant 1");
  assert.equal(result.devices[0].sn, "0001");
  assert.equal(result.devices[0].status, "unknown");
  assert.match(result.warning, /parsial/);
});

test("an invalid inventory envelope is not reported as an empty healthy inventory", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ success: true, data: {} }));
  await assert.rejects(getDevices("P1", "Plant 1"), /Format inventory/);
});
