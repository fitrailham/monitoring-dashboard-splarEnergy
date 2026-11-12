import assert from "node:assert/strict";
import { test } from "node:test";
import { plantReportRows, sortReportRows } from "../src/services/reports.ts";

test("report intervals use the backend boundary in the plant timezone", () => {
  const [row] = plantReportRows([{ label: "00", startAt: "2026-11-11T16:00:00Z", value: 4.5, quality: "derived" }], "Asia/Makassar");
  assert.equal(row.period, "2026-11-12 00:00:00");
  assert.equal(row.pvYield, 4.5);
  assert.equal(row.inverterYield, null);
  assert.equal(row.exportEnergy, null);
  assert.equal(row.revenue, null);
});

test("report rows omit pending intervals and distinguish measured zero from missing", () => {
  const rows = plantReportRows([
    { label: "00", value: 0, quality: "measured" },
    { label: "01", value: null, quality: "missing" },
    { label: "02", value: 100, quality: "pending" },
    { label: "03", value: 3, quality: "partial" },
  ], "Asia/Jakarta");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].pvYield, 0);
  assert.equal(rows[1].pvYield, null);
  assert.equal(rows[2].quality, "partial");
});

test("numeric report sorting keeps unknown values last in both directions without modifying source rows", () => {
  const rows = plantReportRows([
    { label: "A", value: 12, quality: "derived" },
    { label: "B", value: null, quality: "missing" },
    { label: "C", value: 2, quality: "derived" },
  ], "Asia/Jakarta");
  assert.deepEqual(sortReportRows(rows, "pvYield", "asc").map((row) => row.pvYield), [2, 12, null]);
  assert.deepEqual(sortReportRows(rows, "pvYield", "desc").map((row) => row.pvYield), [12, 2, null]);
  assert.deepEqual(rows.map((row) => row.pvYield), [12, null, 2]);
});
