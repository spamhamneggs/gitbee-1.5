import { Readable } from "node:stream";
import { parse, type InfoRecord } from "csv-parse";
import { z } from "zod";

export type CsvUploadType = "student" | "staff";

const requiredColumns: Record<CsvUploadType, readonly string[]> = {
  student: [
    "nim",
    "name",
    "email",
    "binusian_id",
    "major_code",
    "password",
  ],
  staff: [
    "lecturer_code",
    "name",
    "email",
    "binusian_id",
    "role",
    "major_codes",
    "password",
  ],
};

export class CsvParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParsingError";
  }
}

const studentCsvRowSchema = z.object({
  nim: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  binusian_id: z.string().nullable().optional(),
  major_code: z.string().min(1),
  password: z.string().min(1),
});

const staffCsvRowSchema = z.object({
  lecturer_code: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  binusian_id: z.string().nullable().optional(),
  role: z.string().min(1),
  major_codes: z.string().min(1),
  password: z.string().min(1),
});

export type CsvUserRow =
  | z.infer<typeof studentCsvRowSchema>
  | z.infer<typeof staffCsvRowSchema>;

export interface CsvRowError {
  line: number;
  errors: string[];
}

export interface CsvValidationResult {
  totalParsed: number;
  validRows: CsvUserRow[];
  errors: CsvRowError[];
}

function getRecordStartLine(info: InfoRecord): number {
  const recordContent = info.raw
    ?.replace(/^(?:(?:\r\n|\r|\n))+/, "")
    .replace(/(?:(?:\r\n|\r|\n))+$/, "");
  const embeddedLineBreaks =
    recordContent?.match(/\r\n|\r|\n/g)?.length ?? 0;

  return info.lines - embeddedLineBreaks;
}

export async function parseAndValidateCsvBuffer(
  buffer: Buffer,
  uploadType: CsvUploadType
): Promise<CsvValidationResult> {
  if (buffer.length === 0) {
    throw new CsvParsingError("CSV file cannot be empty");
  }

  const validRows: CsvUserRow[] = [];
  const errors: CsvRowError[] = [];
  let totalParsed = 0;
  let headers: string[] = [];
  const rowSchema =
    uploadType === "student" ? studentCsvRowSchema : staffCsvRowSchema;

  const parser = parse({
    bom: true,
    cast: (value) => value.replace(/\uFEFF/g, ""),
    columns: (rawHeaders) => {
      headers = rawHeaders.map((header) => header.replace(/\uFEFF/g, ""));
      return headers;
    },
    info: true,
    raw: true,
    relax_column_count: false,
    skip_empty_lines: true,
    trim: true,
  });

  const rows = Readable.from([buffer]).pipe(parser);
  for await (const parsedRow of rows) {
    const { record, info } = parsedRow as {
      record: Record<string, unknown>;
      info: InfoRecord;
    };
    totalParsed += 1;
    const parsed = rowSchema.safeParse(record);
    if (parsed.success) {
      validRows.push(parsed.data);
    } else {
      errors.push({
        line: getRecordStartLine(info),
        errors: parsed.error.issues.map((issue) => {
          const field = issue.path.join(".");
          return field ? `${field}: ${issue.message}` : issue.message;
        }),
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

  const missingColumns = requiredColumns[uploadType].filter(
    (column) => !headers.includes(column)
  );
  if (missingColumns.length > 0) {
    throw new CsvParsingError(
      `Missing required CSV columns: ${missingColumns.join(", ")}`
    );
  }

  return { totalParsed, validRows, errors };
}
