import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/app/(pages)/explore/actions.tsx", import.meta.url),
  "utf8"
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const actions = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("Explore requests survive an API failure after successful requests", async (t) => {
  const originalApi = process.env.NEXT_PUBLIC_BACKEND_API;
  const requests = [];
  const warnings = [];
  const projects = [{ id: 1 }];
  let response = Response.json({ status: true, data: projects });
  t.mock.method(console, "warn", (...args) => warnings.push(args.join(" ")));
  t.mock.method(globalThis, "fetch", async (input) => {
    requests.push(new URL(input));
    if (response instanceof Error) throw response;
    return response.clone();
  });

  try {
    // Accept the configured API base with or without its trailing slash.
    process.env.NEXT_PUBLIC_BACKEND_API = "http://localhost:5001/api";
    const search = "C++ & React #1 / 100% 日本語";
    assert.deepEqual(await actions.getAllProjects(search, "1", "2", "3"), {
      success: true,
      data: projects,
    });
    assert.equal(requests.at(-1).pathname, "/api/project/all");
    assert.equal(requests.at(-1).searchParams.get("search"), search);
    assert.equal(requests.at(-1).searchParams.get("categoryFilter"), "1");
    assert.equal(requests.at(-1).searchParams.get("majorFilter"), "2");
    assert.equal(requests.at(-1).searchParams.get("technologyFilter"), "3");

    process.env.NEXT_PUBLIC_BACKEND_API += "/";
    const calls = [
      () => actions.getAllCategory(),
      () => actions.getAllMajor(),
      () => actions.getAllTech(),
      () => actions.getAllProjects("", "", "", ""),
      () => actions.getProjectById("1"),
    ];
    for (const call of calls) assert.equal((await call()).success, true);
    assert.equal(requests.at(-1).searchParams.get("id"), "1");

    // An upstream outage or redirect can return HTML, including with HTTP 200.
    for (const status of [200, 404, 502]) {
      response = new Response("<!DOCTYPE html><html>API unavailable</html>", {
        status,
        headers: { "Content-Type": "text/html" },
      });
      for (const call of calls) {
        const result = await call();
        assert.equal(result.success, false);
        assert.equal(typeof result.message, "string");
      }
      assert.match(warnings.at(-1), new RegExp(`HTTP ${status}.*text/html`));
    }
    assert.ok(warnings.every((warning) => !warning.includes("Unexpected token")));

    response = Response.json(
      { status: false, message: "failed", errors: "Database unavailable" },
      { status: 503 }
    );
    assert.equal((await calls[3]()).success, false);
    assert.match(warnings.at(-1), /HTTP 503: Database unavailable/);
    response = Response.json({ status: true, data: projects }, { status: 500 });
    assert.equal((await calls[3]()).success, false);

    response = new TypeError("Failed to fetch");
    assert.equal((await calls[3]()).success, false);
    const requestCount = requests.length;
    delete process.env.NEXT_PUBLIC_BACKEND_API;
    assert.equal((await calls[3]()).success, false);
    assert.equal(requests.length, requestCount);
    assert.match(warnings.at(-1), /NEXT_PUBLIC_BACKEND_API/);

    process.env.NEXT_PUBLIC_BACKEND_API = "http://localhost:5001/api/";
    response = Response.json({ status: true, data: projects });
    assert.deepEqual(await calls[3](), { success: true, data: projects });
  } finally {
    if (originalApi === undefined) delete process.env.NEXT_PUBLIC_BACKEND_API;
    else process.env.NEXT_PUBLIC_BACKEND_API = originalApi;
  }
});
