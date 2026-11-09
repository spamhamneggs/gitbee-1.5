import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/app/(pages)/(student)/course/actions.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { createGroup } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const group = { semester_id: "semester", course_id: "ACCT6411020", class_id: "LA59", student_ids: ["2501959296", "2799999999"] };
const answer = (status, body) => async () => Response.json(body, { status });

test("a rejected group carries the backend's reason", async (t) => {
  t.mock.method(console, "log", () => {});
  t.mock.method(globalThis, "fetch", answer(400, {
    message: "failed", status: false, data: null, errors: "Not enrolled in this class: 2799999999",
  }));
  assert.deepEqual(await createGroup(group), { success: false, message: "Not enrolled in this class: 2799999999" });
});

test("validation messages are joined into one line", async (t) => {
  t.mock.method(console, "log", () => {});
  t.mock.method(globalThis, "fetch", answer(400, {
    message: "failed", status: false, data: null, errors: ["semester_id is required", "class is required"],
  }));
  assert.equal((await createGroup(group)).message, "semester_id is required, class is required");
});

test("an error without a reason falls back to a generic message", async (t) => {
  t.mock.method(console, "log", () => {});
  t.mock.method(globalThis, "fetch", answer(500, { message: "failed", status: false, data: null }));
  assert.equal((await createGroup(group)).message, "Failed to create group");
});

test("a created group is returned as success", async (t) => {
  t.mock.method(console, "log", () => {});
  t.mock.method(globalThis, "fetch", answer(200, { message: "successful", status: true, data: [{ id: 1 }] }));
  assert.deepEqual(await createGroup(group), { success: true, data: [{ id: 1 }] });
});
