import { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../../prisma/client.js";
import bcrypt from "bcryptjs";
import { getErrorMessage } from "../response/response.js";
import type {
  CsvRow,
  CsvUploadType,
  CsvValidationResult,
  StaffCsvRow,
  StudentCsvRow,
} from "./csvParser.js";

export interface CsvImportError {
  line: number;
  errors: string[];
}

export interface CsvImportReport {
  totalParsed: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  errors: CsvImportError[];
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

export type CsvUserIdentity = Pick<
  NewCsvUser,
  "email" | "binusian_id" | "student_id" | "lecturer_code"
>;

export interface CsvUserStore {
  findExistingUser(
    identity: CsvUserIdentity
  ): Promise<Partial<CsvUserIdentity> | null>;
  createMany(users: NewCsvUser[]): Promise<number>;
}

const IDENTITY_COLUMNS = [
  "email",
  "binusian_id",
  "student_id",
  "lecturer_code",
] as const satisfies readonly (keyof CsvUserIdentity)[];

export const prismaUserStore: CsvUserStore = {
  async findExistingUser(identity) {
    const conditions = IDENTITY_COLUMNS.flatMap((column) => {
      const value = identity[column];
      return value === null ? [] : [{ [column]: value }];
    });
    if (conditions.length === 0) return null;

    return prisma.user.findFirst({
      where: { OR: conditions },
      select: {
        email: true,
        binusian_id: true,
        student_id: true,
        lecturer_code: true,
      },
    });
  },
  async createMany(users) {
    if (users.length === 0) return 0;
    const result = await prisma.user.createMany({
      data: users,
      skipDuplicates: true,
    });
    return result.count;
  },
};

function toNewUser(
  row: StudentCsvRow | StaffCsvRow,
  password: string
): NewCsvUser {
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

function compositeKey(row: StudentCsvRow | StaffCsvRow): string {
  const identity =
    row.binusian_id || ("nim" in row ? row.nim : row.lecturer_code);
  return JSON.stringify([row.email.toLocaleLowerCase(), identity.toLocaleLowerCase()]);
}

function identityFromRow(row: StudentCsvRow | StaffCsvRow): CsvUserIdentity {
  if ("nim" in row) {
    return {
      email: row.email,
      binusian_id: row.binusian_id,
      student_id: row.nim,
      lecturer_code: null,
    };
  }
  return {
    email: row.email,
    binusian_id: row.binusian_id,
    student_id: null,
    lecturer_code: row.lecturer_code,
  };
}

function isDuplicate(
  existing: Partial<CsvUserIdentity> | null,
  identity: CsvUserIdentity
): boolean {
  return (
    existing !== null &&
    IDENTITY_COLUMNS.some((column) => {
      const left = existing[column];
      const right = identity[column];
      return (
        left != null &&
        right != null &&
        left.toLocaleLowerCase() === right.toLocaleLowerCase()
      );
    })
  );
}

function validationErrorMessage(error: string): string {
  return error;
}

export async function importCsvUsers<T extends CsvUploadType>(
  validation: CsvValidationResult<CsvRow<T>>,
  store: CsvUserStore = prismaUserStore
): Promise<CsvImportReport> {
  const errors: CsvImportError[] = validation.failedRows.map((row) => ({
    line: row.row_number,
    errors: [validationErrorMessage(row.error)],
  }));
  let skippedCount = 0;
  let createdCount = 0;
  const report = (): CsvImportReport => ({
    totalParsed: validation.totalRows,
    createdCount,
    skippedCount,
    failedCount: errors.length,
    errors: [...errors].sort((left, right) => left.line - right.line),
  });

  const seenKeys = new Set<string>();
  const uniqueRows: typeof validation.validRows = [];
  for (const row of validation.validRows) {
    const data: StudentCsvRow | StaffCsvRow = row.data;
    if ("role" in data && data.role === "HoP") {
      errors.push({
        line: row.row_number,
        errors: [
          `major_codes "${data.major_codes}" can't be resolved: majors have no codes yet, so HoP accounts can't be imported`,
        ],
      });
      continue;
    }

    const key = compositeKey(data);
    if (seenKeys.has(key)) {
      skippedCount += 1;
      errors.push({
        line: row.row_number,
        errors: ["Duplicate record within the uploaded file"],
      });
      continue;
    }
    seenKeys.add(key);
    uniqueRows.push(row);
  }

  const candidates: { line: number; user: NewCsvUser }[] = [];
  for (const row of uniqueRows) {
    const identity = identityFromRow(row.data);
    try {
      const existing = await store.findExistingUser(identity);
      if (isDuplicate(existing, identity)) {
        skippedCount += 1;
        errors.push({
          line: row.row_number,
          errors: ["User with email or ID already exists in the system"],
        });
        continue;
      }
      const hashedPassword = await bcrypt.hash(row.data.password, 10);
      candidates.push({
        line: row.row_number,
        user: toNewUser(row.data, hashedPassword),
      });
    } catch (error) {
      errors.push({
        line: row.row_number,
        errors: [
          getErrorMessage(error, "database error while checking or preparing user"),
        ],
      });
    }
  }

  try {
    createdCount = await store.createMany(candidates.map(({ user }) => user));
    skippedCount += candidates.length - createdCount;
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2000"
        ? "a value is too long for the database column"
        : getErrorMessage(error, "database error while inserting users");
    errors.push(
      ...candidates.map(({ line }) => ({
        line,
        errors: [message],
      }))
    );
  }

  return report();
}
