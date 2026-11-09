import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it, mock } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";
process.env.JWT_SECRET = "data-tools-test-secret";
process.env.COOKIE_NAME = "test_auth";
const { default: routes } =
  await import("../api/routes/user/admin/dataToolsRoutes.js");
const { prisma } = await import("../api/prisma/client.js");
const { createLocalToken } = await import("../api/utils/auth/auth.js");
const { prismaUserStore } = await import("../api/utils/csv/csvUserImport.js");
const { createFakeUserStore } = await import("./fakeUserStore.js");
const { sampleFile } = await import("../api/utils/demo/sampleFiles.js");
const app = express();
app.use(cookieParser());
app.use("/", routes);
const admin = {
  id: 1,
  email: "admin@example.test",
  name: "Admin",
  role: "Admin",
  user_type: null,
  student_id: null,
  lecturer_code: "DEMO1",
  binusian_id: null,
  credential_version: 0,
};
const cookie = `test_auth=${createLocalToken(admin).token}`;
let fake = createFakeUserStore();
const delegate = prisma.user as Record<"findUnique", unknown>;
let original: unknown;
beforeEach(() => {
  fake = createFakeUserStore();
  original = delegate.findUnique;
  delegate.findUnique = async () => admin;
  mock.method(prismaUserStore, "findExistingUsers", fake.findExistingUsers);
  mock.method(prismaUserStore, "collationKeys", fake.collationKeys);
  mock.method(prismaUserStore, "createMany", fake.createMany);
});
afterEach(() => {
  mock.restoreAll();
  delegate.findUnique = original;
});
after(() => prisma.$disconnect());

describe("Admin data workspace", () => {
  it("blocks anonymous and demoted sessions on every endpoint", async () => {
    for (const path of [
      "/database",
      "/database/user",
      "/samples/student/xlsx",
    ]) {
      assert.equal((await request(app).get(path)).status, 401);
    }
    assert.equal((await request(app).post("/student/import")).status, 401);
    delegate.findUnique = async () => ({
      ...admin,
      role: "Student",
      user_type: "student",
    });
    assert.equal(
      (await request(app).get("/database").set("Cookie", cookie)).status,
      403,
    );
    assert.equal(
      (await request(app).post("/student/import").set("Cookie", cookie)).status,
      403,
    );
  });
  it("previews without writing or exposing passwords, imports and skips duplicates", async () => {
    const data = sampleFile("student", "xlsx", true);
    const preview = await request(app)
      .post("/student/preview")
      .set("Cookie", cookie)
      .attach("file", data, "students.xlsx");
    assert.equal(preview.status, 200);
    assert.equal(preview.body.data.validCount, 9);
    assert.equal(fake.users.length, 0);
    assert.ok(!JSON.stringify(preview.body).includes("GitbeeDummy"));
    assert.ok(!("password" in preview.body.data.rows[0]));
    const imported = await request(app)
      .post("/student/import")
      .set("Cookie", cookie)
      .attach("file", data, "students.xlsx");
    assert.equal(imported.body.data.createdCount, 8);
    assert.equal(imported.body.data.skippedCount, 1);
    assert.equal(imported.body.data.failedCount, 1);
    const { verifyPassword } = await import("../api/utils/auth/password.js");
    assert.equal(
      await verifyPassword("GitbeeDummy#2026", fake.users[0]!.password),
      true,
    );
    const again = await request(app)
      .post("/student/import")
      .set("Cookie", cookie)
      .attach("file", data, "students.xlsx");
    assert.equal(again.body.data.createdCount, 0);
    assert.equal(again.body.data.skippedCount, 9);
    assert.equal(fake.users.length, 8);
  });
  it("rejects unsupported files, excessive size and SQL-like table names", async () => {
    assert.equal(
      (
        await request(app)
          .post("/student/preview")
          .set("Cookie", cookie)
          .attach("file", Buffer.from("hello"), "fake.pdf")
      ).status,
      400,
    );
    assert.equal(
      (
        await request(app)
          .post("/student/preview")
          .set("Cookie", cookie)
          .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1), "large.csv")
      ).status,
      413,
    );
    assert.equal(
      (
        await request(app)
          .get("/database/user%3BDELETE%20FROM%20user")
          .set("Cookie", cookie)
      ).status,
      404,
    );
    assert.equal(
      (await request(app).get("/database/user?page=-1").set("Cookie", cookie))
        .status,
      400,
    );
  });
  it("serves a usable sample workbook as a download", async () => {
    const response = await request(app)
      .get("/samples/staff/xlsx")
      .set("Cookie", cookie);
    assert.equal(response.status, 200);
    assert.match(response.headers["content-disposition"], /staff-sample.xlsx/);
    assert.match(response.headers["cache-control"], /no-store/);
  });
});
