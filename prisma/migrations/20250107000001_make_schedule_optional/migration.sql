-- AlterTable
-- Make schedule column nullable to support manual-only backups
ALTER TABLE "backup_configs" ALTER COLUMN "schedule" DROP NOT NULL;
