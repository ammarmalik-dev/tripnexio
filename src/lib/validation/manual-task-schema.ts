import { z } from "zod";
import { TaskPriority, type TaskPriority as TaskPriorityType } from "../../generated/prisma/enums";

const taskPriorityValues = Object.values(TaskPriority) as [TaskPriorityType, ...TaskPriorityType[]];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * P22 item 4 — a staff-created MANUAL task (Tasks page, Lead detail, Booking
 * detail). Shared by `CreateTaskForm` (zodResolver) and `POST /api/tasks`.
 * Optional fields stay plain `string | undefined` on both sides (Input =
 * Output) — an empty string means "not set" and the route normalizes it.
 * `entityType`/`entityId`/`serviceType` are never accepted from the client;
 * the route derives them from `leadId`/`bookingId` (or the creator).
 */
export const createManualTaskSchema = z
  .object({
    title: z.string().trim().min(3, "Enter a task title (at least 3 characters)").max(200, "Keep the title under 200 characters"),
    reason: z.string().trim().max(2000, "Keep the details under 2000 characters").optional(),
    priority: z.enum(taskPriorityValues, { error: "Select a priority" }),
    dueDate: z
      .string()
      .trim()
      .refine((value) => value === "" || (ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))), "Enter a valid date")
      .optional(),
    assignedToId: z.string().trim().optional(),
    leadId: z.string().trim().optional(),
    bookingId: z.string().trim().optional(),
  })
  .refine((data) => !(data.leadId && data.bookingId), {
    message: "Link a task to a lead or a booking, not both",
    path: ["bookingId"],
  });

export type CreateManualTaskValues = z.infer<typeof createManualTaskSchema>;
