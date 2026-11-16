import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import express from "express";
import request from "supertest";
import { Prisma } from "../api/prisma/generated/prisma/client.js";
import { z } from "zod";
import { AppError, errorHandler, notFoundHandler } from "../api/middlewares/errorMiddleware.js";
import type { NextFunction, Request, Response } from "express";

const originalConsoleError = console.error;

afterEach(() => {
  console.error = originalConsoleError;
});

function createApp() {
  const app = express();
  app.use(express.json({ limit: "100b" }));
  app.get("/app-error", (_req, _res, next) => next(new AppError(403, "Access denied")));
  app.get("/zod-error", (_req, _res, next) => {
    const result = z.object({ name: z.string() }).safeParse({});
    if (!result.success) next(result.error);
  });
  app.get("/zod-root-error", (_req, _res, next) => {
    const result = z.string().safeParse({});
    if (!result.success) next(result.error);
  });
  app.get("/unexpected-error", (_req, _res, next) => {
    next(new Error("database password leaked"));
  });
  app.get("/sync-throw", () => {
    throw new Error("sync failure");
  });
  app.get("/async-rejection", async () => {
    throw new Error("async failure");
  });
  app.get("/rejected-value", async () => Promise.reject({ secret: "plain object" }));
  app.get("/rejected-string", async () => Promise.reject("plain string"));
  app.get("/prisma/:code", (req, _res, next) => {
    next(new Prisma.PrismaClientKnownRequestError(
      "Database internals must stay private",
      { code: req.params.code, clientVersion: "test" },
    ));
  });
  app.get("/prisma-validation", (_req, _res, next) => {
    next(new Prisma.PrismaClientValidationError(
      "Invalid invocation at C:\\server\\secret\\database.ts",
      { clientVersion: "test" },
    ));
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe("central error middleware", () => {
  it("returns an AppError status and message", async () => {
    const response = await request(createApp()).get("/app-error");

    assert.equal(response.status, 403);
    assert.equal(response.body.errors, "Access denied");
  });

  it("returns field-level Zod validation issues", async () => {
    const response = await request(createApp()).get("/zod-error");

    assert.equal(response.status, 400);
    assert.deepEqual(response.body.errors, [{ field: "name", message: "Invalid input: expected string, received undefined" }]);
  });

  it("uses a stable field label for root-level Zod issues", async () => {
    const response = await request(createApp()).get("/zod-root-error");

    assert.equal(response.status, 400);
    assert.equal(response.body.errors[0].field, "$");
  });

  it("maps common Prisma errors without exposing internal constraint details", async () => {
    const app = createApp();
    const duplicate = await request(app).get("/prisma/P2002");
    const missing = await request(app).get("/prisma/P2025");
    const relatedRecordConflict = await request(app).get("/prisma/P2003");

    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.errors, "A record with these values already exists");
    assert.equal(missing.status, 404);
    assert.equal(missing.body.errors, "Record not found");
    assert.equal(relatedRecordConflict.status, 409);
    for (const response of [duplicate, missing, relatedRecordConflict]) {
      assert.doesNotMatch(JSON.stringify(response.body), /Database internals|constraint|column/i);
    }
  });

  it("sanitizes Prisma validation errors as generic server errors", async () => {
    const logged: unknown[][] = [];
    console.error = (...args: unknown[]) => logged.push(args);

    const response = await request(createApp()).get("/prisma-validation");

    assert.equal(response.status, 500);
    assert.equal(response.body.errors, "Internal server error");
    assert.doesNotMatch(JSON.stringify(response.body), /Invalid invocation|database\.ts/);
    assert.match(String(logged[0]?.[0]), /Invalid invocation/);
  });

  it("forwards unmatched API paths as a 404 AppError", async () => {
    const response = await request(createApp()).get("/not-a-route");

    assert.equal(response.status, 404);
    assert.equal(response.body.errors, "Route not found");
  });

  it("returns malformed JSON errors as a sanitized 400", async () => {
    const response = await request(createApp())
      .post("/app-error")
      .set("Content-Type", "application/json")
      .send("{");

    assert.equal(response.status, 400);
    assert.equal(response.body.errors, "Invalid JSON payload");
  });

  it("returns oversized JSON bodies as a sanitized 413", async () => {
    const response = await request(createApp())
      .post("/unexpected-error")
      .send({ value: "x".repeat(200) });

    assert.equal(response.status, 413);
    assert.equal(response.body.errors, "Request payload is too large");
  });

  it("handles Express 5 sync throws, async rejections, and non-Error rejection values", async () => {
    console.error = () => {};
    const app = createApp();
    const sync = await request(app).get("/sync-throw");
    const async = await request(app).get("/async-rejection");
    const nonError = await request(app).get("/rejected-value");
    const string = await request(app).get("/rejected-string");

    assert.equal(sync.status, 500);
    assert.equal(async.status, 500);
    assert.equal(nonError.status, 500);
    assert.equal(string.status, 500);
    assert.equal(nonError.body.errors, "Internal server error");
    assert.equal(string.body.errors, "Internal server error");
    assert.doesNotMatch(JSON.stringify(nonError.body), /plain object/);
    assert.doesNotMatch(JSON.stringify(string.body), /plain string/);
  });

  it("delegates errors when headers have already been sent", () => {
    const error = new Error("response already started");
    let forwarded: unknown;
    const next: NextFunction = (nextError?: unknown) => {
      forwarded = nextError;
    };

    errorHandler(
      error,
      { method: "GET", path: "/partial" } as Request,
      { headersSent: true } as Response,
      next,
    );

    assert.equal(forwarded, error);
  });

  it("sanitizes unexpected failures and logs a correlation ID with request context", async () => {
    const logged: unknown[][] = [];
    console.error = (...args: unknown[]) => logged.push(args);

    const response = await request(createApp()).get("/unexpected-error");

    assert.equal(response.status, 500);
    assert.equal(response.body.errors, "Internal server error");
    assert.doesNotMatch(JSON.stringify(response.body), /database password leaked/);
    assert.match(response.headers["x-request-id"], /^[0-9a-f-]{36}$/i);
    assert.match(String(logged[0]?.[0]), /GET \/unexpected-error/);
    assert.match(String(logged[0]?.[0]), /database password leaked/);
    assert.match(String(logged[0]?.[0]), new RegExp(response.headers["x-request-id"]));
  });
});
