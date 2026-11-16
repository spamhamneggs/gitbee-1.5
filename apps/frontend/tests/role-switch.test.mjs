import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/app/(pages)/login/actions.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { switchRole, logout } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const headerSource = await readFile(new URL("../src/app/components/layout/Header.tsx", import.meta.url), "utf8");
const headerModule = ts.transpileModule(headerSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
});
const session = {
  nim: "D5001", name: "STAFF", email: "staff@example.com",
  activeRole: "Lecturer", roles: ["Admin", "Lecturer"], authMethod: "sso",
};

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object") return [];
  return [node, ...elements(node.props.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join("");
  if (!node || typeof node === "boolean") return "";
  return typeof node === "object" ? text(node.props.children) : String(node);
}

// Render the complete Header with mocked hooks, and click its wired controls.
/* eslint-disable @eslint-react/no-unnecessary-use-prefix -- These hooks are deterministic test doubles. */
function headerHarness(options = {}) {
  const state = [];
  let cursor = 0;
  const updates = [];
  const paths = [];
  const removed = [];
  let cookie = options.cookie;
  let microsoftLogouts = 0;
  const context = {
    session: { ...session, ...options.session }, loading: options.loading ?? false,
    setSession(next) { context.session = next; updates.push(next); },
  };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  const modules = {
    "react": {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (next) => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
      },
      useRef: (initial) => ({ current: initial }),
      useEffect() {},
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/app/context/AuthContext": { useAuth: () => context },
    "@azure/msal-react": { useMsal: () => ({ accounts: [], instance: {
      acquireTokenSilent() { throw new Error("MSAL cache is empty"); },
      async logoutRedirect() { microsoftLogouts += 1; if (options.microsoftError) throw options.microsoftError; },
    } }) },
    "framer-motion": { useScroll: () => ({ scrollYProgress: {} }) },
    "next/link": { __esModule: true, default: "a" },
    "next/navigation": { useRouter: () => ({ push: (path) => paths.push(path) }) },
    "js-cookie": { __esModule: true, default: {
      get: (name) => { assert.equal(name, "header_test_session"); return cookie; },
      remove: (name, attributes) => { removed.push([name, attributes]); if (!options.cookieBlocked) cookie = undefined; },
    } },
    "@/components/ui/avatar": { Avatar: "Avatar", AvatarImage: "AvatarImage" },
    "@/components/ui/popover": { Popover: "Popover", PopoverContent: "PopoverContent", PopoverTrigger: "PopoverTrigger" },
    "react-icons/fa": { FaUser: "FaUser" },
    "react-icons/io5": { IoLogOut: "IoLogOut" },
    "react-icons/md": { MdSupportAgent: "MdSupportAgent" },
    "@/app/(pages)/login/actions": { switchRole, logout },
    "@/lib/auth": { SSO_BYPASS_ENABLED: false, SESSION_COOKIE_NAME: "header_test_session", dashboardPathForRole: () => "/dashboard-admin" },
    "../Loading": { __esModule: true, default: "Loading" },
  };
  runInNewContext(headerModule.outputText, { exports, console, require(name) {
    if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
    return modules[name];
  } });
  const render = () => { cursor = 0; return exports.default(); };
  return {
    render, context, updates, paths, removed,
    microsoftLogouts: () => microsoftLogouts,
    click(label) {
      const control = elements(render()).find((node) => typeof node.props.onClick === "function" && text(node).trim() === label);
      assert.ok(control, `Missing control: ${label}`);
      return control.props.onClick();
    },
  };
}
/* eslint-enable @eslint-react/no-unnecessary-use-prefix */

test("Header switches a restored SSO session with an empty MSAL cache through its role control", async (t) => {
  const switched = { ...session, activeRole: "Admin" };
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, ...options });
    return Response.json({ status: true, data: { session: switched } });
  });
  const header = headerHarness();
  await header.click("Login as Admin");
  assert.equal(requests.length, 1);
  assert.ok(requests[0].url.endsWith("auth/session/role"));
  assert.equal(requests[0].credentials, "include");
  assert.deepEqual(header.updates, [switched]);
  assert.deepEqual(header.paths, ["/dashboard-admin"]);
  assert.equal(header.microsoftLogouts(), 0);
  assert.ok(!elements(header.render()).some((node) => node.props.role === "alert"));
});

test("offline logout removes a readable cookie and completes local and Microsoft sign-out", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  for (const authMethod of ["local", "sso"]) {
    const header = headerHarness({ cookie: "readable-token", session: { authMethod } });
    await header.click("Logout");
    assert.equal(header.context.session, null);
    assert.equal(header.removed.length, 1);
    assert.equal(header.removed[0][0], "header_test_session");
    assert.equal(header.removed[0][1].path, "/");
    assert.equal(header.microsoftLogouts(), authMethod === "sso" ? 1 : 0);
    assert.ok(!elements(header.render()).some((node) => node.props.role === "alert"));
  }
});

test("failed server logout preserves the session when its cookie cannot be removed", async (t) => {
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 500 }));
  for (const options of [{}, { cookie: "readable-token", cookieBlocked: true }]) {
    const header = headerHarness(options);
    await header.click("Logout");
    assert.equal(header.context.session.authMethod, "sso");
    assert.equal(header.microsoftLogouts(), 0);
    const alert = elements(header.render()).find((node) => node.props.role === "alert");
    assert.match(text(alert), /Couldn't sign out/);
  }
});

test("Microsoft logout errors stay visible after the app session and popover are gone", async (t) => {
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 200 }));
  const header = headerHarness({ microsoftError: new Error("interaction_in_progress") });
  await header.click("Logout");
  assert.equal(header.context.session, null);
  assert.equal(header.microsoftLogouts(), 1);
  const tree = header.render();
  assert.ok(!elements(tree).some((node) => node.type === "Popover"));
  assert.match(text(elements(tree).find((node) => node.props.role === "alert")), /signed out of GitBee, but Microsoft sign-out failed/);
});

test("Header keeps public navigation available while restoring identity", () => {
  const header = headerHarness({ loading: true });
  header.context.session = null;
  const tree = header.render();
  assert.ok(elements(tree).some((node) => node.type === "a" && node.props.href === "/explore"));
  assert.ok(elements(tree).some((node) => node.props.role === "status"));
  assert.ok(!elements(tree).some((node) => node.type === "button" && text(node) === "Login"));
});

test("local and restored SSO role switches need only one cookie-authenticated request", async (t) => {
  const previous = process.env.NEXT_PUBLIC_BACKEND_API;
  process.env.NEXT_PUBLIC_BACKEND_API = "http://localhost:5001/api/";
  const calls = [];
  const session = {
    nim: "D5001", name: "STAFF", email: "staff@example.com",
    activeRole: "Lecturer", roles: ["Admin", "Lecturer"], authMethod: "local",
  };
  let response;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith("auth/session")) return new Response(null, { status: 503 });
    if (response instanceof Error) throw response;
    return response ? response.clone() : Response.json({ status: true, data: { session } });
  });
  try {
    for (const authMethod of ["local", "sso"]) {
      session.authMethod = authMethod;
      for (const role of ["Lecturer", "Admin", "SCC", "HoP", "Student"]) {
        const count = calls.length;
        assert.deepEqual(await switchRole(role), { success: true, data: session });
        assert.equal(calls.length, count + 1);
        assert.equal(calls.at(-1).url, "http://localhost:5001/api/auth/session/role");
        assert.equal(calls.at(-1).method, "POST");
        assert.equal(calls.at(-1).credentials, "include");
        assert.deepEqual(JSON.parse(calls.at(-1).body), { role });
      }
    }

    for (const status of [401, 403, 500]) {
      response = Response.json({ status: false, errors: "Forbidden", data: null }, { status });
      assert.deepEqual(await switchRole("Admin"), { success: false, message: "Forbidden" });
    }
    // A success-shaped error response must not replace the current session.
    response = Response.json({ status: true, data: { ActiveRole: "Admin" } }, { status: 500 });
    assert.equal((await switchRole("Admin")).success, false);
    response = new Response("<html>Backend unavailable</html>", { status: 502 });
    assert.equal((await switchRole("Admin")).success, false);
    response = new TypeError("Failed to fetch");
    assert.equal((await switchRole("Admin")).success, false);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BACKEND_API;
    else process.env.NEXT_PUBLIC_BACKEND_API = previous;
  }
});
