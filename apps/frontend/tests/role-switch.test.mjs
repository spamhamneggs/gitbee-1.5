import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/app/(pages)/login/actions.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { switchRole } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const headerSource = await readFile(new URL("../src/app/components/layout/Header.tsx", import.meta.url), "utf8");
const header = ts.createSourceFile("Header.tsx", headerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let changeRole;
function findHandler(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(header) === "changeRole") changeRole = node.initializer.getText(header);
  ts.forEachChild(node, findHandler);
}
findHandler(header);
assert.ok(changeRole);
const handlerModule = ts.transpileModule(`export const makeHandler = ({ session, setLoading, setRoleError, setSession, router, switchRole, dashboardPathForRole, accounts, instance }) => (${changeRole});`, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { makeHandler } = await import(`data:text/javascript;base64,${Buffer.from(handlerModule.outputText).toString("base64")}`);

test("Header can switch a restored SSO session with an empty MSAL cache", async (t) => {
  const session = { nim: "D5001", name: "STAFF", email: "staff@example.com", activeRole: "Lecturer", roles: ["Admin", "Lecturer"], authMethod: "sso" };
  const switched = { ...session, activeRole: "Admin" };
  const requests = [];
  const updates = [];
  const errors = [];
  const paths = [];
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, ...options });
    return Response.json({ status: true, data: { session: switched } });
  });
  const handler = makeHandler({
    session, accounts: [], instance: { acquireTokenSilent() { throw new Error("MSAL cache is empty"); } },
    setLoading() {}, setRoleError: (error) => errors.push(error), setSession: (next) => updates.push(next),
    router: { push: (path) => paths.push(path) }, switchRole,
    dashboardPathForRole: () => "/dashboard-admin",
  });
  await handler("Admin");
  assert.equal(requests.length, 1);
  assert.ok(requests[0].url.endsWith("auth/session/role"));
  assert.equal(requests[0].credentials, "include");
  assert.deepEqual(updates, [switched]);
  assert.deepEqual(errors, [null]);
  assert.deepEqual(paths, ["/dashboard-admin"]);
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
