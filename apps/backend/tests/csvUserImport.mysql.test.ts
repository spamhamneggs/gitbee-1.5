// CSV import against a real MySQL database. Duplicate detection has to agree
// with the user table's collation, which the in-memory store only approximates.
//
// Skipped unless TEST_DATABASE_URL points at a migrated database, e.g.
//   TEST_DATABASE_URL=mysql://root:admin@localhost:3306/gitbee_test pnpm --filter gitbee_backend test
// Every user it creates has an email on a per-run domain and is deleted afterwards.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, describe, it } from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;
// The Prisma client reads DATABASE_URL when it's first imported.
process.env.DATABASE_URL = databaseUrl ?? "mysql://test:test@127.0.0.1:3306/test";

const { parseAndValidateCsvBuffer } = await import("../api/utils/csv/csvParser.js");
const { importCsvUsers, prismaUserStore, USER_TABLE_COLLATION } = await import(
  "../api/utils/csv/csvUserImport.js"
);
const { prisma } = await import("../api/prisma/client.js");

const run = randomBytes(4).toString("hex");
const domain = `${run}.example.com`;
const studentHeaders = "nim,name,email,binusian_id,major_code,password";
const upload = async (...rows: string[]) =>
  importCsvUsers(
    await parseAndValidateCsvBuffer(Buffer.from([studentHeaders, ...rows].join("\n")), "student")
  );
const alreadyExists = "User with email or ID already exists in the system";

after(async () => {
  if (databaseUrl) {
    await prisma.user.deleteMany({ where: { email: { endsWith: `@${domain}` } } });
  }
  await prisma.$disconnect();
});

describe(
  "CSV user import against MySQL",
  { skip: databaseUrl ? false : "set TEST_DATABASE_URL to a migrated MySQL database" },
  () => {
    it("reports an accent-equivalent NIM that already exists (issue #21)", async () => {
      const first = await upload(`STUDÉNT-${run},Ada,ada@${domain},,CS,secret`);
      assert.equal(first.createdCount, 1);

      const report = await upload(`STUDENT-${run},Bob,bob@${domain},,CS,secret`);

      assert.deepEqual(report, {
        totalParsed: 1,
        createdCount: 0,
        skippedCount: 1,
        failedCount: 0,
        errors: [{ line: 2, errors: [alreadyExists] }],
      });
    });

    it("reports accent-equivalent IDs repeated within one file", async () => {
      const report = await upload(
        `ÀNA-${run},Ana,ana@${domain},,CS,secret`,
        `ana-${run},Ana Again,ana.again@${domain},,CS,secret`
      );

      assert.equal(report.createdCount, 1);
      assert.deepEqual(report.errors, [
        { line: 3, errors: ["Duplicate record within the uploaded file"] },
      ]);
    });

    it("reports an existing NIM with collation-equivalent trailing padding", async () => {
      const first = await upload(`PAD-${run},Ada,pad.first@${domain},,CS,secret`);
      assert.equal(first.createdCount, 1);

      const report = await upload(`"PAD-${run}\u00a0",Bob,pad.again@${domain},,CS,secret`);

      assert.deepEqual(report, {
        totalParsed: 1,
        createdCount: 0,
        skippedCount: 1,
        failedCount: 0,
        errors: [{ line: 2, errors: [alreadyExists] }],
      });
    });

    it("reports in-file NIM duplicates with collation-equivalent trailing padding", async () => {
      const report = await upload(
        `FILE-${run},Ada,file.first@${domain},,CS,secret`,
        `"FILE-${run}\u00a0",Bob,file.again@${domain},,CS,secret`
      );

      assert.deepEqual(report, {
        totalParsed: 2,
        createdCount: 1,
        skippedCount: 1,
        failedCount: 0,
        errors: [{ line: 3, errors: ["Duplicate record within the uploaded file"] }],
      });
    });

    it("follows MySQL's other equivalences, like ß = ss and full-width letters", async () => {
      const first = await upload(
        `GUS-${run},Gus,gus@${domain},Straße-${run},CS,secret`,
        `ＷＩＤＥ-${run},Wide,wide@${domain},,CS,secret`
      );
      assert.equal(first.createdCount, 2);

      const report = await upload(
        `GUS2-${run},Gus Two,gus2@${domain},STRASSE-${run},CS,secret`,
        `WIDE-${run},Narrow,narrow@${domain},,CS,secret`
      );

      assert.equal(report.createdCount, 0);
      assert.deepEqual(report.errors, [
        { line: 2, errors: [alreadyExists] },
        { line: 3, errors: [alreadyExists] },
      ]);
    });

    it("gives equal keys exactly when MySQL compares values as equal", async () => {
      const pairs: [string, string][] = [
        ["STUDÉNT-1", "STUDENT-1"],
        ["student-1", "STUDENT-1"],
        ["Straße", "STRASSE"],
        ["ＡＢＣ", "ABC"],
        ["a​b", "ab"],
        ["é", "é"],
        ["abc", "abc   "],
        ["abc", "abc\u00a0"],
        ["abc", "abc\u2007"],
        ["abc", "abc\u202f"],
        ["abc", "abc\u3000"],
        ["abc", "abc\u00a0\u200b"],
        ["abc", "abc \u200b"],
        ["\u00a0abc", "abc"],
        ["a\u00a0b", "a b"],
        [" abc", "abc"],
        ["Øle", "Ole"],
      ];
      const keys = await prismaUserStore.collationKeys(pairs.flat());

      for (const [left, right] of pairs) {
        const [row] = await prisma.$queryRaw<{ equal: bigint | number }[]>`
          SELECT (CONVERT(${left} USING utf8mb4) COLLATE utf8mb4_unicode_ci
                  = CONVERT(${right} USING utf8mb4)) AS equal`;
        assert.equal(
          keys.get(left) === keys.get(right),
          Number(row?.equal) === 1,
          `${JSON.stringify(left)} vs ${JSON.stringify(right)}`
        );
      }
    });

    it("checks the user table still uses the collation the keys are computed with", async () => {
      const columns = await prisma.$queryRaw<{ name: string; collation: string }[]>`
        SELECT COLUMN_NAME AS name, COLLATION_NAME AS collation
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user'
          AND COLUMN_NAME IN ('email', 'binusian_id', 'student_id', 'lecturer_code')`;

      assert.equal(columns.length, 4);
      for (const { name, collation } of columns) {
        assert.equal(collation, USER_TABLE_COLLATION, `user.${name}`);
      }
    });
  }
);
