import xlsx from "xlsx";
import { ServiceError } from "../response/response.js";

// Windows-1252 matches Latin-1 except for 0x80–0x9F (€, curly quotes, dashes…).
// TextDecoder("windows-1252") is not dependable across Node builds (some decode
// that range as Latin-1), so map it here instead.
const WINDOWS_1252_HIGH =
    "\u20AC\u0081\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u008D\u017D\u008F" +
    "\u0090\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u009D\u017E\u0178";

function decodeWindows1252(buffer: Buffer): string {
    return buffer
        .toString("latin1")
        .replace(
            /[\u0080-\u009F]/g,
            (ch) => WINDOWS_1252_HIGH[ch.charCodeAt(0) - 0x80] as string
        );
}

/**
 * Workbooks and UTF-16 text declare their own encoding, so pass them straight
 * through. Everything else is text of unknown encoding: decode it ourselves
 * (UTF-8 first, which also strips a BOM, then Windows-1252) and hand SheetJS a
 * string. Forcing a code page on the buffer instead would double-decode BOM'd
 * UTF-8 and mangle UTF-16 / Windows-1252 files.
 */
function readWorkbook(buffer: Buffer): xlsx.WorkBook {
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK" (xlsx)
    const isOle =
        buffer.length >= 4 && buffer.readUInt32BE(0) === 0xd0cf11e0; // xls
    const isUtf16 =
        (buffer[0] === 0xff && buffer[1] === 0xfe) ||
        (buffer[0] === 0xfe && buffer[1] === 0xff);
    if (isZip || isOle || isUtf16) {
        return xlsx.read(buffer, { type: "buffer" });
    }

    let text: string;
    try {
        // Rejects invalid UTF-8; TextDecoder drops a leading UTF-8 BOM for us.
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
        // Excel's "CSV (Comma delimited)" export on Windows writes Windows-1252.
        text = decodeWindows1252(buffer);
    }
    return xlsx.read(text, { type: "string" });
}

/** Rows of the workbook's first sheet as arrays of cells, without the header row. */
export function readFirstSheetRows(buffer: Buffer): unknown[][] {
    const workbook = readWorkbook(buffer);
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
