import assert from "node:assert/strict";
import { test } from "node:test";
import { statisticsRange } from "../src/services/statistics.ts";
import { getYieldStatistics } from "../src/services/yieldStatistics.ts";

test("calendar ranges use exclusive ends, leap days and the plant time zone", () => {
  assert.deepEqual(statisticsRange("Day", "2026-11-11"), {
    from: "2026-11-10T17:00:00.000Z", to: "2026-11-11T17:00:00.000Z",
    grain: "hour", timeZone: "Asia/Jakarta",
  });
  const february = statisticsRange("Month", "2024-02-29", "Asia/Makassar");
  assert.equal(february.from, "2024-01-31T16:00:00.000Z");
  assert.equal(february.to, "2024-02-29T16:00:00.000Z");
  assert.equal((Date.parse(february.to) - Date.parse(february.from)) / 86400000, 29);
  assert.equal(statisticsRange("Day", "2026-12-31").to, "2026-12-31T17:00:00.000Z");
  assert.equal(statisticsRange("Year", "2026-11-11").to, "2026-12-31T17:00:00.000Z");
  assert.throws(() => statisticsRange("Day", "2026-02-29"), /Tanggal/);
});

test("calendar ranges respect daylight saving instead of assuming a fixed 24 hours", () => {
  const range = statisticsRange("Day", "2026-03-08", "America/New_York");
  assert.equal((Date.parse(range.to) - Date.parse(range.from)) / 3600000, 23);
});

test("lifetime requests the archive, independent of the selected date and record count", () => {
  const range = statisticsRange("Lifetime", "2026-11-11", "Asia/Jakarta", new Date("2026-12-31T18:00:00Z"));
  assert.equal(range.from, "1969-12-31T17:00:00.000Z");
  assert.equal(range.to, "2027-12-31T17:00:00.000Z");
  assert.equal(range.grain, "year");
});

function fixture(range) {
  const start = Date.parse(range.from);
  return { success: true, data: {
    aggregation: "interval_energy", unit: "kWh", grain: range.grain,
    time_zone: range.timeZone, from: range.from, to: range.to,
    complete: true,
    buckets: Array.from({ length: 24 }, (_, hour) => ({
      start_at: new Date(start + hour * 3600000).toISOString(),
      end_at: new Date(start + (hour + 1) * 3600000).toISOString(),
      label: String(hour).padStart(2, "0"), yield_kwh: hour, quality: "derived",
    })),
  }, meta: { is_partial: false } };
}

test("statistics API requests the selected range and preserves zero, missing and pending buckets", async (t) => {
  const range = statisticsRange("Day", "2026-11-11");
  const body = fixture(range);
  body.data.buckets[1].quality = "missing";
  body.data.buckets[2].quality = "pending";
  body.data.complete = false;
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/api/database/yield-statistics");
    assert.equal(url.searchParams.get("plant_code"), "PLANT=A&B");
    assert.equal(url.searchParams.get("from"), range.from);
    assert.equal(url.searchParams.get("to"), range.to);
    assert.equal(url.searchParams.get("grain"), "hour");
    assert.equal(url.searchParams.get("time_zone"), "Asia/Jakarta");
    assert.equal(url.searchParams.has("limit"), false);
    assert.ok(init.signal instanceof AbortSignal);
    return Response.json(body);
  });
  const result = await getYieldStatistics("PLANT=A&B", range, controller.signal);
  assert.equal(result.points[0].value, 0);
  assert.equal(result.points[1].value, null);
  assert.equal(result.points[2].value, null);
  assert.equal(result.complete, false);
  assert.equal(result.completeBuckets, 22);
  assert.equal(result.elapsedBuckets, 23);
  assert.equal(result.pendingBuckets, 1);
});

test("cumulative or wrong-range responses cannot be presented as interval energy", async (t) => {
  const range = statisticsRange("Day", "2026-11-11");
  for (const change of [
    (body) => { body.data.aggregation = "cumulative"; },
    (body) => { body.data.to = "2026-11-12T17:00:00Z"; },
    (body) => { body.data.buckets.splice(2, 1); },
    (body) => { body.data.buckets[2].yield_kwh = null; },
  ]) {
    const body = fixture(range); change(body);
    const mock = t.mock.method(globalThis, "fetch", async () => Response.json(body));
    await assert.rejects(getYieldStatistics("PLANT", range), /Format statistik/);
    mock.mock.restore();
  }
});

test("server truncation and incomplete tails stay explicitly partial", async (t) => {
  const range = statisticsRange("Day", "2026-11-11");
  const body = fixture(range);
  body.data.buckets.pop();
  t.mock.method(globalThis, "fetch", async () => Response.json(body));
  const result = await getYieldStatistics("PLANT", range);
  assert.equal(result.complete, false);
  assert.equal(result.truncated, true);
});

test("a server partial flag overrides an otherwise complete set of intervals", async (t) => {
  const range = statisticsRange("Day", "2026-11-11");
  const body = fixture(range);
  body.meta.is_partial = true;
  t.mock.method(globalThis, "fetch", async () => Response.json(body));
  assert.equal((await getYieldStatistics("PLANT", range)).complete, false);
});

test("cancelling a period request propagates cancellation instead of a misleading connection error", async (t) => {
  const range = statisticsRange("Day", "2026-11-11");
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async (_input, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  const pending = getYieldStatistics("PLANT", range, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("unsupported endpoints and database errors never fall back to 500 raw records", async (t) => {
  const range = statisticsRange("Day", "2026-11-11");
  const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ success: false }, { status: 404 }));
  await assert.rejects(getYieldStatistics("PLANT", range), /belum tersedia/);
  assert.equal(mock.mock.callCount(), 1);
  mock.mock.restore();
  t.mock.method(globalThis, "fetch", async () => Response.json({ success: false, message: "Database belum dapat diakses" }, { status: 503 }));
  await assert.rejects(getYieldStatistics("PLANT", range), /Database belum dapat diakses/);
});
