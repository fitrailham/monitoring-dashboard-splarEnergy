import assert from "node:assert/strict";
import { test } from "node:test";
import { cvBand, cvFromSummary, cvGroupTrend, cvRange, getCvAnalysis, parseCvData } from "../src/services/cvAnalysis.ts";

const query = { fromDate: "2026-11-01", toDate: "2026-11-07", deviceId: "" };
const row = (overrides = {}) => ({ date: "2026-11-07", device_id: "INV1", device_name: "Inverter 1", comparison_group: "Group A", mean_value: 10,
  stddev_value: 1, comparable_count: 3, cv_percent: 10, deviation_percent: -5, quality: "derived", ...overrides });
const payload = (rows = [row()], overrides = {}) => ({ plant_code: "P1", analysis_type: "inverter", ...cvRange(query, "Asia/Jakarta"),
  time_zone: "Asia/Jakarta", metric: "normalized_power", unit: "kW/kWp", method: "backend_population_cv", comparison_basis: "Same model, capacity and measurement window", complete: true, rows, ...overrides });

test("CV distinguishes legitimate zero variability from zero mean and insufficient comparison members", () => {
  assert.equal(cvFromSummary(10, 0, 2), 0);
  assert.equal(cvFromSummary(10, 1, 3), 10);
  for (const [mean, sd, count] of [[0, 0, 3], [null, 1, 3], [-1, 1, 3], [1, -1, 3], [1, 0, 1], [1, 0, 2.5]]) assert.equal(cvFromSummary(mean, sd, count), null);
});

test("CV range uses inclusive local dates and an exclusive end boundary", () => {
  const range = cvRange({ ...query, fromDate: "2024-02-28", toDate: "2024-03-01" }, "Asia/Makassar");
  assert.equal(range.days, 3); assert.equal(range.from, "2024-02-27T16:00:00.000Z"); assert.equal(range.to, "2024-03-01T16:00:00.000Z");
  assert.throws(() => cvRange({ ...query, fromDate: "2026-02-30" }, "Asia/Jakarta"));
  assert.throws(() => cvRange({ ...query, fromDate: "2020-01-01" }, "Asia/Jakarta"), /366/);
  assert.throws(() => cvRange({ ...query, fromDate: "2026-11-08" }, "Asia/Jakarta"));
});

test("CV response validates plant, scope, period, comparison metadata and unique identities", () => {
  const result = parseCvData(payload(), "P1", "inverter", query, "Asia/Jakarta");
  assert.equal(result.rows[0].cv, 10); assert.equal(result.rows[0].deviation, -5); assert.equal(result.complete, true);
  for (const data of [payload([], { plant_code: "OTHER" }), payload([], { analysis_type: "string" }), payload([], { comparison_basis: "" }),
    payload([], { from: "2026-11-01T00:00:00" }), payload([row(), row()]), payload([row({ date: "2026-10-01" })])]) {
    assert.throws(() => parseCvData(data, "P1", "inverter", query, "Asia/Jakarta"), /Format analisis/);
  }
});

test("invalid CV statistics stay unavailable and cannot masquerade as normal zero results", () => {
  for (const overrides of [{ mean_value: 0, cv_percent: 0 }, { comparable_count: 1, cv_percent: 0 }, { cv_percent: 99 }, { quality: "missing", cv_percent: 10 }]) {
    const result = parseCvData(payload([row(overrides)]), "P1", "inverter", query, "Asia/Jakarta");
    assert.equal(result.rows[0].cv, null); assert.equal(result.rows[0].quality, "missing"); assert.equal(result.complete, false);
  }
  assert.equal(parseCvData(payload([row({ stddev_value: 0, cv_percent: 0 })]), "P1", "inverter", query, "Asia/Jakarta").rows[0].cv, 0);
});

test("string analysis requires a real string identity and honors device scope", () => {
  const data = payload([row({ string_id: "PV1" })], { analysis_type: "string" });
  assert.equal(parseCvData(data, "P1", "string", query, "Asia/Jakarta").rows[0].stringId, "PV1");
  assert.throws(() => parseCvData(payload([row()], { analysis_type: "string" }), "P1", "string", query, "Asia/Jakarta"));
  assert.throws(() => parseCvData(data, "P1", "string", { ...query, deviceId: "INV2" }, "Asia/Jakarta"));
});

test("trend never averages incompatible groups or inconsistent group statistics", () => {
  const data = parseCvData(payload([row(), row({ device_id: "INV2" }), row({ device_id: "INV3", comparison_group: "Group B", cv_percent: 20, stddev_value: 2 })]), "P1", "inverter", query, "Asia/Jakarta");
  assert.deepEqual(cvGroupTrend(data.rows, "Group A").map((point) => point.value), [10]);
  assert.deepEqual(cvGroupTrend(data.rows, "").map((point) => point.value), []);
  const invalid = parseCvData(payload([row(), row({ device_id: "INV2", mean_value: 20, stddev_value: 2 })]), "P1", "inverter", query, "Asia/Jakarta");
  assert.equal(invalid.complete, false); assert.equal(cvGroupTrend(invalid.rows, "Group A")[0].value, null);
});

test("CV display bands have explicit boundaries and preserve unavailable values", () => {
  assert.deepEqual([0, 5, 5.1, 10, 20, 20.1, null].map(cvBand), ["low", "low", "mid", "mid", "high", "upper", null]);
});

test("CV endpoint remains unconfigured rather than guessing results from aggregate plant history", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected request"); });
  const result = await getCvAnalysis("P1", "inverter", query, "Asia/Jakarta", undefined, "");
  assert.equal(result.status, "unconfigured"); assert.equal(result.complete, false); assert.equal(mock.mock.callCount(), 0);
});

test("configured CV requests use the selected window, zone and device and propagate partial coverage", async (t) => {
  const selected = { ...query, deviceId: "INV1" };
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/api/cv-analysis"); assert.equal(url.searchParams.get("device_id"), "INV1");
    assert.equal(url.searchParams.get("time_zone"), "Asia/Jakarta"); assert.equal(url.searchParams.get("from"), cvRange(query, "Asia/Jakarta").from);
    return Response.json({ success: true, data: payload(), meta: { is_partial: true } });
  });
  const result = await getCvAnalysis("P1", "inverter", selected, "Asia/Jakarta", undefined, "/api/cv-analysis");
  assert.equal(result.rows[0].cv, 10); assert.equal(result.complete, false);
  await assert.rejects(getCvAnalysis("P1", "inverter", query, "Asia/Jakarta", undefined, "https://example.com/cv"), /path relatif/);
});
