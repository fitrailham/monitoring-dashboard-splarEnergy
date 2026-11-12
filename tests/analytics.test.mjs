import assert from "node:assert/strict";
import { test } from "node:test";
import { devicePerformanceRows, getDeviceHistory, getInverterReport, getPowerStatistics } from "../src/services/analytics.ts";
import { mergeInverterYield } from "../src/services/reports.ts";

const range = {from: "2026-11-11T17:00:00.000Z", to: "2026-11-11T17:10:00.000Z", timeZone: "Asia/Jakarta", grain: "hour"};
const bounds = {from_at: range.from, to_at: range.to, time_zone: range.timeZone};
function mock(t, handler) {
  const previous = globalThis.fetch;
  t.after(() => {globalThis.fetch = previous;});
  globalThis.fetch = async (url, init) => new Response(JSON.stringify(await handler(new URL(url), init)), {status: 200});
}
const coverage = (quality) => ({quality, expected_samples: 1, valid_samples: quality === "measured" ? 1 : 0});
function power() {
  return {success: true, data: {...bounds, plant_code: "P1", unit: "kW", aggregation: "last", resolution_minutes: 5,
    complete: false, truncated: false, buckets: [
      {start_at: range.from, end_at: "2026-11-11T17:05:00.000Z", quality: "partial", pv_power_kw: 0, grid_power_kw: -2, load_power_kw: 9,
        coverage: {pv_power_kw: coverage("measured"), grid_power_kw: coverage("measured"), load_power_kw: coverage("unverified")}},
      {start_at: "2026-11-11T17:05:00.000Z", end_at: range.to, quality: "pending", pv_power_kw: 90, coverage: {pv_power_kw: coverage("measured")}},
    ]}, meta: {is_partial: true}};
}
test("range power requests scoped date boundaries and preserves zero, signed values and per-field quality", async (t) => {
  mock(t, (url) => {
    assert.equal(url.pathname, "/api/database/power-statistics");
    assert.equal(url.searchParams.get("plant_code"), "P1");
    assert.equal(url.searchParams.get("from"), range.from);
    assert.equal(url.searchParams.get("resolution_minutes"), "5");
    assert.equal(url.searchParams.get("aggregation"), "last");
    return power();
  });
  const result = await getPowerStatistics("P1", range);
  assert.equal(result.points[0].pv, 0);
  assert.equal(result.points[0].grid, -2);
  assert.equal(result.points[0].load, null);
  assert.equal(result.points[1].pv, null);
  assert.equal(result.points[0].label, "00:00");
  assert.equal(result.complete, false);
});
test("power rejects mismatched scope and overlapping buckets and marks a truncated range incomplete", async (t) => {
  let data = power(); mock(t, () => data);
  data.data.plant_code = "P2";
  await assert.rejects(getPowerStatistics("P1", range), /Kontrak/);
  data = power(); data.data.buckets[1].start_at = range.from;
  await assert.rejects(getPowerStatistics("P1", range), /Bucket/);
  data = power(); data.data.complete = true; data.meta.is_partial = false; data.data.buckets.pop();
  assert.equal((await getPowerStatistics("P1", range)).complete, false);
});
const row = (id, value = 0) => ({plant_code: "P1", device_id: id, device_key: "key-"+id, device_name: "Inverter "+id, device_sn: "00"+id,
  start_at: range.from, end_at: range.to, inverter_yield_kwh: value, quality: "derived"});
const report = (rows, total=rows.length) => ({success: true, ...bounds, data: rows, total, grain: "hour", unit: "kWh",
  aggregation: "interval_energy", complete: true, totals: {total_rows: total, inverter_yield_kwh: 5}, meta: {is_partial: false}});
test("inverter report follows pagination before returning rows or export and uses totals before pagination", async (t) => {
  const pages = [];
  mock(t, (url) => {
    const page = Number(url.searchParams.get("page")); pages.push(page);
    assert.equal(url.searchParams.get("plant_code"), "P1");
    return report([row(page === 1 ? "I1" : "I2", page === 1 ? 0 : 5)], 2);
  });
  const result = await getInverterReport("P1", range);
  assert.deepEqual(pages, [1,2]); assert.equal(result.rows[0].inverterYield, 0);
  assert.equal(result.rows[0].pvYield, null); assert.equal(result.yield, 5);
  assert.equal(result.complete, true);
});
test("inverter scope, duplicate pages and changing totals cannot produce a complete report", async (t) => {
  let value = report([row("I1")], 2); mock(t, () => value);
  await assert.rejects(getInverterReport("P1", range), /duplikat/);
  await assert.rejects(getInverterReport("P1", range, "OTHER"), /lingkup/);
  let calls=0; globalThis.fetch = async () => new Response(JSON.stringify(report([row("I"+(++calls))], calls === 1 ? 2 : 3)));
  await assert.rejects(getInverterReport("P1", range), /berubah/);
});
test("plant report sums inverter intervals separately from PV and keeps missing inverter coverage partial", () => {
  const base={id:"p",timestamp:0,quality:"measured",pvYield:10, inverterYield:null};
  const members=[{...base,id:"i1",inverterYield:0},{...base,id:"i2",inverterYield:null,quality:"missing"}];
  const [merged]=mergeInverterYield([base],members);
  assert.equal(merged.pvYield,10); assert.equal(merged.inverterYield,0); assert.equal(merged.inverterQuality,"partial");
  assert.equal(mergeInverterYield([base],[])[0].inverterYield,null);
});
const sample=(id) => ({sample_id:id, measured_at:range.from,collected_at:range.to,measurement_time_verified:true, active_power_kw:0,
  grid_power_kw:-3, field_quality:{}, power_direction_convention:"grid_import_battery_discharge_positive",status:"normal"});
test("device history requires plant scope, uses vendor ID, follows pages and preserves sample identity", async (t) => {
  mock(t,(url) => {
    assert.equal(decodeURIComponent(url.pathname),"/api/devices/VENDOR/1/history");
    assert.equal(url.searchParams.get("plant_code"),"P1");
    const page=url.searchParams.get("page");
    return {success:true,...bounds,plant_code:"P1",device_id:"VENDOR/1",units:{power:"kW",energy:"kWh"},total:2,data:[sample(page)]};
  });
  const result=await getDeviceHistory("P1","VENDOR/1",range);
  assert.equal(result.samples.length,2);
  await assert.rejects(getDeviceHistory("P1","VENDOR/1",{...range,to:"2027-01-01T00:00:00Z"}),/31 hari/);
});
test("device CSV never exports unverified numeric measurements or unverified signed power as valid values", () => {
  const rows=devicePerformanceRows("P1","I1",[sample("1"),{...sample("2"),measurement_time_verified:false},
    {...sample("3"),power_direction_convention:"unverified",field_quality:{active_power_kw:"SOURCE_UNAVAILABLE"}}]);
  assert.equal(rows[1][6],0); assert.equal(rows[1][9],-3);
  assert.equal(rows[2][6],null); assert.equal(rows[2][9],null);
  assert.equal(rows[3][6],null); assert.equal(rows[3][9],null);
});
