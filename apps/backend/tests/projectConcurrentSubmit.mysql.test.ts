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
    await prisma.project.deleteMany({ where: { lecturer_id: lecturerId } });
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
});
