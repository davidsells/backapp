-- AlterTable
ALTER TABLE "backup_configs" ADD COLUMN "requested_at" TIMESTAMP(3),
ADD COLUMN "last_run_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "backup_configs_requested_at_idx" ON "backup_configs"("requested_at");
