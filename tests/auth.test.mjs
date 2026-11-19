import assert from "node:assert/strict";
import { test } from "node:test";
import { getSession, signIn, signOut } from "../src/services/auth.ts";
import { ApiError, invalidatePendingSessionRequests, onSessionExpired, request } from "../src/services/http.ts";

const session = {
  user: { username: "operator", display_name: "Plant Operator", role: "viewer" },
  csrf_token: "session-csrf",
};
const success = (data) => Response.json({ success: true, data });
const unauthorized = () => Response.json({ success: false, message: "Unauthorized" }, { status: 401 });

test("login uses pre-login CSRF and confirms the server session before data loads", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const path = new URL(url).pathname;
    requests.push(path);
    assert.equal(init.credentials, "include");
    if (path === "/api/auth/csrf") return success({ csrf_token: "login-csrf" });
    if (path === "/api/auth/login") {
      assert.equal(init.method, "POST");
      assert.equal(init.headers["X-CSRF-Token"], "login-csrf");
      assert.deepEqual(JSON.parse(init.body), { username: "operator", password: "test password " });
      return success(session);
    }
    return path === "/api/auth/me" ? success(session) : success([]);
  });

  assert.deepEqual(await signIn("  operator  ", "test password "), {
    displayName: "Plant Operator", role: "viewer", csrfToken: "session-csrf",
  });
  await request("/api/database/overview");
  assert.deepEqual(requests, ["/api/auth/csrf", "/api/auth/login", "/api/auth/me", "/api/database/overview"]);
});

test("a rejected login and a missing post-login cookie cannot establish a session", async (t) => {
  let loginRejected = true;
  let sessionChecks = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    switch (new URL(url).pathname) {
      case "/api/auth/csrf": return success({ csrf_token: "login-csrf" });
      case "/api/auth/login": return loginRejected ? unauthorized() : success(session);
      default: sessionChecks++; return unauthorized();
    }
  });
  await assert.rejects(signIn("operator", "test"), { name: "ApiError", status: 401 });
  assert.equal(sessionChecks, 0);
  loginRejected = false;
  await assert.rejects(signIn("operator", "test"), /session.*cookie/);
  assert.equal(sessionChecks, 1);
});

test("session restore distinguishes no session from a backend failure", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => unauthorized());
  assert.equal(await getSession(), null);
  fetch.mock.mockImplementation(async () => Response.json({ success: false, message: "Database unavailable" }, { status: 503 }));
  await assert.rejects(getSession(), { status: 503 });
});

test("logout includes the session CSRF token and propagates a server failure", async (t) => {
  let status = 200;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(new URL(url).pathname, "/api/auth/logout");
    assert.equal(init.method, "POST");
    assert.equal(init.credentials, "include");
    assert.equal(init.headers["X-CSRF-Token"], "session-csrf");
    assert.equal(init.body, undefined);
    return Response.json({ success: status === 200 }, { status });
  });
  await signOut("session-csrf");
  status = 401;
  await signOut("session-csrf");
  status = 503;
  await assert.rejects(signOut("session-csrf"), { status: 503 });
});

test("only a current protected 401 expires the session", async (t) => {
  const stale = Promise.withResolvers();
  const seen = [];
  let status = 401;
  t.after(onSessionExpired(() => seen.push("expired")));
  t.mock.method(globalThis, "fetch", async (url) => new URL(url).pathname === "/api/database/old"
    ? stale.promise : Response.json({ success: false }, { status }));

  const oldRequest = request("/api/database/old");
  invalidatePendingSessionRequests();
  stale.resolve(unauthorized());
  await assert.rejects(oldRequest, ApiError);
  assert.equal(await getSession(), null);
  status = 403;
  await assert.rejects(request("/api/database/overview"), { status: 403 });
  assert.deepEqual(seen, []);
  status = 401;
  await Promise.allSettled([request("/api/database/overview"), request("/api/database/plants")]);
  assert.deepEqual(seen, ["expired"]);
});
