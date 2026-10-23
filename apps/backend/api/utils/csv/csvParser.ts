import { Readable } from "node:stream";
import { parse, type InfoRecord } from "csv-parse";
import { z } from "zod";

export class CsvParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParsingError";
  }
}

// Max lengths mirror the `user` table columns, so a row that passes here fits the DB.
const requiredText = (max: number) =>
  z
    .string()
    .min(1, "is required")
    .max(max, `must be at most ${max} characters`);

const email = z
  .email("must be a valid email address")
  .max(150, "must be at most 150 characters");

// Blank cells arrive as "", which would collide on the unique binusian_id index.
const optionalBinusianId = z
  .string()
  .max(150, "must be at most 150 characters")
  .transform((value) => value || null);

export const staffRoles = ["Lecturer", "Admin", "SCC", "HoP"] as const;

const staffRole = z.string().transform((value, ctx) => {
  const role = staffRoles.find(
    (candidate) => candidate.toLowerCase() === value.toLowerCase()
  );
  if (!role) {
    ctx.addIssue({
      code: "custom",
      message: `must be one of ${staffRoles.join(", ")}`,
    });
    return z.NEVER;
  }
  return role;
});

const studentCsvRowSchema = z.object({
  nim: requiredText(50),
  name: requiredText(150),
  email,
  binusian_id: optionalBinusianId,
  major_code: requiredText(50),
  password: requiredText(255),
});

const staffCsvRowSchema = z.object({
  lecturer_code: requiredText(50),
  name: requiredText(150),
  email,
  binusian_id: optionalBinusianId,
  role: staffRole,
  major_codes: requiredText(255),
  password: requiredText(255),
});

// One schema per file type; its keys are the required header columns.
const csvFileTypes = {
  student: { schema: studentCsvRowSchema, identifierColumn: "nim" },
  staff: { schema: staffCsvRowSchema, identifierColumn: "lecturer_code" },
} as const;

export type CsvUploadType = keyof typeof csvFileTypes;
export type CsvRow<T extends CsvUploadType> = z.output<
  (typeof csvFileTypes)[T]["schema"]
>;
export type StudentCsvRow = CsvRow<"student">;
export type StaffCsvRow = CsvRow<"staff">;

export interface CsvFailedRow {
  row_number: number;
  identifier: string | null;
  error: string;
}

export interface CsvValidRow<T> {
  row_number: number;
  identifier: string;
  data: T;
}

export interface CsvValidationResult<T> {
  totalRows: number;
  validRows: CsvValidRow<T>[];
  failedRows: CsvFailedRow[];
}

function getRecordStartLine(info: InfoRecord): number {
  const recordContent = info.raw
    ?.replace(/^(?:(?:\r\n|\r|\n))+/, "")
    .replace(/(?:(?:\r\n|\r|\n))+$/, "");
  const embeddedLineBreaks =
    recordContent?.match(/\r\n|\r|\n/g)?.length ?? 0;

  return info.lines - embeddedLineBreaks;
}

function formatIssues(issues: z.core.$ZodIssue[]): string {
  return issues
    .map((issue) => {
      const field = issue.path.join(".");
      return field ? `${field}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export async function parseAndValidateCsvBuffer<T extends CsvUploadType>(
  buffer: Buffer,
  uploadType: T
): Promise<CsvValidationResult<CsvRow<T>>> {
  if (buffer.length === 0) {
    throw new CsvParsingError("CSV file cannot be empty");
  }

  const { schema, identifierColumn } = csvFileTypes[uploadType];
  const validRows: CsvValidRow<CsvRow<T>>[] = [];
  const failedRows: CsvFailedRow[] = [];
  let totalRows = 0;
  let headers: string[] = [];
  let invalidFieldLengthRows = 0;

  const parser = parse({
    bom: true,
    cast: (value) => value.replace(/\uFEFF/g, ""),
    columns: (rawHeaders) => {
      headers = rawHeaders.map((header) =>
        header.replace(/\uFEFF/g, "")
      );
      return headers;
    },
    info: true,
    raw: true,
    // A row with the wrong field count is reported as a failed row, not a rejected file.
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });

  const rows = Readable.from([buffer]).pipe(parser);
  for await (const parsedRow of rows) {
    const { record, info } = parsedRow as {
      record: Record<string, unknown>;
      info: InfoRecord;
    };
    totalRows += 1;
    const rowNumber = getRecordStartLine(info);
    const rawIdentifier = record[identifierColumn];
    const identifier =
      typeof rawIdentifier === "string" && rawIdentifier !== ""
        ? rawIdentifier
        : null;

    if (info.invalid_field_length > invalidFieldLengthRows) {
      invalidFieldLengthRows = info.invalid_field_length;
      failedRows.push({
        row_number: rowNumber,
        identifier,
        error: `row must have ${headers.length} fields to match the header`,
      });
      continue;
    }

    const parsed = schema.safeParse(record);
    if (parsed.success) {
      validRows.push({
        row_number: rowNumber,
        identifier: identifier ?? "",
        data: parsed.data as CsvRow<T>,
      });
    } else {
      failedRows.push({
        row_number: rowNumber,
        identifier,
        error: formatIssues(parsed.error.issues),
      });
    }
  }

  if (headers.length === 0) {
    throw new CsvParsingError("CSV file must include a header row");
  }

  const duplicatedColumns = headers.filter(
    (header, index) => headers.indexOf(header) !== index
  );
  if (duplicatedColumns.length > 0) {
    throw new CsvParsingError(
      `Duplicate CSV columns: ${[...new Set(duplicatedColumns)].join(", ")}`
    );
  }

  const missingColumns = Object.keys(schema.shape).filter(
    (column) => !headers.includes(column)
  );
  if (missingColumns.length > 0) {
    throw new CsvParsingError(
      `Missing required CSV columns: ${missingColumns.join(", ")}`
    );
  }

  return { totalRows, validRows, failedRows };
}
