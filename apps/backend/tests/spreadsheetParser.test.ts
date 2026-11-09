import assert from "node:assert/strict";
import { describe, it } from "node:test";
import xlsx from "xlsx";
import { parseSpreadsheet } from "../api/utils/csv/spreadsheetParser.js";
import { sampleFile } from "../api/utils/demo/sampleFiles.js";
import { csvHeaders } from "../api/utils/csv/csvParser.js";

function workbook(
  rows: unknown[][],
  edit?: (sheet: xlsx.WorkSheet, book: xlsx.WorkBook) => void,
) {
  const book = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet(rows);
  xlsx.utils.book_append_sheet(book, sheet, "Students");
  edit?.(sheet, book);
  return xlsx.write(book, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  }) as Buffer;
}
const row = ["00123", "Ada", "ada@example.test", "", "CS", "demo-password"];

describe("CSV and Excel account parsing", () => {
  it("rejects archives whose expanded size exceeds the limit", async () => {
    const data = workbook([csvHeaders.student, row]);
    const directory = data.readUInt32LE(data.length - 6);
    data.writeUInt32LE(21 * 1024 * 1024, directory + 24);
    await assert.rejects(
      parseSpreadsheet(data, "oversize.xlsx", "student"),
      /expanded limit/,
    );
  });
  for (const type of ["student", "staff"] as const) {
    it(`reads equivalent ${type} CSV and Excel samples`, async () => {
      const csv = await parseSpreadsheet(
        sampleFile(type, "csv"),
        "sample.csv",
        type,
      );
      const excel = await parseSpreadsheet(
        sampleFile(type, "xlsx"),
        "sample.xlsx",
        type,
      );
      assert.deepEqual(excel, csv);
      assert.equal(excel.failedRows.length, 0);
      assert.equal(excel.validRows.length, type === "student" ? 8 : 6);
    });
  }
  it("preserves text IDs and formatted numeric leading zeroes", async () => {
    const data = workbook(
      [
        csvHeaders.student,
        row,
        [123, "Ben", "ben@example.test", "", "CS", "demo-password"],
      ],
      (sheet) => {
        sheet.A3.z = "000000";
      },
    );
    const result = await parseSpreadsheet(data, "people.xlsx", "student");
    assert.equal(result.validRows[0]?.data.nim, "00123");
    assert.equal(result.validRows[1]?.data.nim, "000123");
  });
  it("reports worksheet row numbers after a multiline cell", async () => {
    const result = await parseSpreadsheet(
      workbook([
        csvHeaders.student,
        ["001", "Ada\nLovelace", "ada@example.test", "", "CS", "secret"],
        ["002", "Bob", "bad-email", "", "CS", "secret"],
      ]),
      "people.xlsx",
      "student",
    );
    assert.equal(result.failedRows[0]?.row_number, 3);
    assert.match(result.failedRows[0]!.error, /email/);
  });
  it("rejects formulas, multiple sheets, malformed archives, wrong extensions and missing headers", async () => {
    await assert.rejects(
      parseSpreadsheet(
        workbook([csvHeaders.student, row], (sheet) => {
          sheet.B2 = { t: "s", f: '"Ada"', v: "Ada" };
        }),
        "people.xlsx",
        "student",
      ),
      /Formula/,
    );
    await assert.rejects(
      parseSpreadsheet(
        workbook([csvHeaders.student, row], (_sheet, book) => {
          xlsx.utils.book_append_sheet(
            book,
            xlsx.utils.aoa_to_sheet([["hidden data"]]),
            "Second",
          );
        }),
        "people.xlsx",
        "student",
      ),
      /exactly one/,
    );
    await assert.rejects(
      parseSpreadsheet(Buffer.from("short"), "fake.xlsx", "student"),
      /Unable to read/,
    );
    await assert.rejects(
      parseSpreadsheet(
        Buffer.from("not an archive but definitely long enough"),
        "fake.xlsx",
        "student",
      ),
      /Expected an Excel/,
    );
    await assert.rejects(
      parseSpreadsheet(Buffer.from("data"), "old.xls", "student"),
      /Save older/,
    );
    await assert.rejects(
      parseSpreadsheet(workbook([["name"], ["Ada"]]), "people.xlsx", "student"),
      /Missing required/,
    );
  });
  it("rejects oversized worksheets and invalid UTF-8", async () => {
    await assert.rejects(
      parseSpreadsheet(
        workbook([
          csvHeaders.student,
          ...Array.from({ length: 1001 }, () => row),
        ]),
        "large.xlsx",
        "student",
      ),
      /at most 1000/,
    );
    await assert.rejects(
      parseSpreadsheet(Buffer.from([0xff, 0xff]), "bad.csv", "student"),
      /UTF-8/,
    );
  });
  it("reports deliberate invalid rows without discarding valid rows", async () => {
    const result = await parseSpreadsheet(
      sampleFile("student", "xlsx", true),
      "errors.xlsx",
      "student",
    );
    assert.equal(result.totalRows, 10);
    assert.equal(result.validRows.length, 9);
    assert.equal(result.failedRows.length, 1);
  });
});
