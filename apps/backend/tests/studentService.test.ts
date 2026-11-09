import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";
const { normalizeStudentIds, toStudentIdentity } = await import("../api/services/student/studentService.js");

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
