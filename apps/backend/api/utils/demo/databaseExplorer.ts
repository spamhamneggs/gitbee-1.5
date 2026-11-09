import { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../../prisma/client.js";

const hidden = new Set(["password", "credential_version"]);
export const databaseTables = [
  "user",
  "project",
  "project_detail",
  "project_group",
  "class_transaction",
  "student_list_transaction",
  "assessment",
  "reviewed_project",
  "outstanding_project",
  "gallery",
  "project_technology",
  "technology",
  "major",
  "hop_major",
  "status",
  "category",
  "role",
  "class",
  "deadline",
  "temporary_group",
];

async function describeTables() {
  const [columns, keys] = await Promise.all([
    prisma.$queryRaw<
      {
        table_name: string;
        name: string;
        type: string;
        nullable: string;
        column_key: string;
      }[]
    >`SELECT TABLE_NAME AS table_name, COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_KEY AS column_key FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY ORDINAL_POSITION`,
    prisma.$queryRaw<
      {
        table_name: string;
        column_name: string;
        target: string;
        target_column: string;
      }[]
    >`SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, REFERENCED_TABLE_NAME AS target, REFERENCED_COLUMN_NAME AS target_column FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`,
  ]);
  return databaseTables.map((name) => ({
    name,
    columns: columns
      .filter(
        (column) => column.table_name === name && !hidden.has(column.name),
      )
      .map((column) => ({
        name: column.name,
        type: column.type,
        required: column.nullable === "NO",
        primaryKey: column.column_key === "PRI",
        unique: column.column_key === "UNI",
      })),
    relationships: keys
      .filter((key) => key.table_name === name)
      .map((key) => ({
        columns: [key.column_name],
        target: key.target,
        references: [key.target_column],
      })),
  }));
}

// Tables come from a fixed application allowlist and columns from database
// metadata. Request text is never interpolated into an SQL identifier.
const identifier = (value: string) =>
  Prisma.raw(`\`${value.replaceAll("`", "``")}\``);
export async function databaseOverview() {
  return Promise.all(
    (await describeTables()).map(async (table) => {
      const rows = await prisma.$queryRaw<{ total: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) AS total FROM ${identifier(table.name)}`,
      );
      return { ...table, count: Number(rows[0]?.total ?? 0) };
    }),
  );
}

export async function databaseRows(name: string, page: number) {
  if (!databaseTables.includes(name)) return null;
  const table = (await describeTables()).find(
    (candidate) => candidate.name === name,
  )!;
  const limit = 20;
  const offset = (page - 1) * limit;
  const columns = Prisma.join(
    table.columns.map((column) => identifier(column.name)),
  );
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>(
    Prisma.sql`SELECT ${columns} FROM ${identifier(table.name)} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`,
  );
  // Keep large project documents/images out of the table preview.
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === "bigint"
          ? Number(value)
          : typeof value === "string" && value.length > 240
            ? `${value.slice(0, 240)}…`
            : value,
      ]),
    ),
  );
}
