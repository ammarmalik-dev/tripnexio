-- CreateTable
CREATE TABLE "StaffLeave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffLeave_userId_idx" ON "StaffLeave"("userId");

-- CreateIndex
CREATE INDEX "StaffLeave_startDate_idx" ON "StaffLeave"("startDate");

-- CreateIndex
CREATE INDEX "StaffLeave_endDate_idx" ON "StaffLeave"("endDate");

-- AddForeignKey
ALTER TABLE "StaffLeave" ADD CONSTRAINT "StaffLeave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
