import { z } from "zod";

/** Admin → Legal Pages save. Shared by the API route and the editor. */
export const legalPageSchema = z.object({
  title: z.string().trim().min(3, "Enter the page title").max(160, "Too long"),
  eyebrow: z
    .string()
    .trim()
    .max(60, "Too long")
    .transform((value) => (value === "" ? null : value)),
  intro: z.string().trim().min(10, "Enter a short introduction").max(1000, "Too long"),
  effectiveDate: z
    .string()
    .trim()
    .max(40, "Too long")
    .transform((value) => (value === "" ? null : value)),
  showReviewNotice: z.boolean(),
  body: z.string().trim().min(20, "The page needs some content").max(60000, "Too long"),
});

export type LegalPageValues = z.infer<typeof legalPageSchema>;
