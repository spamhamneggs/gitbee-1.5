import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CsvParsingError,
  parseAndValidateCsvBuffer,
} from "../api/utils/csv/csvParser.ts";

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

    assert.equal(result.totalParsed, 1);
    assert.deepEqual(result.validRows[0], {
      nim: "2501959296",
      name: "Ada",
      email: "ada@example.com",
      binusian_id: "B123",
      major_code: "COMP",
      password: "secret",
    });
    assert.deepEqual(result.errors, []);
  });

  it("reports invalid rows using data-row line numbers", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        `${studentHeaders}\n2501959296,Ada,ada@example.com,B123,COMP,secret\ninvalid,Bob,invalid,B123,COMP,secret\n`
      ),
      "student"
    );

    assert.equal(result.totalParsed, 2);
    assert.equal(result.validRows.length, 1);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]?.line, 3);
    assert.match(result.errors[0]?.errors[0] ?? "", /^email:/);
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

    assert.equal(result.totalParsed, 1);
    assert.deepEqual(result.validRows[0], {
      lecturer_code: "TY23-1",
      name: "Ada",
      email: "ada@example.com",
      binusian_id: "B123",
      role: "Lecturer",
      major_codes: "COMP;MATH",
      password: "secret",
    });
  });

  it("strips BOM markers from field values", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        `${studentHeaders}\n2501959296,\uFEFFAda,ada@example.com,B123,COMP,secret\n`
      ),
      "student"
    );

    assert.equal(result.validRows[0]?.name, "Ada");
  });

  it("returns zero parsed rows when the file contains only a valid header", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(studentHeaders),
      "student"
    );

    assert.deepEqual(result, {
      totalParsed: 0,
      validRows: [],
      errors: [],
    });
  });

  it("skips blank lines and counts only data rows", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        `${studentHeaders}\n\n2501959296,Ada,ada@example.com,B123,COMP,secret\n\n`
      ),
      "student"
    );

    assert.equal(result.totalParsed, 1);
    assert.equal(result.validRows.length, 1);
    assert.deepEqual(result.errors, []);
  });

  it("parses quoted delimiters and embedded newlines in values", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        `${studentHeaders}\n2501959296,"Ada, A.\nLovelace",ada@example.com,B123,COMP,secret\n`
      ),
      "student"
    );

    assert.equal(result.totalParsed, 1);
    assert.equal(result.validRows[0]?.name, "Ada, A.\nLovelace");
    assert.deepEqual(result.errors, []);
  });

  it("reports physical line numbers after rows with embedded newlines", async () => {
    const result = await parseAndValidateCsvBuffer(
      Buffer.from(
        `${studentHeaders}\n2501959296,"Ada\nLovelace",ada@example.com,B123,COMP,secret\n\ninvalid,Bob,invalid,B123,COMP,secret\n`
      ),
      "student"
    );

    assert.equal(result.errors[0]?.line, 5);
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

  it("rejects rows with a different number of fields than the header", async () => {
    await assert.rejects(
      parseAndValidateCsvBuffer(
        Buffer.from(
          `${studentHeaders}\n2501959296,Ada,ada@example.com,B123,COMP\n`
        ),
        "student"
      )
    );
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

    assert.equal(result.totalParsed, 1);
    assert.equal(result.validRows.length, 0);
    assert.equal(result.errors[0]?.line, 2);
    assert.deepEqual(
      result.errors[0]?.errors.map((message) => message.split(":")[0]),
      ["nim", "name", "email", "major_code", "password"]
    );
  });
});
