import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";
const { prisma } = await import("../api/prisma/client.js");
const { default: StudentService, idKey, normalizeStudentIds, toStudentIdentity } =
  await import("../api/services/student/studentService.js");

// Replaces one Prisma model method for the duration of `run`, so no database is needed.
async function withStub<T extends object>(target: T, key: keyof T, value: unknown, run: () => Promise<void>) {
  const object = target as Record<keyof T, unknown>;
  const original = object[key];
  object[key] = value;
  try {
    await run();
  } finally {
    object[key] = original;
  }
}

describe("resolveClassMembers", () => {
  const classRef = { semester_id: "semester", course_id: "COMP6100001", class: "LA01" };

  it("saves the requested NIM, not the roster's spelling of it", async () => {
    // MySQL matches "2701000001 " (a trailing space kept by the Excel import)
    // and "ab-1" in another case, so the roster query returns both rows.
    const roster = [
      { student_id: "2701000001 ", student_name: "Ayu Roster" },
      { student_id: "AB-1", student_name: "Budi Roster" },
    ];
    const users = [{ student_id: "2701000001", name: "Ayu User", binusian_id: "BN001" }];

    await withStub(prisma.studentListTransaction, "findMany", async () => roster, () =>
      withStub(prisma.user, "findMany", async () => users, async () => {
        const result = await StudentService.resolveClassMembers(classRef, ["2701000001", " ab-1 ", "2799999999"]);
        assert.deepEqual(result, {
          members: [
            { student_id: "2701000001", student_name: "Ayu User", student_binusian_id: "BN001" },
            { student_id: "ab-1", student_name: "Budi Roster", student_binusian_id: "ab-1" },
          ],
          notEnrolled: ["2799999999"],
        });
      }));
  });
});

describe("idKey", () => {
  it("ignores case and surrounding whitespace", () => {
    assert.equal(idKey("2701000001 "), idKey("2701000001"));
    assert.equal(idKey("AB-1"), idKey(" ab-1"));
    assert.notEqual(idKey("2701000001"), idKey("2701000002"));
  });
});

describe("normalizeStudentIds", () => {
  it("trims IDs and drops blank member slots", () => {
    assert.deepEqual(normalizeStudentIds([" 2701000001 ", "", "   ", "2701000002"]), ["2701000001", "2701000002"]);
  });

  it("drops repeats, ignoring case, and keeps the first spelling", () => {
    assert.deepEqual(normalizeStudentIds(["ab-1", "2701000001", "AB-1", "2701000001 "]), ["ab-1", "2701000001"]);
  });
});

describe("toStudentIdentity", () => {
  it("prefers the user row's name and Binusian ID", () => {
    assert.deepEqual(
      toStudentIdentity("2701000001", { name: "Ayu Lestari", binusian_id: "BN001" }, "AYU (roster)"),
      { student_id: "2701000001", student_name: "Ayu Lestari", student_binusian_id: "BN001" }
    );
  });

  it("falls back to the roster name, and to the NIM for a missing Binusian ID", () => {
    assert.deepEqual(
      toStudentIdentity("2701000002", undefined, "Budi Santoso"),
      { student_id: "2701000002", student_name: "Budi Santoso", student_binusian_id: "2701000002" }
    );
    assert.deepEqual(
      toStudentIdentity("2701000003", { name: "Citra", binusian_id: null }, undefined),
      { student_id: "2701000003", student_name: "Citra", student_binusian_id: "2701000003" }
    );
  });

  it("never stores an empty name: blank values fall through to the NIM", () => {
    assert.deepEqual(
      toStudentIdentity("2701000004", { name: "  ", binusian_id: "" }, ""),
      { student_id: "2701000004", student_name: "2701000004", student_binusian_id: "2701000004" }
    );
  });
});
