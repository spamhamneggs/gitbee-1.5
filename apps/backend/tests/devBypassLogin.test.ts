import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "dev-bypass-login-test-secret";
process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:3306/test";
process.env.COOKIE_NAME = "gitbee_token";
const { prisma } = await import("../api/prisma/client.js");
const { default: authRoutes } = await import("../api/routes/auth/authRoutes.js");
const { AuthMiddleware } = await import("../api/middlewares/authMiddleware.js");
const { RoleMiddleware } = await import("../api/middlewares/roleMiddleware.js");
const { DEV_BYPASS_USER, isSsoBypassEnabled } = await import("../api/utils/auth/devBypass.js");

const devUser = {
  id: 42, ...DEV_BYPASS_USER, student_id: null, binusian_id: null, credential_version: 0,
};
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRoutes);
app.get("/admin", AuthMiddleware(), RoleMiddleware("Admin"), (_req, res) => res.sendStatus(200));

const restores: (() => void)[] = [];
function stub<T extends object>(target: T, key: keyof T, value: unknown) {
  const object = target as Record<keyof T, unknown>;
  const original = object[key];
  object[key] = value;
  restores.push(() => { object[key] = original; });
}
function setEnv(name: string, value: string | undefined) {
  const original = process.env[name];
  const apply = (next: string | undefined) => {
    if (next === undefined) delete process.env[name];
    else process.env[name] = next;
  };
  apply(value);
  restores.push(() => apply(original));
}

let upserts: { where: { email: string } }[] = [];
beforeEach(() => {
  upserts = [];
  stub(prisma.user, "upsert", async (args: { where: { email: string } }) => {
    upserts.push(args);
    return devUser;
  });
  stub(prisma.user, "findUnique", async () => devUser);
  // Start every test from "off", whatever the developer's .env says.
  setEnv("BYPASS_SSO", undefined);
  setEnv("NODE_ENV", undefined);
});
afterEach(() => {
  for (const restore of restores.splice(0).reverse()) restore();
});

describe("SSO bypass", () => {
  it("is off unless BYPASS_SSO=true outside production", () => {
    assert.equal(isSsoBypassEnabled({}), false);
    assert.equal(isSsoBypassEnabled({ NODE_ENV: "development" }), false);
    assert.equal(isSsoBypassEnabled({ BYPASS_SSO: "1" }), false);
    assert.equal(isSsoBypassEnabled({ BYPASS_SSO: "true", NODE_ENV: "production" }), false);
    assert.equal(isSsoBypassEnabled({ BYPASS_SSO: "true" }), true);
    assert.equal(isSsoBypassEnabled({ BYPASS_SSO: "true", NODE_ENV: "development" }), true);
  });

  it("hides the dev login while the bypass is off", async () => {
    for (const [bypass, nodeEnv] of [[undefined, undefined], [undefined, "development"], ["true", "production"]]) {
      setEnv("BYPASS_SSO", bypass);
      setEnv("NODE_ENV", nodeEnv);
      const response = await request(app).post("/auth/login-dev");
      assert.equal(response.status, 404);
      assert.equal(response.headers["set-cookie"], undefined);
    }
    assert.equal(upserts.length, 0);
  });

  it("signs in as the dev admin row with an ordinary local session", async () => {
    setEnv("BYPASS_SSO", "true");
    const response = await request(app).post("/auth/login-dev");
    assert.equal(response.status, 200);
    assert.equal(upserts[0]?.where.email, DEV_BYPASS_USER.email);
    assert.deepEqual(response.body.data.Role, ["Admin", "Lecturer"]);
    assert.equal(response.body.data.ActiveRole, "Admin");

    const cookies = ([] as string[]).concat(response.headers["set-cookie"] ?? []);
    const token = cookies.join(";").match(/gitbee_token=([^;]+)/)?.[1];
    assert.ok(token);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
    assert.equal(payload.userId, devUser.id);
    assert.equal(payload.credentialVersion, 0);
    assert.equal(payload.activeRole, "Admin");

    const admin = await request(app).get("/admin").set("Cookie", `gitbee_token=${token}`);
    assert.equal(admin.status, 200);
  });

  it("still requires a session on protected routes while the bypass is on", async () => {
    setEnv("BYPASS_SSO", "true");
    setEnv("NODE_ENV", "development");
    assert.equal((await request(app).get("/admin")).status, 401);
  });
});
