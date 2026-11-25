import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import cookieParser from "cookie-parser";
import { createHmac } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.JWT_SECRET = "local-role-access-test-secret";
process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:3306/test";
process.env.COOKIE_NAME = "role_test_session";
const { prisma } = await import("../api/prisma/client.js");
const { default: authRoutes } = await import("../api/routes/auth/authRoutes.js");
const { default: apiRoutes } = await import("../api/routes/Routes.js");
const { AuthMiddleware } = await import("../api/middlewares/authMiddleware.js");
const { RoleMiddleware } = await import("../api/middlewares/roleMiddleware.js");
const { createLocalToken, normalizeRoles } = await import("../api/utils/auth/auth.js");

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
app.get("/multiword", AuthMiddleware(), RoleMiddleware("Head of Program"), (_req, res) => res.sendStatus(200));
app.get("/wrong-multiword", AuthMiddleware(), RoleMiddleware("Program"), (_req, res) => res.sendStatus(200));
app.get("/non-string-cookie", (req, _res, next) => {
  req.cookies = { role_test_session: { token: "not-a-string" } };
  next();
}, AuthMiddleware(), (_req, res) => res.sendStatus(200));
app.use("/api", apiRoutes);
const original = prisma.user.findUnique;
beforeEach(() => {
  user = { ...account };
  prisma.user.findUnique = (async () => user) as typeof original;
});
afterEach(() => { prisma.user.findUnique = original; });
after(async () => prisma.$disconnect());
const cookieFor = (token: string) => `role_test_session=${token}`;
const signPayload = (payload: unknown) => {
  const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const input = `${header}.${body}`;
  const signature = createHmac("sha256", process.env.JWT_SECRET!).update(input).digest("base64url");
  return `${input}.${signature}`;
};

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
    const incompleteClaims = [
      jwt.sign({ userId: 1, email: account.email }, process.env.JWT_SECRET!),
      jwt.sign({ email: account.email, role: ["Admin"] }, process.env.JWT_SECRET!),
      jwt.sign({ userId: 1, role: ["Admin"] }, process.env.JWT_SECRET!),
    ];
    for (const token of ["", "not-a-jwt", jwt.sign({ userId: 1 }, "wrong-secret"), jwt.sign({ userId: 1, exp: 1 }, process.env.JWT_SECRET!), ...incompleteClaims]) {
      assert.equal((await request(app).get("/Admin").set("Cookie", cookieFor(token))).status, 401);
    }
    user = null;
    assert.equal((await request(app).get("/session").set("Cookie", cookieFor(valid))).status, 401);
    assert.equal((await request(app).get("/Admin").set("Cookie", cookieFor(valid))).status, 401);
  });

  it("rejects malformed authorization inputs, payloads and identity or role claims", async () => {
    const valid = createLocalToken(account).token;
    assert.equal((await request(app).get("/session").set("Authorization", `bearer ${valid}`)).status, 200);
    assert.equal((await request(app).get("/session").set("Authorization", `Bearer   ${valid}`)).status, 200);
    assert.equal((await request(app).get("/session").set("Authorization", "Bearer ")).status, 401);
    assert.equal((await request(app).get("/non-string-cookie")).status, 401);

    for (const payload of ["not-an-object", [], null]) {
      assert.equal((await request(app).get("/Admin").set("Cookie", cookieFor(signPayload(payload)))).status, 401);
    }

    const validClaims = {
      userId: 1,
      nim: "LOCAL1",
      email: account.email,
      role: ["Admin", "Lecturer"],
    };
    for (const userId of [0, -1, Number.NaN, "1"]) {
      const token = signPayload({ ...validClaims, userId });
      assert.equal((await request(app).get("/Admin").set("Cookie", cookieFor(token))).status, 401);
    }
    for (const email of ["", "   "]) {
      const token = signPayload({ ...validClaims, email });
      assert.equal((await request(app).get("/Admin").set("Cookie", cookieFor(token))).status, 401);
    }
    for (const role of ["", [], [""], [null, 123, "Admin"], ["__proto__"], ["constructor"], ["prototype"]]) {
      const token = signPayload({ ...validClaims, role });
      assert.equal((await request(app).get("/Admin").set("Cookie", cookieFor(token))).status, 401);
    }
  });

  it("preserves multi-word role claims as one role", async () => {
    const programRoles = normalizeRoles("Head of Program")!;
    const staffRoles = normalizeRoles("Admin Lecturer")!;
    assert.deepEqual(programRoles, ["Head of Program"]);
    assert.deepEqual(staffRoles, ["Admin Lecturer"]);
    assert.equal(programRoles.includes("Program"), false);
    assert.equal(staffRoles.includes("Admin"), false);
    assert.deepEqual(normalizeRoles("Student,Admin"), ["Student", "Admin"]);
    user = null;
    const token = jwt.sign({
      nim: "NIM1",
      email: "untracked@example.com",
      role: "Head of Program",
    }, process.env.JWT_SECRET!);
    assert.equal((await request(app).get("/multiword").set("Cookie", cookieFor(token))).status, 401);
    assert.equal((await request(app).get("/wrong-multiword").set("Cookie", cookieFor(token))).status, 401);
  });

  it("rejects untracked legacy staff tokens but allows explicitly unprovisioned SSO students", async () => {
    user = null;
    const staleStaffToken = jwt.sign({
      nim: "STAFF1",
      email: "deleted-staff@example.com",
      role: ["Admin", "Lecturer"],
      activeRole: "Admin",
      authMethod: "sso",
    }, process.env.JWT_SECRET!);
    for (const path of ["/session", "/Admin", "/Lecturer"]) {
      assert.equal((await request(app).get(path).set("Cookie", cookieFor(staleStaffToken))).status, 401, path);
    }

    const unprovisionedStudentToken = jwt.sign({
      nim: "STUDENT1",
      email: "unprovisioned@example.com",
      role: ["Student"],
      activeRole: "Student",
      authMethod: "sso",
      unprovisionedStudent: true,
    }, process.env.JWT_SECRET!);
    assert.equal((await request(app).get("/session").set("Cookie", cookieFor(unprovisionedStudentToken))).status, 200);
    assert.equal((await request(app).get("/Student").set("Cookie", cookieFor(unprovisionedStudentToken))).status, 200);
    assert.equal((await request(app).get("/Admin").set("Cookie", cookieFor(unprovisionedStudentToken))).status, 403);

    const switchedMarkerToken = jwt.sign({
      nim: "STUDENT1",
      email: "unprovisioned@example.com",
      role: ["Student"],
      activeRole: "Admin",
      authMethod: "sso",
      unprovisionedStudent: true,
    }, process.env.JWT_SECRET!);
    assert.equal((await request(app).get("/Student").set("Cookie", cookieFor(switchedMarkerToken))).status, 401);

    const escalatedMarkerToken = jwt.sign({
      nim: "STAFF1",
      email: "deleted-staff@example.com",
      role: ["Admin"],
      authMethod: "sso",
      unprovisionedStudent: true,
    }, process.env.JWT_SECRET!);
    assert.equal((await request(app).get("/Admin").set("Cookie", cookieFor(escalatedMarkerToken))).status, 401);
  });

  it("enforces role checks on the actual assessment route", async () => {
    user = { ...account, role: "Student", user_type: "student" };
    const token = createLocalToken(user).token;
    assert.equal(
      (await request(app).post("/api/assessment/insert").set("Cookie", cookieFor(token)).send({})).status,
      403,
    );
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
