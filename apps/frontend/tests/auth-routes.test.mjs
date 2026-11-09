import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server.js";
import nextTesting from "next/experimental/testing/server.js";

const { unstable_doesMiddlewareMatch } = nextTesting;

process.env.NEXT_PUBLIC_COOKIE_NAME = "frontend_role_test";

// Execute the actual proxy without starting Next or requiring an SSO account.
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
).toString("base64")}`;
const auth = moduleUrl(await readFile(new URL("../src/lib/auth.ts", import.meta.url), "utf8"));
const source = (await readFile(new URL("../src/proxy.tsx", import.meta.url), "utf8"))
  .replaceAll('"@/lib/auth"', JSON.stringify(auth))
  .replaceAll('"next/server"', JSON.stringify(import.meta.resolve("next/server.js")))
  .replaceAll('"jsonwebtoken"', JSON.stringify(import.meta.resolve("jsonwebtoken")));
const { proxy, config } = await import(moduleUrl(source));
const { SESSION_COOKIE_NAME } = await import(auth);

const pathsByRole = {
  Student: ["/dashboard", "/course", "/profile", "/profile/2702000001"],
  Lecturer: ["/dashboard-lecturer", "/course-lecturer", "/history-lecturer"],
  SCC: ["/dashboard-scc"],
  HoP: ["/dashboard-hop"],
  Admin: ["/dashboard-admin", "/detail-admin-project/1", "/manage-categories", "/manage-student", "/manage-transactions", "/manage-users", "/data-demo"],
};
const memberships = {
  Student: ["Student"], Lecturer: ["Lecturer"],
  SCC: ["SCC", "Lecturer"], HoP: ["HoP", "Lecturer"], Admin: ["Admin", "Lecturer"],
};
const tokenFor = (role, extra = {}) => jwt.sign({
  role: memberships[role], activeRole: role,
  exp: Math.floor(Date.now() / 1000) + 3600, ...extra,
}, "test-only-secret");
const check = (path, token) => proxy(new NextRequest(`http://localhost:8000${path}`, {
  headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
}));

test("Next applies the guard to every protected page and leaves public pages available", () => {
  for (const path of Object.values(pathsByRole).flat()) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path }), true, path);
  }
  for (const path of ["/", "/explore", "/login/microsoft", "/demo-login", "/favicon.ico"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path }), false, path);
  }
});

test("all five local roles can open only routes in their membership", () => {
  for (const [role, membership] of Object.entries(memberships)) {
    for (const [owner, paths] of Object.entries(pathsByRole)) {
      for (const path of paths) {
        const response = check(path, tokenFor(role));
        assert.equal(response.headers.get("x-middleware-next") === "1", membership.includes(owner), `${role}: ${path}`);
      }
    }
  }
});

test("Student prefixes do not admit staff dashboards or courses", () => {
  for (const path of ["/dashboard-admin", "/dashboard-hop", "/dashboard-scc", "/dashboard-lecturer", "/course-lecturer", "/dashboard-admin/nested"]) {
    assert.equal(check(path, tokenFor("Student")).status, 307, path);
  }
  for (const path of ["/dashboardish", "/coursework", "/profile-other", "/manage-users-other"]) {
    assert.equal(check(path, tokenFor("Admin")).status, 307, path);
  }
});

test("missing, malformed, expired and malformed-role sessions redirect to login", () => {
  for (const token of [undefined, "broken", tokenFor("Admin", { exp: 1 }),
    jwt.sign({ role: ["Admin"] }, "test-only-secret"),
    tokenFor("Admin", { role: "Admin" }), tokenFor("Admin", { role: [42] })]) {
    const response = check("/manage-users", token);
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")).pathname, "/login/microsoft");
  }
});

test("switching the active role keeps both assigned staff dashboards available", () => {
  for (const role of ["Admin", "SCC", "HoP"]) {
    const token = tokenFor(role, { activeRole: "Lecturer" });
    assert.equal(check(pathsByRole[role][0], token).headers.get("x-middleware-next"), "1");
    assert.equal(check("/dashboard-lecturer", token).headers.get("x-middleware-next"), "1");
    assert.equal(check("/dashboard", token).status, 307);
  }
});
