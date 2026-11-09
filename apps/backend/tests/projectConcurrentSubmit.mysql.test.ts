import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import express from "express";
import request from "supertest";

const databaseUrl = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL = databaseUrl ?? "mysql://test:test@127.0.0.1:3306/test";
process.env.JWT_SECRET = "project-concurrent-test-secret";
process.env.COOKIE_NAME = "project_concurrent_test";
const { prisma } = await import("../api/prisma/client.js");
const { default: projectRoutes } = await import("../api/routes/project/projectRoutes.js");

const app = express();
app.use(express.json());
app.use("/api/project", projectRoutes);

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

before(async () => {
  if (!databaseUrl) return;
  statusId = (await prisma.status.create({ data: { name: `status-${suffix}` } })).id;
  categoryId = (await prisma.category.create({ data: { name: `category-${suffix}` } })).id;
  majorId = (await prisma.major.create({ data: { name: `major-${suffix}` } })).id;
  technologyId = (await prisma.technology.create({ data: { name: `technology-${suffix}` } })).id;
});

after(async () => {
  if (databaseUrl) {
    await prisma.project.deleteMany({ where: { lecturer_id: { in: [lecturerId, altLecturerId] } } });
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
  it("keeps exactly one project when a group submits twice at once", async () => {
    for (let round = 0; round < 5; round++) {
      const responses = await Promise.all([
        request(app).post("/api/project/insert").send(payload()),
        request(app).post("/api/project/insert").send(payload())
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

    const response = await request(app)
      .post("/api/project/insert")
      .send({ ...payload(), group_members: [rosterStudentId] });

    assert.equal(response.status, 200, JSON.stringify(response.body));

    const members = await prisma.projectGroup.findMany({ where: { student_id: rosterStudentId } });
    assert.equal(members.length, 1);
    assert.equal(members[0].student_name, "Roster Student");
    assert.equal(members[0].student_binusian_id, "BN-ROSTER");
  });

  it("rejects duplicate technology_ids with 400 and keeps the existing project", async () => {
    const before = await prisma.projectDetail.findFirst({ where: groupWhere() });
    assert.ok(before, "expected a project from an earlier test");

    const response = await request(app)
      .post("/api/project/insert")
      .send({ ...payload(), technology_ids: [technologyId, technologyId] });

    assert.equal(response.status, 400, JSON.stringify(response.body));

    const after = await prisma.projectDetail.findFirst({ where: groupWhere() });
    assert.ok(after, "the failed resubmit must not delete the existing project");
    assert.equal(after.project_id, before.project_id);
  });

  it("keeps member names across a resubmit after the roster is cleared", async () => {
    const group = 2;
    const memberId = `P-${suffix}`;
    const submit = () =>
      request(app)
        .post("/api/project/insert")
        .send({ ...payload(), group, student_leader_id: memberId, group_members: [memberId] });

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

    const first = await submit();
    assert.equal(first.status, 200, JSON.stringify(first.body));

    const rosterLeft = await prisma.temporaryGroup.count({
      where: { semester_id: semesterId, course_id: courseId, class: className, group }
    });
    assert.equal(rosterLeft, 0, "the first submit clears the roster");

    const second = await submit();
    assert.equal(second.status, 200, JSON.stringify(second.body));

    const saved = await prisma.projectGroup.findMany({ where: { student_id: memberId } });
    assert.equal(saved.length, 1);
    assert.equal(saved[0].student_name, "Persisted Student");
    assert.equal(saved[0].student_binusian_id, "BN-PERSIST");
  });

  it("lets a group resubmit when the lecturer changes", async () => {
    const group = 3;
    const memberId = `A-${suffix}`;

    const first = await request(app)
      .post("/api/project/insert")
      .send({ ...payload(), group, student_leader_id: memberId, group_members: [memberId] });
    assert.equal(first.status, 200, JSON.stringify(first.body));

    const second = await request(app)
      .post("/api/project/insert")
      .send({ ...payload(), group, lecturer_id: altLecturerId, student_leader_id: memberId, group_members: [memberId] });
    assert.equal(second.status, 200, JSON.stringify(second.body));

    const details = await prisma.projectDetail.count({
      where: { semester_id: semesterId, course_id: courseId, class: className, group }
    });
    assert.equal(details, 1);
  });

  it("lets a group resubmit when the submitter is not in the saved group", async () => {
    const group = 4;
    const firstMember = `A-${suffix}`;
    const otherMember = `O-${suffix}`;

    const first = await request(app)
      .post("/api/project/insert")
      .send({ ...payload(), group, student_leader_id: firstMember, group_members: [firstMember] });
    assert.equal(first.status, 200, JSON.stringify(first.body));

    const second = await request(app)
      .post("/api/project/insert")
      .send({ ...payload(), group, student_leader_id: otherMember, group_members: [otherMember] });
    assert.equal(second.status, 200, JSON.stringify(second.body));

    const details = await prisma.projectDetail.count({
      where: { semester_id: semesterId, course_id: courseId, class: className, group }
    });
    assert.equal(details, 1);
  });
});
