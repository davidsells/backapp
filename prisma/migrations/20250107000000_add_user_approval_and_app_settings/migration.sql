-- AlterTable
ALTER TABLE "users" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "registration_enabled" BOOLEAN NOT NULL DEFAULT false,
    "require_approval" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- Insert default settings row
INSERT INTO "app_settings" ("id", "registration_enabled", "require_approval", "created_at", "updated_at")
VALUES ('default', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
