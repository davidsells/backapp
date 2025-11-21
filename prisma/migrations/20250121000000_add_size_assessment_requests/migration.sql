-- CreateTable
CREATE TABLE "size_assessment_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "total_bytes" BIGINT,
    "total_files" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "size_assessment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "size_assessment_requests_agent_id_status_idx" ON "size_assessment_requests"("agent_id", "status");

-- CreateIndex
CREATE INDEX "size_assessment_requests_created_at_idx" ON "size_assessment_requests"("created_at");
