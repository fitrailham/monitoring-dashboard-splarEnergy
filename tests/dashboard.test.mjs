import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countAlarmSeverities, countPlantStatuses, formatDashboardMetric, getDashboardAlarms,
  getDashboardOverview, getDashboardPlants, isDashboardDataStale,
} from "../src/services/dashboard.ts";

const response = (data, extra = {}) => Response.json({ success: true, data, ...extra });

test("dashboard overview uses the versioned endpoint, preserves zero and rejects malformed KPI values", async (t) => {
  let value = 0;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/api/v1/dashboard/overview");
    assert.equal(url.searchParams.get("date"), "2026-11-19");
    assert.equal(url.searchParams.get("time_zone"), "Asia/Jakarta");
    assert.equal(options.credentials, "include");
    return response({ kpis: { current_power_kw: value, revenue_today_idr: null },
      updated_at: "2026-11-19T08:35:00+07:00" });
  });
  const snapshot = await getDashboardOverview("2026-11-19");
  assert.equal(snapshot.value.kpis.current_power_kw, 0);
  assert.equal(snapshot.value.kpis.revenue_today_idr, null);
  assert.equal(snapshot.updatedAt, Date.parse("2026-11-19T01:35:00Z"));
  value = "invalid";
  await assert.rejects(getDashboardOverview("2026-11-19"), /invalid KPI/);
});

test("overview does not report response generation as a verified source update", async (t) => {
  let updatedAt = null;
  const generatedAt = "2026-11-19T02:00:00Z";
  t.mock.method(globalThis, "fetch", async () => response({
    kpis: { inverter_rated_power_kw: 25 }, updated_at: updatedAt,
  }, { meta: { generated_at: generatedAt } }));
  assert.equal((await getDashboardOverview("2026-11-19")).updatedAt, null);
  updatedAt = undefined;
  assert.equal((await getDashboardOverview("2026-11-19")).updatedAt, Date.parse(generatedAt));
});

test("plant status aggregates all pages and counts missing or unrecognized states separately", async (t) => {
  const rows = ["normal", "faulty", "disconnected", undefined, "other"].map((status, i) => ({
    plant_code: `P${i}`, plant_name: `Plant ${i}`, status,
  }));
  const request = t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    const page = Number(url.searchParams.get("page"));
    assert.equal(url.pathname, "/api/v1/plants");
    assert.equal(url.searchParams.get("snapshot_id"), page === 1 ? null : "plants");
    return response(rows.slice((page - 1) * 3, page * 3), {
      total: 5, meta: { page, total_pages: 2, snapshot_id: "plants" },
    });
  });
  const snapshot = await getDashboardPlants();
  assert.deepEqual(countPlantStatuses(snapshot.value), { normal: 1, faulty: 1, disconnected: 1, unknown: 2 });
  assert.equal(request.mock.callCount(), 2);
});

test("mixed pagination snapshots are rejected instead of replacing the preceding cache", async (t) => {
  t.mock.method(globalThis, "fetch", async (input) => {
    const page = Number(new URL(input).searchParams.get("page"));
    return response([{ plant_code: `P${page}`, plant_name: "Plant" }], {
      total: 2, meta: { page, total_pages: 2, snapshot_id: `snapshot-${page}` },
    });
  });
  await assert.rejects(getDashboardPlants(), /incomplete or invalid dataset/);
});

test("active alarms count only the received snapshot and expose backend repair advice and timestamps", async (t) => {
  let configured = true;
  t.mock.method(globalThis, "fetch", async (input) => {
    assert.equal(new URL(input).pathname, "/api/v1/alarms/active");
    return configured ? response([
      { alarm_id: "A1", plant_code: "P1", severity: "Major", name: "Grid Fault", state: "active",
        acknowledged: true, device_name: "Inverter 1", occurred_at: "2026-11-19T08:00:00+07:00",
        repair_suggestion: "Contact site maintenance." },
      { alarm_id: "A2", plant_code: "P1", state: "active", severity: "warning" },
    ], { configured, total: 2, quality: "partial", coverage: { complete: false, stale_plants: 1 } })
      : response([], { configured: false, total: null });
  });
  const { value: result, stale } = await getDashboardAlarms();
  assert.deepEqual(countAlarmSeverities(result.alarms), { critical: 0, major: 1, minor: 0, warning: 1, unclassified: 0 });
  assert.equal(result.alarms[0].deviceName, "Inverter 1");
  assert.equal(result.alarms[0].occurredAt, "2026-11-19T08:00:00+07:00");
  assert.equal(result.alarms[0].repairSuggestion, "Contact site maintenance.");
  assert.equal(result.complete, false);
  assert.equal(stale, true);
  configured = false;
  await assert.rejects(getDashboardAlarms(), /not configured/);
});

test("an alarm count of zero requires a verified snapshot or empty plant scope", async (t) => {
  let envelope = { configured: true, quality: "missing", total: null, coverage: { complete: false, expected_plants: 1 } };
  t.mock.method(globalThis, "fetch", async () => response([], { ...envelope, meta: { page: 1, total_pages: 0 } }));
  await assert.rejects(getDashboardAlarms(), /Alarm data is unavailable/);

  envelope = { ...envelope, total: 0, quality: "fresh", coverage: { complete: true, expected_plants: 1 } };
  assert.deepEqual((await getDashboardAlarms()).value.alarms, []);

  envelope = { ...envelope, quality: "missing", coverage: { complete: true, expected_plants: 0 } };
  const { value } = await getDashboardAlarms();
  assert.deepEqual(value.alarms, []);
  assert.equal(value.complete, true);
});

test("KPI formatting scales by magnitude, localizes numbers and differentiates missing from zero", () => {
  const units = ["kWh", "MWh", "GWh"];
  assert.deepEqual(formatDashboardMetric(null, units, "en-US"), { amount: "—", unit: "kWh" });
  assert.deepEqual(formatDashboardMetric(0, units, "en-US"), { amount: "0.00", unit: "kWh" });
  assert.deepEqual(formatDashboardMetric(1_280, units, "id-ID"), { amount: "1,28", unit: "MWh" });
  assert.deepEqual(formatDashboardMetric(2_750_000, units, "en-US"), { amount: "2.75", unit: "GWh" });
  assert.deepEqual(formatDashboardMetric(1_500_000, ["Rp"], "en-US", true), { amount: "1.5M", unit: "Rp" });
  assert.equal(isDashboardDataStale(0, 599_999), false);
  assert.equal(isDashboardDataStale(0, 600_000), true);
});
