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
  // A comparison key for each value under the user table's collation: two
  // values collide on a unique index exactly when their keys are equal.
  collationKeys(values: string[]): Promise<Map<string, string>>;
  createMany(users: NewCsvUser[]): Promise<number>;
}

// Collation of the user table's identity columns (set by the 0_init migration).
export const USER_TABLE_COLLATION = "utf8mb4_unicode_ci";

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
  // utf8mb4_unicode_ci ignores case and accents and has rules JavaScript can't
  // reproduce (ß = ss, full-width = ASCII, ignorable characters), so MySQL
  // computes the keys. Trim trailing space weights for PAD SPACE equality,
  // including Unicode spaces and spaces followed by ignorable characters.
  async collationKeys(values) {
    const distinct = [...new Set(values)];
    if (distinct.length === 0) return new Map();

    const rows = await prisma.$queryRaw<{ value: string; sort_key: string }[]>`
      SELECT input.value,
             HEX(TRIM(TRAILING WEIGHT_STRING(_utf8mb4' ' COLLATE ${Prisma.raw(USER_TABLE_COLLATION)})
                      FROM WEIGHT_STRING(input.value COLLATE ${Prisma.raw(USER_TABLE_COLLATION)}))) AS sort_key
      FROM JSON_TABLE(${JSON.stringify(distinct)}, '$[*]' COLUMNS (value VARCHAR(255) PATH '$')) AS input`;
    return new Map(rows.map((row) => [row.value, row.sort_key]));
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

// The unique-index values an identity occupies, e.g. { column: "email", value }.
function identityEntries(identity: Partial<CsvUserIdentity>) {
  return IDENTITY_COLUMNS.flatMap((column) => {
    const value = identity[column];
    return value ? [{ column, value }] : [];
  });
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

  const rowsToCheck = importableRows.map((row) => ({
    row,
    identity: identityFromRow(row.data),
  }));
  let existingUsers: Partial<CsvUserIdentity>[];
  let collationKeys: Map<string, string>;
  try {
    existingUsers = await store.findExistingUsers(
      rowsToCheck.map(({ identity }) => identity)
    );
    collationKeys = await store.collationKeys(
      [...rowsToCheck.map(({ identity }) => identity), ...existingUsers].flatMap(
        (identity) => identityEntries(identity).map(({ value }) => value)
      )
    );
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

  // Compare identities the way the unique indexes do (see collationKeys);
  // JavaScript case folding misses accents, ß = ss and the like.
  const indexKeys = (identity: Partial<CsvUserIdentity>) =>
    identityEntries(identity).map(
      ({ column, value }) => `${column}:${collationKeys.get(value) ?? value}`
    );
  const existingKeys = new Set(existingUsers.flatMap(indexKeys));
  const seenKeys = new Set<string>();
  const uniqueRows: typeof validation.validRows = [];
  for (const { row, identity } of rowsToCheck) {
    const keys = indexKeys(identity);
    if (keys.some((key) => existingKeys.has(key))) {
      skippedCount += 1;
      errors.push({
        line: row.row_number,
        errors: ["User with email or ID already exists in the system"],
      });
      continue;
    }

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
