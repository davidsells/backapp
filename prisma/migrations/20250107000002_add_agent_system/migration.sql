-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "last_seen" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'offline',
    "platform" TEXT,
    "version" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_logs" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_logs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "backup_configs" ADD COLUMN     "agent_id" TEXT,
ADD COLUMN     "execution_mode" TEXT NOT NULL DEFAULT 'server';

-- AlterTable
ALTER TABLE "backup_logs" ADD COLUMN     "s3_path" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "agents_api_key_key" ON "agents"("api_key");

-- CreateIndex
CREATE INDEX "agents_user_id_idx" ON "agents"("user_id");

-- CreateIndex
CREATE INDEX "agents_status_idx" ON "agents"("status");

-- CreateIndex
CREATE INDEX "agent_logs_agent_id_idx" ON "agent_logs"("agent_id");

-- CreateIndex
CREATE INDEX "agent_logs_timestamp_idx" ON "agent_logs"("timestamp");

-- CreateIndex
CREATE INDEX "agent_logs_level_idx" ON "agent_logs"("level");

-- CreateIndex
CREATE INDEX "backup_configs_agent_id_idx" ON "backup_configs"("agent_id");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_logs" ADD CONSTRAINT "agent_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_configs" ADD CONSTRAINT "backup_configs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
