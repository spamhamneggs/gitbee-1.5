// Offline generators for dummy students and staff, in the same row shape the
// student/staff CSV upload expects. No network, no faker: names come from the
// fixtures below and a seeded PRNG, so the same seed always gives the same rows.
import {
  staffRoles,
  type StaffCsvRow,
  type StudentCsvRow,
} from "../../utils/csv/csvParser.js";

export const majorCodes = ["CS", "GAT", "MAT", "DS", "CYBER"] as const;

// Every generated user gets this password, so they can be used for local login.
export const dummyPassword = "GitbeeDummy#2026";

// Raw CSV cells, before validation: every column is a string.
export type StudentCsvInput = Record<keyof StudentCsvRow, string>;
export type StaffCsvInput = Record<keyof StaffCsvRow, string>;

export interface GeneratorOptions {
  seed?: number;
  // Shifts NIMs, lecturer codes, Binusian IDs and emails, so separate batches
  // can be imported into the same database without colliding.
  offset?: number;
}

const firstNames = [
  "Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hendra",
  "Indah", "Joko", "Kartika", "Lestari", "Made", "Nanda", "Oktavia", "Putri",
  "Rizky", "Sari", "Teguh", "Wulan", "Yudi", "Zahra", "Bayu", "Rina",
] as const;

const lastNames = [
  "Santoso", "Wijaya", "Pratama", "Saputra", "Hidayat", "Kusuma", "Nugroho",
  "Setiawan", "Halim", "Gunawan", "Siregar", "Lubis", "Wibowo", "Susanto",
  "Hartono", "Salim", "Tanjaya", "Putra", "Ramadhan", "Purnomo",
] as const;

// mulberry32: small, fast and good enough for picking names.
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

function randomPerson(random: () => number) {
  const first = pick(firstNames, random);
  const last = pick(lastNames, random);
  return { name: `${first} ${last}`, handle: `${first}.${last}`.toLowerCase() };
}

function assertCount(count: number) {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`count must be a non-negative integer, got ${count}`);
  }
}

// Majors rotate in order, so any batch of 5+ covers every major evenly.
const majorFor = (n: number) => majorCodes[(n - 1) % majorCodes.length] as string;

export function generateStudents(
  count: number,
  { seed = 1, offset = 0 }: GeneratorOptions = {}
): StudentCsvInput[] {
  assertCount(count);
  const random = createRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const n = offset + index + 1;
    const person = randomPerson(random);
    return {
      nim: String(2702000000 + n),
      name: person.name,
      email: `${person.handle}${n}@binus.ac.id`,
      // binusian_id is optional; leave every tenth one blank to cover that path.
      binusian_id: n % 10 === 0 ? "" : `BN${100000000 + n}`,
      major_code: majorFor(n),
      password: dummyPassword,
    };
  });
}

// Roles rotate Lecturer, Admin, SCC, HoP, so any batch of 4+ has every staff role.
export function generateStaff(
  count: number,
  { seed = 1, offset = 0 }: GeneratorOptions = {}
): StaffCsvInput[] {
  assertCount(count);
  // A different stream from the students', so the first staff member and the
  // first student don't share a name.
  const random = createRandom(seed ^ 0x9e3779b9);
  return Array.from({ length: count }, (_, index) => {
    const n = offset + index + 1;
    const person = randomPerson(random);
    const primaryMajor = majorFor(n);
    // Every third staff member covers a second major (major_codes is ;-separated).
    const majors =
      n % 3 === 0 ? [primaryMajor, majorFor(n + 2)] : [primaryMajor];
    return {
      lecturer_code: `D${5000 + n}`,
      name: person.name,
      email: `${person.handle}${n}@binus.edu`,
      binusian_id: n % 5 === 0 ? "" : `BN${200000000 + n}`,
      role: staffRoles[(n - 1) % staffRoles.length] as string,
      major_codes: majors.join(";"),
      password: dummyPassword,
    };
  });
}
