// In-memory stand-in for the user table, enforcing the same unique indexes so
// CSV import tests run without MySQL.
import { Prisma } from "../api/prisma/generated/prisma/client.js";
import type {
  CsvUserStore,
  NewCsvUser,
} from "../api/utils/csv/csvUserImport.js";

const uniqueColumns = ["student_id", "lecturer_code", "binusian_id", "email"] as const;
// The user table's utf8mb4_unicode_ci ignores case, accents and trailing spaces.
// Close enough for unit tests; csvUserImport.mysql.test.ts checks the real one.
const collationKey = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/ +$/, "");
const same = (a: string | null | undefined, b: string) =>
  a != null && collationKey(a) === collationKey(b);

// Same shape Prisma 7 + @prisma/adapter-mariadb throws for MySQL error 1062.
export function uniqueViolation(index: string) {
  return new Prisma.PrismaClientKnownRequestError(
    `Unique constraint failed on the constraint: \`${index}\``,
    {
      code: "P2002",
      clientVersion: "test",
      meta: {
        modelName: "User",
        driverAdapterError: {
          name: "DriverAdapterError",
          cause: { kind: "UniqueConstraintViolation", constraint: { index } },
        },
      },
    }
  );
}

export function createFakeUserStore(existing: Partial<NewCsvUser>[] = []) {
  const users: NewCsvUser[] = [];
  const all = () => [...existing, ...users];

  const store: CsvUserStore & { users: NewCsvUser[] } = {
    users,
    async findExistingUsers(identities) {
      return all()
        .filter((user) =>
          identities.some((identity) =>
            uniqueColumns.some((column) => {
              const value = identity[column];
              return value != null && same(user[column], value);
            })
          )
        )
        .map((candidate) => ({
          email: candidate.email,
          binusian_id: candidate.binusian_id,
          student_id: candidate.student_id,
          lecturer_code: candidate.lecturer_code,
        }));
    },
    async collationKeys(values) {
      return new Map(values.map((value) => [value, collationKey(value)]));
    },
    async createMany(newUsers) {
      let count = 0;
      for (const user of newUsers) {
        const duplicate = uniqueColumns.some((column) => {
          const value = user[column];
          return value !== null && all().some((other) => same(other[column], value));
        });
        if (duplicate) {
          continue;
        }
        users.push(user);
        count += 1;
      }
      return count;
    },
  };
  return store;
}
