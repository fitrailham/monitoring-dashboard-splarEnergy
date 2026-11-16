import assert from "node:assert/strict";
import { test } from "node:test";
import { inverterWorkspaceRows, plantWorkspaceRows, sortWorkspaceRows } from "../src/services/reportWorkspace.ts";

const row = (deviceId, value, quality = "measured", timestamp = 0) => ({
  id: `${deviceId}-${timestamp}`, deviceId, deviceName: `Inverter ${deviceId}`, deviceSn: "000123",
  timestamp, period: String(timestamp), pvYield: value, inverterYield: value,
  exportEnergy: null, revenue: null, quality, inverterQuality: quality,
});

test("device reports add interval energy per device without inventing lifetime, capacity or power", () => {
  const result = inverterWorkspaceRows([row("A", 0), row("A", 4, "derived", 1), row("B", 7), row("A", 100, "pending", 2)], "Plant", true);
  assert.equal(result.length, 2);
  assert.equal(result[0].values.yield, 4);
  assert.equal(result[1].values.yield, 7);
  assert.equal(result[0].deviceSn, "000123");
  for (const key of ["totalYield", "capacity", "specificEnergy", "peakAcPower"]) assert.equal(result[0].values[key], null);
});

test("period summaries preserve measured zero, missing values and partial coverage", () => {
  const result = inverterWorkspaceRows([row("zero", 0), row("missing", null, "missing"), row("partial", 3), row("partial", null, "missing", 1)], "Plant", true);
  assert.equal(result[0].values.yield, 0);
  assert.equal(result[0].quality, "derived");
  assert.equal(result[1].values.yield, null);
  assert.equal(result[1].quality, "missing");
  assert.equal(result[2].values.yield, 3);
  assert.equal(result[2].quality, "partial");
  assert.equal(inverterWorkspaceRows([row("A", 3)], "Plant", false)[0].quality, "partial");
});

test("plant grouping keeps PV and inverter totals independent and does not create a zero for an absent source", () => {
  const [result] = plantWorkspaceRows([
    { ...row("A", 2), inverterYield: 4 },
    { ...row("A", null, "missing", 1), inverterYield: null },
  ], "Plant", "plant");
  assert.equal(result.values.pvYield, 2);
  assert.equal(result.values.inverterYield, 4);
  assert.equal(result.values.exportEnergy, null);
  assert.equal(result.values.revenue, null);
  assert.equal(result.quality, "partial");
  assert.equal(result.fieldQuality.inverterYield, "partial");
  assert.deepEqual(plantWorkspaceRows([], "Plant", "plant"), []);
});

test("report sorting is numeric for energy and puts unknowns last in either direction", () => {
  const rows = inverterWorkspaceRows([row("A", 12), row("B", null, "missing"), row("C", 2)], "Plant", true);
  assert.deepEqual(sortWorkspaceRows(rows, "yield", "asc").map((item) => item.values.yield), [2, 12, null]);
  assert.deepEqual(sortWorkspaceRows(rows, "yield", "desc").map((item) => item.values.yield), [12, 2, null]);
  assert.deepEqual(rows.map((item) => item.values.yield), [12, null, 2]);
});
