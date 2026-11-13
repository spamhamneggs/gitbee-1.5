import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/app/(pages)/(admin)/manage-users/actions.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { uploadUsersCsv } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("user CSV imports post the file with the admin session to the matching endpoint", async (t) => {
  const previous = process.env.NEXT_PUBLIC_BACKEND_API;
  process.env.NEXT_PUBLIC_BACKEND_API = "http://localhost:5001/api/";
  const report = { totalParsed: 2, createdCount: 1, skippedCount: 0, failedCount: 1, errors: [{ line: 3, errors: ["email: must be a valid email address"] }] };
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, ...options });
    return Response.json({ status: true, data: report });
  });
  try {
    const file = new File(["lecturer_code,name\n"], "staff.csv", { type: "text/csv" });
    for (const type of ["staff", "student"]) {
      const result = await uploadUsersCsv(file, type);
      assert.deepEqual(result, { success: true, data: report });
      assert.equal(calls.at(-1).url, `http://localhost:5001/api/user/admin/upload-${type}-csv`);
      assert.equal(calls.at(-1).method, "POST");
      assert.equal(calls.at(-1).credentials, "include");
      assert.equal(calls.at(-1).body.get("file").name, "staff.csv");
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BACKEND_API;
    else process.env.NEXT_PUBLIC_BACKEND_API = previous;
  }
});

test("user CSV imports surface the backend's reason, or a reachability error", async (t) => {
  let response = Response.json({ status: false, errors: "Only CSV files are allowed." }, { status: 400 });
  t.mock.method(globalThis, "fetch", async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const file = new File(["x"], "staff.xlsx");
  assert.deepEqual(await uploadUsersCsv(file, "staff"), { success: false, message: "Only CSV files are allowed." });

  response = Response.json({ status: false, errors: ["unexpected shape"] }, { status: 400 });
  assert.deepEqual(await uploadUsersCsv(file, "staff"), { success: false, message: "Import failed." });

  response = new TypeError("fetch failed");
  assert.deepEqual(await uploadUsersCsv(file, "staff"), { success: false, message: "Couldn't reach the server. Please try again." });
});
