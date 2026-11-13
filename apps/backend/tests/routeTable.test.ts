// Pins the API surface: every route the backend serves, one router per resource.
// A route added, removed or renamed shows up here as a diff to review.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";
process.env.JWT_SECRET ??= "route-table-test-secret";
const { resourceRoutes } = await import("../api/routes/Routes.js");

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

const routeTable = Object.entries(resourceRoutes).flatMap(([prefix, router]) =>
  (router.stack as RouteLayer[]).flatMap((layer) => layer.route
    ? Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${prefix}${layer.route!.path}`)
    : [])
);

describe("API route table", () => {
  it("serves exactly the routes the app uses", () => {
    assert.deepEqual([...routeTable].sort(), [
      "POST /assessment/insert",

      "POST /auth/change-password",
      "POST /auth/login",
      "POST /auth/login-dev",
      "POST /auth/login-local",
      "POST /auth/login-local/role",

      "GET /category/all",
      "POST /category/admin/insert",
      "PATCH /category/admin/update",

      "GET /class/lecturer/list-course",
      "GET /class/lecturer/transaction",
      "GET /class/student/list",
      "GET /class/student/transaction",

      "PATCH /group/lecturer/remove",
      "GET /group/student/current",
      "POST /group/student/insert",

      "GET /major/all",

      "POST /outstanding-project/hop/insert",

      "PATCH /project/admin/disable-toggle",
      "GET /project/admin/dashboard",
      "GET /project/all",
      "GET /project/detail",
      "GET /project/hop/dashboard",
      "POST /project/insert",
      "GET /project/lecturer/all-reviewed",
      "GET /project/lecturer/class",
      "GET /project/scc/dashboard",
      "GET /project/student/all",
      "GET /project/student/history",

      "POST /reviewed-project/scc/insert",

      "GET /semester/all",
      "GET /semester/current",

      "GET /technology/all",
      "POST /technology/admin/insert",
      "PATCH /technology/admin/update",

      "GET /user/admin/get-student",
      "GET /user/admin/get-transaction",
      "GET /user/admin/get-user",
      "POST /user/admin/insert-user",
      "PATCH /user/admin/remove-student-excel",
      "PATCH /user/admin/remove-transaction-excel",
      "PATCH /user/admin/remove-user-excel",
      "POST /user/admin/set-password",
      "PATCH /user/admin/update-role",
      "POST /user/admin/upload-staff-csv",
      "POST /user/admin/upload-student-csv",
      "POST /user/admin/upload-student-excel",
      "POST /user/admin/upload-transaction-excel",
      "POST /user/admin/upload-user-excel",
    ].sort());
  });

  it("no longer serves the routes AR-11 found without a caller", () => {
    for (const removed of [
      "GET /user/get-name", "GET /user/get-role", "GET /class/lecturer/check-finalize",
      "GET /reviewed-project/all", "GET /outstanding-project/all", "GET /status/all",
      "GET /technology/data", "POST /major/insert", "GET /group/lecturer/class-group",
      "GET /group/lecturer/class-list", "GET /deadline/check",
    ]) {
      assert.ok(!routeTable.includes(removed), `${removed} is still routed`);
    }
  });
});
