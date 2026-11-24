import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const importCsv = await read("../src/app/components/manage-student/ImportCsv.tsx");
const roster = await read(
  "../src/app/components/manage-student/ImportRosterExcel.tsx"
);
const shared = await read("../src/app/components/csv-import/CsvImporter.tsx");
const actions = await read("../src/app/(pages)/(admin)/manage-student/actions.tsx");
const page = await read("../src/app/(pages)/(admin)/manage-student/page.tsx");
// The third dialog opener lives on the Manage Users page; it shares CsvImporter.
const usersPage = await read("../src/app/(pages)/(admin)/manage-users/page.tsx");

// The selection rules live in a plain module so the picker/drop behaviour can
// be driven directly, without a DOM.
const selectionSource = await read(
  "../src/app/components/csv-import/csvSelection.ts"
);
const { outputText } = ts.transpileModule(selectionSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { isCsvFile, pickCsvFile, dropCsvFiles } = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);

const file = (name, type = "") => ({ name, type });

test("the student CSV portal links drag & drop to the tested CSV importer", () => {
  assert.match(shared, /onDrop=\{handleDrop\}/, "drop handler is wired");
  assert.match(shared, /onDragOver=/, "drop zone accepts drag");
  assert.match(shared, /onDragEnter=/, "drop zone highlights on drag");
  assert.match(importCsv, /uploadStudentsCsv/, "reuses the CSV upload action");
  assert.match(shared, /accept="\.csv,text\/csv"/, "file picker still restricts to CSV");
});

test("files dropped onto the portal are validated before upload", () => {
  assert.match(shared, /dropCsvFiles/, "the drop route validates the dropped file");
  assert.match(selectionSource, /isCsvFile/, "checks the file is a CSV");
  assert.match(selectionSource, /Please choose a CSV file/, "shows a reason for a rejected file");
});

test("accounts import through CSV while the roster keeps its Excel endpoint", () => {
  assert.doesNotMatch(actions, /upload-student-excel/, "the account action no longer calls the Excel endpoint");
  assert.doesNotMatch(actions, /uploadExcelStudents/, "the Excel account-import action is gone");
  assert.match(actions, /upload-student-csv/, "the portal posts accounts to the tested CSV importer");
  // The roster workbook is a separate import. Assert its dialog is actually
  // present and still posts to the restored endpoint, instead of only relying
  // on a regex that happens to miss the component name.
  assert.match(page, /ImportRosterExcel/, "the roster importer is rendered");
  assert.match(page, /Import Lab Roster/, "the roster importer has its own labelled button");
  assert.match(roster, /upload-student-excel/, "the roster dialog posts to the roster endpoint");
  assert.match(roster, /Header Student\.xlsx/, "the roster dialog links its template");
  assert.match(roster, /\.csv/, "the roster picker also accepts CSV");
});

test("the page reads student accounts through the paged account route", () => {
  assert.match(page, /getAccounts\(\s*"student"/, "lists students through getAccounts");
  assert.doesNotMatch(actions, /get-student\?/, "the roster list action is gone");
  assert.doesNotMatch(actions, /remove-student-excel/, "the roster delete action is gone");
  assert.doesNotMatch(page, /Delete All Students/, "the roster delete button is gone");
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
  assert.equal(isCsvFile(file("students.csv")), true);
  assert.equal(
    isCsvFile(file("students.xlsx", "text/csv")),
    false,
    "a CSV MIME type does not excuse a rejected extension"
  );
  assert.equal(pickCsvFile(file("students.xlsx", "text/csv")).kind, "rejected");
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
  assert.equal(isCsvFile(file("Students.CSV")), true, "the suffix match is case-insensitive");
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
  const invalid = pickCsvFile(file("students.xlsx"));
  assert.equal(invalid.kind, "rejected", "a wrong-type file is rejected, not selected");
  assert.equal(invalid.file, null, "the rejected file is not selected");
  assert.ok(invalid.error, "the validation error is shown");

  // Choosing a different valid file is "selected", so the report resets.
  const replaced = pickCsvFile(file("b.csv"));
  assert.equal(replaced.kind, "selected", "a new valid file is a selection");
  assert.equal(replaced.file?.name, "b.csv");
});

test("the portal resets the report only for a selected file", () => {
  const apply = shared.slice(shared.indexOf("const applySelection"));
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
  const upload = shared.slice(shared.indexOf("const handleUpload"));
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
    shared,
    /dropCsvFiles\(selectedFile, event\.dataTransfer\.files\)/,
    "the drop handler routes its files through the tested selector"
  );
  assert.match(
    shared,
    /pickCsvFile\(input\.files/,
    "the picker routes its file through the tested selector"
  );
  assert.match(shared, /input\.value = ""/, "the native input is cleared after reading it");
  assert.match(
    shared,
    /uploadFn\(selectedFile, type\)/,
    "Import sends the React-state selection"
  );
});

test("portal messages are announced to assistive tech", () => {
  assert.match(shared, /role="alert"/, "the validation error is exposed as an alert");
  assert.match(page, /role="alert"/, "a failed student fetch is exposed as an alert");
});

test("every dialog opener returns focus to its trigger button", () => {
  // Both dialogs intercept Radix's default focus restore and send focus back to
  // the button that opened them, so keyboard users don't land back on the page.
  for (const dialog of [shared, roster]) {
    assert.match(dialog, /restoreFocusRef/, "the dialog accepts the opener's ref");
    assert.match(dialog, /onCloseAutoFocus/, "the dialog overrides Radix's focus restore");
  }
  // All three openers pass their trigger's ref in: Manage Users CSV, Manage
  // Students CSV, and Manage Students roster.
  assert.match(usersPage, /restoreFocusRef=\{importCsvRef\}/, "the Manage Users CSV opener restores focus");
  assert.match(page, /restoreFocusRef=\{importCsvRef\}/, "the student CSV opener restores focus");
  assert.match(page, /restoreFocusRef=\{importRosterRef\}/, "the roster opener restores focus");
  assert.match(page, /ref=\{importCsvRef\}/, "the student CSV button holds a ref");
  assert.match(page, /ref=\{importRosterRef\}/, "the roster button holds a ref");
});
