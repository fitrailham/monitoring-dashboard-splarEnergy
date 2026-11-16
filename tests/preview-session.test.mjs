import assert from "node:assert/strict";
import { test } from "node:test";
import { PREVIEW_SESSION_KEY, endPreviewSession, readPreviewSession, startPreviewSession } from "../src/services/previewSession.ts";

function storageFixture() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test("preview persists only mode and display name, with no credential or authentication claim", () => {
  const storage = storageFixture();
  const session = startPreviewSession("  IconGreenTWH  ", storage);
  assert.deepEqual(session, { mode: "preview", displayName: "IconGreenTWH" });
  assert.deepEqual(JSON.parse(storage.getItem(PREVIEW_SESSION_KEY)), session);
  assert.deepEqual(readPreviewSession(storage), session);
  assert.deepEqual(Object.keys(session).sort(), ["displayName", "mode"]);
});

test("malformed state, missing names and real-auth-shaped records cannot restore a preview", () => {
  const storage = storageFixture();
  for (const value of ["bad json", "null", "[]", '{}', '{"mode":"preview","displayName":" "}', '{"mode":"authenticated","displayName":"User"}', JSON.stringify({ mode: "preview", displayName: "x".repeat(81) })]) {
    storage.setItem(PREVIEW_SESSION_KEY, value);
    assert.equal(readPreviewSession(storage), null);
  }
});

test("logout removes only preview state and preserves language and layout preferences", () => {
  const storage = storageFixture();
  storage.setItem("icongreen.ui.language", "id");
  storage.setItem("layout", "saved draft");
  startPreviewSession("User", storage);
  endPreviewSession(storage);
  assert.equal(readPreviewSession(storage), null);
  assert.equal(storage.getItem("icongreen.ui.language"), "id");
  assert.equal(storage.getItem("layout"), "saved draft");
});

test("storage failures do not prevent in-memory navigation and invalid names are rejected", () => {
  const denied = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  assert.equal(readPreviewSession(denied), null);
  assert.deepEqual(startPreviewSession("User", denied), { mode: "preview", displayName: "User" });
  assert.doesNotThrow(() => endPreviewSession(denied));
  assert.throws(() => startPreviewSession(" ", denied), /valid username/);
  assert.throws(() => startPreviewSession("x".repeat(81), denied), /valid username/);
});
