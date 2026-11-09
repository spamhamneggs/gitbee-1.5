import path from "node:path";
import { inflateRawSync } from "node:zlib";
import xlsx from "xlsx";
import { toCsv } from "../../prisma/dummy/dummyCsv.js";
import {
  CsvParsingError,
  parseAndValidateCsvBuffer,
  type CsvUploadType,
} from "./csvParser.js";

export const MAX_IMPORT_ROWS = 1000;
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024;

// Bound decompression before SheetJS opens the workbook. Only ordinary ZIP
// entries are supported; ZIP64/encrypted workbooks aren't import templates.
function boundedXlsxArchive(buffer: Buffer): Buffer {
  if (buffer.readUInt32LE(0) !== 0x04034b50)
    throw new CsvParsingError("Expected an Excel .xlsx workbook.");
  let end = buffer.length - 22;
  while (
    end >= Math.max(0, buffer.length - 65557) &&
    buffer.readUInt32LE(end) !== 0x06054b50
  )
    end--;
  if (end < 0 || buffer.readUInt32LE(end) !== 0x06054b50)
    throw new CsvParsingError("Invalid Excel archive.");
  const entries = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  let expanded = 0;
  const clean = xlsx.CFB.utils.cfb_new();
  const names = new Set<string>();
  if (entries > 2000)
    throw new CsvParsingError("Workbook contains too many archive entries.");
  for (let index = 0; index < entries; index++) {
    if (cursor + 46 > end || buffer.readUInt32LE(cursor) !== 0x02014b50)
      throw new CsvParsingError("Invalid Excel archive directory.");
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressed = buffer.readUInt32LE(cursor + 20);
    const size = buffer.readUInt32LE(cursor + 24);
    const local = buffer.readUInt32LE(cursor + 42);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const name = buffer
      .subarray(cursor + 46, cursor + 46 + nameLength)
      .toString("utf8");
    if (
      !name ||
      names.has(name) ||
      name.includes("\\") ||
      name.includes("\0") ||
      name.startsWith("/") ||
      name.split("/").includes("..")
    )
      throw new CsvParsingError("Invalid Excel archive path.");
    names.add(name);
    expanded += size;
    if (flags & 1 || expanded > MAX_EXPANDED_BYTES || ![0, 8].includes(method))
      throw new CsvParsingError(
        "Workbook is encrypted or exceeds the 20MB expanded limit.",
      );
    if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50)
      throw new CsvParsingError("Invalid Excel archive entry.");
    const start =
      local +
      30 +
      buffer.readUInt16LE(local + 26) +
      buffer.readUInt16LE(local + 28);
    if (start + compressed > cursor)
      throw new CsvParsingError("Invalid Excel archive size.");
    const data = buffer.subarray(start, start + compressed);
    const decoded =
      method === 8
        ? inflateRawSync(data, {
            maxOutputLength: Math.max(1, Math.min(size, MAX_EXPANDED_BYTES)),
          })
        : data;
    if (decoded.length !== size)
      throw new CsvParsingError("Invalid Excel archive size.");
    xlsx.CFB.utils.cfb_add(clean, name, decoded);
    cursor +=
      46 +
      buffer.readUInt16LE(cursor + 28) +
      buffer.readUInt16LE(cursor + 30) +
      buffer.readUInt16LE(cursor + 32);
  }
  // Feed SheetJS only the bounded entries just verified, never unchecked local
  // ZIP headers or orphan entries that disagree with the central directory.
  return xlsx.CFB.write(clean, {
    type: "buffer",
    fileType: "zip",
    compression: false,
  }) as Buffer;
}

export async function parseSpreadsheet<T extends CsvUploadType>(
  buffer: Buffer,
  filename: string,
  type: T,
) {
  if (!buffer.length) throw new CsvParsingError("File cannot be empty.");
  const extension = path.extname(filename).toLowerCase();
  let csv = buffer;
  if (extension === ".xlsx") {
    try {
      if (buffer.length < 22) throw new Error("Truncated workbook");
      const workbook = xlsx.read(boundedXlsxArchive(buffer), {
        type: "buffer",
        sheetRows: MAX_IMPORT_ROWS + 2,
        cellFormula: true,
      });
      if (workbook.SheetNames.length !== 1)
        throw new CsvParsingError("Use a workbook with exactly one worksheet.");
      const sheet = workbook.Sheets[workbook.SheetNames[0]!];
      if (!sheet?.["!ref"]) throw new CsvParsingError("Worksheet is empty.");
      const range = xlsx.utils.decode_range(sheet["!fullref"] ?? sheet["!ref"]);
      if (range.e.r > MAX_IMPORT_ROWS || range.e.c > 30)
        throw new CsvParsingError(
          `Use at most ${MAX_IMPORT_ROWS} data rows and 31 columns.`,
        );
      for (const [address, cell] of Object.entries(sheet)) {
        if (!address.startsWith("!") && cell.f)
          throw new CsvParsingError(
            `Formula in ${address}: replace formulas with plain values before uploading.`,
          );
      }
      // Formatted text preserves IDs such as 001234. Keep blank sheet rows so
      // error line numbers still match the workbook, including multiline cells.
      const rows = xlsx.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: true,
        range: 0,
      });
      csv = Buffer.from(toCsv(rows[0] ?? [], rows.slice(1)));
      const result = await parseAndValidateCsvBuffer(csv, type);
      let csvLine = 2;
      const sheetLines = new Map<number, number>();
      rows.slice(1).forEach((row, index) => {
        sheetLines.set(csvLine, index + 2);
        csvLine +=
          1 +
          row.reduce(
            (count, value) => count + (value.match(/\r\n|\r|\n/g)?.length ?? 0),
            0,
          );
      });
      for (const row of [...result.validRows, ...result.failedRows])
        row.row_number = sheetLines.get(row.row_number) ?? row.row_number;
      return result;
    } catch (error) {
      if (error instanceof CsvParsingError) throw error;
      throw new CsvParsingError(
        "Unable to read workbook. Use an unencrypted .xlsx file with plain values.",
      );
    }
  }
  if (extension !== ".csv")
    throw new CsvParsingError(
      "Choose a .csv or .xlsx file. Save older .xls files as .xlsx first.",
    );
  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(csv);
  } catch {
    throw new CsvParsingError("Save CSV files using UTF-8 encoding.");
  }
  for (const character of content) {
    const code = character.charCodeAt(0);
    if (code < 32 && ![9, 10, 13].includes(code))
      throw new CsvParsingError("Expected a UTF-8 CSV text file.");
  }
  const result = await parseAndValidateCsvBuffer(csv, type);
  if (result.totalRows > MAX_IMPORT_ROWS)
    throw new CsvParsingError(
      `Use at most ${MAX_IMPORT_ROWS} data rows per upload.`,
    );
  return result;
}
