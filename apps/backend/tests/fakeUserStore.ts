// In-memory stand-in for the user table, enforcing the same unique indexes so
// CSV import tests run without MySQL.
import { Prisma } from "../api/prisma/generated/prisma/client.js";
import type { CsvUserStore, NewCsvUser } from "../api/utils/csv/csvUserImport.js";

const uniqueColumns = ["student_id", "lecturer_code", "binusian_id"] as const;

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
    async emailExists(email) {
      return all().some((user) => user.email === email);
    },
    async createUser(user) {
      for (const column of uniqueColumns) {
        const value = user[column];
        if (value != null && all().some((other) => other[column] === value)) {
          throw uniqueViolation(`user_${column}_key`);
        }
      }
      users.push(user);
    },
  };
  return store;
}
