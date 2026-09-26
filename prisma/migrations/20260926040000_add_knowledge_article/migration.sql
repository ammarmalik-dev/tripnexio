-- Item 14 (client-message/PENDING_WORK_PROMPTS.md): the CRM's internal
-- Knowledge Centre (SOPs, staff FAQ, training material) — client-scoped as
-- all three combined into one module.
CREATE TYPE "KnowledgeArticleCategory" AS ENUM ('SOP', 'STAFF_FAQ', 'TRAINING');

CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "KnowledgeArticleCategory" NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" TEXT[],
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeArticle_category_idx" ON "KnowledgeArticle"("category");

CREATE INDEX "KnowledgeArticle_active_idx" ON "KnowledgeArticle"("active");
