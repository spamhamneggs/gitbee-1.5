import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";

const databaseUrl = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL = databaseUrl ?? "mysql://test:test@127.0.0.1:3306/test";
process.env.JWT_SECRET = "project-concurrent-test-secret";
process.env.COOKIE_NAME = "project_concurrent_test";
const { prisma } = await import("../api/prisma/client.js");
const { default: projectRoutes } = await import("../api/routes/project/projectRoutes.js");
const { default: groupRoutes } = await import("../api/routes/group/groupRoutes.js");
const { default: GenericService } = await import("../api/services/generic/genericService.js");

const app = express();
app.use(express.json(), cookieParser());
app.use("/api/project", projectRoutes);
app.use("/api/group", groupRoutes);

const suffix = randomBytes(6).toString("hex");
const lecturerId = `D-${suffix}`;
const altLecturerId = `D2-${suffix}`;
const leaderId = `L-${suffix}`;
const semesterId = `sem-${suffix}`;
const courseId = `COMP-${suffix}`;
const className = "T01";

let statusId = 0;
let categoryId = 0;
let majorId = 0;
let technologyId = 0;

const payload = () => ({
  lecturer_id: lecturerId,
  student_leader_id: leaderId,
  title: "Concurrent submit",
  semester_id: semesterId,
  course_id: courseId,
  class: className,
  github_link: "https://github.com/example/repo",
  project_link: "https://example.com",
  documentation: "https://example.com/doc.pdf",
  video_link: "https://example.com/video",
  thumbnail: "https://example.com/thumb.png",
  description: "concurrency regression fixture",
  status_id: statusId,
  category_id: categoryId,
  major_id: majorId,
  gallery: ["https://example.com/img.png"],
  group_members: [`M-${suffix}`],
  technology_ids: [technologyId],
  group: 1
});

const groupWhere = () => ({
  semester_id: semesterId,
  course_id: courseId,
  class: className,
  group: 1
});

const tokenFor = (studentId = leaderId, role = "Student") => jwt.sign({
  nim: studentId, role: [role], email: `${studentId}@project-submit.example.test`,
}, process.env.JWT_SECRET!);
const submit = (body = payload(), studentId = body.student_leader_id) =>
  request(app).post("/api/project/insert")
    .set("Authorization", `Bearer ${tokenFor(studentId)}`).send(body);
const reserveGroup = (group: number, studentIds: string[]) => prisma.temporaryGroup.createMany({
  data: studentIds.map((student_id) => ({
    ...groupWhere(), group, student_id, student_name: student_id, student_binusian_id: student_id,
  })),
});

before(async () => {
  if (!databaseUrl) return;
  statusId = (await prisma.status.create({ data: { name: `status-${suffix}` } })).id;
  categoryId = (await prisma.category.create({ data: { name: `category-${suffix}` } })).id;
  majorId = (await prisma.major.create({ data: { name: `major-${suffix}` } })).id;
  technologyId = (await prisma.technology.create({ data: { name: `technology-${suffix}` } })).id;
  await reserveGroup(1, [leaderId, `M-${suffix}`]);
  await reserveGroup(3, [`A-${suffix}`]);
  await reserveGroup(6, [leaderId, `member-${suffix}`]);
});

after(async () => {
  if (databaseUrl) {
    await prisma.project.deleteMany({ where: { lecturer_id: { in: [lecturerId, altLecturerId] } } });
    await prisma.temporaryGroup.deleteMany({ where: { semester_id: semesterId } });
    await prisma.status.deleteMany({ where: { id: statusId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.major.deleteMany({ where: { id: majorId } });
    await prisma.technology.deleteMany({ where: { id: technologyId } });
  }
  await prisma.$disconnect();
});

describe("project insert concurrency against MySQL", {
  skip: databaseUrl ? false : "set TEST_DATABASE_URL to a migrated test database",
}, () => {
  it("requires a student session and binds the leader to the signed NIM", async () => {
    for (const authorization of [undefined, "Bearer invalid-token"]) {
      const req = request(app).post("/api/project/insert");
      if (authorization) req.set("Authorization", authorization);
      assert.equal((await req.send(payload())).status, 401);
    }
    assert.equal((await request(app).post("/api/project/insert")
      .set("Authorization", `Bearer ${tokenFor(leaderId, "Lecturer")}`).send(payload())).status, 403);
    assert.equal((await submit(payload(), `outsider-${suffix}`)).status, 403);
    assert.equal(await prisma.projectDetail.count({ where: { semester_id: semesterId } }), 0);
  });

  it("keeps exactly one project when a group submits twice at once", async () => {
    for (let round = 0; round < 5; round++) {
      const responses = await Promise.all([
        submit(),
        submit()
      ]);

      for (const response of responses) {
        assert.ok(
          [200, 409].includes(response.status),
          `round ${round}: unexpected ${response.status} ${JSON.stringify(response.body)}`
        );
      }

      const projects = await prisma.project.count({ where: { lecturer_id: lecturerId } });
      assert.equal(projects, 1, `round ${round}: expected 1 project, found ${projects}`);

      const details = await prisma.projectDetail.count({ where: groupWhere() });
      assert.equal(details, 1, `round ${round}: expected 1 project detail, found ${details}`);
    }
  });

  it("fills member names from the group roster when there is no user row", async () => {
    const rosterStudentId = `R-${suffix}`;
    await prisma.temporaryGroup.create({
      data: {
        semester_id: semesterId,
        course_id: courseId,
        class: className,
        group: 1,
        student_id: rosterStudentId,
        student_name: "Roster Student",
        student_binusian_id: "BN-ROSTER"
      }
    });

    const response = await submit({ ...payload(), group_members: [rosterStudentId] });

    assert.equal(response.status, 200, JSON.stringify(response.body));

    const members = await prisma.projectGroup.findMany({ where: { student_id: rosterStudentId } });
    assert.equal(members.length, 1);
    assert.equal(members[0].student_name, "Roster Student");
    assert.equal(members[0].student_binusian_id, "BN-ROSTER");
  });

  it("rejects an outsider's first submission and leaves the reserved group able to submit", async () => {
    const group = 7;
    const memberId = `reserved-${suffix}`;
    const outsiderId = `outside-${suffix}`;
    await reserveGroup(group, [memberId]);
    const where = { ...groupWhere(), group };
    const roster = await prisma.temporaryGroup.findMany({ where });
    const projectsBefore = await prisma.project.count({ where: { lecturer_id: lecturerId } });

    const rejected = await submit({
      ...payload(), group, student_leader_id: outsiderId, group_members: [memberId, outsiderId],
    });
    assert.equal(rejected.status, 409, JSON.stringify(rejected.body));
    assert.equal(await prisma.projectDetail.count({ where }), 0);
    assert.equal(await prisma.project.count({ where: { lecturer_id: lecturerId } }), projectsBefore);
    assert.deepEqual(await prisma.temporaryGroup.findMany({ where }), roster);

    const accepted = await submit({
      ...payload(), group, student_leader_id: memberId, group_members: [memberId],
    });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.equal(accepted.body.data.newProject.student_leader_id, memberId);
    assert.equal(await prisma.projectDetail.count({ where }), 1);
    assert.equal(await prisma.temporaryGroup.count({ where }), 0);
  });

  it("rejects a first submission without a matching reserved roster", async () => {
    const group = 8;
    const studentId = `unreserved-${suffix}`;
    const projectsBefore = await prisma.project.count({ where: { lecturer_id: lecturerId } });
    const rejected = await submit({
      ...payload(), group, student_leader_id: studentId, group_members: [studentId],
    });
    assert.equal(rejected.status, 409, JSON.stringify(rejected.body));
    assert.equal(await prisma.projectDetail.count({ where: { ...groupWhere(), group } }), 0);
    assert.equal(await prisma.project.count({ where: { lecturer_id: lecturerId } }), projectsBefore);
  });

  it("rejects duplicate technology_ids with 400 and keeps the existing project", async () => {
    const before = await prisma.projectDetail.findFirst({ where: groupWhere() });
    assert.ok(before, "expected a project from an earlier test");

    const response = await submit({ ...payload(), technology_ids: [technologyId, technologyId] });

    assert.equal(response.status, 400, JSON.stringify(response.body));

    const after = await prisma.projectDetail.findFirst({ where: groupWhere() });
    assert.ok(after, "the failed resubmit must not delete the existing project");
    assert.equal(after.project_id, before.project_id);
  });

  it("keeps member names across a resubmit after the roster is cleared", async () => {
    const group = 2;
    const memberId = `P-${suffix}`;
    const resubmit = () => submit({ ...payload(), group, student_leader_id: memberId, group_members: [memberId] });

    await prisma.temporaryGroup.create({
      data: {
        semester_id: semesterId,
        course_id: courseId,
        class: className,
        group,
        student_id: memberId,
        student_name: "Persisted Student",
        student_binusian_id: "BN-PERSIST"
      }
    });

    const first = await resubmit();
    assert.equal(first.status, 200, JSON.stringify(first.body));

    const rosterLeft = await prisma.temporaryGroup.count({
      where: { semester_id: semesterId, course_id: courseId, class: className, group }
    });
    assert.equal(rosterLeft, 0, "the first submit clears the roster");

    const second = await resubmit();
    assert.equal(second.status, 200, JSON.stringify(second.body));

    const saved = await prisma.projectGroup.findMany({ where: { student_id: memberId } });
    assert.equal(saved.length, 1);
    assert.equal(saved[0].student_name, "Persisted Student");
    assert.equal(saved[0].student_binusian_id, "BN-PERSIST");
  });

  it("lets a group resubmit when the lecturer changes", async () => {
    const group = 3;
    const memberId = `A-${suffix}`;

    const first = await submit({ ...payload(), group, student_leader_id: memberId, group_members: [memberId] });
    assert.equal(first.status, 200, JSON.stringify(first.body));

    const second = await request(app)
      .post("/api/project/insert")
      .set("Cookie", `${process.env.COOKIE_NAME}=${tokenFor(memberId)}`)
      .send({ ...payload(), group, lecturer_id: altLecturerId, student_leader_id: memberId, group_members: [memberId] });
    assert.equal(second.status, 200, JSON.stringify(second.body));

    const details = await prisma.projectDetail.count({
      where: { semester_id: semesterId, course_id: courseId, class: className, group }
    });
    assert.equal(details, 1);
  });

  it("lets another saved group member resubmit as the leader", async () => {
    const memberId = `member-${suffix}`;
    const first = await submit({ ...payload(), group: 6, group_members: [memberId] });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const second = await submit({ ...payload(), group: 6, student_leader_id: memberId, group_members: [leaderId] });
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.equal(second.body.data.newProject.student_leader_id, memberId);
    assert.equal(await prisma.projectDetail.count({ where: { ...groupWhere(), group: 6 } }), 1);
  });

  it("preserves the project, assessment and waiting roster when another group has the same number", async () => {
    const group = 4;
    const firstMember = `A-${suffix}`;
    const otherMember = `O-${suffix}`;

    await prisma.temporaryGroup.createMany({ data: [firstMember, otherMember].map((student_id) => ({
      ...groupWhere(), group, student_id, student_name: student_id, student_binusian_id: student_id,
    })) });
    const first = await submit({ ...payload(), group, student_leader_id: firstMember, group_members: [firstMember] });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const projectId = first.body.data.newProject.id;
    const assessment = await prisma.assessment.create({ data: {
      project_id: projectId, grade: 5, reason: "Must survive a conflicting submit",
    } });

    const second = await submit({ ...payload(), group, student_leader_id: otherMember, group_members: [otherMember] });
    assert.equal(second.status, 409, JSON.stringify(second.body));
    assert.ok(await prisma.project.findUnique({ where: { id: projectId } }));
    assert.ok(await prisma.assessment.findUnique({ where: { id: assessment.id } }));
    assert.equal(await prisma.gallery.count({ where: { project_id: projectId } }), 1);
    assert.equal(await prisma.projectTechnology.count({ where: { project_id: projectId } }), 1);
    const savedMembers = await prisma.projectGroup.findMany({ where: { project_id: projectId } });
    assert.deepEqual(savedMembers.map((row) => row.student_id), [firstMember]);
    const waiting = await prisma.temporaryGroup.findMany({ where: { ...groupWhere(), group } });
    assert.deepEqual(waiting.map((row) => row.student_id), [otherMember]);

    const details = await prisma.projectDetail.count({
      where: { semester_id: semesterId, course_id: courseId, class: className, group }
    });
    assert.equal(details, 1);
  });

  it("allocates different numbers to concurrent groups and lets both submit", async (t) => {
    t.mock.method(GenericService, "getName", async (studentId: string) => ({ message: "successful", status: true, data: studentId }));
    t.mock.method(GenericService, "getBinusianID", async (studentId: string) => ({ message: "successful", status: true, data: studentId }));
    for (let round = 0; round < 5; round++) {
      const classId = `R${round}`;
      const students = [`G1-${suffix}`, `G2-${suffix}`];
      const groups = await Promise.all(students.map((student_id) => request(app)
        .post("/api/group/student/insert")
        .send({ semester_id: semesterId, course_id: courseId, class: classId, student_ids: [student_id] })));
      for (const response of groups) assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.notEqual(groups[0]!.body.data[0].group, groups[1]!.body.data[0].group);
      const submissions = await Promise.all(students.map((student_id, i) => submit({
        ...payload(), class: classId, group: groups[i]!.body.data[0].group,
        student_leader_id: student_id, group_members: [student_id],
      })));
      for (const response of submissions) assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(await prisma.projectDetail.count({ where: { semester_id: semesterId, class: classId } }), 2);
    }
  });

  it("rejects overlapping concurrent groups without leaving a partial roster", async (t) => {
    t.mock.method(GenericService, "getName", async (studentId: string) => ({ message: "successful", status: true, data: studentId }));
    t.mock.method(GenericService, "getBinusianID", async (studentId: string) => ({ message: "successful", status: true, data: studentId }));
    const studentIds = [`C1-${suffix}`, `C2-${suffix}`];
    const body = { semester_id: semesterId, course_id: courseId, class: "OVERLAP", student_ids: studentIds };
    const responses = await Promise.all([
      request(app).post("/api/group/student/insert").send(body),
      request(app).post("/api/group/student/insert").send(body),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
    const rows = await prisma.temporaryGroup.findMany({ where: { semester_id: semesterId, class: body.class } });
    assert.equal(rows.length, 2);
    assert.equal(new Set(rows.map((row) => row.group)).size, 1);
    assert.deepEqual(rows.map((row) => row.student_id).sort(), studentIds);
  });
});
