import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it, mock } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";
process.env.JWT_SECRET = "admin-csv-upload-test-secret";
process.env.COOKIE_NAME = "test_auth";

const { createToken } = await import("../api/utils/auth/auth.js");
const { default: adminUserRoutes } = await import(
  "../api/routes/user/admin/adminUserRoutes.js"
);
const { prismaUserStore } = await import("../api/utils/csv/csvUserImport.js");
const { createFakeUserStore } = await import("./fakeUserStore.js");

// Uploads insert users; point the Prisma-backed store at an in-memory table.
let fakeStore = createFakeUserStore();
beforeEach(() => {
  fakeStore = createFakeUserStore();
  mock.method(prismaUserStore, "emailExists", fakeStore.emailExists);
  mock.method(prismaUserStore, "createUser", fakeStore.createUser);
});
afterEach(() => mock.restoreAll());

const authToken = createToken(
  "test-user",
  "test-user",
  "Test User",
  "test@example.com",
  ["Admin"],
  ""
).token;
const lecturerToken = createToken(
  "lecturer-user",
  "lecturer-user",
  "Lecturer User",
  "lecturer@example.com",
  ["Lecturer"],
  ""
).token;
const tokenWithClaims = (claims: Record<string, unknown>) =>
  jwt.sign(claims, "admin-csv-upload-test-secret");
const adminStringToken = tokenWithClaims({ role: "Admin" });
const pluralAdminToken = tokenWithClaims({ roles: ["Admin"] });
const emptyRolesToken = tokenWithClaims({ role: [] });
const nullRoleToken = tokenWithClaims({ role: null, roles: null });
const missingRoleToken = tokenWithClaims({});
const studentAndAdminToken = tokenWithClaims({ role: ["Student", "Admin"] });
const studentToken = createToken(
  "student-user",
  "student-user",
  "Student User",
  "student@example.com",
  ["Student"],
  ""
).token;
const delimitedRoleToken = tokenWithClaims({ role: "Student,Admin" });

const app = express();
app.use(cookieParser());
app.use("/api/user/admin", adminUserRoutes);

const appWithoutCookieParser = express();
appWithoutCookieParser.use("/api/user/admin", adminUserRoutes);

const authCookie = `${process.env.COOKIE_NAME}=${authToken}`;
const studentCsvPath = "/api/user/admin/upload-student-csv";
const staffCsvPath = "/api/user/admin/upload-staff-csv";
const studentHeaders = "nim,name,email,binusian_id,major_code,password";
const staffHeaders =
  "lecturer_code,name,email,binusian_id,role,major_codes,password";
const validStudentCsv =
  `${studentHeaders}\n2501959296,Ada,ada@example.com,B123,COMP,secret\n`;
const validStaffCsv =
  `${staffHeaders}\nTY23-1,Ada,ada@example.com,B123,Lecturer,COMP;MATH,secret\n`;

after(async () => {
  const { prisma } = await import("../api/prisma/client.js");
  await prisma.$disconnect();
});

describe("Admin CSV uploads", () => {
  it("inserts a valid CSV file and returns the import report", async () => {
    const csvBuffer = Buffer.from(validStudentCsv);
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", csvBuffer, {
        filename: "users.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, {
      total_rows: 1,
      successful_inserts: 1,
      failed_rows: [],
    });
    assert.equal(fakeStore.users[0]?.student_id, "2501959296");
    assert.match(fakeStore.users[0]?.password ?? "", /^scrypt\$/);
    assert.ok(!JSON.stringify(response.body).includes("secret"));
  });

  it("accepts standard CSV MIME types when the filename ends in .csv", async () => {
    const mimeTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "text/plain",
      "application/csv",
      "text/x-csv",
      "application/octet-stream",
    ];

    for (const contentType of mimeTypes) {
      const response = await request(app)
        .post(studentCsvPath)
        .attach("file", Buffer.from(validStudentCsv), {
          filename: "users.csv",
          contentType,
        })
        .set("Cookie", authCookie);

      assert.equal(response.status, 200, `${contentType} should be accepted`);
    }
  });

  it("accepts uppercase extensions, UTF-8 BOM, and whitespace around CSV values", async () => {
    const contents = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(
        ` ${studentHeaders} \r\n 2501959296 , Ada , ada@example.com , B123 , COMP , secret \r\n`
      ),
    ]);
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", contents, {
        filename: "users.CSV",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.successful_inserts, 1);
    assert.equal(fakeStore.users[0]?.name, "Ada");
  });

  it("accepts a staff CSV upload", async () => {
    const response = await request(app)
      .post(staffCsvPath)
      .attach("file", Buffer.from(validStaffCsv), {
        filename: "staff.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.successful_inserts, 1);
    assert.equal(fakeStore.users[0]?.lecturer_code, "TY23-1");
    assert.equal(fakeStore.users[0]?.role, "Lecturer");
  });

  it("rejects student headers on the staff endpoint", async () => {
    const response = await request(app)
      .post(staffCsvPath)
      .attach("file", Buffer.from(validStudentCsv), {
        filename: "students.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 400);
    assert.match(response.body.errors, /Missing required CSV columns:/);
  });

  it("rejects staff headers on the student endpoint", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from(validStaffCsv), {
        filename: "staff.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 400);
    assert.match(response.body.errors, /Missing required CSV columns:/);
  });

  it("returns 400 for a header-only CSV with no data rows", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from(studentHeaders), {
        filename: "students.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 400);
    assert.equal(response.body.errors, "CSV file has no data rows.");
  });

  it("inserts the valid rows and reports the failed ones by row number", async () => {
    const csv = [
      studentHeaders,
      "2501959296,Ada,ada@example.com,B123,COMP,secret",
      "2501959297,Bob,invalid,B124,COMP,secret",
    ].join("\n");
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from(csv), {
        filename: "users.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, {
      total_rows: 2,
      successful_inserts: 1,
      failed_rows: [
        {
          row_number: 3,
          identifier: "2501959297",
          error: "email: must be a valid email address",
        },
      ],
    });
  });

  it("reports duplicates against the database as failed rows", async () => {
    fakeStore = createFakeUserStore([{ email: "old@example.com", lecturer_code: "TY23-1" }]);
    mock.method(prismaUserStore, "emailExists", fakeStore.emailExists);
    mock.method(prismaUserStore, "createUser", fakeStore.createUser);
    const csv = [
      staffHeaders,
      "TY23-1,Ada,ada@example.com,B1,Lecturer,COMP,secret",
      "TY23-2,Bob,old@example.com,B2,Lecturer,COMP,secret",
      "TY23-3,Cy,cy@example.com,B3,SCC,COMP,secret",
    ].join("\n");
    const response = await request(app)
      .post(staffCsvPath)
      .attach("file", Buffer.from(csv), {
        filename: "staff.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, {
      total_rows: 3,
      successful_inserts: 1,
      failed_rows: [
        { row_number: 2, identifier: "TY23-1", error: 'lecturer_code "TY23-1" is already in use' },
        { row_number: 3, identifier: "TY23-2", error: 'email "old@example.com" is already in use' },
      ],
    });
  });

  it("returns 500 with the partial report when the database fails mid-import", async () => {
    let calls = 0;
    mock.method(prismaUserStore, "createUser", async (user: Parameters<typeof fakeStore.createUser>[0]) => {
      calls += 1;
      if (calls === 2) {
        throw new Error("connect ECONNREFUSED");
      }
      return fakeStore.createUser(user);
    });
    const csv = [
      studentHeaders,
      "2501959296,Ada,ada@example.com,B1,COMP,secret",
      "2501959297,Bob,bob@example.com,B2,COMP,secret",
      "2501959298,Cy,cy@example.com,B3,COMP,secret",
    ].join("\n");
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from(csv), {
        filename: "students.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 500);
    assert.deepEqual(response.body.errors, {
      message: "Import stopped at row 3: connect ECONNREFUSED",
      total_rows: 3,
      successful_inserts: 1,
      failed_rows: [],
    });
  });

  it("reports every row as failed instead of rejecting the file", async () => {
    const csv =
      `${staffHeaders}\nTY23-1,Ada,invalid-email,B123,Lecturer,COMP;MATH,secret\n`;
    const response = await request(app)
      .post(staffCsvPath)
      .attach("file", Buffer.from(csv), {
        filename: "staff.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, {
      total_rows: 1,
      successful_inserts: 0,
      failed_rows: [
        {
          row_number: 2,
          identifier: "TY23-1",
          error: "email: must be a valid email address",
        },
      ],
    });
  });

  it("returns 400 when no file is attached", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .set("Cookie", authCookie);

    assert.equal(response.status, 400);
    assert.equal(response.body.errors, "No file uploaded");
  });

  it("returns 401 when no authentication token is provided to either endpoint", async () => {
    const studentResponse = await request(app).post(studentCsvPath);
    const staffResponse = await request(app).post(staffCsvPath);

    assert.equal(studentResponse.status, 401);
    assert.equal(staffResponse.status, 401);
  });

  it("returns 403 when the authenticated user is not an admin", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .set("Cookie", `${process.env.COOKIE_NAME}=${studentToken}`);

    assert.equal(response.status, 403);
  });

  it("returns 403 for students on the staff CSV endpoint", async () => {
    const response = await request(app)
      .post(staffCsvPath)
      .set("Cookie", `${process.env.COOKIE_NAME}=${studentToken}`);

    assert.equal(response.status, 403);
  });

  it("returns 403 for lecturers and role claims without Admin", async () => {
    const lecturerResponse = await request(app)
      .post(studentCsvPath)
      .set("Cookie", `${process.env.COOKIE_NAME}=${lecturerToken}`);
    const emptyRolesResponse = await request(app)
      .post(studentCsvPath)
      .set("Cookie", `${process.env.COOKIE_NAME}=${emptyRolesToken}`);
    const nullRoleResponse = await request(app)
      .post(studentCsvPath)
      .set("Cookie", `${process.env.COOKIE_NAME}=${nullRoleToken}`);
    const missingRoleResponse = await request(app)
      .post(studentCsvPath)
      .set("Cookie", `${process.env.COOKIE_NAME}=${missingRoleToken}`);

    assert.equal(lecturerResponse.status, 403);
    assert.equal(emptyRolesResponse.status, 403);
    assert.equal(nullRoleResponse.status, 403);
    assert.equal(missingRoleResponse.status, 403);
  });

  it("accepts comma-delimited and plural role claims", async () => {
    const delimitedRoleResponse = await request(app)
      .post(studentCsvPath)
      .set("Cookie", `${process.env.COOKIE_NAME}=${delimitedRoleToken}`)
      .attach("file", Buffer.from(validStudentCsv), {
        filename: "users.csv",
        contentType: "text/csv",
      });
    const pluralRoleResponse = await request(app)
      .post(staffCsvPath)
      .set("Cookie", `${process.env.COOKIE_NAME}=${pluralAdminToken}`)
      .attach("file", Buffer.from(validStaffCsv), {
        filename: "staff.csv",
        contentType: "text/csv",
      });

    assert.equal(delimitedRoleResponse.status, 200);
    assert.equal(pluralRoleResponse.status, 200);
  });

  it("accepts exact string and array role claims", async () => {
    const stringRoleResponse = await request(app)
      .post(studentCsvPath)
      .set("Cookie", `${process.env.COOKIE_NAME}=${adminStringToken}`)
      .attach("file", Buffer.from(validStudentCsv), {
        filename: "users.csv",
        contentType: "text/csv",
      });
    const multiRoleResponse = await request(app)
      .post(studentCsvPath)
      .set("Cookie", `${process.env.COOKIE_NAME}=${studentAndAdminToken}`)
      .attach("file", Buffer.from(validStudentCsv), {
        filename: "users.csv",
        contentType: "text/csv",
      });

    assert.equal(stringRoleResponse.status, 200);
    assert.equal(multiRoleResponse.status, 200);
  });

  it("accepts a bearer token when the auth cookie is absent", async () => {
    const response = await request(appWithoutCookieParser)
      .post(studentCsvPath)
      .set("Authorization", `Bearer ${authToken}`)
      .attach("file", Buffer.from(validStudentCsv), {
        filename: "users.csv",
        contentType: "text/csv",
      });

    assert.equal(response.status, 200);
  });

  it("falls back from an empty cookie to a valid bearer token", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .set("Cookie", `${process.env.COOKIE_NAME}=`)
      .set("Authorization", `Bearer ${authToken}`)
      .attach("file", Buffer.from(validStudentCsv), {
        filename: "users.csv",
        contentType: "text/csv",
      });

    assert.equal(response.status, 200);
  });

  it("returns 401 for missing or malformed credentials without cookie parsing", async () => {
    const missingResponse = await request(appWithoutCookieParser).post(studentCsvPath);
    const malformedHeaderResponse = await request(appWithoutCookieParser)
      .post(studentCsvPath)
      .set("Authorization", "Bearer not-a-jwt");
    const malformedCookieResponse = await request(app)
      .post(studentCsvPath)
      .set("Cookie", `${process.env.COOKIE_NAME}=not-a-jwt`);

    assert.equal(missingResponse.status, 401);
    assert.equal(malformedHeaderResponse.status, 401);
    assert.equal(malformedCookieResponse.status, 401);
  });

  it("rejects a file with a non-CSV extension and MIME type", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from("%PDF-1.7"), {
        filename: "document.pdf",
        contentType: "application/pdf",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 400);
    assert.equal(response.body.errors, "Only CSV files are allowed.");
  });

  it("rejects an .xls file reported as an Excel MIME type", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from(validStudentCsv), {
        filename: "users.xls",
        contentType: "application/vnd.ms-excel",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 400);
    assert.equal(response.body.errors, "Only CSV files are allowed.");
  });

  it("rejects an .exe file reported as CSV", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from("not a csv"), {
        filename: "evil.exe",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 400);
    assert.equal(response.body.errors, "Only CSV files are allowed.");
  });

  it("rejects PDF content even when the filename and MIME type claim CSV", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from("%PDF-1.7\n1 0 obj\n"), {
        filename: "report.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 400);
    assert.equal(response.body.errors, "Only CSV files are allowed.");
  });

  it("rejects malformed CSV quoting", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from('name,email\n"Ada,ada@example.com\n'), {
        filename: "users.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 400);
    assert.equal(response.body.errors, "Only CSV files are allowed.");
  });

  it("returns 400 when the CSV file is empty", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.alloc(0), {
        filename: "empty.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 400);
    assert.equal(response.body.errors, "CSV file cannot be empty");
  });

  it("explains that uploaded CSV files must be UTF-8 encoded", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from([0x6e, 0x61, 0x6d, 0x65, 0x2c, 0x80]), {
        filename: "invalid-encoding.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.errors,
      "File must be UTF-8 encoded (in Excel, Save As 'CSV UTF-8')"
    );
  });

  it("rejects Windows-1252-only bytes with UTF-8 guidance", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .attach(
        "file",
        Buffer.from("name,email\nJos\xe9,jose@example.com\n", "binary"),
        {
          filename: "legacy-encoding.csv",
          contentType: "text/csv",
        }
      )
      .set("Cookie", authCookie);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.errors,
      "File must be UTF-8 encoded (in Excel, Save As 'CSV UTF-8')"
    );
  });

  it("returns 400 when the multipart field name is not file", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .attach("upload", Buffer.from(validStudentCsv), {
        filename: "users.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 400);
  });

  it("rejects executable and spreadsheet signatures even when named as CSV", async () => {
    const spoofedContents = [
      Buffer.from("MZ executable payload"),
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    ];

    for (const contents of spoofedContents) {
      const response = await request(app)
        .post(studentCsvPath)
        .attach("file", contents, {
          filename: "spoofed.csv",
          contentType: "text/csv",
        })
        .set("Cookie", authCookie);

      assert.equal(response.status, 400);
      assert.equal(response.body.errors, "Only CSV files are allowed.");
    }
  });

  it("returns 413 when the file exceeds 5MB", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1, "a"), {
        filename: "large.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 413);
    assert.equal(
      response.body.errors,
      "File size exceeds the 5MB limit."
    );
  });

  it("does not reject a CSV-sized file at the 5MB limit as too large", async () => {
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.alloc(5 * 1024 * 1024, "a"), {
        filename: "maximum-size.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 400);
    assert.notEqual(response.status, 413);
  });
});
