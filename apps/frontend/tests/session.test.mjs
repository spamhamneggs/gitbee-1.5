import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/app/(pages)/login/actions.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { getSession, login, loginDevBypass, logout, switchRole } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const session = {
  nim: "D5001", name: "STAFF", email: "staff@example.com",
  activeRole: "Admin", roles: ["Admin", "Lecturer"], authMethod: "local",
};
let previousBackend;
beforeEach(() => {
  previousBackend = process.env.NEXT_PUBLIC_BACKEND_API;
  process.env.NEXT_PUBLIC_BACKEND_API = "http://localhost:5001/api/";
});
afterEach(() => {
  if (previousBackend === undefined) delete process.env.NEXT_PUBLIC_BACKEND_API;
  else process.env.NEXT_PUBLIC_BACKEND_API = previousBackend;
});

test("identity loads from a credentialed, uncached backend request with cancellation", async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "http://localhost:5001/api/auth/session");
    assert.equal(options.credentials, "include");
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    controller.abort();
    assert.equal(options.signal.aborted, true);
    return Response.json({ status: true, data: session });
  });
  assert.deepEqual(await getSession(controller.signal), session);
});

test("missing and expired sessions become anonymous; backend failures remain errors", async (t) => {
  let response = new Response(null, { status: 401 });
  t.mock.method(globalThis, "fetch", async () => response.clone());
  assert.equal(await getSession(), null);
  for (const status of [403, 500]) {
    response = Response.json({ status: false, errors: "Unavailable" }, { status });
    await assert.rejects(getSession(), /Unavailable/);
  }
  response = new Response("<html>Backend unavailable</html>", { status: 502 });
  await assert.rejects(getSession());
});

test("SSO and bypass logins use the session in the cookie-setting response without a second request", async (t) => {
  const calls = [];
  let method = "sso";
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith("auth/session")) return new Response(null, { status: 503 });
    return Response.json({ status: true, data: {
      Name: "IGNORED", MicrosoftToken: "must-not-enter-context",
      session: { ...session, authMethod: method },
    } });
  });
  assert.deepEqual(await login("fresh-msal-token"), { success: true, data: { ...session, authMethod: "sso" } });
  assert.equal(calls[0].url, "http://localhost:5001/api/auth/login");
  assert.deepEqual(JSON.parse(calls[0].body), { microsoft_token: "fresh-msal-token" });
  assert.equal(calls.length, 1);

  method = "local";
  assert.deepEqual(await loginDevBypass(), { success: true, data: session });
  assert.equal(calls[1].url, "http://localhost:5001/api/auth/login-dev");
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.credentials === "include"));
});

test("legacy-only login responses cannot replace the canonical session", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ status: true, data: { Name: "Legacy" } }));
  assert.equal((await login("fresh-msal-token")).success, false);
  assert.equal((await loginDevBypass()).success, false);
  assert.equal((await switchRole("Lecturer")).success, false);
});

test("session bootstrap has a deadline even if the backend never responds", async (t) => {
  const deadline = new AbortController();
  t.mock.method(AbortSignal, "timeout", (milliseconds) => {
    assert.equal(milliseconds, 10_000);
    return deadline.signal;
  });
  t.mock.method(globalThis, "fetch", (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  const pending = assert.rejects(getSession(), { name: "TimeoutError" });
  deadline.abort(new DOMException("Timed out", "TimeoutError"));
  await pending;
});

test("logout asks the backend to clear its cookie and reports failure", async (t) => {
  let status = 200;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "http://localhost:5001/api/auth/logout");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "include");
    return new Response(null, { status });
  });
  await logout();
  status = 500;
  await assert.rejects(logout(), /Couldn't sign out/);
});
