// Writes students.csv and staff.csv from the dummy generators.
// With no arguments it regenerates the committed samples in apps/backend/samples.
//
//   pnpm --filter gitbee_backend dummy:csv
//   pnpm --filter gitbee_backend dummy:csv --students 500 --staff 50 --out ./tmp-csv
//   pnpm --filter gitbee_backend dummy:csv --students 500 --valid-only
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildDummyCsv, sampleCsvOptions } from "./dummyCsv.js";

const { values } = parseArgs({
  // pnpm forwards a literal "--" when it's used to separate script arguments.
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    students: { type: "string" },
    staff: { type: "string" },
    seed: { type: "string" },
    out: { type: "string" },
    "valid-only": { type: "boolean", default: false },
  },
});

function integerOption(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`--${name} must be a non-negative integer, got "${value}"`);
  }
  return number;
}

const students = integerOption("students", values.students, sampleCsvOptions.students);
const staff = integerOption("staff", values.staff, sampleCsvOptions.staff);
const seed = integerOption("seed", values.seed, sampleCsvOptions.seed);
const broken = !values["valid-only"];
const outDir = path.resolve(values.out ?? path.join(import.meta.dirname, "../../../samples"));

await mkdir(outDir, { recursive: true });
await writeFile(
  path.join(outDir, "students.csv"),
  buildDummyCsv("student", { count: students, seed, broken })
);
await writeFile(
  path.join(outDir, "staff.csv"),
  buildDummyCsv("staff", { count: staff, seed, broken })
);

console.log(
  `Wrote ${students} students and ${staff} staff${broken ? " plus broken rows" : ""} to ${outDir}`
);
