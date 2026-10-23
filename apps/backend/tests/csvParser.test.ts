import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CsvParsingError,
  parseAndValidateCsvBuffer,
} from "../api/utils/csv/csvParser.js";

const studentHeaders = "nim,name,email,binusian_id,major_code,password";
const staffHeaders =
  "lecturer_code,name,email,binusian_id,role,major_codes,password";

describe("CSV parsing and row validation", () => {
  it("rejects an empty buffer with the expected error", async () => {
    await assert.rejects(
      parseAndValidateCsvBuffer(Buffer.alloc(0), "student"),
      (error: unknown) =>
        error instanceof CsvParsingError &&
        error.message === "CSV file cannot be empty"
    );
  });

  it("strips BOM markers and trims headers and values", async () => {
    const contents = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(
        ` ${studentHeaders} \n 2501959296 , Ada , ada@example.com , B123 , COMP , secret `
      ),
    ]);

    const result = await parseAndValidateCsvBuffer(contents, "student");

    assert.equal(result.totalRows, 1);
    assert.deepEqual(result.validRows[0], {
      row_number: 2,
      identifier: "2501959296",
      data: {
        nim: "2501959296",
        name: "Ada",
        email: "ada@example.com",
        binusian_id: "B123",
        major_code: "COMP",
        password: "secret",
      },
    });
    assert.deepEqual(result.failedRows, []);
  });

  it("reports invalid rows as {row_number, identifier, error}", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        `${studentHeaders}\n2501959296,Ada,ada@example.com,B123,COMP,secret\n2501959297,Bob,invalid,B123,COMP,secret\n`
      ),
      "student"
    );

    assert.equal(result.totalRows, 2);
    assert.equal(result.validRows.length, 1);
    assert.deepEqual(result.failedRows, [
      {
        row_number: 3,
        identifier: "2501959297",
        error: "email: must be a valid email address",
      },
    ]);
  });

  it("rejects CSV files missing required columns", async () => {
    await assert.rejects(
      parseAndValidateCsvBuffer(
        Buffer.from("nim,name,email\n2501959296,Ada,ada@example.com\n"),
        "student"
      ),
      /Missing required CSV columns: binusian_id, major_code, password/
    );
  });

  it("rejects staff files missing staff-specific required columns", async () => {
    await assert.rejects(
      parseAndValidateCsvBuffer(
        Buffer.from(
          "lecturer_code,name,email,binusian_id,role\nTY23-1,Ada,ada@example.com,B123,Lecturer\n"
        ),
        "staff"
      ),
      /Missing required CSV columns: major_codes, password/
    );
  });

  it("checks staff headers and validates staff rows separately", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        `${staffHeaders}\nTY23-1,Ada,ada@example.com,B123,Lecturer,COMP;MATH,secret\n`
      ),
      "staff"
    );

    assert.equal(result.totalRows, 1);
    assert.deepEqual(result.validRows[0], {
      row_number: 2,
      identifier: "TY23-1",
      data: {
        lecturer_code: "TY23-1",
        name: "Ada",
        email: "ada@example.com",
        binusian_id: "B123",
        role: "Lecturer",
        major_codes: "COMP;MATH",
        password: "secret",
      },
    });
  });

  it("strips BOM markers from field values", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        `${studentHeaders}\n2501959296,\uFEFFAda,ada@example.com,B123,COMP,secret\n`
      ),
      "student"
    );

    assert.equal(result.validRows[0]?.data.name, "Ada");
  });

  it("returns zero parsed rows when the file contains only a valid header", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(studentHeaders),
      "student"
    );

    assert.deepEqual(result, {
      totalRows: 0,
      validRows: [],
      failedRows: [],
    });
  });

  it("skips blank lines and counts only data rows", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        `${studentHeaders}\n\n2501959296,Ada,ada@example.com,B123,COMP,secret\n\n`
      ),
      "student"
    );

    assert.equal(result.totalRows, 1);
    assert.equal(result.validRows.length, 1);
    assert.equal(result.validRows[0]?.row_number, 3);
    assert.deepEqual(result.failedRows, []);
  });

  it("parses quoted delimiters and embedded newlines in values", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        `${studentHeaders}\n2501959296,"Ada, A.\nLovelace",ada@example.com,B123,COMP,secret\n`
      ),
      "student"
    );

    assert.equal(result.totalRows, 1);
    assert.equal(result.validRows[0]?.data.name, "Ada, A.\nLovelace");
    assert.deepEqual(result.failedRows, []);
  });

  it("reports physical line numbers after rows with embedded newlines", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        `${studentHeaders}\n2501959296,"Ada\nLovelace",ada@example.com,B123,COMP,secret\n\ninvalid,Bob,invalid,B123,COMP,secret\n`
      ),
      "student"
    );

    assert.equal(result.failedRows[0]?.row_number, 5);
  });

  it("rejects duplicate headers instead of silently overwriting fields", async () => {
    await assert.rejects(
      parseAndValidateCsvBuffer(
        Buffer.from(
          "nim,name,email,email,binusian_id,major_code,password\n2501959296,Ada,ada@example.com,other,B123,COMP,secret\n"
        ),
        "student"
      ),
      /Duplicate CSV columns: email/
    );
  });

  it("reports rows with a different number of fields than the header as failed rows", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        [
          studentHeaders,
          "2501959296,Ada,ada@example.com,B123,COMP",
          "2501959297,Bob,bob@example.com,B124,COMP,secret",
          "2501959298,Cy,cy@example.com,B125,COMP,secret,extra",
        ].join("\n")
      ),
      "student"
    );

    assert.equal(result.totalRows, 3);
    assert.deepEqual(
      result.validRows.map((row) => row.identifier),
      ["2501959297"]
    );
    assert.deepEqual(result.failedRows, [
      {
        row_number: 2,
        identifier: "2501959296",
        error: "row must have 6 fields to match the header",
      },
      {
        row_number: 4,
        identifier: "2501959298",
        error: "row must have 6 fields to match the header",
      },
    ]);
  });

  it("rejects malformed quoted CSV data", async () => {
    await assert.rejects(
      parseAndValidateCsvBuffer(
        Buffer.from(`${studentHeaders}\n2501959296,"Ada,ada@example.com,B123,COMP,secret\n`),
        "student"
      )
    );
  });

  it("rejects an empty header row", async () => {
    await assert.rejects(
      parseAndValidateCsvBuffer(Buffer.from("\n"), "student"),
      /CSV file must include a header row/
    );
  });

  it("reports all Zod issues for a row with multiple invalid fields", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        `${studentHeaders}\n, ,invalid-email,,,\n`
      ),
      "student"
    );

    assert.equal(result.totalRows, 1);
    assert.equal(result.validRows.length, 0);
    assert.equal(result.failedRows[0]?.row_number, 2);
    assert.equal(result.failedRows[0]?.identifier, null);
    assert.deepEqual(
      result.failedRows[0]?.error
        .split("; ")
        .map((message) => message.split(":")[0]),
      ["nim", "name", "email", "major_code", "password"]
    );
  });

  it("turns a blank binusian_id into null so it cannot collide on the unique index", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(`${studentHeaders}\n2501959296,Ada,ada@example.com,,COMP,secret\n`),
      "student"
    );

    assert.equal(result.validRows[0]?.data.binusian_id, null);
  });

  it("accepts staff roles case-insensitively and rejects unknown roles", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        [
          staffHeaders,
          "TY23-1,Ada,ada@example.com,B1,hop,COMP,secret",
          "TY23-2,Bob,bob@example.com,B2,Student,COMP,secret",
        ].join("\n")
      ),
      "staff"
    );

    assert.equal(result.validRows[0]?.data.role, "HoP");
    assert.deepEqual(result.failedRows, [
      {
        row_number: 3,
        identifier: "TY23-2",
        error: "role: must be one of Lecturer, Admin, SCC, HoP",
      },
    ]);
  });

  it("rejects values longer than the matching user column", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        `${studentHeaders}\n${"9".repeat(51)},${"a".repeat(151)},ada@example.com,B123,COMP,secret\n`
      ),
      "student"
    );

    assert.equal(
      result.failedRows[0]?.error,
      "nim: must be at most 50 characters; name: must be at most 150 characters"
    );
  });
});
