import xlsx from "xlsx";
import { ServiceError } from "../response/response.js";

/** Rows of the workbook's first sheet as arrays of cells, without the header row. */
export function readFirstSheetRows(buffer: Buffer): unknown[][] {
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new ServiceError("Excel file has no sheets.");
    }
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
        throw new ServiceError("Excel sheet not found.");
    }
    return xlsx.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 }).slice(1);
}

/**
 * The Bluejack semester description for a BINUS term code such as 2610
 * (2026, term 10 = Odd) or 2620 (term 20 = Even); "" when the code doesn't parse.
 */
export function semesterNameFromTermCode(raw: unknown): string {
    if (!raw) return "";
    const numericRaw = Number(raw);
    if (Number.isNaN(numericRaw)) return "";
    const year = 2000 + Math.floor(numericRaw / 100);
    const termPart = numericRaw % 100;
    if (termPart === 10) return `Odd Semester ${year}/${year + 1}`;
    if (termPart === 20) return `Even Semester ${year}/${year + 1}`;
    return "";
}
