// Group creation reads students from the local database
// (user + student_list_transaction) instead of Atlantis.
// Skipped unless TEST_DATABASE_URL points at a migrated test database.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import express from "express";
import request from "supertest";

const databaseUrl = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL = databaseUrl ?? "mysql://test:test@127.0.0.1:3306/test";
delete process.env.ATLANTIS_API; // any remaining Atlantis call would fail loudly
const { prisma } = await import("../api/prisma/client.js");
const { default: groupRoutes } = await import("../api/routes/group/groupRoutes.js");
const { default: classRoutes } = await import("../api/routes/class/classRoutes.js");

const app = express();
app.use(express.json());
app.use("/api/group", groupRoutes);
app.use("/api/class", classRoutes);

const suffix = randomBytes(5).toString("hex");
const semesterId = `sem-${suffix}`;
const courseId = `COMP-${suffix}`;
const className = "LA01";
const nim = (tag: string) => `${tag}-${suffix}`;
const emailDomain = `group-lookup-${suffix}.example.test`;

const createGroup = (studentIds: string[]) => request(app)
  .post("/api/group/student/insert")
  .send({ semester_id: semesterId, course_id: courseId, class: className, student_ids: studentIds });
const savedMembers = (studentIds: string[]) => prisma.temporaryGroup.findMany({
  where: { semester_id: semesterId, student_id: { in: studentIds } },
  orderBy: { student_id: "asc" },
});

before(async () => {
  if (!databaseUrl) return;
  await prisma.user.createMany({ data: [
    { email: `ayu@${emailDomain}`, name: "Ayu User", role: "Student", user_type: "student", student_id: nim("A"), binusian_id: `BN-${suffix}` },
    { email: `budi@${emailDomain}`, name: "Budi User", role: "Student", user_type: "student", student_id: nim("B"), binusian_id: null },
  ] });
  const roster = (student_id: string, student_name: string, classId = className) =>
    ({ semester_id: semesterId, student_id, student_name, course_code: courseId, class: classId });
  await prisma.studentListTransaction.createMany({ data: [
    roster(nim("A"), "AYU (roster)"),
    roster(nim("B"), "BUDI (roster)"),
    roster(nim("C"), "Citra Roster"),
    roster(nim("D"), ""),
    roster(nim("E"), "Other Class Student", "LB02"),
    roster(nim("F"), "Fajar Roster"),
    roster(nim("G"), "Gita Roster"),
    // A trailing space, as the Excel enrolment import keeps from a string cell.
    roster(`${nim("H")} `, "Hana Roster"),
  ] });
});

after(async () => {
  if (databaseUrl) {
    await prisma.temporaryGroup.deleteMany({ where: { semester_id: semesterId } });
    await prisma.studentListTransaction.deleteMany({ where: { semester_id: semesterId } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `@${emailDomain}` } } });
  }
  await prisma.$disconnect();
});

describe("group members and names from the local database", {
  skip: databaseUrl ? false : "set TEST_DATABASE_URL to a migrated test database",
}, () => {
  it("names members from the user row, then the roster, then the NIM", async () => {
    const ids = [nim("A"), nim("B"), nim("C"), nim("D")];
    const response = await createGroup(ids);
    assert.equal(response.status, 200, JSON.stringify(response.body));

    const rows = await savedMembers(ids);
    assert.deepEqual(rows.map(({ student_id, student_name, student_binusian_id }) =>
      [student_id, student_name, student_binusian_id]), [
      [nim("A"), "Ayu User", `BN-${suffix}`],
      [nim("B"), "Budi User", nim("B")],
      [nim("C"), "Citra Roster", nim("C")],
      [nim("D"), nim("D"), nim("D")],
    ]);
    assert.equal(new Set(rows.map((row) => row.group)).size, 1);
  });

  it("rejects students who are not on this class's roster, and saves nothing", async () => {
    const response = await createGroup([nim("F"), nim("E"), nim("Z")]);
    assert.equal(response.status, 400);
    assert.equal(response.body.errors, `Not enrolled in this class: ${nim("E")}, ${nim("Z")}`);
    assert.equal((await savedMembers([nim("F"), nim("E"), nim("Z")])).length, 0);
  });

  it("ignores blank member slots and repeated IDs, and saves the ID as first requested", async () => {
    const requested = nim("G").toUpperCase();
    const response = await createGroup([requested, "", "  ", nim("G")]);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const rows = await savedMembers([nim("G")]);
    assert.deepEqual(rows.map((row) => [row.student_id, row.student_name]), [[requested, "Gita Roster"]]);
  });

  it("saves the requested NIM when the roster's copy has a trailing space, and still marks the student as taken", async () => {
    const response = await createGroup([nim("H")]);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const rows = await savedMembers([nim("H")]);
    assert.deepEqual(rows.map((row) => [row.student_id, row.student_name]), [[nim("H"), "Hana Roster"]]);

    // The member picker reads is_disable from the class list, which compares
    // the roster's "H " with the saved "H".
    const list = await request(app).get("/api/class/student/list")
      .query({ semester_id: semesterId, course_id: courseId, class: className });
    assert.equal(list.status, 200, JSON.stringify(list.body));
    const taken = Object.fromEntries(list.body.data.map((student: { student_id: string; is_disable: number }) =>
      [student.student_id.trim(), student.is_disable]));
    assert.equal(taken[nim("H")], 1);
    assert.equal(taken[nim("F")], 0);
  });

  it("asks for a member when every slot is blank", async () => {
    const response = await createGroup(["", " "]);
    assert.equal(response.status, 400);
    assert.equal(response.body.errors, "Choose at least one group member");
  });

});
