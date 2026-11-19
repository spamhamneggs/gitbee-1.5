import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const databaseUrl = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL = databaseUrl ?? "mysql://test:test@127.0.0.1:3306/test";
process.env.JWT_SECRET = "local-role-mysql-test-secret";
process.env.COOKIE_NAME = "local_role_mysql";
const { prisma } = await import("../api/prisma/client.js");
const { default: authRoutes } = await import("../api/routes/auth/authRoutes.js");
const { AuthMiddleware } = await import("../api/middlewares/authMiddleware.js");
const { RoleMiddleware } = await import("../api/middlewares/roleMiddleware.js");
const { hashPassword } = await import("../api/utils/auth/password.js");

const roles = ["Student", "Lecturer", "SCC", "HoP", "Admin"];
const domain = `task45-${randomBytes(6).toString("hex")}.example.com`;
const emailFor = (role: string) => `${role.toLowerCase()}@${domain}`;
const password = "Task45-local-password";
const app = express();
app.use(express.json(), cookieParser());
app.use("/api/auth", authRoutes);
for (const role of roles) {
  app.get(`/${role}`, AuthMiddleware(), RoleMiddleware(role), (_req, res) => res.sendStatus(200));
}

before(async () => {
  if (!databaseUrl) return;
  const passwordHash = await hashPassword(password);
  await prisma.user.createMany({ data: roles.map((role, index) => ({
    email: emailFor(role), name: `Task 4.5 ${role}`, role, password: passwordHash,
    user_type: role === "Student" ? "student" : "staff",
    student_id: role === "Student" ? `S-${domain.slice(0, 19)}` : null,
    lecturer_code: role === "Student" ? null : `D${index}-${domain.slice(0, 19)}`,
  })) });
});
after(async () => {
  if (databaseUrl) await prisma.user.deleteMany({ where: { email: { endsWith: `@${domain}` } } });
  await prisma.$disconnect();
});

describe("local role flows against MySQL", {
  skip: databaseUrl ? false : "set TEST_DATABASE_URL to a migrated test database",
}, () => {
  it("logs in all five roles with real credentials and checks each protected role", async () => {
    for (const role of roles) {
      const agent = request.agent(app);
      const login = await agent.post("/api/auth/login-local").send({ email: emailFor(role), password });
      assert.equal(login.status, 200, role);
      const membership = [role, ...(["Admin", "SCC", "HoP"].includes(role) ? ["Lecturer"] : [])];
      assert.deepEqual(login.body.data.Role, membership);
      assert.equal(login.body.data.ActiveRole, role);
      assert.equal(login.body.data.MicrosoftToken, "");
      for (const required of roles) {
        assert.equal((await agent.get(`/${required}`)).status, membership.includes(required) ? 200 : 403, `${role} -> ${required}`);
      }
    }
  });

  it("persists local staff role switches in the cookie and refuses escalation", async () => {
    for (const role of ["Admin", "SCC", "HoP"]) {
      const agent = request.agent(app);
      assert.equal((await agent.post("/api/auth/login-local").send({ email: emailFor(role), password })).status, 200);
      for (const target of ["Lecturer", role]) {
        const response = await agent.post("/api/auth/login-local/role").send({ role: target });
        assert.equal(response.status, 200);
        const cookie = response.headers["set-cookie"]![0]!.split(";")[0]!;
        const payload = jwt.verify(cookie.slice("local_role_mysql=".length), process.env.JWT_SECRET!) as jwt.JwtPayload;
        assert.equal(payload.activeRole, target);
        assert.equal(payload.microsoftToken, "");
        assert.equal((await agent.get(`/${role}`)).status, 200);
        assert.equal((await agent.get("/Lecturer")).status, 200);
      }
      const denied = await agent.post("/api/auth/login-local/role").send({ role: "Student" });
      assert.equal(denied.status, 403);
      assert.equal(denied.headers["set-cookie"], undefined);
      assert.equal((await agent.get(`/${role}`)).status, 200);
    }
  });

  it("applies database demotions and credential revocations to an existing session", async () => {
    const agent = request.agent(app);
    assert.equal((await agent.post("/api/auth/login-local").send({ email: emailFor("Admin"), password })).status, 200);
    await prisma.user.update({ where: { email: emailFor("Admin") }, data: { role: "Lecturer" } });
    assert.equal((await agent.get("/Admin")).status, 401);
    assert.equal((await agent.get("/Lecturer")).status, 401);
    assert.equal((await agent.post("/api/auth/login-local/role").send({ role: "Admin" })).status, 401);
    assert.equal((await agent.post("/api/auth/login-local").send({ email: emailFor("Admin"), password })).status, 200);
    assert.equal((await agent.get("/Lecturer")).status, 200);
    await prisma.user.update({ where: { email: emailFor("Admin") }, data: { credential_version: { increment: 1 } } });
    assert.equal((await agent.get("/Lecturer")).status, 401);
    assert.equal((await agent.post("/api/auth/login-local/role").send({ role: "Lecturer" })).status, 401);
  });
});
