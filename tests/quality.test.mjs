import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateMetric, telemetryFreshness, telemetryLabel } from "../src/services/quality.ts";

const now = Date.parse("2026-11-11T05:00:00Z");
function plant(overrides = {}) {
  return {
    plant_code: "TEST", plant_name: "Test", capacity_kwp: 100,
    recorded_at: "2026-11-11T04:55:00Z", measured_at: "2026-11-11T04:55:00Z",
    measurement_time_verified: true, timestamp_source: "device", time_zone: "Asia/Jakarta",
    pv_power_kw: 25, yield_today_kwh: 150, total_yield_kwh: 10000,
    ...overrides,
  };
}

test("telemetry ages continue advancing even without a new API response", () => {
  assert.equal(telemetryFreshness(plant(), now).state, "fresh");
  const later = telemetryFreshness(plant(), now + 20 * 60000);
  assert.equal(later.state, "stale");
  assert.match(telemetryLabel(later), /25 menit/);
});

test("collector timestamps, missing offsets and future measurements cannot prove freshness", () => {
  assert.equal(telemetryFreshness(plant({ measured_at: null, timestamp_source: "collector", measurement_time_verified: false }), now).state, "unverified");
  assert.equal(telemetryFreshness(plant({ measured_at: "2026-11-11T04:55:00" }), now).state, "unverified");
  assert.equal(telemetryFreshness(plant({ measured_at: "2026-11-11T06:00:00Z" }), now).state, "unverified");
  assert.equal(telemetryFreshness(plant({ measured_at: null, recorded_at: null }), now).state, "missing");
});

test("verified measured_at is independent of collector time and honors the server stale threshold", () => {
  const sample = plant({ timestamp_source: "collector", data_quality: {
    measured_at: "2026-11-11T04:55:00Z", measurement_time_verified: true,
    state: "fresh", stale_after_seconds: 120,
  } });
  assert.equal(telemetryFreshness(sample, now).state, "stale");
});

test("KPI coverage excludes stale, missing and unverified values while preserving measured zero", () => {
  const result = aggregateMetric([
    plant(), plant({ pv_power_kw: 0 }),
    plant({ measured_at: "2026-11-11T04:00:00Z" }),
    plant({ pv_power_kw: null }),
    plant({ measurement_time_verified: false }),
  ], "pv_power_kw", now);
  assert.equal(result.value, 25);
  assert.equal(result.valid, 2);
  assert.equal(result.expected, 5);
  assert.equal(result.stale, 1);
  assert.equal(result.missing, 1);
  assert.equal(result.unverified, 1);
  assert.equal(result.partial, true);
});

test("metadata capacity remains usable when telemetry is stale; demo and inapplicable plants are excluded", () => {
  const result = aggregateMetric([
    plant({ measured_at: "2026-11-01T00:00:00Z" }),
    plant({ is_demo: true }), plant({ has_pv: false }),
  ], "capacity_kwp", now);
  assert.equal(result.value, 100);
  assert.equal(result.expected, 1);
  assert.equal(result.valid, 1);
  assert.equal(result.demo, 1);
  assert.equal(result.notApplicable, 1);
});

test("yesterday's yield cannot enter today's KPI, including the local midnight boundary", () => {
  const midnight = Date.parse("2026-11-10T17:02:00Z");
  const result = aggregateMetric([
    plant({ measured_at: "2026-11-10T16:59:00Z" }),
    plant({ measured_at: "2026-11-10T17:01:00Z", yield_business_date: "2026-11-10" }),
    plant({ measured_at: "2026-11-10T17:01:00Z", yield_today_kwh: 0 }),
  ], "yield_today_kwh", midnight);
  assert.equal(result.value, 0);
  assert.equal(result.valid, 1);
  assert.equal(result.stale, 2);
});

test("missing fields and per-field unverified states cannot be counted as valid numeric values", () => {
  const result = aggregateMetric([
    plant({ data_quality: { missing_fields: ["pv_power_kw"] } }),
    plant({ data_quality: { field_quality: { pv_power_kw: "TIME_UNVERIFIED" } } }),
  ], "pv_power_kw", now);
  assert.equal(result.value, null);
  assert.equal(result.missing, 1);
  assert.equal(result.unverified, 1);
});

test("empty and entirely missing metrics do not become a verified zero", () => {
  assert.equal(aggregateMetric([], "pv_power_kw", now).value, null);
  assert.equal(aggregateMetric([plant({ pv_power_kw: " " })], "pv_power_kw", now).value, null);
});

test("each plant's business date uses its own time zone", () => {
  const midnightMakassar = Date.parse("2026-11-10T16:02:00Z");
  const result = aggregateMetric([
    plant({ measured_at: "2026-11-10T16:01:00Z", time_zone: "Asia/Makassar", yield_business_date: "2026-11-11" }),
    plant({ measured_at: "2026-11-10T16:01:00Z", time_zone: "Asia/Jakarta", yield_business_date: "2026-11-11" }),
  ], "yield_today_kwh", midnightMakassar);
  assert.equal(result.value, 150);
  assert.equal(result.valid, 1);
  assert.equal(result.stale, 1);
});

test("per-field stale and not-applicable states have separate coverage counts", () => {
  const result = aggregateMetric([
    plant({ data_quality: { field_quality: { pv_power_kw: "STALE" } } }),
    plant({ data_quality: { field_quality: { pv_power_kw: "NOT_APPLICABLE" } } }),
  ], "pv_power_kw", now);
  assert.equal(result.stale, 1);
  assert.equal(result.notApplicable, 1);
  assert.equal(result.expected, 1);
  assert.equal(result.value, null);
});
