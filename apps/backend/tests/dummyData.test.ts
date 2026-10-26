import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { after, describe, it } from "node:test";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";

const { csvHeaders, parseAndValidateCsvBuffer, staffRoles } = await import(
  "../api/utils/csv/csvParser.js"
);
const { importCsvUsers } = await import("../api/utils/csv/csvUserImport.js");
const { generateStaff, generateStudents, majorCodes } = await import(
  "../api/prisma/dummy/dummyUsers.js"
);
const { buildDummyCsv, dummyCsvRows, sampleCsvOptions, toCsv } = await import(
  "../api/prisma/dummy/dummyCsv.js"
);
const { dummyCountsFromEnv, seedDummyUsers } = await import(
  "../api/prisma/dummy/seedDummyUsers.js"
);
const { createFakeUserStore } = await import("./fakeUserStore.js");

const samplesDir = path.join(import.meta.dirname, "..", "samples");
const unique = (values: string[]) => new Set(values).size === values.length;

after(async () => {
  const { prisma } = await import("../api/prisma/client.js");
  await prisma.$disconnect();
});

describe("dummy user generators", () => {
  it("generates students across every major with unique identifiers", async () => {
    const students = generateStudents(50);

    assert.equal(students.length, 50);
    assert.deepEqual(new Set(students.map((s) => s.major_code)), new Set(majorCodes));
    assert.ok(unique(students.map((s) => s.nim)));
    assert.ok(unique(students.map((s) => s.email)));
    assert.ok(unique(students.map((s) => s.binusian_id).filter(Boolean)));
    assert.ok(students.some((s) => s.binusian_id === ""), "covers the optional binusian_id");

    const validation = await parseAndValidateCsvBuffer(
      Buffer.from(buildDummyCsv("student", { count: 50, broken: false })),
      "student"
    );
    assert.deepEqual(validation.failedRows, []);
    assert.equal(validation.validRows.length, 50);
  });

  it("generates staff in every staff role across every major", async () => {
    const staff = generateStaff(20);
    const majors = staff.flatMap((s) => s.major_codes.split(";"));

    assert.deepEqual(new Set(staff.map((s) => s.role)), new Set(staffRoles));
    assert.deepEqual(new Set(majors), new Set(majorCodes));
    assert.ok(staff.some((s) => s.major_codes.includes(";")), "covers multiple major codes");
    assert.ok(unique(staff.map((s) => s.lecturer_code)));
    assert.ok(unique(staff.map((s) => s.email)));

    const validation = await parseAndValidateCsvBuffer(
      Buffer.from(buildDummyCsv("staff", { count: 20, broken: false })),
      "staff"
    );
    assert.deepEqual(validation.failedRows, []);
    assert.equal(validation.validRows.length, 20);
  });

  it("is reproducible per seed, and offset batches don't collide", () => {
    assert.deepEqual(generateStudents(10, { seed: 7 }), generateStudents(10, { seed: 7 }));
    assert.notDeepEqual(
      generateStudents(10, { seed: 7 }).map((s) => s.name),
      generateStudents(10, { seed: 8 }).map((s) => s.name)
    );

    const first = generateStaff(10);
    const second = generateStaff(10, { offset: 10 });
    for (const column of ["lecturer_code", "email", "binusian_id"] as const) {
      const values = [...first, ...second].map((s) => s[column]).filter(Boolean);
      assert.ok(unique(values), `${column} values are unique across batches`);
    }
  });

  it("rejects counts that aren't non-negative integers", () => {
    assert.throws(() => generateStudents(-1), RangeError);
    assert.throws(() => generateStaff(2.5), RangeError);
    assert.deepEqual(generateStudents(0), []);
  });

  it("quotes cells that contain commas, quotes or line breaks", () => {
    assert.equal(
      toCsv(["a", "b"], [["x,y", 'say "hi"'], ["line\nbreak", "plain"]]),
      'a,b\n"x,y","say ""hi"""\n"line\nbreak",plain\n'
    );
  });
});

describe("sample CSV files", () => {
  const sampleFiles = [
    { type: "student", file: "students.csv", count: sampleCsvOptions.students },
    { type: "staff", file: "staff.csv", count: sampleCsvOptions.staff },
  ] as const;

  for (const { type, file, count } of sampleFiles) {
    it(`samples/${file} matches the generator (run \`pnpm dummy:csv\` to refresh)`, async () => {
      const committed = await readFile(path.join(samplesDir, file), "utf8");
      assert.equal(committed, buildDummyCsv(type, { count, seed: sampleCsvOptions.seed }));
    });

    it(`samples/${file} fails exactly on its deliberately broken rows`, async () => {
      const rows = dummyCsvRows(type, { count, seed: sampleCsvOptions.seed });
      const roleIndex = csvHeaders.staff.indexOf("role");
      const store = createFakeUserStore();

      const report = await importCsvUsers(
        await parseAndValidateCsvBuffer(
          await readFile(path.join(samplesDir, file)),
          type
        ),
        store
      );

      // Row 1 is the header and no cell spans lines, so data row i is line i + 2.
      const expected = rows.flatMap((row, index) => {
        if (row.expectedError) {
          const duplicate =
            /^(nim|email|lecturer_code|binusian_id) ".+" is already in use$/.test(
              row.expectedError
            );
          return [{
            line: index + 2,
            error: duplicate
              ? "Duplicate record within the uploaded file"
              : row.expectedError,
          }];
        }
        // Well-formed HoP rows are rejected until majors have codes.
        if (type === "staff" && row.cells[roleIndex] === "HoP") {
          return [{ line: index + 2, error: "can't be resolved" }];
        }
        return [];
      });
      const actual = report.errors.map(({ line, errors }) => ({
        line,
        error: errors[0]?.includes("can't be resolved")
          ? "can't be resolved"
          : errors[0],
      }));

      assert.deepEqual(actual, expected);
      assert.equal(report.totalParsed, rows.length);
      assert.equal(report.createdCount, rows.length - expected.length);
      assert.ok(
        rows.filter((row) => row.expectedError).length >= 7,
        "has a meaningful set of broken rows"
      );
    });
  }
});

describe("dummy user seeding", () => {
  it("reads counts from SEED_DUMMY_STUDENTS / SEED_DUMMY_STAFF", () => {
    assert.deepEqual(dummyCountsFromEnv({}), { students: 0, staff: 0 });
    assert.deepEqual(
      dummyCountsFromEnv({ SEED_DUMMY_STUDENTS: "120", SEED_DUMMY_STAFF: " " }),
      { students: 120, staff: 0 }
    );
    assert.throws(() => dummyCountsFromEnv({ SEED_DUMMY_STUDENTS: "-5" }), /SEED_DUMMY_STUDENTS/);
    assert.throws(() => dummyCountsFromEnv({ SEED_DUMMY_STAFF: "ten" }), /SEED_DUMMY_STAFF/);
  });

  it("imports generated users through the CSV import path", async () => {
    const store = createFakeUserStore();
    await seedDummyUsers({ students: 6, staff: 8 }, { store });

    const roles = store.users.map((user) => user.role);
    assert.equal(roles.filter((role) => role === "Student").length, 6);
    // 8 staff rotate through 4 roles; the 2 HoPs are skipped until majors have codes.
    assert.deepEqual(
      [...new Set(roles)].sort(),
      ["Admin", "Lecturer", "SCC", "Student"]
    );
    assert.equal(store.users.length, 6 + 6);
    assert.ok(store.users.every((user) => user.password.startsWith("scrypt$")));
  });

  it("runs the documented 200-student / 40-staff volume through the import path", async () => {
    const store = createFakeUserStore();
    const log = console.log;
    console.log = () => undefined;
    try {
      await seedDummyUsers({ students: 200, staff: 40 }, { store, seed: 35 });
    } finally {
      console.log = log;
    }

    assert.equal(store.users.length, 230);
    assert.equal(store.users.filter((user) => user.role === "Student").length, 200);
    assert.equal(store.users.filter((user) => user.role !== "Student").length, 30);
    assert.ok(store.users.every((user) => user.password.startsWith("scrypt$")));
  });
});
