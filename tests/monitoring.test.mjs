import assert from "node:assert/strict";
import { test } from "node:test";
import { hourlyPower, powerTimeline, trendCsv } from "../src/services/monitoring.ts";

const sample = (recorded_at, values = {}) => ({ recorded_at, measurement_time_verified: true,
  pv_power_kw: 20, grid_power_kw: -5, load_power_kw: 15, ...values });

test("monitoring uses the latest verified reading in each local hour and preserves signed power", () => {
  const points = hourlyPower([
    sample("2026-11-12T00:05:00Z"),
    sample("2026-11-12T00:55:00Z", { pv_power_kw: "24.5", load_power_kw: null }),
    sample("2026-11-12T00:59:00Z", { measurement_time_verified: false, pv_power_kw: 999 }),
  ], "2026-11-12", "Asia/Jakarta");
  assert.equal(points.length, 24);
  assert.deepEqual(points[7], { label: "07:00", pv: 24.5, grid: -5, load: null });
  assert.equal(points[8].pv, null);
});

test("monitoring respects plant timezone and excludes ambiguous timestamps and other days", () => {
  const points = hourlyPower([
    sample("2026-11-11T16:30:00Z", { pv_power_kw: 0 }),
    sample("2026-11-12T00:40:00", { pv_power_kw: 999 }),
    sample("invalid"), sample("2026-11-10T00:00:00Z"),
  ], "2026-11-12", "Asia/Makassar");
  assert.equal(points[0].pv, 0);
  assert.equal(points.filter((point) => point.pv !== null).length, 1);
});

test("missing power remains null instead of fabricated zero", () => {
  const points = hourlyPower([], "2026-11-12", "Asia/Jakarta");
  assert.ok(points.every((point) => point.pv === null && point.load === null && point.grid === null));
});

test("Trend bins verified samples per five minutes while preserving gaps and measured zero", () => {
  const points = powerTimeline([
    sample("2026-11-12T00:06:00Z", { pv_power_kw: 0 }),
    sample("2026-11-12T00:08:00Z", { pv_power_kw: 4 }),
    sample("2026-11-12T00:09:00Z", { measurement_time_verified: false, pv_power_kw: 999 }),
    sample("2026-11-12T00:15:00Z", { pv_power_kw: 0 }),
  ], "2026-11-12", "Asia/Jakarta");
  assert.equal(points.length, 288);
  assert.deepEqual(points[85], { label: "07:05", pv: 4, grid: -5, load: 15 });
  assert.equal(points[86].pv, null);
  assert.equal(points[87].pv, 0);
  assert.equal(points[287].label, "23:55");
});

test("Trend rejects intervals that cannot form a complete day", () => {
  for (const interval of [0, -1, 7, 90, 2.5]) assert.throws(() => powerTimeline([], "2026-11-12", "Asia/Jakarta", interval));
});

test("CSV preserves blank and negative measurements and escapes names and spreadsheet formulas", () => {
  const csv = trendCsv([["plant_name", "power_kw", "missing"], ['Plant "A", B', -5, null], ["=1+1", 0, "line\nbreak"]]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"Plant ""A"", B","-5",""'));
  assert.ok(csv.includes('"\'=1+1","0","line\nbreak"'));
  assert.ok(trendCsv([["  =1+1", -12]]).includes('"\'  =1+1","-12"'));
});
