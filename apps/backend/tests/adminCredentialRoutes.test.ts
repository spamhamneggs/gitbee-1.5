import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";

process.env.DATABASE_URL ??= "******127.0.0.1:3306/test";
process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:3306/test";
process.env.JWT_SECRET = "admin-credential-route-test-secret";
process.env.COOKIE_NAME = "test_auth";

const { prisma } = await import("../api/prisma/client.js");
const { default: adminUserRoutes } = await import(
  "../api/routes/user/admin/adminUserRoutes.js"
);
const { default: authRoutes } = await import("../api/routes/auth/authRoutes.js");
const { createLocalToken } = await import("../api/utils/auth/auth.js");
const { createToken } = await import("../api/utils/auth/auth.js");
const { AuthMiddleware } = await import("../api/middlewares/authMiddleware.js");
const { verifyPassword } = await import("../api/utils/auth/password.js");
const { Prisma } = await import("../api/prisma/generated/prisma/client.js");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/user/admin", adminUserRoutes);
app.use("/api/auth", authRoutes);
app.get("/api/auth-checked", AuthMiddleware(), (_req, res) => res.sendStatus(200));

const adminAccount = {
  id: 1,
  email: "admin@example.com",
  name: "Admin",
  role: "Admin",
  user_type: null,
  student_id: null,
  binusian_id: null,
  lecturer_code: "D5000",
  credential_version: 0,
};
const lecturerAccount = {
  ...adminAccount,
  id: 2,
  email: "lecturer@example.com",
  name: "Lecturer",
  role: "Lecturer",
  lecturer_code: "D5001",
};
const victimAdmin = {
  ...adminAccount,
  id: 3,
  email: "victim@example.com",
  name: "Victim",
  lecturer_code: "D5002",
};
const adminToken = createLocalToken(adminAccount).token;
const microsoftAdminToken = createToken(
  "D5000", "B5000", "Admin", "admin@example.com", ["Admin"], "microsoft-token",
  "", "Admin", adminAccount.id, adminAccount.credential_version
).token;
const lecturerToken = createLocalToken(lecturerAccount).token;
const victimToken = createLocalToken(victimAdmin).token;
let currentAdmin: typeof adminAccount | null = adminAccount;
let adminCredentialVersion = 0;
let victimCredentialVersion = 0;

const restores: (() => void)[] = [];
function stub<T extends object>(target: T, key: keyof T, value: unknown) {
  const object = target as Record<keyof T, unknown>;
  const original = object[key];
  object[key] = value;
  restores.push(() => { object[key] = original; });
}

beforeEach(() => {
  currentAdmin = adminAccount;
  adminCredentialVersion = 0;
  victimCredentialVersion = 0;
  stub(prisma.user, "findUnique", async ({ where }: { where: { id?: number; email?: string } }) => {
    if ((where.id === adminAccount.id || where.email === adminAccount.email) && currentAdmin) {
      return { ...currentAdmin, credential_version: adminCredentialVersion };
    }
    if (where.id === lecturerAccount.id || where.email === lecturerAccount.email) {
      return lecturerAccount;
    }
    if (where.id === victimAdmin.id || where.email === victimAdmin.email) {
      return { ...victimAdmin, credential_version: victimCredentialVersion };
    }
    return null;
  });
});
afterEach(() => {
  for (const restore of restores.splice(0).reverse()) restore();
});
after(async () => prisma.$disconnect());

describe("admin local credentials", () => {
  it("creates a user with a hashed password and returns no credential material", async () => {
    let createdPassword = "";
    stub(prisma.user, "create", async (args: unknown) => {
      const data = (args as { data: { password: string } }).data;
      createdPassword = data.password;
      return {
        id: 12,
        lecturer_code: "D501",
        email: "lecturer@example.com",
        name: "Lecturer",
        role: "Lecturer",
      };
    });

    const rawPassword = "initial-password";
    const response = await request(app)
      .post("/api/user/admin/insert-user")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        lecturer_code: "D501",
        email: "Lecturer@Example.com",
        name: "Lecturer",
        role: "Lecturer",
        password: rawPassword,
      });

    assert.equal(response.status, 200);
    assert.equal(createdPassword.startsWith("scrypt$"), true);
    assert.equal(await verifyPassword(rawPassword, createdPassword), true);
    assert.equal(JSON.stringify(response.body).includes(rawPassword), false);
    assert.equal(JSON.stringify(response.body).includes(createdPassword), false);
    assert.deepEqual(response.body.data, {
      id: 12,
      lecturer_code: "D501",
      email: "lecturer@example.com",
      name: "Lecturer",
      role: "Lecturer",
    });
  });

  it("lets an administrator set an existing user's password without returning the hash", async () => {
    let updatedPassword = "";
    stub(prisma.user, "update", async (args: unknown) => {
      const data = (args as { data: { password: string } }).data;
      updatedPassword = data.password;
      return { id: 12, email: "lecturer@example.com", name: "Lecturer" };
    });

    const rawPassword = "reset-password";
    const response = await request(app)
      .post("/api/user/admin/set-password")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: 12, password: rawPassword });

    assert.equal(response.status, 200);
    assert.equal(await verifyPassword(rawPassword, updatedPassword), true);
    assert.equal(JSON.stringify(response.body).includes(rawPassword), false);
    assert.equal(JSON.stringify(response.body).includes(updatedPassword), false);
    assert.deepEqual(response.body.data, {
      id: 12,
      email: "lecturer@example.com",
      name: "Lecturer",
    });
  });

  it("allows Microsoft-authenticated administrators with a local account to manage credentials", async () => {
    let updatedUserId = 0;
    stub(prisma.user, "update", async ({ where }: { where: { id: number } }) => {
      updatedUserId = where.id;
      return { id: where.id, email: adminAccount.email, name: adminAccount.name };
    });

    const response = await request(app)
      .post("/api/user/admin/set-password")
      .set("Authorization", `Bearer ${microsoftAdminToken}`)
      .send({ id: victimAdmin.id, password: "recovery-password" });

    assert.equal(response.status, 200);
    assert.equal(updatedUserId, victimAdmin.id);
  });

  it("rejects stale Microsoft tokens after credential changes on AuthMiddleware routes", async () => {
    assert.equal(
      (await request(app).get("/api/auth-checked").set("Authorization", `Bearer ${microsoftAdminToken}`)).status,
      200
    );
    adminCredentialVersion += 1;
    assert.equal(
      (await request(app).get("/api/auth-checked").set("Authorization", `Bearer ${microsoftAdminToken}`)).status,
      401
    );
  });

  it("revokes administrator access to credential actions after resetting their own password", async () => {
    stub(prisma.user, "update", async ({ where }: { where: { id: number } }) => {
      if (where.id === adminAccount.id) adminCredentialVersion += 1;
      return { id: where.id, email: adminAccount.email, name: adminAccount.name };
    });

    const reset = await request(app)
      .post("/api/user/admin/set-password")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: adminAccount.id, password: "recovery-password" });
    const retry = await request(app)
      .post("/api/user/admin/insert-user")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        lecturer_code: "D501",
        email: "new@example.com",
        name: "New User",
        role: "Lecturer",
        password: "initial-password",
      });

    assert.equal(reset.status, 200);
    assert.equal(retry.status, 401);
  });

  it("protects the user listing and excludes credential version from returned fields", async () => {
    const unauthenticated = await request(app).get("/api/user/admin/get-user");
    assert.equal(unauthenticated.status, 401);

    const queries: { select?: Record<string, unknown> }[] = [];
    stub(prisma.user, "findMany", async (args: { select?: Record<string, unknown> }) => {
      queries.push(args);
      return [];
    });
    const response = await request(app)
      .get("/api/user/admin/get-user")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(response.status, 200);
    assert.equal(queries.length, 4);
    assert.ok(queries.every(({ select }) => select && !("credential_version" in select)));
    assert.equal(JSON.stringify(response.body).includes("credential_version"), false);
  });

  it("sends cookies with the cross-origin Manage Users requests", async () => {
    const actions = await readFile(
      new URL("../../frontend/src/app/(pages)/(admin)/manage-users/actions.tsx", import.meta.url),
      "utf8"
    );
    const updateRoleAction = actions.slice(
      actions.indexOf("export const updateUserRole"),
      actions.indexOf("export const uploadExcelUsers")
    );
    const getUsersAction = actions.slice(
      actions.indexOf("export const getAllUsers"),
      actions.indexOf("export const updateUserRole")
    );

    assert.ok(updateRoleAction.includes('credentials: "include"'));
    assert.ok(getUsersAction.includes('credentials: "include"'));
  });

  it("accepts only positive integer JSON numbers for the target user ID", async () => {
    let writes = 0;
    stub(prisma.user, "update", async () => {
      writes += 1;
      return { id: 2, email: "user@example.com", name: "User" };
    });

    for (const id of [true, [2], "2", 0, -1, 1.5, null]) {
      const response = await request(app)
        .post("/api/user/admin/set-password")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ id, password: "reset-password" });
      assert.equal(response.status, 400, `id=${JSON.stringify(id)} should be rejected`);
    }

    assert.equal(writes, 0);
  });

  it("returns 404 without exposing Prisma errors when the target user is missing", async () => {
    stub(prisma.user, "update", async () => {
      throw new Prisma.PrismaClientKnownRequestError(
        "Record not found at C:\\server\\secret\\database.ts",
        { code: "P2025", clientVersion: "test" }
      );
    });

    const response = await request(app)
      .post("/api/user/admin/set-password")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: 99, password: "reset-password" });

    assert.equal(response.status, 404);
    assert.equal(response.body.errors, "User not found.");
    assert.equal(JSON.stringify(response.body).includes("C:\\server"), false);
  });

  it("revokes existing local sessions when an administrator resets that account's password", async () => {
    let updates = 0;
    stub(prisma.user, "update", async ({ where }: { where: { id: number } }) => {
      updates += 1;
      if (where.id === victimAdmin.id) victimCredentialVersion += 1;
      return { id: where.id, email: "victim@example.com", name: "Victim" };
    });

    const reset = await request(app)
      .post("/api/user/admin/set-password")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: victimAdmin.id, password: "recovery-password" });
    assert.equal(reset.status, 200);
    assert.equal(victimCredentialVersion, 1);

    const refresh = await request(app)
      .post("/api/auth/login-local/role")
      .set("Authorization", `Bearer ${victimToken}`)
      .send({ role: "Lecturer" });
    const secondReset = await request(app)
      .post("/api/user/admin/set-password")
      .set("Authorization", `Bearer ${victimToken}`)
      .send({ id: adminAccount.id, password: "attacker-password" });

    assert.equal(refresh.status, 401);
    assert.equal(secondReset.status, 401);
    assert.equal(updates, 1);
  });

  it("returns 409 without exposing Prisma errors for duplicate user identities", async () => {
    stub(prisma.user, "create", async () => {
      throw new Prisma.PrismaClientKnownRequestError(
        "Duplicate at C:\\server\\secret\\database.ts",
        { code: "P2002", clientVersion: "test", meta: { target: ["email"] } }
      );
    });

    const response = await request(app)
      .post("/api/user/admin/insert-user")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        lecturer_code: "D501",
        email: "existing@example.com",
        name: "Lecturer",
        role: "Lecturer",
        password: "initial-password",
      });

    assert.equal(response.status, 409);
    assert.equal(response.body.errors, "A user with this email or lecturer code already exists.");
    assert.equal(JSON.stringify(response.body).includes("C:\\server"), false);
  });

  it("creates HoP users and major links in one nested operation", async () => {
    let createArgs: unknown;
    stub(prisma.user, "create", async (args: unknown) => {
      createArgs = args;
      return {
        id: 12,
        lecturer_code: "D501",
        email: "hop@example.com",
        name: "Head",
        role: "HoP",
      };
    });

    const response = await request(app)
      .post("/api/user/admin/insert-user")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        lecturer_code: "D501",
        email: "hop@example.com",
        name: "Head",
        role: "HoP",
        password: "initial-password",
        major_ids: ["3", "7"],
      });

    assert.equal(response.status, 200);
    const data = (createArgs as {
      data: { hopMajors: { create: { major: { connect: { id: number } } }[] } };
    }).data;
    assert.deepEqual(
      data.hopMajors.create.map(({ major }) => major.connect.id),
      [3, 7]
    );
  });

  it("rejects malformed or duplicate HoP major IDs before creating an account", async () => {
    let creates = 0;
    stub(prisma.user, "create", async () => {
      creates += 1;
      return {};
    });

    for (const major_ids of [["not-a-number"], ["0"], ["1", "1"]]) {
      const response = await request(app)
        .post("/api/user/admin/insert-user")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          lecturer_code: "D501",
          email: "hop@example.com",
          name: "Head",
          role: "HoP",
          password: "initial-password",
          major_ids,
        });
      assert.equal(response.status, 400);
    }

    assert.equal(creates, 0);
  });

  it("rolls back HoP creation if a connected major does not exist", async () => {
    let creates = 0;
    let relationWrites = 0;
    stub(prisma.user, "create", async () => {
      creates += 1;
      throw new Prisma.PrismaClientKnownRequestError(
        "Missing related record at C:\\server\\secret\\database.ts",
        { code: "P2025", clientVersion: "test" }
      );
    });
    stub(prisma.hoPMajor, "createMany", async () => {
      relationWrites += 1;
      return { count: 1 };
    });

    const response = await request(app)
      .post("/api/user/admin/insert-user")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        lecturer_code: "D501",
        email: "hop@example.com",
        name: "Head",
        role: "HoP",
        password: "initial-password",
        major_ids: ["999"],
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.errors, "One or more major IDs are invalid.");
    assert.equal(JSON.stringify(response.body).includes("C:\\server"), false);
    assert.equal(creates, 1);
    assert.equal(relationWrites, 0);
  });

  it("restricts credential creation and resets to administrators", async () => {
    let writes = 0;
    stub(prisma.user, "create", async () => {
      writes += 1;
      return {};
    });
    stub(prisma.user, "update", async () => {
      writes += 1;
      return {};
    });

    const createWithoutSession = await request(app)
      .post("/api/user/admin/insert-user")
      .send({
        lecturer_code: "D501",
        email: "lecturer@example.com",
        name: "Lecturer",
        role: "Lecturer",
        password: "initial-password",
      });
    const resetAsLecturer = await request(app)
      .post("/api/user/admin/set-password")
      .set("Authorization", `Bearer ${lecturerToken}`)
      .send({ id: 12, password: "reset-password" });

    assert.equal(createWithoutSession.status, 401);
    assert.equal(resetAsLecturer.status, 403);
    assert.equal(writes, 0);
  });

  it("denies credential writes and role changes to a demoted administrator", async () => {
    currentAdmin = { ...adminAccount, role: "Lecturer" };
    let writes = 0;
    stub(prisma.user, "create", async () => {
      writes += 1;
      return {};
    });
    stub(prisma.user, "update", async () => {
      writes += 1;
      return {};
    });

    const reset = await request(app)
      .post("/api/user/admin/set-password")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: 12, password: "reset-password" });
    const roleChange = await request(app)
      .patch("/api/user/admin/update-role")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: "12", role: "Admin" });
    const create = await request(app)
      .post("/api/user/admin/insert-user")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        lecturer_code: "D501",
        email: "lecturer@example.com",
        name: "Lecturer",
        role: "Lecturer",
        password: "initial-password",
      });

    assert.equal(reset.status, 403);
    assert.equal(roleChange.status, 403);
    assert.equal(create.status, 403);
    assert.equal(writes, 0);
  });

  it("denies credential writes and role changes when the administrator was deleted", async () => {
    currentAdmin = null;
    let writes = 0;
    stub(prisma.user, "create", async () => {
      writes += 1;
      return {};
    });
    stub(prisma.user, "update", async () => {
      writes += 1;
      return {};
    });

    const reset = await request(app)
      .post("/api/user/admin/set-password")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: 12, password: "reset-password" });
    const roleChange = await request(app)
      .patch("/api/user/admin/update-role")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: "12", role: "Admin" });

    assert.equal(reset.status, 401);
    assert.equal(roleChange.status, 401);
    assert.equal(writes, 0);
  });

  it("requires current administrator authorization to change roles", async () => {
    let writes = 0;
    stub(prisma.user, "update", async () => {
      writes += 1;
      return { id: 12, role: "Admin" };
    });

    const unauthenticated = await request(app)
      .patch("/api/user/admin/update-role")
      .send({ id: "12", role: "Admin" });
    const lecturer = await request(app)
      .patch("/api/user/admin/update-role")
      .set("Authorization", `Bearer ${lecturerToken}`)
      .send({ id: "12", role: "Admin" });

    assert.equal(unauthenticated.status, 401);
    assert.equal(lecturer.status, 403);
    assert.equal(writes, 0);
  });

  it("rejects weak passwords before writing credentials", async () => {
    let writes = 0;
    stub(prisma.user, "create", async () => {
      writes += 1;
      return {};
    });
    stub(prisma.user, "update", async () => {
      writes += 1;
      return {};
    });

    const createResponse = await request(app)
      .post("/api/user/admin/insert-user")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        lecturer_code: "D501",
        email: "lecturer@example.com",
        name: "Lecturer",
        role: "Lecturer",
        password: "short",
      });
    const resetResponse = await request(app)
      .post("/api/user/admin/set-password")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ id: 12, password: "short" });

    assert.equal(createResponse.status, 400);
    assert.equal(resetResponse.status, 400);
    assert.equal(writes, 0);
  });
});
