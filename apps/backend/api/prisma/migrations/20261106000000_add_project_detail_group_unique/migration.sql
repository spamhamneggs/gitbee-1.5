/*
  Warnings:

  - A unique constraint covering the columns `[semester_id, course_id, class, group]` on the table `project_detail` will be added. If there are existing
    duplicate values, this will fail. These duplicates are exactly what the overlapping-resubmit race produced, so find them before deploying (`group` is a
    reserved word):
      SELECT semester_id, course_id, class, `group`, COUNT(*) FROM `project_detail`
      GROUP BY semester_id, course_id, class, `group` HAVING COUNT(*) > 1;
    Keep the newest project in each group and delete the rest, then:
      prisma migrate resolve --rolled-back 20261106000000_add_project_detail_group_unique
      prisma migrate deploy

*/
-- CreateIndex
CREATE UNIQUE INDEX `project_detail_group_key` ON `project_detail`(`semester_id`, `course_id`, `class`, `group`);
