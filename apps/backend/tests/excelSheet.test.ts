import assert from "node:assert/strict";
import { describe, it } from "node:test";
import xlsx from "xlsx";
import { readFirstSheetRows } from "../api/utils/excel/excelSheet.js";

const NAME = "José Ma’ruf";
const header = "NIM,Name,Term,Course,Class";
const csv = `${header}\n2501,${NAME},2610,COMP,L1\n`;

// The name is the second cell of the first data row (the header is dropped).
const nameOf = (rows: unknown[][]): unknown => rows[0]?.[1];

describe("readFirstSheetRows", () => {
  it("decodes UTF-8 CSV cells when the file has no byte-order mark", () => {
    // Google Sheets, Numbers and LibreOffice exports omit the BOM.
    assert.equal(nameOf(readFirstSheetRows(Buffer.from(csv, "utf8"))), NAME);
  });

  it("decodes UTF-8 CSV cells that carry a byte-order mark", () => {
    // Excel's "CSV UTF-8" export adds a BOM; a forced code page would decode it twice.
    const withBom = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(csv, "utf8"),
    ]);

    assert.equal(nameOf(readFirstSheetRows(withBom)), NAME);
  });

  it("decodes Windows-1252 CSV cells", () => {
    // Excel's "CSV (Comma delimited)" export on Windows uses code page 1252.
    const cp1252 = `${header}\n2501,Jos\u00e9 Ma\u0092ruf,2610,COMP,L1\n`;

    assert.equal(nameOf(readFirstSheetRows(Buffer.from(cp1252, "latin1"))), NAME);
  });

  it("decodes UTF-16 CSV cells that carry a byte-order mark", () => {
    const utf16 = Buffer.from(`\uFEFF${csv}`, "utf16le");

    assert.equal(nameOf(readFirstSheetRows(utf16)), NAME);
  });

  it("reads .xlsx workbooks unchanged", () => {
    assert.equal(nameOf(readFirstSheetRows(workbookBuffer("xlsx"))), NAME);
  });

  it("reads .xls workbooks unchanged", () => {
    assert.equal(nameOf(readFirstSheetRows(workbookBuffer("xls"))), NAME);
  });
});

function workbookBuffer(bookType: "xlsx" | "xls"): Buffer {
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.aoa_to_sheet([
    ["NIM", "Name", "Term", "Course", "Class"],
    [2501, NAME, 2610, "COMP", "L1"],
  ]);
  xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  return xlsx.write(workbook, { type: "buffer", bookType }) as Buffer;
}
