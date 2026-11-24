import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFirstSheetRows } from "../api/utils/excel/excelSheet.js";

describe("readFirstSheetRows", () => {
  it("decodes UTF-8 CSV cells when the file has no byte-order mark", () => {
    // Google Sheets, Numbers and LibreOffice exports omit the BOM. Without
    // codepage 65001, SheetJS falls back to Latin-1 and stores "José" as
    // "JosÃ©" and "Ma’ruf" as "Maâ€™ruf".
    const csv =
      "NIM,Name,Term,Course,Class\n" +
      "2501,José,2610,COMP,L1\n" +
      "2502,Ma’ruf,2610,COMP,L2\n";

    const rows = readFirstSheetRows(Buffer.from(csv, "utf8"));

    assert.deepEqual(rows, [
      [2501, "José", 2610, "COMP", "L1"],
      [2502, "Ma’ruf", 2610, "COMP", "L2"],
    ]);
  });
});
