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
  mock.method(prismaUserStore, "findExistingUsers", fakeStore.findExistingUsers);
  mock.method(prismaUserStore, "createMany", fakeStore.createMany);
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
      totalParsed: 1,
      createdCount: 1,
      skippedCount: 0,
      failedCount: 0,
      errors: [],
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
    assert.equal(response.body.data.createdCount, 1);
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
    assert.equal(response.body.data.createdCount, 1);
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
      totalParsed: 2,
      createdCount: 1,
      skippedCount: 0,
      failedCount: 1,
      errors: [
        {
          line: 3,
          errors: ["email: must be a valid email address"],
        },
      ],
    });
  });

  it("reports rows with database identity conflicts", async () => {
    fakeStore = createFakeUserStore([{ email: "old@example.com", lecturer_code: "TY23-1" }]);
    mock.method(prismaUserStore, "findExistingUsers", fakeStore.findExistingUsers);
    mock.method(prismaUserStore, "createMany", fakeStore.createMany);
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
      totalParsed: 3,
      createdCount: 1,
      skippedCount: 2,
      failedCount: 0,
      errors: [
        {
          line: 2,
          errors: ["User with email or ID already exists in the system"],
        },
        {
          line: 3,
          errors: ["User with email or ID already exists in the system"],
        },
      ],
    });
  });

  it("detects repeated emails and student IDs within one upload", async () => {
    const csv = [
      studentHeaders,
      "2501959296,Ada,Ada@Example.com,B101,COMP,secret",
      "2501959297,Ada Again,ada@example.com,B102,COMP,secret",
      "2501959296,Another Ada,another@example.com,B103,COMP,secret",
    ].join("\n");
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from(csv), {
        filename: "students.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.createdCount, 1);
    assert.equal(response.body.data.skippedCount, 2);
    assert.equal(response.body.data.failedCount, 0);
    assert.deepEqual(response.body.data.errors, [
      { line: 3, errors: ["Duplicate record within the uploaded file"] },
      { line: 4, errors: ["Duplicate record within the uploaded file"] },
    ]);
    assert.equal(
      response.body.data.totalParsed,
      response.body.data.createdCount +
        response.body.data.skippedCount +
        response.body.data.failedCount
    );
  });

  it("does not treat missing optional IDs as duplicate identity values", async () => {
    const csv = [
      studentHeaders,
      "2501959296,Ada,ada@example.com,,COMP,secret",
      "2501959297,Bob,bob@example.com,,COMP,secret",
    ].join("\n");
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from(csv), {
        filename: "students.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.createdCount, 2);
    assert.equal(response.body.data.skippedCount, 0);
    assert.equal(response.body.data.failedCount, 0);
    assert.deepEqual(response.body.data.errors, []);
  });

  it("detects existing database email and student ID conflicts case-insensitively", async () => {
    fakeStore = createFakeUserStore([
      { email: "Existing@Example.com", student_id: "2500000000" },
      { email: "other@example.com", student_id: "2500000001" },
    ]);
    mock.method(prismaUserStore, "findExistingUsers", fakeStore.findExistingUsers);
    mock.method(prismaUserStore, "createMany", fakeStore.createMany);
    const csv = [
      studentHeaders,
      "2501959296,Email Conflict,existing@example.com,B101,COMP,secret",
      "2500000001,ID Conflict,id-conflict@example.com,B102,COMP,secret",
      "2501959298,New User,new@example.com,B103,COMP,secret",
    ].join("\n");
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from(csv), {
        filename: "students.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.createdCount, 1);
    assert.equal(response.body.data.skippedCount, 2);
    assert.equal(response.body.data.failedCount, 0);
    assert.deepEqual(response.body.data.errors, [
      {
        line: 2,
        errors: ["User with email or ID already exists in the system"],
      },
      {
        line: 3,
        errors: ["User with email or ID already exists in the system"],
      },
    ]);
  });

  it("does not reserve identities from database-conflicting rows", async () => {
    fakeStore = createFakeUserStore([{ email: "existing@example.com" }]);
    mock.method(prismaUserStore, "findExistingUsers", fakeStore.findExistingUsers);
    mock.method(prismaUserStore, "createMany", fakeStore.createMany);
    const csv = [
      studentHeaders,
      "2501959296,Conflicting Row,existing@example.com,B101,COMP,secret",
      "2501959296,Importable Row,new@example.com,B102,COMP,secret",
    ].join("\n");
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from(csv), {
        filename: "students.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.createdCount, 1);
    assert.equal(response.body.data.skippedCount, 1);
    assert.equal(response.body.data.failedCount, 0);
    assert.deepEqual(response.body.data.errors, [
      {
        line: 2,
        errors: ["User with email or ID already exists in the system"],
      },
    ]);
    assert.equal(fakeStore.users[0]?.email, "new@example.com");
  });

  it("handles all-invalid or duplicate rows without attempting an empty insert", async () => {
    fakeStore = createFakeUserStore([{ email: "existing@example.com" }]);
    mock.method(prismaUserStore, "findExistingUsers", fakeStore.findExistingUsers);
    const csv = [
      studentHeaders,
      "2501959296,Ada,invalid-email,B101,COMP,secret",
      "2501959297,Bob,existing@example.com,B102,COMP,secret",
      "2501959298,Bob Again,EXISTING@example.com,B103,COMP,secret",
    ].join("\n");
    const createMany = mock.method(
      prismaUserStore,
      "createMany",
      fakeStore.createMany
    );
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from(csv), {
        filename: "students.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.createdCount, 0);
    assert.equal(response.body.data.skippedCount, 2);
    assert.equal(response.body.data.failedCount, 1);
    assert.deepEqual(response.body.data.errors, [
      { line: 2, errors: ["email: must be a valid email address"] },
      {
        line: 3,
        errors: ["User with email or ID already exists in the system"],
      },
      {
        line: 4,
        errors: ["User with email or ID already exists in the system"],
      },
    ]);
    assert.equal(createMany.mock.callCount(), 0);
    assert.equal(
      response.body.data.totalParsed,
      response.body.data.createdCount +
        response.body.data.skippedCount +
        response.body.data.failedCount
    );
  });

  it("keeps counts consistent for a mixed batch of inserts and both duplicate types", async () => {
    fakeStore = createFakeUserStore([
      { email: "existing@example.com", student_id: "2500000000" },
    ]);
    const lookups: number[] = [];
    mock.method(prismaUserStore, "findExistingUsers", async (identities) => {
      lookups.push(identities.length);
      return fakeStore.findExistingUsers(identities);
    });
    mock.method(prismaUserStore, "createMany", fakeStore.createMany);
    const csv = [
      studentHeaders,
      "2501959296,Ada,ada@example.com,B101,COMP,secret",
      "2501959297,Ada Again,ADA@example.com,B102,COMP,secret",
      "2501959298,Email Conflict,existing@example.com,B103,COMP,secret",
      "2500000000,ID Conflict,id-conflict@example.com,B104,COMP,secret",
      "2501959299,Cy,cy@example.com,B105,COMP,secret",
    ].join("\n");
    const response = await request(app)
      .post(studentCsvPath)
      .attach("file", Buffer.from(csv), {
        filename: "students.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.createdCount, 2);
    assert.equal(response.body.data.skippedCount, 3);
    assert.equal(response.body.data.failedCount, 0);
    assert.deepEqual(response.body.data.errors, [
      { line: 3, errors: ["Duplicate record within the uploaded file"] },
      {
        line: 4,
        errors: ["User with email or ID already exists in the system"],
      },
      {
        line: 5,
        errors: ["User with email or ID already exists in the system"],
      },
    ]);
    assert.deepEqual(lookups, [5]);
    assert.equal(
      response.body.data.totalParsed,
      response.body.data.createdCount +
        response.body.data.skippedCount +
        response.body.data.failedCount
    );
  });

  it("reports HoP rows as failed because their majors can't be resolved yet", async () => {
    const csv = [
      staffHeaders,
      "RA23-1,Roger,roger@example.com,B1,HoP,COMP,secret",
      "TY23-1,Ada,ada@example.com,B2,Lecturer,COMP,secret",
    ].join("\n");
    const response = await request(app)
      .post(staffCsvPath)
      .attach("file", Buffer.from(csv), {
        filename: "staff.csv",
        contentType: "text/csv",
      })
      .set("Cookie", authCookie);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.createdCount, 1);
    assert.equal(response.body.data.errors[0].line, 2);
    assert.match(response.body.data.errors[0].errors[0], /HoP accounts can't be imported/);
    assert.deepEqual(fakeStore.users.map((user) => user.lecturer_code), ["TY23-1"]);
  });

  it("returns a summary with line-numbered insertion failures", async () => {
    mock.method(prismaUserStore, "findExistingUsers", async () => {
      throw new Error("connect ECONNREFUSED");
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

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, {
      totalParsed: 3,
      createdCount: 0,
      skippedCount: 0,
      failedCount: 3,
      errors: [
        {
          line: 2,
          errors: ["connect ECONNREFUSED"],
        },
        {
          line: 3,
          errors: ["connect ECONNREFUSED"],
        },
        {
          line: 4,
          errors: ["connect ECONNREFUSED"],
        },
      ],
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
      totalParsed: 1,
      createdCount: 0,
      skippedCount: 0,
      failedCount: 1,
      errors: [
        {
          line: 2,
          errors: ["email: must be a valid email address"],
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
