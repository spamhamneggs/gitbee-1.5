import { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../../prisma/client.js";
import { hashPassword } from "../auth/password.js";
import { getErrorMessage } from "../response/response.js";
import type {
  CsvFailedRow,
  CsvRow,
  CsvUploadType,
  CsvValidationResult,
  StaffCsvRow,
  StudentCsvRow,
} from "./csvParser.js";

export interface CsvImportReport {
  total_rows: number;
  successful_inserts: number;
  failed_rows: CsvFailedRow[];
}

// Raised when the database fails for a reason unrelated to the row (e.g. it is
// unreachable). Carries what was imported before the failure.
export class CsvImportAbortedError extends Error {
  constructor(message: string, readonly report: CsvImportReport) {
    super(message);
    this.name = "CsvImportAbortedError";
  }
}

export interface NewCsvUser {
  email: string;
  name: string;
  role: string;
  password: string;
  user_type: string | null;
  binusian_id: string | null;
  student_id: string | null;
  lecturer_code: string | null;
}

export interface CsvUserStore {
  emailExists(email: string): Promise<boolean>;
  createUser(user: NewCsvUser): Promise<void>;
}

export const prismaUserStore: CsvUserStore = {
  async emailExists(email) {
    return (await prisma.user.count({ where: { email } })) > 0;
  },
  async createUser(user) {
    await prisma.user.create({ data: user, select: { id: true } });
  },
};

// Hashing runs on libuv's thread pool (4 threads by default); inserts stay
// sequential so duplicates inside one file always fail on the later row.
const HASH_BATCH_SIZE = 4;

// user table column -> CSV column, for duplicate-key messages.
const uniqueColumnLabels: Record<string, string> = {
  student_id: "nim",
  lecturer_code: "lecturer_code",
  binusian_id: "binusian_id",
};

function toNewUser(row: StudentCsvRow | StaffCsvRow, password: string): NewCsvUser {
  if ("nim" in row) {
    return {
      email: row.email,
      name: row.name,
      role: "Student",
      password,
      user_type: "student",
      binusian_id: row.binusian_id,
      student_id: row.nim,
      lecturer_code: null,
    };
  }
  return {
    email: row.email,
    name: row.name,
    role: row.role,
    password,
    user_type: null,
    binusian_id: row.binusian_id,
    student_id: null,
    lecturer_code: row.lecturer_code,
  };
}

function duplicateColumn(error: Prisma.PrismaClientKnownRequestError): string | null {
  const meta = error.meta as
    | {
        target?: string | string[];
        driverAdapterError?: { cause?: { constraint?: { index?: string; fields?: string[] } } };
      }
    | undefined;
  const constraint = meta?.driverAdapterError?.cause?.constraint;
  const candidates = [
    ...(Array.isArray(meta?.target) ? meta.target : [meta?.target]),
    ...(constraint?.fields ?? []),
    constraint?.index?.replace(/^user_(.+)_key$/, "$1"),
  ];
  const column = candidates.find(
    (candidate): candidate is string => !!candidate && candidate in uniqueColumnLabels
  );
  return column ? uniqueColumnLabels[column] ?? null : null;
}

function rowErrorFor(error: unknown, user: NewCsvUser): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  if (error.code === "P2002") {
    const column = duplicateColumn(error);
    const value =
      column === "nim" ? user.student_id
        : column === "lecturer_code" ? user.lecturer_code
        : column === "binusian_id" ? user.binusian_id
        : null;
    return column
      ? `${column} "${value}" is already in use`
      : "a user with the same NIM, lecturer code or Binusian ID already exists";
  }
  if (error.code === "P2000") {
    return "a value is too long for the database column";
  }
  return null;
}

export async function importCsvUsers<T extends CsvUploadType>(
  validation: CsvValidationResult<CsvRow<T>>,
  store: CsvUserStore = prismaUserStore
): Promise<CsvImportReport> {
  const failedRows = [...validation.failedRows];
  let successfulInserts = 0;
  const report = (): CsvImportReport => ({
    total_rows: validation.totalRows,
    successful_inserts: successfulInserts,
    failed_rows: [...failedRows].sort((a, b) => a.row_number - b.row_number),
  });

  for (let start = 0; start < validation.validRows.length; start += HASH_BATCH_SIZE) {
    const batch = validation.validRows.slice(start, start + HASH_BATCH_SIZE);
    const hashes = await Promise.all(batch.map((row) => hashPassword(row.data.password)));

    for (const [index, row] of batch.entries()) {
      const user = toNewUser(row.data, hashes[index] as string);
      try {
        if (await store.emailExists(user.email)) {
          failedRows.push({
            row_number: row.row_number,
            identifier: row.identifier,
            error: `email "${user.email}" is already in use`,
          });
          continue;
        }
        await store.createUser(user);
        successfulInserts += 1;
      } catch (error) {
        const rowError = rowErrorFor(error, user);
        if (!rowError) {
          const reason =
            error instanceof Prisma.PrismaClientKnownRequestError
              ? `database error (${error.code})`
              : getErrorMessage(error, "database error");
          throw new CsvImportAbortedError(
            `Import stopped at row ${row.row_number}: ${reason}`,
            report()
          );
        }
        failedRows.push({
          row_number: row.row_number,
          identifier: row.identifier,
          error: rowError,
        });
      }
    }
  }

  return report();
}
