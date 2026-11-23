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
const { isCsvFile, pickCsvFile, dropCsvFiles } = await import(
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
  assert.match(importCsv, /dropCsvFiles/, "the drop route validates the dropped file");
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
  let outcome = pickCsvFile(first);
  assert.equal(outcome.kind, "selected", "picker selects the first file");
  assert.equal(outcome.file, first);

  outcome = dropCsvFiles(outcome.file, [second]);
  assert.equal(outcome.kind, "selected", "drop replaces the picker's file");
  assert.equal(outcome.file, second);

  outcome = pickCsvFile(first);
  assert.equal(outcome.kind, "selected", "re-picking the first file sends it again");
  assert.equal(outcome.file, first);
});

test("a multi-file drop is rejected and keeps the current selection", () => {
  const current = file("a.csv");
  const outcome = dropCsvFiles(current, [file("b.csv"), file("c.csv")]);

  assert.equal(outcome.kind, "rejected", "a multi-file drop is not a selection");
  assert.equal(outcome.file, current, "the current selection is preserved");
  assert.match(outcome.error, /single CSV file/, "says why the drop was rejected");
});

test("a drop with no files changes nothing", () => {
  const outcome = dropCsvFiles(file("a.csv"), []);

  assert.equal(
    outcome.kind,
    "ignored",
    "a text-only drop is not a selection change, so the report survives"
  );
});

test("only a .csv filename is accepted; the MIME type alone is not enough", () => {
  assert.equal(isCsvFile(file("staff.csv")), true);
  assert.equal(
    isCsvFile(file("staff.txt", "text/csv")),
    false,
    "a CSV MIME type does not excuse a rejected extension"
  );
  assert.equal(pickCsvFile(file("staff.txt", "text/csv")).kind, "rejected");
  assert.equal(
    isCsvFile(file(".csv")),
    false,
    "a bare extension has no filename stem, so the API would reject it"
  );
  assert.equal(pickCsvFile(file(".csv")).kind, "rejected");
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

test("a rejected selection keeps the import report", () => {
  const current = file("a.csv");

  // After a successful import, dropping two files is rejected: the outcome is
  // "rejected", which the portal renders without touching the report.
  const multi = dropCsvFiles(current, [file("b.csv"), file("c.csv")]);
  assert.equal(multi.kind, "rejected", "a multi-file drop is rejected");
  assert.equal(multi.file, current, "the selection is unchanged");
  assert.match(multi.error, /single CSV file/, "the drop error is shown");

  // A single wrong-type file clears the selection, but the outcome is still
  // "rejected", so the report survives there too.
  const invalid = pickCsvFile(file("staff.xlsx"));
  assert.equal(invalid.kind, "rejected", "a wrong-type file is rejected, not selected");
  assert.equal(invalid.file, null, "the rejected file is not selected");
  assert.ok(invalid.error, "the validation error is shown");

  // Choosing a different valid file is "selected", so the report resets.
  const replaced = pickCsvFile(file("b.csv"));
  assert.equal(replaced.kind, "selected", "a new valid file is a selection");
  assert.equal(replaced.file?.name, "b.csv");
});

test("the portal resets the report only for a selected file", () => {
  const apply = importCsv.slice(importCsv.indexOf("const applySelection"));
  assert.match(
    apply,
    /if \(outcome\.kind === "selected"\) resetReport\(\)/,
    "only a newly selected file makes the report stale"
  );
  assert.match(
    apply,
    /if \(outcome\.kind === "ignored"\) return;/,
    "an ignored outcome leaves the selection, error and report untouched"
  );
});

test("a failed upload keeps the last import report", () => {
  const upload = importCsv.slice(importCsv.indexOf("const handleUpload"));
  assert.match(
    upload,
    /if \(result\.success\) \{[\s\S]*?setReport\(result\.data\)[\s\S]*?\} else \{[\s\S]*?setError\(result\.message\)/,
    "only a successful import replaces the report; a failure shows the reason"
  );
  assert.doesNotMatch(
    upload,
    /else \{[\s\S]*?setReport\(null\)/,
    "a failure must not clear the previous report"
  );
});

test("the portal routes the picker and drops through the tested selector", () => {
  assert.match(
    importCsv,
    /dropCsvFiles\(selectedFile, event\.dataTransfer\.files\)/,
    "the drop handler routes its files through the tested selector"
  );
  assert.match(
    importCsv,
    /pickCsvFile\(input\.files/,
    "the picker routes its file through the tested selector"
  );
  assert.match(importCsv, /input\.value = ""/, "the native input is cleared after reading it");
  assert.match(
    importCsv,
    /uploadUsersCsv\(selectedFile, type\)/,
    "Import sends the React-state selection"
  );
});

test("portal messages are announced to assistive tech", () => {
  assert.match(importCsv, /role="alert"/, "the validation error is exposed as an alert");
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
