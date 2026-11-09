import xlsx from "xlsx";
import { csvHeaders, type CsvUploadType } from "../csv/csvParser.js";
import {
  generateStudents,
  generateStaff,
} from "../../prisma/dummy/dummyUsers.js";
import { toCsv } from "../../prisma/dummy/dummyCsv.js";

export function sampleFile(
  type: CsvUploadType,
  format: "csv" | "xlsx",
  withErrors = false,
) {
  const headers = csvHeaders[type];
  const records: Record<string, string>[] =
    type === "student"
      ? generateStudents(8, { seed: 42, offset: 1000 })
      : generateStaff(8, { seed: 42, offset: 1000 }).filter(
          (row) => row.role !== "HoP",
        );
  records.forEach((row, index) => {
    row.email = `import.${type}.${index + 1}@example.test`;
  });
  if (withErrors) {
    records.push({ ...records[0]! });
    records.push({ ...records[1]!, email: "invalid-email", name: "" });
  }
  const rows = records.map((row) => headers.map((header) => row[header] ?? ""));
  if (format === "csv") return Buffer.from(toCsv(headers, rows));
  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);
  sheet["!cols"] = headers.map((header) => ({
    wch: header === "email" ? 36 : 24,
  }));
  xlsx.utils.book_append_sheet(
    workbook,
    sheet,
    type === "student" ? "Students" : "Staff",
  );
  return xlsx.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  }) as Buffer;
}
