import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import express from "express";
import request from "supertest";
import { Prisma } from "../api/prisma/generated/prisma/client.js";
import { z } from "zod";
import { AppError, errorHandler, notFoundHandler } from "../api/middlewares/errorMiddleware.js";
import type { NextFunction, Request, Response } from "express";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";
const [{ default: ProjectHandler }, { default: ProjectService }, { default: ProjectDashboardService }] = await Promise.all([
  import("../api/handlers/project/projectHandler.js"),
  import("../api/services/project/projectService.js"),
  import("../api/services/project/projectDashboardService.js"),
]);

const originalConsoleError = console.error;
const restores: (() => void)[] = [];

function stubMethod<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => { target[key] = original; });
}

afterEach(() => {
  console.error = originalConsoleError;
  for (const restore of restores.splice(0).reverse()) restore();
});

function createApp() {
  const app = express();
  app.use(express.json({ limit: "10kb" }));
  app.get("/app-error", (_req, _res, next) => next(new AppError(403, "Access denied")));
  app.get("/project-detail", ProjectHandler.getProject);
  app.get("/project-explore", ProjectHandler.listExploreProjects);
  app.get("/project-dashboard", ProjectHandler.getHopDashboard);
  app.get("/admin-dashboard", ProjectHandler.getAdminDashboard);
  app.get("/scc-dashboard", ProjectHandler.getSccDashboard);
  app.post("/project-submit", ProjectHandler.submitProject);
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

  it("rejects invalid project IDs and numeric filters before reaching Prisma", async () => {
    const app = createApp();
    const invalidId = await request(app).get("/project-detail?id=abc");
    const unsafeId = await request(app).get("/project-detail?id=9007199254740992");
    const invalidFilter = await request(app).get("/project-explore?categoryFilter=abc");
    const invalidSccMajor = await request(app).get("/scc-dashboard?major_id=abc&semester_id=test");
    const invalidDashboardFlag = await request(app)
      .get("/project-dashboard?major_id=1&semester_id=test&is_outstanding=2");

    for (const response of [invalidId, unsafeId, invalidFilter, invalidSccMajor, invalidDashboardFlag]) {
      assert.equal(response.status, 400);
      assert.equal(response.body.status, false);
      assert.ok(response.body.errors);
    }
  });

  it("accepts default and partially selected Explore, Admin, and SCC filters", async () => {
    const exploreCalls: unknown[] = [];
    const adminCalls: unknown[] = [];
    const sccCalls: unknown[] = [];
    stubMethod(ProjectService, "listExploreProjects", async (params) => {
      exploreCalls.push(params);
      return [];
    });
    stubMethod(ProjectDashboardService, "getAdminDashboard", async (params) => {
      adminCalls.push(params);
      return {
        "count submitted": 0,
        "count graded": 0,
        "count reviewed": 0,
        "count outstanding": 0,
        submitted: [],
        graded: [],
        reviewed: [],
        outstanding: [],
      };
    });
    stubMethod(ProjectDashboardService, "getSccDashboard", async (params) => {
      sccCalls.push(params);
      return {
        "count reviewed": 0,
        "count not reviewed": 0,
        reviewed: [],
        "not reviewed": [],
      };
    });

    const app = createApp();
    const exploreDefault = await request(app)
      .get("/project-explore?search=&categoryFilter=&majorFilter=&technologyFilter=");
    const exploreOneFilter = await request(app)
      .get("/project-explore?search=&categoryFilter=2&majorFilter=&technologyFilter=");
    const adminDefault = await request(app)
      .get("/admin-dashboard?search=&categoryFilter=&majorFilter=&semester_id=");
    const adminOneFilter = await request(app)
      .get("/admin-dashboard?search=&categoryFilter=2&majorFilter=&semester_id=");
    const sccDefault = await request(app)
      .get("/scc-dashboard?search=&major_id=&semester_id=semester-1");

    for (const response of [exploreDefault, exploreOneFilter, adminDefault, adminOneFilter, sccDefault]) {
      assert.equal(response.status, 200);
      assert.equal(response.body.status, true);
    }
    assert.equal((exploreCalls[0] as { categoryFilter?: string }).categoryFilter, undefined);
    assert.equal((exploreCalls[1] as { categoryFilter?: string }).categoryFilter, "2");
    assert.equal((exploreCalls[1] as { majorFilter?: string }).majorFilter, undefined);
    assert.equal((adminCalls[0] as { categoryFilter?: string }).categoryFilter, undefined);
    assert.equal((adminCalls[1] as { categoryFilter?: string }).categoryFilter, "2");
    assert.equal((adminCalls[1] as { majorFilter?: string }).majorFilter, undefined);
    assert.equal((sccCalls[0] as { major_id?: string }).major_id, undefined);
  });

  it("rejects duplicate technology IDs as invalid project input", async () => {
    const response = await request(createApp()).post("/project-submit").send({
      lecturer_id: "D1",
      student_leader_id: "S1",
      title: "Test",
      semester_id: "semester",
      course_id: "course",
      class: "class",
      github_link: "https://github.com/example/repo",
      project_link: "https://example.com",
      documentation: "https://example.com/doc",
      video_link: "https://example.com/video",
      thumbnail: "https://example.com/image",
      description: "Test project",
      status_id: 1,
      category_id: 1,
      major_id: 1,
      gallery: [],
      technology_ids: [1, 1],
      group: 1,
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.status, false);
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

  it("maps unsupported JSON charsets and encodings to sanitized 415 responses", async () => {
    const unsupportedCharset = await request(createApp())
      .post("/unexpected-error")
      .set("Content-Type", "application/json; charset=iso-8859-1")
      .send("{}");
    const unsupportedEncoding = await request(createApp())
      .post("/unexpected-error")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "compress")
      .send("{}");

    for (const response of [unsupportedCharset, unsupportedEncoding]) {
      assert.equal(response.status, 415);
      assert.equal(response.body.errors, "Unsupported request encoding");
    }
  });

  it("maps invalid compressed JSON to a sanitized 400", async () => {
    console.error = () => {};
    const response = await request(createApp())
      .post("/unexpected-error")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "gzip")
      .send("not gzip");

    assert.equal(response.status, 400);
    assert.equal(response.body.status, false);
    assert.equal(response.body.errors, "Invalid request body");
  });

  it("maps malformed Brotli JSON to a sanitized 400", async () => {
    console.error = () => {};
    const response = await request(createApp())
      .post("/unexpected-error")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "br")
      .send("not compressed data");

    assert.equal(response.status, 400);
    assert.equal(response.body.status, false);
    assert.equal(response.body.errors, "Invalid request body");
  });

  it("returns oversized JSON bodies as a sanitized 413", async () => {
    const response = await request(createApp())
      .post("/unexpected-error")
      .send({ value: "x".repeat(20_000) });

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
