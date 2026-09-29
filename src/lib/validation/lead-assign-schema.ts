import { z } from "zod";

/** P22 item 8 — ADMIN.md §13 "Manual reassignment should record a reason." */
export const REASSIGN_REASON_MIN_LENGTH = 5;

/**
 * `reason` is optional at the schema level because claiming an unassigned
 * lead needs none — PATCH /api/leads/[id]/assign requires it (min 5 chars)
 * whenever the lead already has an assignee (a reassignment or unassignment).
 */
export const assignLeadSchema = z.object({
  staffId: z.string().min(1).nullable(),
  reason: z
    .string()
    .trim()
    .max(500, "Keep the reason under 500 characters")
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type AssignLeadValues = z.infer<typeof assignLeadSchema>;
