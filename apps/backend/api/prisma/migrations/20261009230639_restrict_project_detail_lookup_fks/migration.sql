-- DropForeignKey
ALTER TABLE `project_detail` DROP FOREIGN KEY `project_detail_status_id_fkey`;

-- DropForeignKey
ALTER TABLE `project_detail` DROP FOREIGN KEY `project_detail_category_id_fkey`;

-- DropForeignKey
ALTER TABLE `project_detail` DROP FOREIGN KEY `project_detail_major_id_fkey`;

-- AddForeignKey
ALTER TABLE `project_detail` ADD CONSTRAINT `project_detail_status_id_fkey` FOREIGN KEY (`status_id`) REFERENCES `status`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_detail` ADD CONSTRAINT `project_detail_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_detail` ADD CONSTRAINT `project_detail_major_id_fkey` FOREIGN KEY (`major_id`) REFERENCES `major`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

