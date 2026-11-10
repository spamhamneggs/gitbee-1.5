import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.JWT_SECRET = "session-route-test-secret";
process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:3306/test";
process.env.COOKIE_NAME = "session_route_test";
const { prisma } = await import("../api/prisma/client.js");
const { default: authRoutes } = await import("../api/routes/auth/authRoutes.js");
const { createLocalToken, createToken } = await import("../api/utils/auth/auth.js");

const account = {
  id: 1, email: "staff@example.com", name: "Staff", role: "Admin",
  user_type: "staff", student_id: null as string | null, lecturer_code: "D5001",
  binusian_id: null, credential_version: 0,
};
let user: typeof account | null;
const app = express();
app.use(express.json(), cookieParser());
app.use("/auth", authRoutes);
const originalFindUnique = prisma.user.findUnique;
beforeEach(() => {
  user = { ...account };
  prisma.user.findUnique = (async () => user) as typeof originalFindUnique;
});
afterEach(() => { prisma.user.findUnique = originalFindUnique; });
after(async () => prisma.$disconnect());
const cookieFor = (token: string) => `session_route_test=${token}`;
const claims = (token: string) => jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
const sign = (payload: jwt.JwtPayload) => jwt.sign(payload, process.env.JWT_SECRET!);

describe("backend session identity", () => {
  it("returns one token-free shape for local and SSO logins", async () => {
    const tokens = [
      [createLocalToken(account).token, "local"],
      [createToken("D5001", "BN1", "Staff", account.email, ["Admin", "Lecturer"], "upstream-secret", "", "Admin", account.id).token, "sso"],
    ];
    for (const [token, authMethod] of tokens) {
      const response = await request(app).get("/auth/session").set("Cookie", cookieFor(token!));
      assert.equal(response.status, 200);
      assert.equal(response.headers["cache-control"], "no-store");
      assert.deepEqual(response.body.data, {
        nim: "D5001", name: "STAFF", email: account.email,
        activeRole: "Admin", roles: ["Admin", "Lecturer"], authMethod,
      });
      assert.ok(!JSON.stringify(response.body).includes("upstream-secret"));
      assert.equal(response.headers["set-cookie"], undefined);
    }
  });

  it("restores and switches SSO accounts matched by lecturer code when the local email is an alias", async (t) => {
    const principal = "staff-principal@example.com";
    user = { ...account, email: "staff-alias@example.com" };
    const { default: GenericService } = await import("../api/services/generic/genericService.js");
    const originalFirst = prisma.user.findFirst;
    prisma.user.findFirst = (async ({ where }: { where: { OR: unknown[] } }) => {
      assert.ok(where.OR.some((identity) => JSON.stringify(identity) === JSON.stringify({ lecturer_code: account.lecturer_code })));
      return user;
    }) as typeof originalFirst;
    t.after(() => { prisma.user.findFirst = originalFirst; });
    t.mock.method(GenericService, "getAtlantisData", async () => ({ status: true, data: { KodeDosen: account.lecturer_code } }));
    const login = await request(app).post("/auth/login").send({
      microsoft_token: jwt.sign({ preferred_username: principal, name: "Staff" }, "upstream-test-secret"),
    });
    assert.equal(login.status, 200);
    let cookie = login.headers["set-cookie"]![0]!.split(";")[0]!;
    const payload = claims(cookie.split("=")[1]!);
    assert.equal(payload.userId, account.id);
    assert.equal(payload.email, principal);
    for (const target of ["Admin", "Lecturer"]) {
      const restored = await request(app).get("/auth/session").set("Cookie", cookie);
      assert.equal(restored.status, 200);
      assert.equal(restored.body.data.email, principal);
      const switched = await request(app).post("/auth/session/role").set("Cookie", cookie).send({ role: target });
      assert.equal(switched.status, 200);
      assert.equal(switched.body.data.session.activeRole, target);
      assert.equal(switched.body.data.session.email, principal);
      cookie = switched.headers["set-cookie"]![0]!.split(";")[0]!;
    }
    const aliasPayload = claims(cookie.split("=")[1]!);
    // Existing cookies infer SSO from their upstream token; 5.9 cookies need only the explicit method.
    for (const legacy of [false, true]) {
      const payload = { ...aliasPayload };
      if (legacy) delete payload.authMethod;
      else delete payload.microsoftToken;
      const restored = await request(app).get("/auth/session").set("Cookie", cookieFor(sign(payload)));
      assert.equal(restored.status, 200);
      assert.equal(restored.body.data.authMethod, "sso");
    }
  });

  it("keeps email equality checks for local and unbound SSO sessions", async () => {
    const local = claims(createLocalToken(account).token);
    const unboundSso = claims(createToken("D5001", "BN1", "Staff", "other@example.com",
      ["Admin", "Lecturer"], "upstream-secret", "", "Lecturer").token);
    for (const payload of [{ ...local, email: "other@example.com" }, unboundSso]) {
      const cookie = cookieFor(sign(payload));
      assert.equal((await request(app).get("/auth/session").set("Cookie", cookie)).status, 401);
      const switched = await request(app).post("/auth/session/role").set("Cookie", cookie).send({ role: "Admin" });
      assert.equal(switched.status, 401);
      assert.equal(switched.headers["set-cookie"], undefined);
    }
  });

  it("still rejects changed identity, membership, revoked credentials and deleted users for SSO aliases", async () => {
    const cookie = cookieFor(createToken("D5001", "BN1", "Staff", "staff-principal@example.com",
      ["Admin", "Lecturer"], "upstream-secret", "", "Lecturer", account.id).token);
    for (const changed of [
      { ...account, lecturer_code: "D5002" },
      { ...account, role: "Lecturer" },
      { ...account, credential_version: 1 },
      null,
    ]) {
      user = changed;
      assert.equal((await request(app).get("/auth/session").set("Cookie", cookie)).status, 401);
      const switched = await request(app).post("/auth/session/role").set("Cookie", cookie).send({ role: "Lecturer" });
      assert.equal(switched.status, 401);
      assert.equal(switched.headers["set-cookie"], undefined);
    }
  });

  it("restores legacy SSO sessions, including students without a local user row", async () => {
    user = null;
    const payload = claims(createToken("2702000001", "BN1", "Student", "student@example.com", ["Student"], "upstream-secret", "", "Student").token);
    delete payload.authMethod;
    const response = await request(app).get("/auth/session").set("Cookie", cookieFor(sign(payload)));
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, {
      nim: "2702000001", name: "STUDENT", email: "student@example.com",
      activeRole: "Student", roles: ["Student"], authMethod: "sso",
    });
  });

  it("restores legacy local sessions and SSO sessions without an embedded Microsoft token", async () => {
    for (const authMethod of ["local", "sso"]) {
      const payload = claims(createLocalToken(account).token);
      delete payload.microsoftToken;
      if (authMethod === "local") delete payload.authMethod;
      else payload.authMethod = "sso";
      const response = await request(app).get("/auth/session").set("Cookie", cookieFor(sign(payload)));
      assert.equal(response.status, 200);
      assert.equal(response.body.data.authMethod, authMethod);
    }
  });

  it("restores the selected role after a cookie-only switch", async () => {
    const cookie = cookieFor(createLocalToken(account).token);
    const switched = await request(app).post("/auth/login-local/role").set("Cookie", cookie).send({ role: "Lecturer" });
    assert.equal(switched.status, 200);
    const response = await request(app).get("/auth/session").set("Cookie", switched.headers["set-cookie"]![0]!.split(";")[0]!);
    assert.equal(response.body.data.activeRole, "Lecturer");
  });

  it("switches restored SSO sessions using only their cookie and preserves their method and expiry", async () => {
    const payload = claims(createToken("D5001", "BN1", "Staff", account.email,
      ["Admin", "Lecturer"], "", "", "Lecturer", account.id).token);
    delete payload.microsoftToken;
    for (const legacy of [false, true]) {
      if (legacy) {
        delete payload.authMethod;
        delete payload.userId;
        payload.microsoftToken = "legacy-upstream-secret";
      }
      const switched = await request(app).post("/auth/session/role")
        .set("Cookie", cookieFor(sign(payload))).send({ role: "Admin" });
      assert.equal(switched.status, 200);
      assert.deepEqual(switched.body.data.session, {
        nim: "D5001", name: "STAFF", email: account.email,
        activeRole: "Admin", roles: ["Admin", "Lecturer"], authMethod: "sso",
      });
      assert.ok(!JSON.stringify(switched.body).includes("legacy-upstream-secret"));
      const token = switched.headers["set-cookie"]![0]!.split(";")[0]!.split("=")[1]!;
      assert.equal(claims(token).authMethod, "sso");
      assert.equal(claims(token).activeRole, "Admin");
      assert.equal(claims(token).exp, payload.exp);
    }
  });

  it("requires a valid session and assigned role before issuing a role-switch cookie", async () => {
    assert.equal((await request(app).post("/auth/session/role").send({ role: "Admin" })).status, 401);
    const cookie = cookieFor(createLocalToken(account).token);
    for (const [body, status] of [[{}, 400], [{ role: "Student" }, 403]] as const) {
      const response = await request(app).post("/auth/session/role").set("Cookie", cookie).send(body);
      assert.equal(response.status, status);
      assert.equal(response.headers["set-cookie"], undefined);
    }
    const switched = await request(app).post("/auth/session/role").set("Cookie", cookie).send({ role: "Lecturer" });
    assert.equal(switched.status, 200);
    assert.equal(switched.body.data.session.authMethod, "local");
    assert.equal(switched.body.data.session.activeRole, "Lecturer");
  });

  it("rejects stale membership and identity instead of mixing old and current claims", async () => {
    const cookie = cookieFor(createLocalToken(account).token);
    for (const changed of [
      { ...account, role: "Lecturer" },
      { ...account, role: "Student", user_type: "student", student_id: "2702000001" },
      { ...account, lecturer_code: "D5002" },
    ]) {
      user = changed;
      const response = await request(app).get("/auth/session").set("Cookie", cookie);
      assert.equal(response.status, 401);
      assert.equal(response.body.data, null);
      assert.equal((await request(app).post("/auth/session/role").set("Cookie", cookie).send({ role: "Lecturer" })).status, 401);
    }
  });

  it("includes the cookie's canonical session in each login response while keeping legacy fields", async (t) => {
    const { default: GenericService } = await import("../api/services/generic/genericService.js");
    const { hashPassword } = await import("../api/utils/auth/password.js");
    const originalRaw = prisma.$queryRaw;
    const originalFirst = prisma.user.findFirst;
    const originalUpsert = prisma.user.upsert;
    prisma.$queryRaw = (async () => [{ password: await hashPassword("password123") }]) as typeof originalRaw;
    prisma.user.findFirst = (async () => user) as typeof originalFirst;
    prisma.user.upsert = (async () => user) as typeof originalUpsert;
    t.after(() => {
      prisma.$queryRaw = originalRaw;
      prisma.user.findFirst = originalFirst;
      prisma.user.upsert = originalUpsert;
    });
    t.mock.method(GenericService, "getAtlantisData", async () => ({ status: true, data: { KodeDosen: "D5001" } }));
    const bypass = process.env.BYPASS_SSO;
    const nodeEnv = process.env.NODE_ENV;
    process.env.BYPASS_SSO = "true";
    process.env.NODE_ENV = "development";
    try {
      for (const [path, body, authMethod] of [
        ["login-local", { email: account.email, password: "password123" }, "local"],
        ["login-dev", {}, "local"],
        ["login", { microsoft_token: jwt.sign({ preferred_username: account.email, name: "Staff" }, "upstream-test-secret") }, "sso"],
      ] as const) {
        const response = await request(app).post(`/auth/${path}`).send(body);
        assert.equal(response.status, 200);
        assert.equal(response.body.data.Name, "STAFF");
        assert.deepEqual(response.body.data.Role, ["Admin", "Lecturer"]);
        assert.equal(response.body.data.session.authMethod, authMethod);
        assert.equal(response.body.data.session.activeRole, response.body.data.ActiveRole);
        assert.equal(response.body.data.session.MicrosoftToken, undefined);
        const restored = await request(app).get("/auth/session")
          .set("Cookie", response.headers["set-cookie"]![0]!.split(";")[0]!);
        assert.deepEqual(response.body.data.session, restored.body.data);
      }
    } finally {
      if (bypass === undefined) delete process.env.BYPASS_SSO;
      else process.env.BYPASS_SSO = bypass;
      if (nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = nodeEnv;
    }
  });

  it("rejects missing, forged, expired, malformed, revoked and deleted-user sessions", async () => {
    const valid = createLocalToken(account).token;
    const payload = claims(valid);
    const withoutExpiry = { ...payload };
    delete withoutExpiry.exp;
    for (const token of ["", "broken", jwt.sign(payload, "wrong-secret"),
      sign({ ...payload, exp: 1 }), sign(withoutExpiry), sign({ ...payload, role: [42] }),
      sign({ ...payload, name: null }), sign({ ...payload, userId: -1 })]) {
      const response = await request(app).get("/auth/session").set("Cookie", cookieFor(token));
      assert.equal(response.status, 401);
      assert.equal(response.body.data, null);
      assert.equal(response.headers["cache-control"], "no-store");
    }
    user = { ...account, credential_version: 1 };
    assert.equal((await request(app).get("/auth/session").set("Cookie", cookieFor(valid))).status, 401);
    user = null;
    assert.equal((await request(app).get("/auth/session").set("Cookie", cookieFor(valid))).status, 401);
  });

  it("clears the configured cookie on the server and permits repeated logout", async () => {
    const agent = request.agent(app);
    agent.jar.setCookie(`${cookieFor(createLocalToken(account).token)}; Path=/; HttpOnly`);
    assert.equal((await agent.get("/auth/session")).status, 200);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await agent.post("/auth/logout");
      assert.equal(response.status, 200);
      assert.match(response.headers["set-cookie"]![0]!, /^session_route_test=; Path=\/; Expires=Thu, 01 Jan 1970/);
      assert.equal((await agent.get("/auth/session")).status, 401);
    }
  });
});
