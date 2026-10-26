// Builds student/staff CSV files from the dummy generators, optionally mixed
// with deliberately broken rows for exercising the upload's error report.
import { csvHeaders, type CsvUploadType } from "../../utils/csv/csvParser.js";
import {
  dummyPassword,
  generateStaff,
  generateStudents,
  type GeneratorOptions,
  type StaffCsvInput,
  type StudentCsvInput,
} from "./dummyUsers.js";

export interface DummyCsvRow {
  cells: string[];
  // The error the upload report should give for this row; absent for valid rows.
  expectedError?: string;
}

export interface DummyCsvOptions extends GeneratorOptions {
  count: number;
  broken?: boolean;
}

// What apps/backend/samples/{students,staff}.csv are generated from.
export const sampleCsvOptions = { students: 25, staff: 12, seed: 1 } as const;

function quote(cell: string): string {
  return /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

export function toCsv(header: readonly string[], rows: readonly string[][]): string {
  return `${[header, ...rows].map((row) => row.map(quote).join(",")).join("\n")}\n`;
}

function cellsOf(type: CsvUploadType, row: StudentCsvInput | StaffCsvInput): string[] {
  return csvHeaders[type].map((column) => (row as Record<string, string>)[column] ?? "");
}

// Broken rows use their own NIM/lecturer code range so they never collide with
// generated rows by accident; the duplicate rows below collide on purpose.
function brokenStudentRows(valid: StudentCsvInput[]): DummyCsvRow[] {
  const row = (n: number, overrides: Partial<StudentCsvInput> = {}): string[] =>
    cellsOf("student", {
      nim: String(2709000000 + n),
      name: "Broken Row",
      email: `broken.student${n}@binus.ac.id`,
      binusian_id: "",
      major_code: "CS",
      password: dummyPassword,
      ...overrides,
    });

  const rows: DummyCsvRow[] = [
    { cells: row(1, { nim: "" }), expectedError: "nim: is required" },
    { cells: row(2, { email: "not-an-email" }), expectedError: "email: must be a valid email address" },
    { cells: row(3, { major_code: "" }), expectedError: "major_code: is required" },
    { cells: row(4, { password: "" }), expectedError: "password: is required" },
    {
      cells: row(5, { name: `${"Exceedingly Long ".repeat(9)}Name` }),
      expectedError: "name: must be at most 150 characters",
    },
    {
      cells: row(6, { nim: "", email: "also-not-an-email" }),
      expectedError: "nim: is required; email: must be a valid email address",
    },
    { cells: row(7).slice(0, -1), expectedError: "row must have 6 fields to match the header" },
  ];

  // Valid on their own, but rejected at import because an earlier row already
  // used the same NIM / email.
  const [first] = valid;
  if (first) {
    rows.push(
      { cells: row(8, { nim: first.nim }), expectedError: `nim "${first.nim}" is already in use` },
      { cells: row(9, { email: first.email }), expectedError: `email "${first.email}" is already in use` }
    );
  }
  return rows;
}

function brokenStaffRows(valid: StaffCsvInput[]): DummyCsvRow[] {
  const row = (n: number, overrides: Partial<StaffCsvInput> = {}): string[] =>
    cellsOf("staff", {
      lecturer_code: `X${9000 + n}`,
      name: "Broken Row",
      email: `broken.staff${n}@binus.edu`,
      binusian_id: "",
      role: "Lecturer",
      major_codes: "CS",
      password: dummyPassword,
      ...overrides,
    });

  const rows: DummyCsvRow[] = [
    { cells: row(1, { role: "Dean" }), expectedError: "role: must be one of Lecturer, Admin, SCC, HoP" },
    { cells: row(2, { lecturer_code: "" }), expectedError: "lecturer_code: is required" },
    { cells: row(3, { email: "lecturer@" }), expectedError: "email: must be a valid email address" },
    { cells: row(4, { major_codes: "" }), expectedError: "major_codes: is required" },
    { cells: row(5, { password: "" }), expectedError: "password: is required" },
    { cells: [...row(6), "extra"], expectedError: "row must have 7 fields to match the header" },
  ];

  // Duplicates must point at a row that actually gets imported; HoP rows don't
  // (majors have no codes yet), so skip those.
  const imported = valid.filter((staff) => staff.role !== "HoP");
  const firstCode = imported[0];
  const firstBinusian = imported.find((staff) => staff.binusian_id !== "");
  if (firstCode) {
    rows.push({
      cells: row(7, { lecturer_code: firstCode.lecturer_code }),
      expectedError: `lecturer_code "${firstCode.lecturer_code}" is already in use`,
    });
  }
  if (firstBinusian) {
    rows.push({
      cells: row(8, { binusian_id: firstBinusian.binusian_id }),
      expectedError: `binusian_id "${firstBinusian.binusian_id}" is already in use`,
    });
  }
  return rows;
}

// Spreads broken rows evenly between valid ones, so the error report shows a
// range of row numbers. Any that don't fit go at the end, which also keeps the
// duplicate rows after the rows they duplicate.
function interleave(valid: DummyCsvRow[], broken: DummyCsvRow[]): DummyCsvRow[] {
  const rows: DummyCsvRow[] = [];
  let next = 0;
  valid.forEach((row, index) => {
    rows.push(row);
    while (
      next < broken.length &&
      Math.floor(((next + 1) * valid.length) / (broken.length + 1)) === index + 1
    ) {
      rows.push(broken[next] as DummyCsvRow);
      next += 1;
    }
  });
  return [...rows, ...broken.slice(next)];
}

export function dummyCsvRows(
  type: CsvUploadType,
  { count, broken = true, ...generator }: DummyCsvOptions
): DummyCsvRow[] {
  if (type === "student") {
    const students = generateStudents(count, generator);
    return interleave(
      students.map((student) => ({ cells: cellsOf("student", student) })),
      broken ? brokenStudentRows(students) : []
    );
  }
  const staff = generateStaff(count, generator);
  return interleave(
    staff.map((member) => ({ cells: cellsOf("staff", member) })),
    broken ? brokenStaffRows(staff) : []
  );
}

export function buildDummyCsv(type: CsvUploadType, options: DummyCsvOptions): string {
  return toCsv(
    csvHeaders[type],
    dummyCsvRows(type, options).map((row) => row.cells)
  );
}
