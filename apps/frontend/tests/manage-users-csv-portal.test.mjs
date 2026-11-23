import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const importCsv = await read("../src/app/components/manage-users/ImportCsv.tsx");
const actions = await read("../src/app/(pages)/(admin)/manage-users/actions.tsx");
const page = await read("../src/app/(pages)/(admin)/manage-users/page.tsx");

// The selection rules live in a plain module so the picker/drop behaviour can
// be driven directly, without a DOM.
const selectionSource = await read(
  "../src/app/components/manage-users/csvSelection.ts"
);
const { outputText } = ts.transpileModule(selectionSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { isCsvFile, selectCsvFile, selectDroppedCsvFiles, resolveSelection } =
  await import(
    "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
  );

const file = (name, type = "") => ({ name, type });

test("the staff CSV portal links drag & drop to the tested CSV importer", () => {
  assert.match(importCsv, /onDrop=\{handleDrop\}/, "drop handler is wired");
  assert.match(importCsv, /onDragOver=/, "drop zone accepts drag");
  assert.match(importCsv, /onDragEnter=/, "drop zone highlights on drag");
  assert.match(importCsv, /uploadUsersCsv/, "reuses the CSV upload action");
  assert.match(importCsv, /accept="\.csv,text\/csv"/, "file picker still restricts to CSV");
});

test("files dropped onto the portal are validated before upload", () => {
  assert.match(importCsv, /selectDroppedCsvFiles/, "the drop route validates the dropped file");
  assert.match(selectionSource, /isCsvFile/, "checks the file is a CSV");
  assert.match(selectionSource, /Please choose a CSV file/, "shows a reason for a rejected file");
});

test("the page no longer posts to the legacy Excel endpoint (AR-11)", () => {
  assert.doesNotMatch(actions, /upload-user-excel/, "action no longer calls the Excel endpoint");
  assert.doesNotMatch(actions, /uploadExcelUsers/, "Excel upload action is gone");
  assert.doesNotMatch(page, /ImportExcel/, "the Excel importer is no longer rendered");
  assert.doesNotMatch(page, /Import Excel Lecturer/, "the Excel import button is removed");
});

test("the portal sends the last pick or drop, not an earlier one", () => {
  const first = file("a.csv");
  const second = file("b.csv");

  // Pick a.csv, drop b.csv, then pick a.csv again.
  let selection = selectCsvFile(first);
  assert.equal(selection.file, first, "picker selects the first file");

  selection = selectDroppedCsvFiles(selection.file, [second]);
  assert.equal(selection.file, second, "drop replaces the picker's file");

  selection = selectCsvFile(first);
  assert.equal(selection.file, first, "re-picking the first file sends it again");
  assert.equal(selection.error, null);
});

test("a multi-file drop is rejected and keeps the current selection", () => {
  const current = file("a.csv");
  const selection = selectDroppedCsvFiles(current, [file("b.csv"), file("c.csv")]);

  assert.equal(selection.file, current, "the current selection is preserved");
  assert.match(selection.error, /single CSV file/, "says why the drop was rejected");
});

test("a drop with no files keeps the current selection without an error", () => {
  const current = file("a.csv");
  const selection = selectDroppedCsvFiles(current, []);

  assert.equal(selection.file, current, "the current selection is preserved");
  assert.equal(selection.error, null);
});

test("only a .csv filename is accepted; the MIME type alone is not enough", () => {
  assert.equal(isCsvFile(file("staff.csv")), true);
  assert.equal(
    isCsvFile(file("staff.txt", "text/csv")),
    false,
    "a CSV MIME type does not excuse a rejected extension"
  );
  assert.equal(selectCsvFile(file("staff.txt", "text/csv")).file, null);
  assert.equal(
    isCsvFile(file(".csv")),
    false,
    "a bare extension has no filename stem, so the API would reject it"
  );
  assert.equal(selectCsvFile(file(".csv")).file, null);
});

test("a .csv suffix is accepted even when the stem holds a line separator", () => {
  assert.equal(
    isCsvFile(file("report\u2028.csv")),
    true,
    "a Unicode line separator in the stem must not be mistaken for a rejected suffix"
  );
  assert.equal(isCsvFile(file("Staff.CSV")), true, "the suffix match is case-insensitive");
  assert.equal(isCsvFile(file(".CSV")), false, "a bare extension stays invalid in any case");
});

test("a rejected drop keeps the import report when the selection stays the same", () => {
  const current = file("a.csv");

  // After a successful import, dropping two files is rejected but resolves back
  // to the current file — the report must survive.
  const rejected = resolveSelection(
    current,
    selectDroppedCsvFiles(current, [file("b.csv"), file("c.csv")])
  );
  assert.equal(rejected.file, current, "the selection is unchanged");
  assert.match(rejected.error, /single CSV file/, "the drop error is shown");
  assert.equal(rejected.resetReport, false, "the import report is kept");

  // Choosing a different file genuinely changes the selection, so the report resets.
  const replaced = resolveSelection(current, selectCsvFile(file("b.csv")));
  assert.equal(replaced.file?.name, "b.csv");
  assert.equal(replaced.resetReport, true, "a new file resets the report");
});

test("the portal applies selections through the tested resolver", () => {
  assert.match(
    importCsv,
    /resolveSelection\(selectedFile, selection\)/,
    "the drop and picker paths both route through resolveSelection"
  );
});

test("a text-only drop leaves the selection and the import report alone", () => {
  assert.match(
    importCsv,
    /if \(event\.dataTransfer\.files\.length === 0\) return;[\s\S]*?applySelection\(/,
    "an empty drop returns before applySelection can clear the report"
  );
});

test("the portal routes the picker and drops through the tested selector", () => {
  assert.match(
    importCsv,
    /selectDroppedCsvFiles\(selectedFile, event\.dataTransfer\.files\)/,
    "the drop handler routes its files through the tested selector"
  );
  assert.match(
    importCsv,
    /selectCsvFile\(input\.files/,
    "the picker routes its file through the tested selector"
  );
  assert.match(importCsv, /input\.value = ""/, "the native input is cleared after reading it");
  assert.match(
    importCsv,
    /uploadUsersCsv\(selectedFile, type\)/,
    "Import sends the React-state selection"
  );
});

test("a denied bulk deletion is surfaced and does not refresh the list", () => {
  const deleteAction = actions.slice(actions.indexOf("export const deleteAllUser"));

  assert.match(
    deleteAction,
    /return \{\s*success: false,\s*message: "Couldn't reach the server/,
    "the action returns a failure instead of nothing"
  );
  assert.match(
    deleteAction,
    /typeof result\.errors === "string"/,
    "the failure message surfaces the API's error, not the generic \\\"failed\\\""
  );
  assert.match(page, /const result = await deleteAllUser\(\)/, "the page reads the deletion result");
  assert.match(
    page,
    /if \(!result\?\.success\) \{[\s\S]*?return;[\s\S]*?\}[\s\S]*?refreshAccounts\(\)/,
    "the list refreshes only after a successful deletion"
  );
  assert.match(page, /setError\(result\?\.message/, "the failure reason is displayed on the page");
});
