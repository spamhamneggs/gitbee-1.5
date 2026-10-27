import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import http from "node:http";
import type { Request, Response } from "express";
import express from "express";
import request from "supertest";
import { it } from "node:test";
import { createLoginRateLimitMiddleware } from "../api/middlewares/loginRateLimitMiddleware.js";

process.env.JWT_SECRET = "disconnect-test-secret";
process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:3306/test";
const { prisma } = await import("../api/prisma/client.js");
const { default: AuthHandler } = await import("../api/handlers/auth/authHandler.js");

it("bounds real disconnected login work per account and IP until hashing completes", { timeout: 10_000 }, async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const originalLookup = prisma.user.findUnique;
  const releases: (() => void)[] = [];
  const jobs: Promise<unknown>[] = [];
  let arrived: (() => void) | undefined;
  // Prisma delegates are proxies, so replace the method directly.
  prisma.user.findUnique = (() => new Promise((resolve) => {
    releases.push(() => resolve(null));
    arrived?.();
  })) as typeof prisma.user.findUnique;
  const app = express();
  app.use(express.json());
  const limiter = createLoginRateLimitMiddleware({ windowMs: 1_000 }, async (req, res, next) => {
    const job = AuthHandler.loginLocal(req, res, next);
    jobs.push(job);
    await job;
  });
  app.post("/login", limiter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as { port: number };
  const login = (email: string) => request(server).post("/login").send({ email, password: "wrong" });

  async function disconnect(email: string) {
    const admission = new Promise<void>((resolve) => { arrived = resolve; });
    const response = new Promise<http.ServerResponse>((resolve) => {
      server.once("request", (_req, res) => resolve(res));
    });
    const body = JSON.stringify({ email, password: "wrong" });
    const client = http.request({
      hostname: "127.0.0.1", port, path: "/login", method: "POST", agent: false,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    });
    client.on("error", () => {});
    client.end(body);
    await admission;
    const closed = once(await response, "close");
    client.destroy();
    await closed;
  }

  try {
    for (let index = 0; index < 5; index += 1) await disconnect("missing@example.com");
    assert.equal(jobs.length, 5);
    assert.equal((await login("missing@example.com")).status, 429);
    releases.slice(0, 5).forEach((release) => release());
    await Promise.all(jobs);
    assert.equal((await login("missing@example.com")).status, 429, "aborts remain failed attempts after hashing");
    for (let index = 0; index < 15; index += 1) await disconnect(`missing${index}@example.com`);
    assert.equal(jobs.length, 20);
    assert.equal((await login("another@example.com")).status, 429);
    now += 1_001;
    const pendingResponse = await login("another@example.com");
    assert.equal(pendingResponse.status, 429, "window expiry must not free running work");
    assert.ok(Number(pendingResponse.headers["retry-after"]) >= 1);
    assert.equal(jobs.length, 20);
    releases.forEach((release) => release());
    await Promise.all(jobs);
    prisma.user.findUnique = (async () => null) as typeof prisma.user.findUnique;
    assert.equal((await login("another@example.com")).status, 401, "capacity is released after the work finishes and the window expires");
  } finally {
    releases.forEach((release) => release());
    await Promise.all(jobs);
    prisma.user.findUnique = originalLookup;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});

it("counts an abort even when the handler finishes with the default 200 status", async () => {
  class TestResponse extends EventEmitter {
    statusCode = 200;
    writableFinished = false;
    set() { return this; }
    status(code: number) { this.statusCode = code; return this; }
    json() { return this; }
  }
  let release!: () => void;
  const work = new Promise<void>((resolve) => { release = resolve; });
  const limiter = createLoginRateLimitMiddleware({ maxAccountFailures: 1 }, async () => { await work; });
  const req = { ip: "192.0.2.1", body: { email: "user@example.com" } } as Request;
  const first = new TestResponse();
  const job = limiter(req, first as unknown as Response, () => {});
  first.emit("close");
  release();
  await job;
  const second = new TestResponse();
  await limiter(req, second as unknown as Response, () => { assert.fail("blocked attempt reached handler"); });
  assert.equal(second.statusCode, 429);
});
