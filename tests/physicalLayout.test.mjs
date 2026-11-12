import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeLayouts, layoutStorageKey } from "../src/services/physicalLayout.ts";

test("layout storage is isolated per plant code", () => {
  assert.notEqual(layoutStorageKey("PLANT/A"), layoutStorageKey("PLANT/B"));
  assert.ok(layoutStorageKey("PLANT/A").endsWith("PLANT%2FA"));
});

test("an empty browser starts with no layouts and no artificial devices", () => {
  assert.deepEqual(decodeLayouts(null), []);
});

test("saved draft modules survive a storage round trip", () => {
  const layouts = [{ id: "layout-1", name: "Roof 1", modules: [{ id: "module-1", label: "Module 1" }] }];
  assert.deepEqual(decodeLayouts(JSON.stringify(layouts)), layouts);
});

test("corrupt or duplicate drafts are rejected instead of silently overwritten", () => {
  for (const raw of ["broken", "{}", '[{"id":"a","name":"","modules":[]}]',
    '[{"id":"a","name":"A","modules":[]},{"id":"a","name":"B","modules":[]}]',
    '[{"id":"a","name":"A","modules":[{"id":"1","label":"A"},{"id":"1","label":"B"}]}]']) {
    assert.throws(() => decodeLayouts(raw));
  }
});
