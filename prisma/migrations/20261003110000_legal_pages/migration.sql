-- CreateTable
CREATE TABLE "LegalPage" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eyebrow" TEXT,
    "intro" TEXT NOT NULL,
    "effectiveDate" TEXT,
    "showReviewNotice" BOOLEAN NOT NULL DEFAULT true,
    "body" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalPage_pkey" PRIMARY KEY ("slug")
);

