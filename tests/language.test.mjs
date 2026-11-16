import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, getLanguage, getLocale, isLanguage, readLanguage, setLanguage, subscribeLanguage, translate } from "../src/i18n/language.ts";
import { format } from "../src/services/fleet.ts";

test("UI phrases translate in both directions and preserve names, IDs, units and unknown diagnostics", () => {
  assert.equal(translate("Plant Report", "id"), "Laporan PLTS");
  assert.equal(translate("Klik Search untuk menerapkan perubahan filter.", "en"), "Click Search to apply filter changes.");
  for (const value of ["NE=75907332", "PT. Solar One", "kWh", "INV-000123", "Vendor error E9", 0, null, undefined]) {
    assert.equal(translate(value, "id"), value);
  }
  assert.equal(translate("Photo of Unknown", "id"), "Foto Unknown", "A plant name is not translated as a UI status");
});

test("dynamic phrases preserve scope values and translate nested measurement quality and age", () => {
  assert.equal(translate("Report page 12", "id"), "Halaman laporan 12");
  assert.equal(translate("Cakupan 2/10 PLTS · parsial", "en"), "Coverage 2/10 plants · partial");
  assert.equal(translate("Terbaru · 7 menit lalu", "en"), "Fresh · 7 min ago");
  assert.equal(translate("Quality: unverified", "id"), "Kualitas: belum terverifikasi");
  assert.equal(translate(" Search ", "id"), " Cari ");
});

test("saved language accepts only supported values and safely handles unavailable storage", () => {
  assert.equal(readLanguage({ getItem: key => key === LANGUAGE_STORAGE_KEY ? "id" : null }), "id");
  assert.equal(readLanguage({ getItem: () => "fr" }), DEFAULT_LANGUAGE);
  assert.equal(readLanguage({ getItem: () => { throw new Error("Storage denied"); } }), DEFAULT_LANGUAGE);
  assert.equal(isLanguage("en"), true);
  assert.equal(isLanguage("ID"), false);
});

test("changing language updates subscribers, persists preference and formats numbers without changing measurements", () => {
  const previous = getLanguage(), saved = [];
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem: (...args) => saved.push(args) } });
  let changes = 0;
  const unsubscribe = subscribeLanguage(() => changes++);
  try {
    setLanguage("id");
    assert.equal(getLocale(), "id-ID");
    assert.equal(format(1234.5, 2), "1.234,50");
    const count = changes;
    setLanguage("id");
    assert.equal(changes, count, "The same language does not trigger a render");
    setLanguage("en");
    assert.equal(format(1234.5, 2), "1,234.50");
    assert.equal(format(null), "--");
    assert.deepEqual(saved.at(-1), [LANGUAGE_STORAGE_KEY, "en"]);
  } finally {
    unsubscribe(); setLanguage(previous);
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});
