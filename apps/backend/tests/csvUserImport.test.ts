import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";

const { parseAndValidateCsvBuffer } = await import("../api/utils/csv/csvParser.js");
const { importCsvUsers } = await import("../api/utils/csv/csvUserImport.js");
const { createFakeUserStore } = await import("./fakeUserStore.js");
const { verifyPassword } = await import("../api/utils/auth/password.js");

const studentHeaders = "nim,name,email,binusian_id,major_code,password";
const staffHeaders =
  "lecturer_code,name,email,binusian_id,role,major_codes,password";

const csv = (...lines: string[]) => Buffer.from(lines.join("\n"));

after(async () => {
  const { prisma } = await import("../api/prisma/client.js");
  await prisma.$disconnect();
});

describe("CSV user import", () => {
  it("inserts every valid row and returns the report shape", async () => {
    const store = createFakeUserStore();
    const validation = await parseAndValidateCsvBuffer(
      csv(
        studentHeaders,
        "2501959296,Ada,ada@example.com,B123,COMP,secret",
        "2501959297,Bob,bob@example.com,,COMP,hunter2"
      ),
      "student"
    );

    const report = await importCsvUsers(validation, store);

    assert.deepEqual(report, {
      totalParsed: 2,
      createdCount: 2,
      skippedCount: 0,
      failedCount: 0,
      errors: [],
    });
    assert.equal(store.users.length, 2);
  });

  it("maps student rows to Student users with a hashed password", async () => {
    const store = createFakeUserStore();
    await importCsvUsers(
      await parseAndValidateCsvBuffer(
        csv(studentHeaders, "2501959296,Ada,ada@example.com,,COMP,secret"),
        "student"
      ),
      store
    );

    const [user] = store.users;
    assert.ok(user);
    assert.deepEqual({ ...user, password: "<hash>" }, {
      email: "ada@example.com",
      name: "Ada",
      role: "Student",
      password: "<hash>",
      user_type: "student",
      binusian_id: null,
      student_id: "2501959296",
      lecturer_code: null,
    });
    assert.equal(await verifyPassword("secret", user.password), true);
  });

  it("preserves password suffixes beyond bcrypt's 72-byte limit", async () => {
    const store = createFakeUserStore();
    const password = `${"a".repeat(72)}first`;
    const report = await importCsvUsers(
      await parseAndValidateCsvBuffer(
        csv(
          studentHeaders,
          `2501959296,Ada,ada@example.com,,COMP,${password}`
        ),
        "student"
      ),
      store
    );

    assert.equal(report.createdCount, 1);
    const importedPassword = store.users[0]?.password;
    assert.ok(importedPassword);
    assert.equal(await verifyPassword(password, importedPassword), true);
    assert.equal(
      await verifyPassword(`${"a".repeat(72)}other`, importedPassword),
      false
    );
  });

  it("yields to the event loop while hashing passwords", async () => {
    const store = createFakeUserStore();
    let timerFired = false;
    const timer = new Promise<void>((resolve) => {
      setTimeout(() => {
        timerFired = true;
        resolve();
      }, 0);
    });
    const createMany = store.createMany;
    store.createMany = async (users) => {
      assert.equal(timerFired, true);
      return createMany(users);
    };
    const validation = await parseAndValidateCsvBuffer(
      csv(
        studentHeaders,
        "2501959296,Ada,ada@example.com,B1,COMP,secret",
        "2501959297,Bob,bob@example.com,B2,COMP,secret",
        "2501959298,Cy,cy@example.com,B3,COMP,secret",
        "2501959299,Di,di@example.com,B4,COMP,secret"
      ),
      "student"
    );

    const report = await importCsvUsers(validation, store);
    await timer;
    assert.equal(report.createdCount, 4);
  });

  it("maps staff rows to users with their role and lecturer code", async () => {
    const store = createFakeUserStore();
    await importCsvUsers(
      await parseAndValidateCsvBuffer(
        csv(staffHeaders, "TY23-1,Ada,ada@example.com,B123,admin,COMP;MATH,secret"),
        "staff"
      ),
      store
    );

    const [user] = store.users;
    assert.equal(user?.role, "Admin");
    assert.equal(user?.lecturer_code, "TY23-1");
    assert.equal(user?.student_id, null);
    assert.equal(user?.user_type, null);
  });

  it("rejects in-file duplicates using the normalized composite key", async () => {
    const store = createFakeUserStore();
    const report = await importCsvUsers(
      await parseAndValidateCsvBuffer(
        csv(
          studentHeaders,
          "2501959296,Ada,ada@example.com,B123,COMP,secret",
          "2501959297,Ada Again,ADA@example.com,B123,COMP,secret"
        ),
        "student"
      ),
      store
    );

    assert.equal(report.createdCount, 1);
    assert.equal(report.skippedCount, 1);
    assert.deepEqual(report.errors, [
      {
        line: 3,
        errors: ["Duplicate record within the uploaded file"],
      },
    ]);
  });

  it("collects database conflicts per row instead of rejecting the file", async () => {
    const store = createFakeUserStore([
      { email: "taken@example.com", student_id: "2500000000", binusian_id: "B999" },
    ]);
    const validation = await parseAndValidateCsvBuffer(
      csv(
        studentHeaders,
        "2501959296,Ada,ada@example.com,B123,COMP,secret",
        "2500000000,Old,old@example.com,B124,COMP,secret",
        "2501959297,Bob,taken@example.com,B125,COMP,secret",
        "2501959298,Cy,cy@example.com,B999,COMP,secret",
        "2501959296,Ada again,ada2@example.com,B126,COMP,secret"
      ),
      "student"
    );

    const report = await importCsvUsers(validation, store);

    assert.equal(report.totalParsed, 5);
    assert.equal(report.createdCount, 1);
    assert.equal(report.skippedCount, 4);
    assert.equal(report.failedCount, 0);
    assert.deepEqual(report.errors, [
      { line: 3, errors: ["User with email or ID already exists in the system"] },
      { line: 4, errors: ["User with email or ID already exists in the system"] },
      { line: 5, errors: ["User with email or ID already exists in the system"] },
      { line: 6, errors: ["Duplicate record within the uploaded file"] },
    ]);
  });

  it("merges validation and database failures in row order", async () => {
    const store = createFakeUserStore([{ email: "taken@example.com" }]);
    const validation = await parseAndValidateCsvBuffer(
      csv(
        staffHeaders,
        "TY23-1,Ada,taken@example.com,B1,Lecturer,COMP,secret",
        "TY23-2,Bob,not-an-email,B2,Lecturer,COMP,secret",
        "TY23-3,Cy,cy@example.com,B3,Lecturer,COMP,secret"
      ),
      "staff"
    );

    const report = await importCsvUsers(validation, store);

    assert.equal(report.createdCount, 1);
    assert.deepEqual(report.errors, [
      {
        line: 2,
        errors: ["User with email or ID already exists in the system"],
      },
      { line: 3, errors: ["email: must be a valid email address"] },
    ]);
  });

  it("uses createMany's duplicate backstop count for race-time conflicts", async () => {
    const store = createFakeUserStore();
    store.createMany = async () => 0;

    const report = await importCsvUsers(
      await parseAndValidateCsvBuffer(
        csv(studentHeaders, "2501959296,Ada,ada@example.com,B123,COMP,secret"),
        "student"
      ),
      store
    );

    assert.equal(report.skippedCount, 1);
    assert.equal(report.failedCount, 0);
    assert.deepEqual(report.errors, []);
  });

  it("reports HoP rows as failed instead of creating a HoP without majors", async () => {
    const store = createFakeUserStore();
    const report = await importCsvUsers(
      await parseAndValidateCsvBuffer(
        csv(
          staffHeaders,
          "TY23-1,Ada,ada@example.com,B1,Lecturer,COMP,secret",
          "RA23-1,Roger,roger@example.com,B2,hop,COMP;MATH,secret",
          "NC23-1,Nick,nick@example.com,B3,SCC,COMP,secret"
        ),
        "staff"
      ),
      store
    );

    assert.equal(report.createdCount, 2);
    assert.deepEqual(report.errors, [
      {
        line: 3,
        errors: [
          `major_codes "COMP;MATH" can't be resolved: majors have no codes yet, so HoP accounts can't be imported`,
        ],
      },
    ]);
    assert.deepEqual(store.users.map((user) => user.role), ["Lecturer", "SCC"]);
  });

  it("treats emails that differ only in case as duplicates, like MySQL", async () => {
    const store = createFakeUserStore([{ email: "Ada@Example.com" }]);
    const report = await importCsvUsers(
      await parseAndValidateCsvBuffer(
        csv(studentHeaders, "2501959296,Ada,ada@example.com,B123,COMP,secret"),
        "student"
      ),
      store
    );

    assert.equal(report.skippedCount, 1);
    assert.deepEqual(report.errors, [
      {
        line: 2,
        errors: ["User with email or ID already exists in the system"],
      },
    ]);
  });

  // Issue #21: MySQL rejected these as duplicates, but the report had no error.
  it("treats IDs that differ only in accents as duplicates, like MySQL", async () => {
    const store = createFakeUserStore([
      { email: "ada@example.com", student_id: "STUDÉNT-1" },
    ]);
    const report = await importCsvUsers(
      await parseAndValidateCsvBuffer(
        csv(studentHeaders, "STUDENT-1,Bob,bob@example.com,,COMP,secret"),
        "student"
      ),
      store
    );

    assert.deepEqual(report, {
      totalParsed: 1,
      createdCount: 0,
      skippedCount: 1,
      failedCount: 0,
      errors: [
        {
          line: 2,
          errors: ["User with email or ID already exists in the system"],
        },
      ],
    });
  });

  it("rejects in-file duplicates that differ only in accents", async () => {
    const store = createFakeUserStore();
    const report = await importCsvUsers(
      await parseAndValidateCsvBuffer(
        csv(
          studentHeaders,
          "STUDÉNT-1,Ada,ada@example.com,,COMP,secret",
          "STUDENT-1,Bob,bob@example.com,,COMP,secret"
        ),
        "student"
      ),
      store
    );

    assert.equal(report.createdCount, 1);
    assert.deepEqual(report.errors, [
      { line: 3, errors: ["Duplicate record within the uploaded file"] },
    ]);
  });

  it("compares identities by the store's collation keys, not JavaScript case folding", async () => {
    // MySQL's utf8mb4_unicode_ci equates ß and ss; no lowercasing does.
    const store = createFakeUserStore();
    store.findExistingUsers = async () => [
      { email: "old@example.com", binusian_id: "Straße", student_id: null, lecturer_code: null },
    ];
    store.collationKeys = async (values) =>
      new Map(values.map((value) => [value, value.toLowerCase().replace(/ß/g, "ss")]));

    const report = await importCsvUsers(
      await parseAndValidateCsvBuffer(
        csv(
          studentHeaders,
          "2501959296,Ada,ada@example.com,STRASSE,COMP,secret",
          "2501959297,Bob,bob@example.com,Fluß,COMP,secret",
          "2501959298,Cy,cy@example.com,FLUSS,COMP,secret"
        ),
        "student"
      ),
      store
    );

    assert.deepEqual(report.errors, [
      { line: 2, errors: ["User with email or ID already exists in the system"] },
      { line: 4, errors: ["Duplicate record within the uploaded file"] },
    ]);
    assert.deepEqual(store.users.map((user) => user.binusian_id), ["Fluß"]);
  });

  it("lets only one of two concurrent imports insert the same email", async () => {
    const store = createFakeUserStore();
    const upload = (nim: string) =>
      parseAndValidateCsvBuffer(
        csv(studentHeaders, `${nim},Ada,ada@example.com,,COMP,secret`),
        "student"
      ).then((validation) => importCsvUsers(validation, store));

    const reports = await Promise.all([upload("2501959296"), upload("2501959297")]);

    assert.equal(store.users.length, 1);
    assert.deepEqual(
      reports.map((report) => report.createdCount).sort(),
      [0, 1]
    );
  });

  it("reports insertion failures by line and continues processing later rows", async () => {
    const store = createFakeUserStore();
    store.findExistingUsers = async () => {
      throw new Error("connect ECONNREFUSED");
    };
    const validation = await parseAndValidateCsvBuffer(
      csv(
        studentHeaders,
        "2501959296,Ada,ada@example.com,B123,COMP,secret",
        "bad,Bob,not-an-email,B124,COMP,secret",
        "2501959297,Cy,cy@example.com,B125,COMP,secret",
        "2501959298,Di,di@example.com,B126,COMP,secret"
      ),
      "student"
    );

    const report = await importCsvUsers(validation, store);
    assert.equal(report.totalParsed, 4);
    assert.equal(report.createdCount, 0);
    assert.equal(report.failedCount, 4);
    assert.deepEqual(report.errors.map((row) => row.line), [2, 3, 4, 5]);
    assert.equal(store.users.length, 0);
  });
});
