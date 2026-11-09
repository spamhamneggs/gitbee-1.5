import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/app/(pages)/(student)/course/actions.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { insertProject } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("project submission includes the student session cookie", async (t) => {
  let submitted;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    submitted = options;
    return Response.json({ status: true, data: { newProject: { id: 1 } } });
  });
  t.mock.method(console, "log", () => {});
  const result = await insertProject({
    lecturerId: "D1", studentLeaderId: "2702000001", title: "Project", description: "",
    semesterId: "semester", courseId: "COMP1", className: "T01", githubLink: "",
    projectLink: "", videoLink: "", gallery: [], categoryId: "1",
    selectedTechnologies: [], majorId: 6, groupMembersId: ["2702000001"], group: 1,
  });
  assert.equal(result.success, true);
  assert.equal(submitted.credentials, "include");
  assert.equal(JSON.parse(submitted.body).student_leader_id, "2702000001");
});
