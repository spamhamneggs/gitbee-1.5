// Adds generated students and staff to the database during `prisma db seed`.
// Rows go through the same CSV validation and import as an admin upload, so
// passwords are hashed and duplicates are caught by the same unique indexes.
import { parseAndValidateCsvBuffer, type CsvUploadType } from "../../utils/csv/csvParser.js";
import { importCsvUsers, type CsvUserStore } from "../../utils/csv/csvUserImport.js";
import { buildDummyCsv } from "./dummyCsv.js";
import type { GeneratorOptions } from "./dummyUsers.js";

export interface DummyUserCounts {
  students: number;
  staff: number;
}

function countFromEnv(name: string, value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return 0;
  }
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`${name} must be a non-negative integer, got "${value}"`);
  }
  return count;
}

export function dummyCountsFromEnv(env: NodeJS.ProcessEnv = process.env): DummyUserCounts {
  return {
    students: countFromEnv("SEED_DUMMY_STUDENTS", env.SEED_DUMMY_STUDENTS),
    staff: countFromEnv("SEED_DUMMY_STAFF", env.SEED_DUMMY_STAFF),
  };
}

export async function seedDummyUsers(
  counts: DummyUserCounts,
  { store, ...generator }: GeneratorOptions & { store?: CsvUserStore } = {}
): Promise<void> {
  const batches: [CsvUploadType, number][] = [
    ["student", counts.students],
    ["staff", counts.staff],
  ];

  for (const [type, count] of batches) {
    if (count === 0) {
      continue;
    }
    const csv = buildDummyCsv(type, { ...generator, count, broken: false });
    const validation = await parseAndValidateCsvBuffer(Buffer.from(csv), type);
    const report = await importCsvUsers(validation, store);
    console.log(`Dummy ${type} users: ${report.createdCount} of ${report.totalParsed} inserted.`);

    // HoP rows are expected here: the importer can't link them to majors until
    // majors have codes. Group failures by reason instead of printing each row.
    const reasons = new Map<string, number>();
    for (const { errors } of report.errors) {
      for (const error of errors) {
        const reason = error.replace(/"[^"]*"/g, "…");
        reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      }
    }
    for (const [reason, failures] of reasons) {
      console.log(`  ${failures} skipped: ${reason}`);
    }
  }
}
