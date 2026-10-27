import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "local-auth-route-test-secret";
process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:3306/test";
process.env.COOKIE_NAME = "gitbee_token";
const { prisma } = await import("../api/prisma/client.js");
const { default: authRoutes } = await import("../api/routes/auth/authRoutes.js");
const { createLocalToken } = await import("../api/utils/auth/auth.js");
const { hashPassword, verifyPassword } = await import("../api/utils/auth/password.js");
const { RoleMiddleware } = await import("../api/middlewares/roleMiddleware.js");

const originalPassword = "original-password";
const originalHash = await hashPassword(originalPassword);
const staff = {
  id: 1, email: "staff@example.com", name: "Staff", role: "Admin",
  user_type: null as string | null, student_id: "2702000001",
  lecturer_code: "D5001", binusian_id: "BN1",
};
let user = { ...staff };
let passwordHash = originalHash;
let credentialReads = 0;
let passwordWrites = 0;
let claimedId = 0;
const app = express();
app.set("trust proxy", true);
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRoutes);
app.get("/lecturer", RoleMiddleware("Lecturer"), (_req, res) => res.sendStatus(200));

const session = () => `gitbee_token=${createLocalToken(user).token}`;
const change = (currentPassword: string, ip = "192.0.2.1", cookie = session()) =>
  request(app).post("/auth/change-password").set("Cookie", cookie)
    .set("X-Forwarded-For", ip)
    .send({ currentPassword, newPassword: "replacement-password", email: `attacker${claimedId}@example.com`, userId: ++claimedId });

const restores: (() => void)[] = [];
function stub<T extends object>(target: T, key: keyof T, value: unknown) {
  const object = target as Record<keyof T, unknown>;
  const original = object[key];
  object[key] = value;
  restores.push(() => { object[key] = original; });
}

beforeEach(() => {
  user = { ...staff };
  passwordHash = originalHash;
  credentialReads = 0;
  passwordWrites = 0;
  stub(prisma.user, "findUnique", async () => user);
  stub(prisma, "$queryRaw", async () => {
    credentialReads += 1;
    return [{ password: passwordHash }];
  });
  stub(prisma.user, "update", async ({ data }: { data: { password: string } }) => {
    passwordHash = data.password;
    passwordWrites += 1;
    return user;
  });
});
afterEach(() => {
  for (const restore of restores.splice(0).reverse()) restore();
});

describe("local authentication routes", () => {
  it("never grants Lecturer access to an explicit Student with a blank or unknown type", async () => {
    user = { ...staff, id: 10, role: "Student", email: "student@example.com" };
    for (const type of ["", " ", "unknown", "staff", "student", null]) {
      user.user_type = type;
      const response = await request(app).post("/auth/login-local")
        .send({ email: user.email, password: originalPassword });
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.data.Role, ["Student"]);
      assert.equal(response.body.data.nim, user.student_id);
      const cookie = response.headers["set-cookie"]![0]!;
      const claims = jwt.verify(cookie.split(";")[0]!.slice("gitbee_token=".length), process.env.JWT_SECRET!);
      assert.equal(typeof claims, "object");
      assert.equal((claims as jwt.JwtPayload).activeRole, "Student");
      assert.equal((await request(app).get("/lecturer").set("Cookie", cookie)).status, 403);
    }
  });

  it("limits password guesses by verified user ID across IPs and attacker-supplied identities", async () => {
    user.id = 20;
    const cookie = session();
    for (let index = 0; index < 5; index += 1) {
      assert.equal((await change("wrong", `192.0.2.${index + 10}`, cookie)).status, 401);
    }
    const response = await change(originalPassword, "192.0.2.99", cookie);
    assert.equal(response.status, 429);
    assert.ok(Number(response.headers["retry-after"]) > 0);
    assert.equal(credentialReads, 5);
    assert.equal(passwordWrites, 0);
    assert.equal(passwordHash, originalHash);
  });

  it("refuses to issue a local session for an unrecognized staff classification", async () => {
    for (const user_type of ["", "unknown"]) {
      user.user_type = user_type;
      const response = await request(app).post("/auth/login-local")
        .send({ email: user.email, password: originalPassword });
      assert.equal(response.status, 403);
      assert.equal(response.headers["set-cookie"], undefined);
    }
  });

  it("limits password guesses by IP across verified accounts", async () => {
    for (let index = 0; index < 20; index += 1) {
      user.id = 100 + index;
      assert.equal((await change("wrong", "198.51.100.1")).status, 401);
    }
    user.id = 200;
    assert.equal((await change(originalPassword, "198.51.100.1")).status, 429);
    assert.equal(credentialReads, 20);
    assert.equal(passwordWrites, 0);
  });

  it("changes a password with a verified bearer session and does not count successes as failures", async () => {
    user.id = 30;
    for (let index = 0; index < 6; index += 1) {
      const response = await request(app).post("/auth/change-password")
        .set("Authorization", `Bearer ${createLocalToken(user).token}`)
        .set("X-Forwarded-For", "203.0.113.1")
        .send({ currentPassword: index === 0 ? originalPassword : "replacement-password", newPassword: "replacement-password" });
      assert.equal(response.status, 200);
    }
    assert.equal(passwordWrites, 6);
    assert.equal(await verifyPassword("replacement-password", passwordHash), true);
    assert.equal(await verifyPassword(originalPassword, passwordHash), false);
  });

  it("rejects missing, forged, and non-local sessions before reading credentials", async () => {
    for (const token of ["", jwt.sign({ userId: 1 }, "forged"), jwt.sign({ email: staff.email }, process.env.JWT_SECRET!), jwt.sign({ userId: "1" }, process.env.JWT_SECRET!)]) {
      const response = await request(app).post("/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: originalPassword, newPassword: "replacement-password" });
      assert.equal(response.status, 401);
    }
    assert.equal(credentialReads, 0);
    assert.equal(passwordWrites, 0);
  });

  it("serves the Header role-switch contract with refreshed database membership and claims", async () => {
    const header = await readFile(new URL("../../frontend/src/app/components/layout/Header.tsx", import.meta.url), "utf8");
    assert.ok(header.includes("auth/login-local/role"));
    assert.ok(header.includes('credentials: "include"'));
    for (const role of ["Admin", "SCC", "HoP"]) {
      user = { ...staff, role };
      const response = await request(app).post("/auth/login-local/role")
        .set("Cookie", session()).send({ role: "Lecturer" });
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.data, {
        nim: "D5001", Name: "STAFF", Email: staff.email,
        Role: [role, "Lecturer"], ActiveRole: "Lecturer", MicrosoftToken: "",
      });
      const cookie = response.headers["set-cookie"]![0]!;
      const claims = jwt.verify(cookie.split(";")[0]!.slice("gitbee_token=".length), process.env.JWT_SECRET!) as jwt.JwtPayload;
      assert.equal(claims.activeRole, "Lecturer");
      assert.equal(claims.nim, "D5001");
      const back = await request(app).post("/auth/login-local/role").set("Cookie", cookie).send({ role });
      assert.equal(back.status, 200);
      assert.equal(back.body.data.ActiveRole, role);
    }
    const staleCookie = session();
    user = { ...staff, role: "Student", user_type: "student" };
    assert.equal((await request(app).post("/auth/login-local/role").set("Cookie", staleCookie).send({ role: "Lecturer" })).status, 403);
    assert.equal((await request(app).post("/auth/login-local/role").set("Cookie", staleCookie).send({ role: "Admin" })).status, 403);
  });

  it("rejects invalid role-switch sessions, unknown roles, malformed input, and deleted users", async () => {
    for (const token of ["", jwt.sign({ userId: 1 }, "forged"), jwt.sign({ email: staff.email }, process.env.JWT_SECRET!)]) {
      assert.equal((await request(app).post("/auth/login-local/role").set("Authorization", `Bearer ${token}`).send({ role: "Lecturer" })).status, 401);
    }
    assert.equal((await request(app).post("/auth/login-local/role").set("Cookie", session()).send({ role: "Student" })).status, 403);
    assert.equal((await request(app).post("/auth/login-local/role").set("Cookie", session()).send({})).status, 400);
    stub(prisma.user, "findUnique", async () => null);
    assert.equal((await request(app).post("/auth/login-local/role").set("Cookie", session()).send({ role: "Lecturer" })).status, 401);
    assert.equal(credentialReads, 0);
  });
});
