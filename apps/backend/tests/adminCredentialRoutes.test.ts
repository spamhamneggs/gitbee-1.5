import assert from "node:assert/strict";
import { after, afterEach, describe, it } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";

process.env.DATABASE_URL ??= "******127.0.0.1:3306/test";
process.env.JWT_SECRET = "admin-credential-route-test-secret";
process.env.COOKIE_NAME = "test_auth";

const { prisma } = await import("../api/prisma/client.js");
const { default: adminUserRoutes } = await import(
  "../api/routes/user/admin/adminUserRoutes.js"
);
const { createToken } = await import("../api/utils/auth/auth.js");
const { verifyPassword } = await import("../api/utils/auth/password.js");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/user/admin", adminUserRoutes);

const adminToken = createToken(
  "admin",
  "admin",
  "Admin",
  "admin@example.com",
  ["Admin"],
  ""
).token;
const lecturerToken = createToken(
  "lecturer",
  "lecturer",
  "Lecturer",
  "lecturer@example.com",
  ["Lecturer"],
  ""
).token;

const restores: (() => void)[] = [];
function stub<T extends object>(target: T, key: keyof T, value: unknown) {
  const object = target as Record<keyof T, unknown>;
  const original = object[key];
  object[key] = value;
  restores.push(() => { object[key] = original; });
}

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
