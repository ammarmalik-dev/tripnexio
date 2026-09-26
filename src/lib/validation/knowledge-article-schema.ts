import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { KnowledgeArticleCategory, type KnowledgeArticleCategory as KnowledgeArticleCategoryType } from "../../generated/prisma/enums";

const categoryValues = Object.values(KnowledgeArticleCategory) as [KnowledgeArticleCategoryType, ...KnowledgeArticleCategoryType[]];

export const createKnowledgeArticleSchema = z.object({
  title: z.string().trim().min(4, "Enter a title"),
  category: z.enum(categoryValues),
  content: z.string().trim().min(4, "Enter the article content"),
  keywords: z.array(z.string().trim().min(1)).default([]),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateKnowledgeArticleSchema = partialUpdateSchema(createKnowledgeArticleSchema);

export type CreateKnowledgeArticleValues = z.infer<typeof createKnowledgeArticleSchema>;
export type UpdateKnowledgeArticleValues = z.infer<typeof updateKnowledgeArticleSchema>;
