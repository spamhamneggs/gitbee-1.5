/*
  Warnings:

  - A unique constraint covering the columns `[binusian_id]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[student_id]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `user_lecturer_code_name_key` ON `user`;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `binusian_id` VARCHAR(150) NULL,
    ADD COLUMN `password` VARCHAR(255) NULL,
    ADD COLUMN `student_id` VARCHAR(50) NULL,
    ADD COLUMN `user_type` VARCHAR(50) NULL,
    MODIFY `lecturer_code` VARCHAR(50) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `user_binusian_id_key` ON `user`(`binusian_id`);

-- CreateIndex
CREATE UNIQUE INDEX `user_student_id_key` ON `user`(`student_id`);
