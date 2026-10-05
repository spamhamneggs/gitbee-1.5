-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lecturer_code` VARCHAR(50) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `role` VARCHAR(50) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_lecturer_code_key`(`lecturer_code`),
    UNIQUE INDEX `user_lecturer_code_name_key`(`lecturer_code`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lecturer_id` VARCHAR(50) NOT NULL,
    `student_leader_id` VARCHAR(50) NOT NULL,
    `is_disable` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_detail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `semester_id` VARCHAR(100) NOT NULL,
    `course_id` VARCHAR(50) NOT NULL,
    `class` VARCHAR(20) NOT NULL,
    `github_link` TEXT NOT NULL,
    `project_link` TEXT NOT NULL,
    `documentation` MEDIUMTEXT NOT NULL,
    `video_link` MEDIUMTEXT NULL,
    `description` TEXT NOT NULL,
    `thumbnail` MEDIUMTEXT NOT NULL,
    `status_id` INTEGER NOT NULL,
    `category_id` INTEGER NOT NULL,
    `major_id` INTEGER NOT NULL,
    `group` INTEGER NOT NULL,

    UNIQUE INDEX `project_detail_project_id_key`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `grade` INTEGER NOT NULL,
    `reason` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `assessment_project_id_key`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviewed_project` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `is_recommended` INTEGER NOT NULL,
    `feedback` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `reviewed_project_project_id_key`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outstanding_project` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `is_outstanding` INTEGER NOT NULL,
    `feedback` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `outstanding_project_project_id_key`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_group` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `student_id` VARCHAR(50) NOT NULL,
    `student_name` VARCHAR(200) NOT NULL,
    `student_binusian_id` VARCHAR(150) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gallery` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `image` MEDIUMTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `status` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `technology` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_technology` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `technology_id` INTEGER NOT NULL,

    UNIQUE INDEX `project_technology_project_id_technology_id_key`(`project_id`, `technology_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `major` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `temporary_group` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `semester_id` VARCHAR(100) NOT NULL,
    `course_id` VARCHAR(50) NOT NULL,
    `class` VARCHAR(20) NOT NULL,
    `group` INTEGER NOT NULL,
    `student_id` VARCHAR(50) NOT NULL,
    `student_name` VARCHAR(200) NOT NULL,
    `student_binusian_id` VARCHAR(150) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `semester_id` VARCHAR(100) NOT NULL,
    `course_id` VARCHAR(50) NOT NULL,
    `class` VARCHAR(20) NOT NULL,
    `lecturer_id` VARCHAR(50) NOT NULL,
    `finalized_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deadline` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `periode` VARCHAR(50) NOT NULL,
    `deadline_at` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hop_major` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `major_id` INTEGER NOT NULL,

    UNIQUE INDEX `hop_major_user_id_major_id_key`(`user_id`, `major_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class_transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `semester_id` VARCHAR(150) NOT NULL,
    `lecturer_code` VARCHAR(50) NOT NULL,
    `lecturer_name` VARCHAR(150) NOT NULL,
    `course_code` VARCHAR(50) NOT NULL,
    `course_name` VARCHAR(100) NOT NULL,
    `class` VARCHAR(50) NOT NULL,
    `location` VARCHAR(50) NOT NULL,

    UNIQUE INDEX `class_transaction_semester_id_lecturer_code_course_code_clas_key`(`semester_id`, `lecturer_code`, `course_code`, `class`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_list_transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `semester_id` VARCHAR(150) NOT NULL,
    `student_id` VARCHAR(50) NOT NULL,
    `student_name` VARCHAR(150) NOT NULL,
    `course_code` VARCHAR(50) NOT NULL,
    `class` VARCHAR(50) NOT NULL,

    UNIQUE INDEX `student_list_transaction_semester_id_student_id_course_code__key`(`semester_id`, `student_id`, `course_code`, `class`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `project_detail` ADD CONSTRAINT `project_detail_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_detail` ADD CONSTRAINT `project_detail_status_id_fkey` FOREIGN KEY (`status_id`) REFERENCES `status`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_detail` ADD CONSTRAINT `project_detail_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_detail` ADD CONSTRAINT `project_detail_major_id_fkey` FOREIGN KEY (`major_id`) REFERENCES `major`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment` ADD CONSTRAINT `assessment_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviewed_project` ADD CONSTRAINT `reviewed_project_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outstanding_project` ADD CONSTRAINT `outstanding_project_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_group` ADD CONSTRAINT `project_group_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gallery` ADD CONSTRAINT `gallery_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_technology` ADD CONSTRAINT `project_technology_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_technology` ADD CONSTRAINT `project_technology_technology_id_fkey` FOREIGN KEY (`technology_id`) REFERENCES `technology`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hop_major` ADD CONSTRAINT `hop_major_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hop_major` ADD CONSTRAINT `hop_major_major_id_fkey` FOREIGN KEY (`major_id`) REFERENCES `major`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
