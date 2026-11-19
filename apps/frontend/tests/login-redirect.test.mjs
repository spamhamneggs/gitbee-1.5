import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/app/(pages)/login/microsoft/page.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
const storedSession = { nim: "D5001", activeRole: "Admin", authMethod: "local" };
const settle = () => new Promise((resolve) => setImmediate(resolve));

/* eslint-disable @eslint-react/no-unnecessary-use-prefix -- These hooks are deterministic test doubles. */
function pageHarness(getSession, bypass = false) {
  const state = [];
  const paths = [];
  const updates = [];
  let cursor = 0;
  let effect;
  let dependencies;
  let cleanup;
  let bypassCalls = 0;
  const context = {
    session: storedSession, loading: false,
    setSession(next) { context.session = next; updates.push(next); },
  };
  const msal = { inProgress: "none", accounts: [], instance: {} };
  const router = { push: (path) => paths.push(path) };
  function nextState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], (next) => { state[index] = next; }];
  }
  const jsx = (type, props) => ({ type, props });
  const modules = {
    "react": {
      useState: nextState,
      useRef: (initial) => nextState({ current: initial })[0],
      useEffect(callback, nextDependencies) {
        if (!dependencies || nextDependencies.some((value, index) => value !== dependencies[index])) {
          dependencies = nextDependencies;
          effect = callback;
        }
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/link": { default: "a" },
    "next/navigation": { useRouter: () => router },
    "@azure/msal-react": { useMsal: () => msal },
    "@/app/context/AuthContext": { useAuth: () => context },
    "@/lib/auth": {
      SSO_BYPASS_ENABLED: bypass,
      dashboardPathForRole: (role) => ({ Admin: "/dashboard-admin", Lecturer: "/dashboard-lecturer" })[role],
    },
    "../actions": {
      getSession,
      async loginDevBypass() { bypassCalls += 1; return { success: true, data: storedSession }; },
      login() { throw new Error("Unexpected Microsoft login"); },
    },
  };
  const exports = {};
  runInNewContext(outputText, { exports, AbortController, console: { error() {} }, require(name) {
    if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
    return modules[name];
  } });
  return {
    context, msal, paths, updates,
    bypassCalls: () => bypassCalls,
    render() {
      cursor = 0;
      const tree = exports.default();
      if (effect) {
        cleanup?.();
        cleanup = effect();
        effect = undefined;
      }
      return tree;
    },
    unmount() { cleanup?.(); },
  };
}
/* eslint-enable @eslint-react/no-unnecessary-use-prefix */

test("a session whose cookie disappeared clears tab identity and resumes ordinary sign-in", async () => {
  for (const bypass of [false, true]) {
    let checks = 0;
    const page = pageHarness(async () => { checks += 1; return null; }, bypass);
    page.render();
    await settle();
    assert.equal(checks, 1);
    assert.deepEqual(page.updates, [null]);
    assert.deepEqual(page.paths, []);

    page.render();
    await settle();
    assert.equal(page.bypassCalls(), bypass ? 1 : 0);
    assert.deepEqual(page.paths, [bypass ? "/dashboard-admin" : "/"]);
    page.unmount();
  }
});

test("a confirmed session redirects using the backend role without installing a new object or rechecking", async () => {
  let checks = 0;
  const page = pageHarness(async () => { checks += 1; return { ...storedSession, activeRole: "Lecturer" }; });
  page.render();
  await settle();
  assert.deepEqual(page.paths, ["/dashboard-lecturer"]);
  assert.deepEqual(page.updates, []);
  page.render();
  await settle();
  assert.equal(checks, 1);
  page.unmount();
});

test("an unavailable backend returns home without clearing identity or starting another login", async () => {
  const page = pageHarness(async () => { throw new TypeError("Failed to fetch"); }, true);
  page.render();
  await settle();
  assert.deepEqual(page.paths, ["/"]);
  assert.deepEqual(page.updates, []);
  assert.equal(page.context.session, storedSession);
  assert.equal(page.bypassCalls(), 0);
  page.unmount();
});

test("leaving the sign-in page cancels revalidation and ignores late results", async () => {
  for (const result of [null, storedSession, new Error("Late network failure")]) {
    let finish;
    let signal;
    const page = pageHarness((requestSignal) => {
      signal = requestSignal;
      return new Promise((resolve, reject) => { finish = () => result instanceof Error ? reject(result) : resolve(result); });
    });
    page.render();
    page.unmount();
    assert.equal(signal.aborted, true);
    finish();
    await settle();
    assert.deepEqual(page.paths, []);
    assert.deepEqual(page.updates, []);
  }
});

test("session validation waits for provider bootstrap", async () => {
  let checks = 0;
  const page = pageHarness(async () => { checks += 1; return storedSession; });
  page.context.loading = true;
  page.render();
  await settle();
  assert.equal(checks, 0);
  assert.deepEqual(page.paths, []);
  page.context.loading = false;
  page.render();
  await settle();
  assert.equal(checks, 1);
  assert.deepEqual(page.paths, ["/dashboard-admin"]);
  page.unmount();
});
