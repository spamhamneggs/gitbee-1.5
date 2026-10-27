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
      createLoginRateLimitMiddleware({ maxAccountFailures: 2, maxIpFailures: 10 }),
      (_req, res) => {
        handlerCalls += 1;
        res.sendStatus(401);
      }
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
      createLoginRateLimitMiddleware({ maxAccountFailures: 10, maxIpFailures: 2 }),
      (_req, res) => {
        handlerCalls += 1;
        res.sendStatus(401);
      }
    );

    assert.equal((await request(app).post("/login").send({ email: "one@example.com" })).status, 401);
    assert.equal((await request(app).post("/login").send({ email: "two@example.com" })).status, 401);
    assert.equal((await request(app).post("/login").send({ email: "three@example.com" })).status, 429);
    assert.equal(handlerCalls, 2);
  });
});
