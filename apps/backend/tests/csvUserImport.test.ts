import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";

const { parseAndValidateCsvBuffer } = await import("../api/utils/csv/csvParser.js");
const { CsvImportAbortedError, importCsvUsers } = await import(
  "../api/utils/csv/csvUserImport.js"
);
const { createFakeUserStore, uniqueViolation } = await import("./fakeUserStore.js");
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

    assert.deepEqual(report, { total_rows: 2, successful_inserts: 2, failed_rows: [] });
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

    assert.equal(report.total_rows, 5);
    assert.equal(report.successful_inserts, 1);
    assert.deepEqual(report.failed_rows, [
      { row_number: 3, identifier: "2500000000", error: 'nim "2500000000" is already in use' },
      { row_number: 4, identifier: "2501959297", error: 'email "taken@example.com" is already in use' },
      { row_number: 5, identifier: "2501959298", error: 'binusian_id "B999" is already in use' },
      { row_number: 6, identifier: "2501959296", error: 'nim "2501959296" is already in use' },
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

    assert.equal(report.successful_inserts, 1);
    assert.deepEqual(
      report.failed_rows.map((row) => [row.row_number, row.identifier]),
      [[2, "TY23-1"], [3, "TY23-2"]]
    );
  });

  it("reports a constraint it cannot attribute to a column generically", async () => {
    const store = createFakeUserStore();
    store.createUser = async () => {
      throw uniqueViolation("some_other_key");
    };

    const report = await importCsvUsers(
      await parseAndValidateCsvBuffer(
        csv(studentHeaders, "2501959296,Ada,ada@example.com,B123,COMP,secret"),
        "student"
      ),
      store
    );

    assert.deepEqual(report.failed_rows, [
      {
        row_number: 2,
        identifier: "2501959296",
        error: "a user with the same NIM, lecturer code or Binusian ID already exists",
      },
    ]);
  });

  it("stops on an unexpected database error and keeps the partial report", async () => {
    const store = createFakeUserStore();
    const createUser = store.createUser;
    store.createUser = async (user) => {
      if (user.student_id === "2501959297") {
        throw new Error("connect ECONNREFUSED");
      }
      return createUser(user);
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

    await assert.rejects(importCsvUsers(validation, store), (error: unknown) => {
      assert.ok(error instanceof CsvImportAbortedError);
      assert.equal(error.message, "Import stopped at row 4: connect ECONNREFUSED");
      assert.equal(error.report.total_rows, 4);
      assert.equal(error.report.successful_inserts, 1);
      assert.deepEqual(error.report.failed_rows.map((row) => row.row_number), [3]);
      return true;
    });
    assert.equal(store.users.length, 1);
  });
});
