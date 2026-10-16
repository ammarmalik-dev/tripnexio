-- Client doc 2026-10-15 (J3) — editable photo and wording for the home and service pages.
CREATE TABLE "SitePageContent" (
    "page" TEXT NOT NULL,
    "heroImageFileId" TEXT,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SitePageContent_pkey" PRIMARY KEY ("page")
);
