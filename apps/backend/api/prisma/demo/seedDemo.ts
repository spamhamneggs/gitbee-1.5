import "dotenv/config";
import { prisma } from "../client.js";
import { hashPassword } from "../../utils/auth/password.js";
import { generateStudents, dummyPassword } from "../dummy/dummyUsers.js";
import { databaseOverview } from "../../utils/demo/databaseExplorer.js";

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? "");
  if (!/^\/gitbee_demo(?:_[a-z0-9]+)?$/.test(target.pathname))
    throw new Error(
      "Demo seed requires a dedicated database named gitbee_demo or gitbee_demo_<suffix>.",
    );
  const tables = await databaseOverview();
  if (tables.some((table) => table.count > 0)) {
    console.log(
      "Database already contains records. Demo seed skipped; existing data preserved.",
    );
    return;
  }
  const password = await hashPassword(dummyPassword);
  const students = generateStudents(24, { seed: 7 }).map((row, index) => ({
    student_id: row.nim,
    name: row.name,
    email:
      index === 0
        ? "student@example.test"
        : `student.${index + 1}@example.test`,
    binusian_id: row.binusian_id || null,
    role: "Student",
    user_type: "student",
    password,
  }));
  await prisma.$transaction(
    async (tx) => {
      await tx.user.createMany({ data: students });
      for (const [index, role] of [
        "Admin",
        "Lecturer",
        "SCC",
        "HoP",
      ].entries()) {
        await tx.user.create({
          data: {
            name: `Demo ${role}`,
            email: `${role.toLowerCase()}@example.test`,
            role,
            lecturer_code: `DEMO${index + 1}`,
            password,
          },
        });
      }
      await tx.role.createMany({
        data: ["Student", "Lecturer", "Admin", "SCC", "HoP"].map((name) => ({
          name,
        })),
      });
      const major = await tx.major.create({
        data: { name: "Computer Science" },
      });
      const hop = await tx.user.findUniqueOrThrow({
        where: { email: "hop@example.test" },
      });
      await tx.hoPMajor.create({
        data: { user_id: hop.id, major_id: major.id },
      });
      const category = await tx.category.create({
        data: { name: "Web Application" },
      });
      const technologies = await Promise.all(
        ["TypeScript", "React", "MySQL"].map((name) =>
          tx.technology.create({ data: { name } }),
        ),
      );
      const statuses = await Promise.all(
        ["Submitted", "Graded", "Reviewed", "Finalized"].map((name) =>
          tx.status.create({ data: { name } }),
        ),
      );
      await tx.classTransaction.create({
        data: {
          semester_id: "2026-1",
          lecturer_code: "DEMO2",
          lecturer_name: "Demo Lecturer",
          course_code: "COMP6047",
          course_name: "Software Engineering",
          class: "LA01",
          location: "Demo Campus",
        },
      });
      await tx.studentListTransaction.createMany({
        data: students.map((student) => ({
          semester_id: "2026-1",
          student_id: student.student_id,
          student_name: student.name,
          course_code: "COMP6047",
          class: "LA01",
        })),
      });
      const titles = ["Campus Connect", "Green Steps", "Study Buddy"];
      for (const [index, title] of titles.entries()) {
        const members = students.slice(index * 3, index * 3 + 3);
        await tx.project.create({
          data: {
            lecturer_id: "DEMO2",
            student_leader_id: members[0]!.student_id,
            is_disable: 0,
            projectDetail: {
              create: {
                title,
                semester_id: "2026-1",
                course_id: "COMP6047",
                class: "LA01",
                group: index + 1,
                github_link: "https://github.com/spamhamneggs/gitbee-1.5",
                project_link: "https://example.test",
                documentation: "Synthetic project for the GitBee demo.",
                description: [
                  "A student community platform for campus events and clubs.",
                  "Track everyday sustainability goals with a shared dashboard.",
                  "Find study groups and organize collaborative learning sessions.",
                ][index]!,
                thumbnail: "/demo-project.svg",
                status_id: statuses[index]!.id,
                category_id: category.id,
                major_id: major.id,
              },
            },
            projectGroups: {
              create: members.map((student) => ({
                student_id: student.student_id,
                student_name: student.name,
                student_binusian_id: student.binusian_id ?? "",
              })),
            },
            projectTechnologies: {
              create: technologies.map((technology) => ({
                technology_id: technology.id,
              })),
            },
            ...(index > 0
              ? {
                  assessment: {
                    create: {
                      grade: 4,
                      reason:
                        "Clear implementation and a complete demonstration.",
                    },
                  },
                }
              : {}),
            ...(index > 1
              ? {
                  reviewedProject: {
                    create: {
                      is_recommended: 1,
                      feedback: "Recommended for the demo showcase.",
                    },
                  },
                }
              : {}),
          },
        });
      }
    },
    { timeout: 30000 },
  );
  console.log(
    "Demo ready: 24 students, four staff accounts, three projects, class roster and reference data.",
  );
  console.log(`Sign in as admin@example.test with ${dummyPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
