import { z } from "zod";
import { TaskPriority, type TaskPriority as TaskPriorityType } from "../../generated/prisma/enums";

const taskPriorityValues = Object.values(TaskPriority) as [TaskPriorityType, ...TaskPriorityType[]];

/** P22 item 2 — CRM Help page "Report an issue" form, shared by the form and `POST /api/crm/support-requests`. */
export const supportRequestSchema = z.object({
  title: z.string().trim().min(3, "Summarise the issue (at least 3 characters)").max(200, "Keep the summary under 200 characters"),
  description: z.string().trim().min(10, "Describe what happened (at least 10 characters)").max(4000, "Keep the description under 4000 characters"),
  /** The CRM page/URL the issue is about — free text, optional. */
  pageUrl: z.string().trim().max(500, "Keep the page/URL under 500 characters").optional(),
  priority: z.enum(taskPriorityValues, { error: "Select a priority" }),
});

export type SupportRequestValues = z.infer<typeof supportRequestSchema>;
