import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const importCsv = await read("../src/app/components/manage-users/ImportCsv.tsx");
const actions = await read("../src/app/(pages)/(admin)/manage-users/actions.tsx");
const page = await read("../src/app/(pages)/(admin)/manage-users/page.tsx");

test("the staff CSV portal links drag & drop to the tested CSV importer", () => {
  assert.match(importCsv, /onDrop=\{handleDrop\}/, "drop handler is wired");
  assert.match(importCsv, /onDragOver=/, "drop zone accepts drag");
  assert.match(importCsv, /onDragEnter=/, "drop zone highlights on drag");
  assert.match(importCsv, /uploadUsersCsv/, "reuses the CSV upload action");
  assert.match(importCsv, /accept="\.csv,text\/csv"/, "file picker still restricts to CSV");
});

test("files dropped onto the portal are validated before upload", () => {
  assert.match(importCsv, /isCsvFile/, "checks the dropped file is a CSV");
  assert.match(importCsv, /Please choose a CSV file/, "shows a reason for a rejected file");
});

test("the page no longer posts to the legacy Excel endpoint (AR-11)", () => {
  assert.doesNotMatch(actions, /upload-user-excel/, "action no longer calls the Excel endpoint");
  assert.doesNotMatch(actions, /uploadExcelUsers/, "Excel upload action is gone");
  assert.doesNotMatch(page, /ImportExcel/, "the Excel importer is no longer rendered");
  assert.doesNotMatch(page, /Import Excel Lecturer/, "the Excel import button is removed");
});
