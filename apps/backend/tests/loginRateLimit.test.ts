import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { describe, it } from "node:test";
import { createLoginRateLimitMiddleware } from "../api/middlewares/loginRateLimitMiddleware.js";

describe("local login rate limiting", () => {
  it("limits failed attempts per account before reaching the handler", async () => {
    let handlerCalls = 0;
    const app = express();
    app.use(express.json());
    app.post(
      "/login",
      createLoginRateLimitMiddleware({ maxAccountFailures: 2, maxIpFailures: 10 }, (_req, res) => {
        handlerCalls += 1;
        res.sendStatus(401);
      })
    );

    assert.equal((await request(app).post("/login").send({ email: "User@example.com" })).status, 401);
    assert.equal((await request(app).post("/login").send({ email: "user@example.com" })).status, 401);
    assert.equal((await request(app).post("/login").send({ email: "user@example.com" })).status, 429);
    assert.equal(handlerCalls, 2);
  });

  it("limits failed attempts per IP across different accounts", async () => {
    let handlerCalls = 0;
    const app = express();
    app.use(express.json());
    app.post(
      "/login",
      createLoginRateLimitMiddleware({ maxAccountFailures: 10, maxIpFailures: 2 }, (_req, res) => {
        handlerCalls += 1;
        res.sendStatus(401);
      })
    );

    assert.equal((await request(app).post("/login").send({ email: "one@example.com" })).status, 401);
    assert.equal((await request(app).post("/login").send({ email: "two@example.com" })).status, 401);
    assert.equal((await request(app).post("/login").send({ email: "three@example.com" })).status, 429);
    assert.equal(handlerCalls, 2);
  });

  it("normalizes the full email before applying the account limit", async () => {
    let handlerCalls = 0;
    const app = express();
    app.use(express.json());
    app.post(
      "/login",
      createLoginRateLimitMiddleware({ maxAccountFailures: 2, maxIpFailures: 10 }, (_req, res) => {
        handlerCalls += 1;
        res.sendStatus(401);
      })
    );

    assert.equal((await request(app).post("/login").send({ email: "user@example.com" })).status, 401);
    assert.equal((await request(app).post("/login").send({ email: "USER@example.com" })).status, 401);
    assert.equal(
      (await request(app).post("/login").send({ email: `${" ".repeat(254)}user@example.com` })).status,
      429
    );
    assert.equal(handlerCalls, 2);
  });

  it("does not grow tracking state from distinct emails after an IP is blocked", async () => {
    let handlerCalls = 0;
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    const limiter = createLoginRateLimitMiddleware({
      maxAccountFailures: 10,
      maxIpFailures: 1,
      maxEntries: 3,
    }, (_req, res) => {
      handlerCalls += 1;
      res.sendStatus(401);
    });
    app.post("/login", limiter);

    assert.equal(
      (await request(app).post("/login").set("X-Forwarded-For", "192.0.2.1").send({ email: "first@example.com" })).status,
      401
    );
    for (let index = 0; index < 10; index += 1) {
      assert.equal(
        (
          await request(app)
            .post("/login")
            .set("X-Forwarded-For", "192.0.2.1")
            .send({ email: `attacker-${index}@example.com` })
        ).status,
        429
      );
    }
    assert.equal(limiter.getTrackedEntryCount(), 2);

    assert.equal(
      (await request(app).post("/login").set("X-Forwarded-For", "192.0.2.2").send({})).status,
      401
    );
    assert.equal(
      (
        await request(app)
          .post("/login")
          .set("X-Forwarded-For", "192.0.2.3")
          .send({ email: "legitimate@example.com" })
      ).status,
      429
    );
    const capacityResponse = await request(app)
      .post("/login")
      .set("X-Forwarded-For", "192.0.2.4")
      .send({ email: "another@example.com" });
    assert.equal(capacityResponse.status, 429);
    assert.equal(capacityResponse.body.errors, "Login temporarily unavailable. Please try again later.");
    assert.equal("stack" in capacityResponse.body, false);
    assert.equal(handlerCalls, 2);
    assert.equal(limiter.getTrackedEntryCount(), 3);
  });

  it("normalizes Unicode accents, case, and a trailing domain dot consistently", async () => {
    const app = express();
    app.use(express.json());
    app.post(
      "/login",
      createLoginRateLimitMiddleware({ maxAccountFailures: 2, maxIpFailures: 10 },
        (_req, res) => res.sendStatus(401))
    );

    assert.equal((await request(app).post("/login").send({ email: "user@example.com" })).status, 401);
    assert.equal((await request(app).post("/login").send({ email: "Usér@EXAMPLE.COM." })).status, 401);
    assert.equal((await request(app).post("/login").send({ email: "user@example.com" })).status, 429);
  });

  it("reclaims expired entries and admits new requests after the window", async () => {
    const app = express();
    app.use(express.json());
    const limiter = createLoginRateLimitMiddleware({
      windowMs: 20,
      maxAccountFailures: 10,
      maxIpFailures: 10,
      maxEntries: 2,
    }, (_req, res) => res.sendStatus(401));
    app.post("/login", limiter);

    assert.equal((await request(app).post("/login").send({ email: "first@example.com" })).status, 401);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal((await request(app).post("/login").send({ email: "second@example.com" })).status, 401);
    assert.equal(limiter.getTrackedEntryCount(), 2);
  });
});
