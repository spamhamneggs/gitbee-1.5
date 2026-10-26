import { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../../prisma/client.js";
import { hashPassword } from "../auth/password.js";
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
  findExistingUsers(
    identities: CsvUserIdentity[]
  ): Promise<Partial<CsvUserIdentity>[]>;
  createMany(users: NewCsvUser[]): Promise<number>;
}

const IDENTITY_COLUMNS = [
  "email",
  "binusian_id",
  "student_id",
  "lecturer_code",
] as const satisfies readonly (keyof CsvUserIdentity)[];
const HASH_CONCURRENCY = 4;

export const prismaUserStore: CsvUserStore = {
  async findExistingUsers(identities) {
    const conditions = IDENTITY_COLUMNS.flatMap((column) => {
      const values = [
        ...new Set(
          identities
            .map((identity) => identity[column]?.trim())
            .filter((value): value is string => !!value)
        ),
      ];
      return values.length > 0 ? [{ [column]: { in: values } }] : [];
    });
    if (conditions.length === 0) return [];

    return prisma.user.findMany({
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

function normalizedIdentityKeys(row: StudentCsvRow | StaffCsvRow): string[] {
  const keys = [`email:${row.email.trim().toLowerCase()}`];
  const binusianId = row.binusian_id?.trim().toLowerCase();
  if (binusianId) keys.push(`binusian_id:${binusianId}`);

  if ("nim" in row) {
    const studentId = row.nim.trim().toLowerCase();
    if (studentId) keys.push(`student_id:${studentId}`);
  } else {
    const lecturerCode = row.lecturer_code.trim().toLowerCase();
    if (lecturerCode) keys.push(`lecturer_code:${lecturerCode}`);
  }
  return keys;
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
        left.trim().toLowerCase() === right.trim().toLowerCase()
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
  let failedCount = validation.failedRows.length;
  let skippedCount = 0;
  let createdCount = 0;
  const report = (): CsvImportReport => ({
    totalParsed: validation.totalRows,
    createdCount,
    skippedCount,
    failedCount,
    errors: [...errors].sort((left, right) => left.line - right.line),
  });

  const importableRows: typeof validation.validRows = [];
  for (const row of validation.validRows) {
    const data: StudentCsvRow | StaffCsvRow = row.data;
    if ("role" in data && data.role === "HoP") {
      errors.push({
        line: row.row_number,
        errors: [
          `major_codes "${data.major_codes}" can't be resolved: majors have no codes yet, so HoP accounts can't be imported`,
        ],
      });
      failedCount += 1;
      continue;
    }
    importableRows.push(row);
  }

  const identities = importableRows.map((row) => identityFromRow(row.data));
  let existingUsers: Partial<CsvUserIdentity>[];
  try {
    existingUsers = await store.findExistingUsers(identities);
  } catch (error) {
    for (const row of importableRows) {
      errors.push({
        line: row.row_number,
        errors: [
          getErrorMessage(error, "database error while checking for duplicate users"),
        ],
      });
      failedCount += 1;
    }
    return report();
  }

  const seenKeys = new Set<string>();
  const uniqueRows: typeof validation.validRows = [];
  for (const [index, row] of importableRows.entries()) {
    const identity = identities[index];
    const databaseDuplicate =
      identity !== undefined &&
      existingUsers.some((existing) => isDuplicate(existing, identity));
    if (databaseDuplicate) {
      skippedCount += 1;
      errors.push({
        line: row.row_number,
        errors: ["User with email or ID already exists in the system"],
      });
      continue;
    }

    const keys = normalizedIdentityKeys(row.data);
    if (keys.some((key) => seenKeys.has(key))) {
      skippedCount += 1;
      errors.push({
        line: row.row_number,
        errors: ["Duplicate record within the uploaded file"],
      });
      continue;
    }
    keys.forEach((key) => seenKeys.add(key));
    uniqueRows.push(row);
  }

  const candidates: { line: number; user: NewCsvUser }[] = [];
  for (
    let start = 0;
    start < uniqueRows.length;
    start += HASH_CONCURRENCY
  ) {
    const batch = uniqueRows.slice(start, start + HASH_CONCURRENCY);
    const hashedRows = await Promise.all(
      batch.map(async (row) => {
        try {
          const password = await hashPassword(row.data.password);
          return { row, password };
        } catch (error) {
          errors.push({
            line: row.row_number,
            errors: [getErrorMessage(error, "failed to hash initial password")],
          });
          failedCount += 1;
          return null;
        }
      })
    );
    for (const hashed of hashedRows) {
      if (!hashed) continue;
      candidates.push({
        line: hashed.row.row_number,
        user: toNewUser(hashed.row.data, hashed.password),
      });
    }
  }

  if (candidates.length === 0) return report();

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
    failedCount += candidates.length;
  }

  return report();
}
