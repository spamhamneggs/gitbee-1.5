import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.JWT_SECRET = "local-role-access-test-secret";
process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:3306/test";
process.env.COOKIE_NAME = "role_test_session";
const { prisma } = await import("../api/prisma/client.js");
const { default: authRoutes } = await import("../api/routes/auth/authRoutes.js");
const { AuthMiddleware } = await import("../api/middlewares/authMiddleware.js");
const { RoleMiddleware } = await import("../api/middlewares/roleMiddleware.js");
const { createLocalToken } = await import("../api/utils/auth/auth.js");

const roles = ["Student", "Lecturer", "SCC", "HoP", "Admin"];
const account = {
  id: 1, email: "local@example.com", name: "Local User", role: "Admin",
  user_type: "staff", student_id: null, lecturer_code: "LOCAL1",
  binusian_id: null, credential_version: 0,
};
let user: typeof account | null;
const app = express();
app.use(express.json(), cookieParser());
app.use("/api/auth", authRoutes);
app.get("/session", AuthMiddleware(), (_req, res) => res.sendStatus(200));
for (const role of roles) {
  // Real middleware chain; the final handler has no database side effects.
  app.get(`/${role}`, AuthMiddleware(), RoleMiddleware(role), (_req, res) => res.sendStatus(200));
}
const original = prisma.user.findUnique;
beforeEach(() => {
  user = { ...account };
  prisma.user.findUnique = (async () => user) as typeof original;
});
afterEach(() => { prisma.user.findUnique = original; });
after(async () => prisma.$disconnect());
const cookieFor = (token: string) => `role_test_session=${token}`;

describe("local RoleMiddleware access", () => {
  it("enforces the five-role membership matrix for cookies and bearer tokens", async () => {
    for (const role of roles) {
      user = { ...account, role, user_type: role === "Student" ? "student" : "staff" };
      const token = createLocalToken(user).token;
      const membership = role === "Student" || role === "Lecturer" ? [role] : [role, "Lecturer"];
      for (const required of roles) {
        const expected = membership.includes(required) ? 200 : 403;
        assert.equal((await request(app).get(`/${required}`).set("Cookie", cookieFor(token))).status, expected, `${role} cookie -> ${required}`);
        assert.equal((await request(app).get(`/${required}`).set("Authorization", `Bearer ${token}`)).status, expected, `${role} bearer -> ${required}`);
      }
    }
  });

  it("rejects absent, forged, expired and deleted-account sessions", async () => {
    const valid = createLocalToken(account).token;
    for (const token of ["", "not-a-jwt", jwt.sign({ userId: 1 }, "wrong-secret"), jwt.sign({ userId: 1, exp: 1 }, process.env.JWT_SECRET!)]) {
      assert.equal((await request(app).get("/Admin").set("Cookie", cookieFor(token))).status, 401);
    }
    user = null;
    assert.equal((await request(app).get("/session").set("Cookie", cookieFor(valid))).status, 401);
    assert.equal((await request(app).get("/Admin").set("Cookie", cookieFor(valid))).status, 401);
  });

  it("rejects sessions with stale membership or credential versions", async () => {
    const oldToken = createLocalToken(account).token;
    user = { ...account, role: "Student", user_type: "student" };
    assert.equal((await request(app).get("/Admin").set("Cookie", cookieFor(oldToken))).status, 401);
    assert.equal((await request(app).get("/Lecturer").set("Cookie", cookieFor(oldToken))).status, 401);
    assert.equal((await request(app).get("/Student").set("Cookie", cookieFor(oldToken))).status, 401);
    user.credential_version += 1;
    assert.equal((await request(app).get("/session").set("Cookie", cookieFor(oldToken))).status, 401);
    assert.equal((await request(app).get("/Student").set("Cookie", cookieFor(oldToken))).status, 401);
  });

  it("switches every multi-role staff account to Lecturer and back without Microsoft", async () => {
    for (const role of ["Admin", "SCC", "HoP"]) {
      user = { ...account, role };
      let cookie = cookieFor(createLocalToken(user).token);
      for (const target of ["Lecturer", role]) {
        const response = await request(app).post("/api/auth/login-local/role").set("Cookie", cookie).send({ role: target });
        assert.equal(response.status, 200);
        assert.equal(response.body.data.ActiveRole, target);
        assert.equal(response.body.data.MicrosoftToken, "");
        cookie = response.headers["set-cookie"]![0]!.split(";")[0]!;
        const payload = jwt.verify(cookie.slice("role_test_session=".length), process.env.JWT_SECRET!) as jwt.JwtPayload;
        assert.equal(payload.userId, user.id);
        assert.equal(payload.activeRole, target);
        assert.equal((await request(app).get(`/${role}`).set("Cookie", cookie)).status, 200);
        assert.equal((await request(app).get("/Lecturer").set("Cookie", cookie)).status, 200);
        assert.equal((await request(app).get("/Student").set("Cookie", cookie)).status, 403);
      }
    }
  });

  it("rejects unassigned role switches without issuing a replacement cookie", async () => {
    user = { ...account, role: "Student", user_type: "student" };
    const cookie = cookieFor(createLocalToken(user).token);
    for (const role of ["Admin", "Lecturer", "SCC", "HoP", "unknown"]) {
      const response = await request(app).post("/api/auth/login-local/role").set("Cookie", cookie).send({ role });
      assert.equal(response.status, 403);
      assert.equal(response.headers["set-cookie"], undefined);
      assert.equal((await request(app).get("/Student").set("Cookie", cookie)).status, 200);
    }
  });
});
