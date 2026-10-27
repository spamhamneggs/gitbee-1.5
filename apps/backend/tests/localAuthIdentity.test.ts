import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.JWT_SECRET ??= "local-auth-identity-test-secret";
const { createLocalToken, getLocalNim, getLocalRoles } = await import("../api/utils/auth/auth.js");

describe("local authentication identity", () => {
  it("prefers lecturer_code for staff even when student_id is populated", () => {
    const user = {
      id: 1,
      email: "lecturer@example.com",
      name: "Lecturer",
      role: "Lecturer",
      user_type: null,
      student_id: "2702999999",
      binusian_id: null,
      lecturer_code: "D5001",
    };

    assert.equal(getLocalNim(user), "D5001");
    const { token } = createLocalToken(user);
    const switched = createLocalToken(user, "Lecturer");
    assert.equal(JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()).nim, "D5001");
    assert.equal(JSON.parse(Buffer.from(switched.token.split(".")[1]!, "base64url").toString()).nim, "D5001");
    assert.equal(JSON.parse(Buffer.from(switched.token.split(".")[1]!, "base64url").toString()).activeRole, "Lecturer");
  });

  it("continues to use student_id for student accounts", () => {
    assert.equal(getLocalNim({
      role: "Student",
      user_type: "student",
      student_id: "2702999999",
      lecturer_code: "D5001",
    }), "2702999999");
  });

  it("uses lecturer identity when user_type identifies staff even if role is Student", () => {
    const user = {
      role: "Student",
      user_type: " Staff ",
      student_id: "2702999999",
      lecturer_code: "D5001",
    };

    assert.equal(getLocalNim(user), "D5001");
    assert.deepEqual(getLocalRoles(user), ["Lecturer"]);
    const { token } = createLocalToken({
      id: 2,
      email: "staff@example.com",
      name: "Staff",
      ...user,
      binusian_id: null,
    });
    const claims = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
    assert.equal(claims.nim, "D5001");
    assert.equal(claims.activeRole, "Lecturer");
  });

  it("uses student identity when user_type identifies a student with a lecturer code", () => {
    const user = {
      role: "Lecturer",
      user_type: "Student",
      student_id: "2702999999",
      lecturer_code: "D5001",
    };

    assert.equal(getLocalNim(user), "2702999999");
    assert.deepEqual(getLocalRoles(user), ["Student"]);
  });
});
