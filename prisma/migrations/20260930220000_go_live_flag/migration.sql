-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "goLiveMarkedAt" TIMESTAMP(3),
ADD COLUMN     "goLiveMarkedById" TEXT,
ADD COLUMN     "goLiveReady" BOOLEAN NOT NULL DEFAULT false;

